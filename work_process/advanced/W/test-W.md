# W. OAuth Architecture Agent 테스트 계획

## 테스트 목표

OAuth 공통 구조가 provider별 구현을 확장 가능하게 분리하고, token 저장과 로그 보안 규칙을 지키는지 확인한다.

대상 파일은 다음과 같다.

- `src/auth/oauth.js`
- `src/auth/oauthProviders.js`
- `src/config/store.js`

W 단계 테스트는 실제 브라우저 로그인이나 외부 OAuth provider 호출을 기본으로 하지 않는다. 네트워크 호출은 mock 처리하고, token 저장은 격리된 임시 config 디렉터리 또는 mock store에서 검증한다.

## Provider 구조 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 지원 provider 조회 | `getOAuthProvider("github")` 같은 지원 provider 요청 | provider metadata를 반환한다. |
| provider metadata 필수 필드 | provider 정의 확인 | `authorizationEndpoint`, `tokenEndpoint`, `scopes`, `supportsPKCE`, `supportsRefresh`가 존재한다. |
| 지원하지 않는 provider | `getOAuthProvider("unknown")` 요청 | 명확한 오류를 던지고 mock provider로 fallback하지 않는다. |
| provider 이름 분리 | 여러 provider metadata 정의 | provider별 설정이 서로 덮어쓰이지 않는다. |
| runtime 로직 분리 | `oauthProviders.js` import 검사 | token 저장, callback server, refresh 실행 로직이 provider metadata 파일에 섞이지 않는다. |

## Authorization URL 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 기본 URL 생성 | provider, redirectUri, state, codeChallenge 입력 | authorization endpoint 기반 URL을 반환한다. |
| state 포함 | state 입력 | URL query에 동일한 state가 포함된다. |
| PKCE 포함 | `supportsPKCE: true` provider | `code_challenge`와 `code_challenge_method=S256`이 포함된다. |
| PKCE 미지원 provider | `supportsPKCE: false` provider | PKCE 파라미터 없이 URL을 생성하거나 명확한 정책에 따라 처리한다. |
| scope 병합 | 기본 scope와 추가 scope 입력 | 중복 없는 scope 문자열이 생성된다. |
| URL logging 제한 | logger mock 사용 | token, code, state 전체값, client secret이 출력되지 않는다. |

## Callback 처리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 callback | `code`와 일치하는 `state` 포함 | state 검증 후 token 교환 함수가 호출된다. |
| state 불일치 | callback state와 expected state가 다름 | token 교환 함수가 호출되지 않고 보안 오류로 중단한다. |
| code 누락 | callback URL에 `code` 없음 | token 저장 없이 명확한 오류를 반환한다. |
| provider error 반환 | callback URL에 `error=access_denied` 포함 | token 교환 없이 사용자 취소 또는 provider 오류로 처리한다. |
| raw callback 보호 | callback URL에 민감 query 포함 | 전체 callback URL을 로그에 출력하지 않는다. |
| timeout 처리 | callback timeout mock | token 저장 없이 안전하게 종료한다. |

## Token 저장 경계 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| token 저장 | tokenSet 입력 후 `saveOAuthTokens()` 호출 | `credentials.json` 계층에 provider별로 저장된다. |
| config 저장 금지 | tokenSet 저장 후 config mock 확인 | `config.json`에 `accessToken`, `refreshToken`, `idToken`, `authorizationCode`, `clientSecret`이 저장되지 않는다. |
| provider별 분리 저장 | github와 antigravity tokenSet 저장 | 각 provider token이 `credentials.oauth.<provider>` 아래에 분리된다. |
| 기존 credentials 보존 | API Key credentials가 이미 있음 | OAuth token 저장이 기존 API Key 항목을 덮어쓰지 않는다. |
| token metadata 저장 | `expiresAt`, `scope`, `tokenType` 포함 | secret이 아닌 metadata가 tokenSet과 함께 credentials 계층에 저장된다. |
| 저장 실패 | credentials 쓰기 실패 mock | token 원문 없이 권한 또는 저장 실패 요약만 출력한다. |

## Refresh 구조 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 만료 전 token | `expiresAt`이 미래 | refresh 요청을 호출하지 않는다. |
| 만료 token과 refresh token 존재 | `expiresAt`이 과거, refresh token 있음 | refresh token 요청 후 새 tokenSet을 credentials에 저장한다. |
| refresh token 없음 | 만료 token만 존재 | 재로그인 필요 오류를 반환하고 mock fallback하지 않는다. |
| refresh 미지원 provider | `supportsRefresh: false` | refresh 요청 없이 재로그인 필요 상태를 반환한다. |
| refresh 실패 | token endpoint 실패 mock | raw token 또는 provider 응답 원문 없이 실패를 요약한다. |
| refresh 저장 경계 | refresh 성공 후 config 확인 | 새 access token도 `config.json`에 저장되지 않는다. |

