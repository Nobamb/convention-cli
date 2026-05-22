# Z. OAuth PKCE State Agent 테스트 계획

## 테스트 목표

OAuth PKCE State Agent의 테스트 목표는 OAuth 인증 시작부터 callback 검증까지의 보안 조건을 확인하는 것이다. 특히 `code_verifier`, `code_challenge`, `state` 생성 품질과 state mismatch 시 token 요청 차단 여부를 검증한다.

테스트는 실제 외부 OAuth provider를 호출하지 않고, provider 설정과 token 요청 함수를 mock 처리한다.

## 격리 원칙

- 실제 사용자 credentials 파일을 읽거나 쓰지 않는다.
- 실제 OAuth token을 발급하지 않는다.
- 실제 브라우저 인증이 필요한 테스트는 unit test에서 수행하지 않는다.
- token endpoint, callback request, logger는 mock으로 대체한다.
- 로그 검증 시 secret 원문이 출력되지 않는지만 확인하고, secret 값을 화면에 표시하지 않는다.

## `code_verifier` 생성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 기본 생성 | `generateCodeVerifier()` 1회 호출 | 문자열을 반환한다. |
| 길이 검증 | 생성된 verifier 길이 측정 | 43자 이상 128자 이하이다. |
| 문자 형식 검증 | verifier를 정규식으로 검사 | `A-Z`, `a-z`, `0-9`, `-`, `_`, `.`, `~` 외 문자가 없다. |
| 엔트로피 검증 | verifier를 100회 이상 생성 | 모두 같지 않고 중복이 없어야 한다. |
| 예측 가능 값 방지 | 연속 호출 결과 비교 | timestamp나 provider 이름처럼 반복 가능한 패턴이 보이지 않아야 한다. |

권장 단위 테스트:

```js
const verifier = generateCodeVerifier();
expect(verifier.length).toBeGreaterThanOrEqual(43);
expect(verifier.length).toBeLessThanOrEqual(128);
expect(verifier).toMatch(/^[A-Za-z0-9._~-]+$/);
```

## `code_challenge` 파생 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| S256 challenge 생성 | 고정 verifier 입력 | SHA-256 base64url 결과와 일치한다. |
| padding 제거 | challenge 문자열 검사 | `=` 문자가 포함되지 않는다. |
| base64url 형식 | challenge 문자열 검사 | `+`, `/` 문자가 포함되지 않는다. |
| 결정성 검증 | 같은 verifier로 2회 생성 | 같은 challenge를 반환한다. |
| 입력 차이 검증 | 서로 다른 verifier 입력 | 서로 다른 challenge를 반환한다. |
| 빈 입력 방지 | 빈 문자열 입력 | 명확한 오류를 던지거나 실패 처리한다. |

권장 검증 방식:

- Node.js `crypto.createHash("sha256")`로 별도 expected 값을 계산한다.
- `code_challenge_method`가 authorization URL에 `S256`으로 들어가는지 확인한다.

## `state` 생성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 기본 생성 | `generateState()` 1회 호출 | 비어 있지 않은 문자열을 반환한다. |
| 형식 검증 | state 문자열 검사 | base64url 안전 문자만 포함한다. |
| 유일성 검증 | state를 100회 이상 생성 | 중복이 없어야 한다. |
| OAuth 시작별 신규 생성 | `startOAuthFlow()`를 여러 번 호출 | 각 OAuth session마다 다른 state가 저장된다. |
| 원문 로그 방지 | logger mock 사용 | state 원문이 로그에 포함되지 않는다. |

## State 검증 테스트

| 케이스 | expected state | received state | 기대 결과 |
| --- | --- | --- | --- |
| 정상 일치 | `abc` | `abc` | 검증 성공 |
| 불일치 | `abc` | `xyz` | 검증 실패 |
| callback state 없음 | `abc` | 없음 | 검증 실패 |
| 저장 state 없음 | 없음 | `abc` | 검증 실패 |
| 길이 다름 | `abc` | `abcd` | 검증 실패 |
| 둘 다 없음 | 없음 | 없음 | 검증 실패 |

