# AC. OAuth Provider Integration Agent 테스트 계획

## 테스트 목표

`authType`이 `oauth`일 때 provider routing이 OAuth token을 안전하게 사용하고, 만료 refresh와 인증 실패 처리를 올바르게 수행하는지 확인한다.

중점 검증 항목은 다음과 같다.

- OAuth token 로드
- `Authorization` header 구성
- token 만료 시 refresh 경로
- provider 인증 실패 처리
- API Key 방식과 OAuth 방식 분리
- token/API Key 로그 노출 방지
- OAuth 미지원 provider 오류

## Provider Routing 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| OAuth provider 호출 | `config.provider: "antigravity"`, `authType: "oauth"` | provider routing이 OAuth auth resolver를 호출한다. |
| API Key provider 호출 | `config.provider: "antigravity"`, `authType: "api"` | OAuth token을 읽지 않고 API Key resolver만 사용한다. |
| 인증 없는 provider 호출 | `config.provider: "localLLM"`, `authType: "none"` | OAuth/API Key credential을 읽지 않는다. |
| provider 누락 | `authType: "oauth"`, `provider: null` | 명확한 provider 설정 오류로 중단한다. |
| 알 수 없는 provider | `provider: "unknown"`, `authType: "oauth"` | mock fallback 없이 지원하지 않는 provider 오류를 반환한다. |

## OAuth Header 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 access token | credentials에 만료되지 않은 access token 저장 | provider 요청에 `Authorization: Bearer <token>` header가 전달된다. |
| provider 함수 전달 | provider mock으로 headers 인자 캡처 | header가 provider 구현까지 전달된다. |
| header 중복 방지 | API Key credential도 함께 존재 | OAuth 요청에는 API Key header가 포함되지 않는다. |
| header 미출력 | logger mock으로 출력 캡처 | `Bearer`, access token 원문, `Authorization` 원문이 출력되지 않는다. |

## Expired Refresh Path 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 만료된 access token | `expiresAt`이 과거, refresh token 존재 | provider 호출 전 refresh 함수가 호출된다. |
| refresh 성공 | refresh mock이 새 access token 반환 | 새 token이 저장되고 새 token으로 Authorization header가 구성된다. |
| refresh 후 provider 호출 | refresh 성공 후 provider mock 호출 | provider에는 이전 access token이 아니라 새 access token이 전달된다. |
| refresh token 없음 | access token 만료, refresh token 없음 | provider 호출 없이 재로그인 필요 오류를 반환한다. |
| refresh 실패 | refresh mock이 실패 반환 또는 throw | token 원문 없이 재로그인 안내를 출력하고 provider 호출을 중단한다. |

## 인증 실패 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| provider 401 응답 | provider mock이 401 반환 | OAuth 인증 실패로 분류하고 재로그인 안내를 출력한다. |
| provider 403 응답 | provider mock이 403 반환 | 권한 또는 인증 실패로 분류하고 token 원문 없이 중단한다. |
| refresh 후 401 | 만료 token refresh 성공 후 provider가 401 반환 | 추가 fallback 없이 재로그인 안내로 종료한다. |
| provider 오류 body에 secret 포함 | mock response body에 token 유사 문자열 포함 | body 원문을 출력하지 않는다. |
| 인증 실패 후 mock fallback 여부 | provider 401 발생 | mock provider로 fallback하지 않는다. |

## API Key와 OAuth 분리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| API Key와 OAuth token 동시 존재 | credentials에 `apiKeys.antigravity`, `oauth.antigravity` 모두 존재 | `authType: "oauth"`이면 OAuth token만 사용한다. |
| API Key 방식 실행 | 같은 credentials에서 `authType: "api"` | OAuth token을 읽거나 refresh하지 않는다. |
| OAuth 방식 실행 | 같은 credentials에서 `authType: "oauth"` | API Key를 읽거나 API Key header를 만들지 않는다. |
| OAuth 설정 저장 후 API Key 보존 | OAuth token 갱신 발생 | 기존 API Key 값이 삭제되거나 덮어써지지 않는다. |
| API Key 설정 후 OAuth 보존 | API Key 저장 flow mock | 기존 OAuth token 값이 삭제되거나 덮어써지지 않는다. |
| provider별 분리 | `antigravity`와 `github-copilot` token 모두 존재 | 현재 provider의 token만 사용하고 다른 provider token은 사용하지 않는다. |

