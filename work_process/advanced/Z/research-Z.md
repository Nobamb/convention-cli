# Z. OAuth PKCE State Agent 구현 계획

## 작업 범위

Z 단계는 OAuth 인증 흐름에서 PKCE와 state 검증을 담당한다. 브라우저 로그인 이후 callback으로 받은 authorization code를 token 요청에 사용하기 전에, 요청을 시작할 때 생성한 state와 callback state가 일치하는지 반드시 검증한다.

구현 대상은 다음 파일로 예상한다.

- `src/auth/oauth.js`
- `src/auth/security.js`

이번 문서 작업에서는 실제 코드 파일을 수정하지 않고, Z 단계 구현 계획만 정리한다.

## 선행 조건

Z 단계는 Phase 5의 W, X, Y 작업 결과 위에 연결한다.

- W: OAuth 전체 구조와 `startOAuthFlow()`, `handleCallback()` 흐름
- X: provider별 authorization/token endpoint, client 설정
- Y: localhost callback 서버와 authorization code 수신

Z 단계는 provider 설정을 새로 정의하지 않고, 기존 OAuth 흐름에 보안 파라미터 생성과 검증을 삽입한다.

## 구현 목표

- `code_verifier`를 충분한 엔트로피로 생성한다.
- `code_challenge`를 `code_verifier` 기반 SHA-256 방식으로 생성한다.
- OAuth 요청마다 예측 불가능한 `state`를 생성한다.
- callback 수신 시 저장된 state와 callback state를 비교한다.
- state가 없거나 일치하지 않으면 token 요청을 실행하지 않는다.
- `code_verifier`, `code_challenge`, `state`, authorization code, token 값을 로그에 출력하지 않는다.

## `src/auth/security.js` 계획

OAuth 보안 유틸리티는 provider와 독립적인 순수 함수 중심으로 분리한다.

권장 함수는 다음과 같다.

```js
export function generateCodeVerifier()
export function generateCodeChallenge(codeVerifier)
export function generateState()
export function verifyState(expectedState, receivedState)
```

### `generateCodeVerifier()`

`crypto.randomBytes()`를 사용해 예측 불가능한 랜덤 값을 만든다.

구현 기준:

- Node.js 내장 `crypto`만 사용한다.
- base64url 형식으로 인코딩한다.
- OAuth PKCE 권장 범위에 맞게 43자 이상 128자 이하를 유지한다.
- 허용 문자는 `A-Z`, `a-z`, `0-9`, `-`, `_`, `.`, `~` 범위 안에 둔다.
- 매 호출마다 다른 값을 반환해야 한다.

권장 방식:

1. `crypto.randomBytes(32)` 또는 그 이상으로 랜덤 바이트 생성
2. base64url 문자열로 변환
3. 길이와 문자 형식 검증

### `generateCodeChallenge(codeVerifier)`

`code_challenge_method`는 `S256`을 기본으로 한다.

구현 기준:

- `crypto.createHash("sha256")`로 `code_verifier`를 해시한다.
- 해시 결과를 base64url로 인코딩한다.
- padding 문자 `=`는 포함하지 않는다.
- 입력이 비어 있거나 문자열이 아니면 명확한 오류로 중단한다.

authorization URL에는 다음 값이 포함되어야 한다.

- `code_challenge`
- `code_challenge_method=S256`

### `generateState()`

state는 CSRF 방어 목적의 일회성 랜덤 값이다.

구현 기준:

- `crypto.randomBytes()` 기반으로 생성한다.
- 매 OAuth 시작 시 새로 생성한다.
- 충분한 길이를 가진 base64url 문자열로 반환한다.
- provider 이름, timestamp, 사용자 입력만으로 state를 만들지 않는다.
- state 원문은 로그에 출력하지 않는다.

### `verifyState(expectedState, receivedState)`

callback state 검증은 token 요청보다 먼저 실행한다.

구현 기준:

- expected state가 없으면 실패 처리한다.
- received state가 없으면 실패 처리한다.
- 두 값이 일치하지 않으면 실패 처리한다.
- 비교는 가능하면 `crypto.timingSafeEqual()`을 사용한다.
- 길이가 다르면 즉시 false를 반환하되, 두 state 값을 로그에 남기지 않는다.
- 반환값은 boolean으로 단순화하거나, 호출부에서 안전하게 처리할 수 있는 명확한 오류를 던진다.

## `src/auth/oauth.js` 연결 계획

`startOAuthFlow()`는 authorization URL 생성 전에 PKCE와 state 값을 만든다.

권장 흐름:

1. provider OAuth 설정 로드
2. `generateCodeVerifier()` 호출
3. `generateCodeChallenge(codeVerifier)` 호출
4. `generateState()` 호출
5. callback 검증에 사용할 임시 OAuth session에 `codeVerifier`와 `state` 저장
6. authorization URL에 `state`, `code_challenge`, `code_challenge_method=S256` 추가
7. 브라우저 인증 시작

`handleCallback()` 또는 callback 처리 함수는 token 요청 전에 state를 검증한다.

권장 흐름:

1. callback query에서 `code`와 `state`를 읽는다.
2. OAuth session에서 expected state와 code verifier를 읽는다.
3. `verifyState(expectedState, receivedState)`를 호출한다.
4. 검증 실패 시 OAuth session을 폐기하고 token 요청을 실행하지 않는다.
5. 검증 성공 시 token 요청에 `code_verifier`를 포함한다.
6. token 요청 성공/실패 로그에는 secret 원문을 포함하지 않는다.

## State 불일치 처리

state 검증 실패는 인증 실패로 처리하고, fallback으로 token 요청을 시도하지 않는다.

금지 사항:

- state mismatch 이후 token endpoint 호출
- mock provider 또는 API key 방식으로 조용히 fallback
- callback query 전체 출력
- authorization code, state, code verifier 출력

권장 사용자 메시지:

- "OAuth state 검증에 실패했습니다. 인증을 다시 시작해 주세요."

내부 디버그 로그가 필요하더라도 다음 값은 출력하지 않는다.

- expected state
- received state
- code verifier
- code challenge
- authorization code
- access token
- refresh token

## 민감값 로깅 방지

Z 단계에서 민감값으로 취급할 항목:

- `code_verifier`
- `code_challenge`
- `state`
- callback `code`
- access token
- refresh token
- provider client secret

로그 규칙:

- logger에는 원문 값을 넘기지 않는다.
- 필요 시 `[REDACTED]`만 출력한다.
- 오류 객체에 provider 응답 원문이 포함될 수 있으므로 token endpoint 오류도 요약해서 출력한다.
- callback URL 전체를 출력하지 않는다. 포트, path, provider 이름 정도만 출력한다.

## 완료 기준

- OAuth 시작 시 `code_verifier`, `code_challenge`, `state`가 생성된다.
- authorization URL에 `code_challenge_method=S256`과 `state`가 포함된다.
- callback state가 저장된 state와 일치할 때만 token 요청이 진행된다.
- state가 없거나 다르면 token 요청이 차단된다.
- token 요청에는 원래 생성한 `code_verifier`가 포함된다.
- PKCE/state 관련 민감값이 로그에 출력되지 않는다.
- 기존 API key, localLLM, mock provider 흐름을 변경하지 않는다.