추가 확인:

- state 검증 실패 시 오류 메시지에 expected/received 원문이 포함되지 않는다.
- 검증 실패 이후 OAuth session이 재사용되지 않도록 폐기되는지 확인한다.

## State mismatch token 요청 차단 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| state 불일치 callback | 저장 state와 다른 callback state 전달 | token 요청 함수가 호출되지 않는다. |
| state 누락 callback | callback query에 state 없음 | token 요청 함수가 호출되지 않는다. |
| 저장 state 누락 | OAuth session에 state 없음 | token 요청 함수가 호출되지 않는다. |
| 정상 state | 저장 state와 callback state 일치 | token 요청 함수가 1회 호출된다. |
| 정상 state의 token 요청 payload | 정상 callback 처리 | token 요청에 `code_verifier`가 포함된다. |

권장 mock 검증:

```js
expect(requestToken).not.toHaveBeenCalled();
```

정상 케이스에서는 다음만 확인한다.

- token 요청이 호출된다.
- `code_verifier`가 payload에 포함된다.
- 로그에 `code_verifier` 원문은 출력되지 않는다.

## Authorization URL 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| PKCE 파라미터 포함 | OAuth 시작 | URL에 `code_challenge`가 포함된다. |
| S256 method 포함 | OAuth 시작 | URL에 `code_challenge_method=S256`이 포함된다. |
| state 포함 | OAuth 시작 | URL에 `state`가 포함된다. |
| verifier 미포함 | OAuth 시작 | URL에 `code_verifier`는 포함되지 않는다. |
| secret 미포함 | OAuth 시작 | URL에 client secret, token 값이 포함되지 않는다. |

## 로그 redaction 테스트

| 민감값 | 테스트 입력 | 기대 결과 |
| --- | --- | --- |
| code verifier | verifier를 포함한 내부 오류 mock | 로그에 원문이 없다. |
| code challenge | authorization URL 생성 로그 mock | 로그에 원문이 없다. |
| state | callback mismatch 오류 mock | expected/received state 원문이 없다. |
| authorization code | callback query mock | code 원문이 없다. |
| access token | token 응답 mock | token 원문이 없다. |
| refresh token | token 응답 mock | token 원문이 없다. |
| client secret | provider 설정 mock | secret 원문이 없다. |

허용 출력:

- `[REDACTED]`
- provider 이름
- callback path
- 실패 유형 요약

금지 출력:

- callback URL 전체
- query string 전체
- OAuth token endpoint 응답 원문
- credentials 파일 내용

## 통합 흐름 테스트

| 케이스 | 단계 | 기대 결과 |
| --- | --- | --- |
| 정상 OAuth callback | OAuth 시작 후 같은 state로 callback 처리 | token 요청까지 진행된다. |
| 변조된 callback | OAuth 시작 후 다른 state로 callback 처리 | 인증 실패 메시지를 출력하고 token 요청을 차단한다. |
| 재사용 callback | 같은 state/code로 callback 2회 처리 | 두 번째 요청은 실패하거나 session 없음으로 차단된다. |
| provider token 실패 | state는 정상, token endpoint mock 실패 | secret 없이 요약 오류만 출력한다. |

## 완료 기준

- verifier 엔트로피와 형식 테스트가 통과한다.
- challenge 파생 값이 SHA-256 base64url 규칙과 일치한다.
- state가 OAuth 요청마다 유일하게 생성된다.
- state mismatch, state 누락, session state 누락 시 token 요청이 호출되지 않는다.
- 정상 state일 때만 token 요청이 호출되고 `code_verifier`가 포함된다.
- 로그에 PKCE/state/token 관련 민감값이 출력되지 않는다.