## No Token Logging 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 OAuth 호출 | access token 값이 `test-access-token-123` | stdout/stderr/logger 출력에 token 원문이 없다. |
| refresh 성공 | 새 token 값이 `new-access-token-456` | 새 token 원문이 출력되지 않는다. |
| refresh 실패 | refresh token 값이 `refresh-token-789` | refresh token 원문이 출력되지 않는다. |
| Authorization header 오류 | provider 요청 실패 | `Authorization: Bearer ...` 전체가 출력되지 않는다. |
| credentials parse 오류 | credentials 파일 mock이 깨진 JSON | credentials 파일 원문을 출력하지 않는다. |
| API Key 동시 존재 | API Key 값이 `api-key-secret-000` | OAuth 실행 로그에 API Key 원문이 없다. |

## Unsupported Provider Error 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| `mock` + `oauth` | `provider: "mock"`, `authType: "oauth"` | OAuth 미지원 provider 오류로 중단한다. |
| `localLLM` + `oauth` | `provider: "localLLM"`, `authType: "oauth"` | OAuth 미지원 provider 오류로 중단한다. |
| 알 수 없는 provider | `provider: "unknown"`, `authType: "oauth"` | 지원하지 않는 provider 오류로 중단한다. |
| provider OAuth 설정 없음 | provider는 존재하지만 OAuth config 없음 | OAuth 설정 누락 오류를 출력한다. |
| 오류 후 fallback 확인 | 위 오류 케이스 공통 | mock fallback, API Key fallback, commit flow 자동 진행이 발생하지 않는다. |

## Provider별 요청 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| Antigravity OAuth 요청 | `provider: "antigravity"`, OAuth token 존재 | Antigravity provider mock이 OAuth header를 받는다. |
| GitHub Copilot OAuth 요청 | `provider: "github-copilot"`, OAuth token 존재 | GitHub Copilot provider mock이 OAuth header를 받는다. |
| listModels OAuth 요청 | `listProviderModels(config)` 호출 | 모델 목록 요청에도 OAuth header가 적용된다. |
| generate OAuth 요청 | `generateWithProvider({ prompt, config })` 호출 | 커밋 메시지 생성 요청에도 OAuth header가 적용된다. |

## 보안 Gate 유지 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 민감 diff 감지 | diff에 `API_KEY=` 포함 | OAuth provider 호출 전 기존 보안 gate가 유지된다. |
| 외부 전송 확인 필요 | cloud provider OAuth 사용 | 사용자 확인 또는 설정 정책 없이 diff를 전송하지 않는다. |
| 인증 오류 후 commit 여부 | OAuth 인증 실패 | `git add`, `git commit`, `git push`가 호출되지 않는다. |
| reset/push와 무관성 | OAuth 실패 상황 | reset 또는 push가 자동 실행되지 않는다. |

## 권장 Mock 방식

테스트에서는 실제 OAuth server나 실제 외부 provider를 호출하지 않는다.

- `loadCredentials()`는 provider별 fixture credentials를 반환하도록 mock 처리한다.
- `refreshAccessToken()`은 성공/실패 케이스별로 mock 처리한다.
- provider의 `generateCommitMessage()`와 `listModels()`는 전달받은 headers를 캡처한다.
- logger는 stdout/stderr 출력을 캡처해 secret 원문 포함 여부를 검사한다.
- Git wrapper는 mock 처리하고 호출 횟수가 0인지 확인한다.

## 확인 명령 후보

실제 테스트 파일이 구현된 뒤에는 다음 명령을 기준으로 확인한다.

```bash
npm test
node bin/convention.js --model antigravity oauth
node bin/convention.js --model github-copilot oauth
```

외부 네트워크 호출은 unit test에서 mock 처리한다. 실제 provider 호출이 필요한 통합 확인은 별도 opt-in 테스트로 분리한다.

## 완료 기준

- OAuth 방식 provider 호출에 `Authorization` header가 전달된다.
- 만료 token은 refresh 후 새 token으로 요청된다.
- refresh 실패와 401/403 인증 실패는 token 원문 없이 안전하게 처리된다.
- API Key 방식과 OAuth 방식이 서로 credential을 오염시키지 않는다.
- token, API Key, Authorization header 원문이 로그에 출력되지 않는다.
- OAuth 미지원 provider는 명확한 오류로 중단하고 mock fallback하지 않는다.
