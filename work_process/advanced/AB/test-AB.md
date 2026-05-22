# AB. OAuth Refresh Agent 테스트 계획

## 테스트 목표

OAuth access token 만료 확인, refresh token 확인, refresh 요청, 새 token 저장, 실패 시 재로그인 안내가 안전하게 동작하는지 검증한다. 특히 실패 메시지와 로그에 access token, refresh token, raw response body가 출력되지 않는지 확인한다.

테스트는 unit test 중심으로 작성하고 외부 네트워크 호출은 모두 mock 처리한다.

## Token 만료 여부 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 만료되지 않은 token | `expiresAt`이 현재 시각보다 충분히 미래 | refresh 요청을 보내지 않고 기존 access token을 반환한다. |
| 만료된 token | `expiresAt`이 현재 시각보다 과거 | refresh token 존재 여부를 확인한 뒤 refresh 요청으로 진행한다. |
| 만료 60초 이내 token | `expiresAt`이 현재 시각 기준 60초 이내 | clock skew 보호를 위해 만료된 것으로 처리한다. |
| 만료 시각 없음 | token record에 `expiresAt` 없음 | 만료된 것으로 처리하고 refresh 대상으로 분기한다. |
| token record 없음 | provider credentials가 없음 | refresh 요청 없이 재로그인 필요 오류를 반환한다. |

## Refresh Token 존재 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| refresh token 존재 | provider token record에 `refreshToken` 존재 | token endpoint refresh 요청을 수행한다. |
| refresh token 없음 | `accessToken`만 있고 `refreshToken` 없음 | refresh 요청을 보내지 않고 재로그인 안내를 출력한다. |
| refresh token 빈 문자열 | `refreshToken: ""` | refresh token 없음과 동일하게 처리한다. |
| 다른 provider token만 존재 | `oauth.gemini`만 있고 요청 provider는 `github-copilot` | 요청 provider의 refresh token 없음으로 처리한다. |

## Refresh 요청 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 refresh 요청 | 만료된 token과 refresh token, provider token endpoint mock | `grant_type=refresh_token` 요청이 전송된다. |
| provider 설정 없음 | OAuth provider config에 token endpoint 없음 | 네트워크 요청 없이 명확한 설정 오류를 반환한다. |
| 네트워크 실패 | fetch 또는 HTTP client mock이 reject | 안전한 갱신 실패 메시지를 출력하고 token 원문을 출력하지 않는다. |
| 401 응답 | token endpoint가 401 반환 | 재로그인 안내를 출력한다. |
| 500 응답 | token endpoint가 500 반환 | provider 갱신 실패로 요약하고 raw body를 출력하지 않는다. |
| JSON parse 실패 | token endpoint 응답이 깨진 JSON | 응답 처리 실패로 요약하고 raw body를 출력하지 않는다. |

## 성공 시 저장 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 새 access token 저장 | 응답에 `access_token`, `expires_in` 포함 | credentials provider 영역에 새 access token과 새 `expiresAt`이 저장된다. |
| 새 refresh token 교체 | 응답에 `refresh_token` 포함 | 기존 refresh token이 새 refresh token으로 교체된다. |
| refresh token 미포함 응답 | 응답에 `refresh_token` 없음 | 기존 refresh token을 유지한다. |
| 다른 provider 보존 | credentials에 여러 provider token 존재 | 갱신 대상 provider 외 token은 변경되지 않는다. |
| 저장 성공 메시지 | refresh 성공 후 로그 확인 | token 값 없이 갱신 성공 여부만 출력한다. |

## 실패 메시지 안전성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| refresh token 없음 | token record에 refresh token 없음 | `convention --model <provider> oauth` 재로그인 안내가 출력되고 token 원문은 없다. |
| provider 401 raw body에 token 포함 | mock body에 `access_token`, `refresh_token` 문자열 포함 | 사용자 출력과 logger 출력에 raw body가 포함되지 않는다. |
| 네트워크 오류 메시지에 token 포함 | mock Error message에 token 형태 문자열 포함 | logger redaction 또는 안전한 오류 wrapping으로 token이 출력되지 않는다. |
| 저장 실패 | `saveCredentials()` mock이 throw | credentials 원문 없이 저장 실패만 요약한다. |
| refresh 실패 후 provider 호출 | refresh 실패 상황에서 AI provider 호출 spy | provider API 호출이 실행되지 않는다. |

## Network Mock 테스트

모든 token endpoint 호출은 실제 네트워크를 사용하지 않는다.

확인 항목:

- HTTP client 또는 `fetch`를 mock 처리한다.
- 정상 응답, 400, 401, 500, timeout, reject를 각각 재현한다.
- request body 검증은 mock 내부에서만 수행하고 로그로 출력하지 않는다.
- test fixture에 실제 token을 넣지 않고 `test-access-token`, `test-refresh-token` 같은 가짜 값을 사용한다.
- CI 환경에서도 외부 OAuth provider에 접속하지 않는다.

## Raw Body 및 Token Logging 금지 테스트

다음 문자열이 stdout, stderr, logger mock 호출 인자에 포함되지 않는지 확인한다.

- `test-access-token`
- `test-refresh-token`
- `access_token`
- `refresh_token`
- `Authorization: Bearer`
- raw token endpoint response body
- raw credentials JSON

권장 검증 방식:

```js
expect(output).not.toContain("test-access-token");
expect(output).not.toContain("test-refresh-token");
expect(output).not.toContain("Authorization: Bearer");
```

민감 키 이름 자체를 오류 요약에 표시해야 하는 경우에도 값은 반드시 `[REDACTED]`로 마스킹되어야 한다.

## `core/ai.js` 연결 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| OAuth token 유효 | `authType: "oauth"`, token 미만료 | refresh 없이 provider 호출에 유효 token이 전달된다. |
| OAuth token 만료 | token 만료, refresh 성공 mock | refresh 후 새 access token으로 provider 호출이 진행된다. |
| OAuth refresh 실패 | token 만료, refresh 실패 mock | provider 호출이 중단되고 재로그인 안내가 출력된다. |
| API key provider | `authType: "api"` | OAuth refresh 함수가 호출되지 않는다. |
| none provider | `authType: "none"` | OAuth refresh 함수가 호출되지 않는다. |

## 격리 원칙

- 실제 사용자 `~/.config/convention/credentials.json`을 읽거나 쓰지 않는다.
- 테스트용 임시 config directory 또는 mock store를 사용한다.
- 실제 OAuth provider, GitHub, Gemini endpoint에 접속하지 않는다.
- 실제 commit, push, reset은 수행하지 않는다.
- 실패 fixture에도 실제 token이나 private key를 넣지 않는다.

## 완료 기준

- 만료 token과 미만료 token 분기가 테스트된다.
- refresh token 누락 시 안전한 재로그인 안내가 테스트된다.
- refresh 성공 시 새 token 저장과 기존 refresh token 유지/교체가 테스트된다.
- refresh 실패 시 raw body와 token이 출력되지 않는지 테스트된다.
- 네트워크 호출은 모두 mock 처리된다.
- `core/ai.js` provider 호출 전 OAuth refresh 연결이 테스트된다.