## Architecture Boundary 테스트

`oauth.js`와 `oauthProviders.js`의 책임 경계를 다음 기준으로 확인한다.

| 경계 | 기대 결과 |
| --- | --- |
| provider metadata | `oauthProviders.js`에만 provider별 endpoint/scope/client 정책이 있다. |
| authorization URL 생성 | `oauth.js`의 공통 함수가 provider metadata를 받아 생성한다. |
| callback parsing | `oauth.js` 또는 callback 전용 모듈에서 처리하고 provider metadata 파일에 넣지 않는다. |
| token persistence | `src/config/store.js` credentials 함수로만 위임한다. |
| refresh | callback 처리 함수와 별도 함수로 분리된다. |
| provider integration | 실제 AI provider 호출 연결은 AC 단계로 남기고 W 단계 구조에 섞지 않는다. |

## No Config Token Storage 테스트

다음 문자열이 `config.json` 저장 결과에 포함되지 않는지 확인한다.

- `accessToken`
- `refreshToken`
- `idToken`
- `authorizationCode`
- `clientSecret`
- `oauthToken`
- 실제 token fixture 값

권장 테스트 방식:

1. 임시 config 디렉터리 생성
2. OAuth tokenSet 저장 함수 호출
3. `config.json`과 `credentials.json`을 각각 읽음
4. `config.json`에는 secret key와 fixture token 값이 없음을 확인
5. `credentials.json`에는 provider별 tokenSet이 저장되었음을 확인

## No Token Logging 테스트

logger mock 또는 stdout/stderr capture로 다음 값이 출력되지 않는지 확인한다.

- access token fixture 값
- refresh token fixture 값
- id token fixture 값
- authorization code fixture 값
- client secret fixture 값
- callback URL 전체 query
- credentials 파일 원문

테스트 대상 흐름:

- authorization URL 생성
- callback 처리 성공
- state 검증 실패
- token 교환 실패
- token 저장 실패
- refresh 성공
- refresh 실패

기대 결과는 모든 로그에서 secret 원문이 없고, 필요한 경우 `[REDACTED]` 또는 secret 없는 요약만 표시되는 것이다.

## Unsupported OAuth Provider 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 알 수 없는 provider로 OAuth 시작 | `startOAuthFlow({ provider: "unknown" })` | 지원하지 않는 provider 오류로 중단한다. |
| 알 수 없는 provider URL 생성 | `buildAuthorizationUrl()`에 unknown provider 전달 | URL을 만들지 않고 오류를 반환한다. |
| 알 수 없는 provider token 저장 | `saveOAuthTokens({ provider: "unknown" })` | 저장을 차단하고 지원하지 않는 provider 오류로 실패한다. |
| provider routing fallback 검사 | mock provider spy 설정 | unsupported OAuth provider 처리 중 mock provider가 호출되지 않는다. |
| 오류 메시지 검사 | unknown provider 오류 capture | token, credentials 원문 없이 지원 provider 목록 또는 원인만 표시한다. |

## 보안 회귀 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| credentials 파일 존재 | 파일 내용을 그대로 출력하지 않는다. |
| `.env` 존재 | OAuth 설정 흐름이 `.env` 내용을 읽거나 출력하지 않는다. |
| token endpoint 오류 응답에 secret 포함 | 오류 출력에서 secret을 제거한다. |
| state 검증 실패 | token 교환과 token 저장이 모두 발생하지 않는다. |
| refresh 실패 | 기존 refresh token 원문이 출력되지 않는다. |
| 외부 네트워크 mock 실패 | commit flow, git add, git commit, git push가 실행되지 않는다. |

## 격리 원칙

- 테스트는 실제 사용자 `~/.config/convention`을 사용하지 않는다.
- 실제 OAuth provider에 네트워크 요청을 보내지 않는다.
- 실제 브라우저 로그인을 요구하지 않는다.
- 실제 사용자 Git 저장소에서 commit, push, reset을 수행하지 않는다.
- Git 관련 확인이 필요하면 `fixtures/test-repo` 또는 임시 테스트 저장소를 사용한다.
- token fixture는 테스트 전용 더미 문자열만 사용한다.

## 완료 기준

- provider별 OAuth metadata 구조가 검증된다.
- authorization URL 생성이 state와 PKCE 정책을 반영한다.
- callback state 검증 실패 시 token 교환이 차단된다.
- OAuth token은 credentials 계층에만 저장된다.
- `config.json`에 token이나 raw secret이 저장되지 않는다.
- 로그에 token, raw secret, callback URL 전체, credentials 원문이 노출되지 않는다.
- unsupported OAuth provider는 명확한 오류로 중단하고 mock fallback하지 않는다.
