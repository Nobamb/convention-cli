# AA. OAuth Token Store Agent 테스트 계획

## 테스트 목표

OAuth token 저장소가 `credentials.json`에 provider별로 안전하게 token을 저장하고, `config.json`과 로그에는 secret이 노출되지 않는지 확인한다.

중점 검증 항목은 다음과 같다.

- access token 저장/로드
- refresh token 저장/로드
- expiresAt 저장/로드
- provider별 token 분리
- config.json secret 제외
- 파일 권한 제한 best effort
- token 로그 출력 금지
- 깨진 credentials 파일 fallback

## 저장 및 로드 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 신규 token 저장 | `credentials.json` 없음 | `credentials.oauth.<provider>`에 `accessToken`, `refreshToken`, `expiresAt`이 저장된다. |
| 기존 credentials에 token 추가 | API key만 저장된 credentials 존재 | 기존 API key를 유지하고 같은 provider의 `oauth` 값만 추가된다. |
| token 로드 | provider token 저장 완료 | `getOAuthTokens(provider)`가 해당 provider의 token 객체를 반환한다. |
| refresh token 없음 | provider가 refresh token을 반환하지 않음 | `accessToken`, `expiresAt`은 저장되고 `refreshToken`은 없거나 null로 안전하게 처리된다. |
| expiresAt 정규화 | epoch milliseconds 입력 | ISO 8601 문자열로 저장되거나 비교 가능한 만료 시간 값으로 일관되게 저장된다. |
| 빈 access token | `accessToken: ""` | 저장하지 않고 명확한 오류로 중단한다. |

## Provider 분리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| provider A 저장 후 provider B 저장 | `antigravity`, `github-copilot` token 순차 저장 | 두 provider token이 각각 별도 key 아래 유지된다. |
| provider A 갱신 | `oauth.antigravity` token이 이미 있음 | `credentials.oauth.antigravity`만 갱신되고 다른 provider token은 변경되지 않는다. |
| provider별 로드 | 여러 provider token 저장 | 요청한 provider의 token만 반환한다. |
| provider별 삭제 | 여러 provider token 저장 후 한 provider 삭제 | 해당 provider의 `oauth`만 제거되고 다른 provider와 API key는 유지된다. |
| 지원하지 않는 provider | 허용 목록 밖 provider 입력 | mock fallback 없이 명확한 오류로 중단한다. |
| API Key namespace 보존 | `credentials.apiKeys.antigravity`와 `credentials.oauth.antigravity` 동시 존재 | OAuth 저장/삭제는 `apiKeys.antigravity` 값을 변경하지 않는다. |

## config.json 제외 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| OAuth token 저장 후 config 확인 | token 저장 완료 | `config.json`에 `accessToken`, `refreshToken`, `expiresAt`이 없다. |
| model 설정과 token 저장 병행 | `provider`, `authType`, `modelVersion` 저장 | config에는 metadata만 있고 secret은 credentials에만 있다. |
| token response 원문 포함 방지 | OAuth provider가 추가 필드를 반환 | raw token response 전체가 config에 저장되지 않는다. |
| Authorization header 제외 | provider 호출용 bearer header 생성 | `Authorization` 또는 bearer token 문자열이 config에 저장되지 않는다. |

확인해야 할 금지 문자열은 다음과 같다.

- `accessToken`
- `refreshToken`
- 실제 access token 값
- 실제 refresh token 값
- `Bearer `

단, `credentials.json` 내부 schema key로서의 `accessToken`, `refreshToken`은 허용된다.

## 파일 권한 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| POSIX 권한 제한 | Linux/macOS 테스트 환경 | 저장 후 `credentials.json` 권한이 `600` 또는 사용자 읽기/쓰기 수준이다. |
| Windows best effort | Windows 테스트 환경 | 권한 제한 실패가 치명적 오류가 되지 않고 token 원문 없이 경고 또는 정상 처리된다. |
| 권한 변경 실패 mock | `chmod` 실패 mock | 실패 메시지에 token 값과 credentials 내용이 포함되지 않는다. |
| config 디렉터리 생성 | config 디렉터리 없음 | 디렉터리를 생성하고 credentials 파일을 저장한다. |

권한 테스트는 실제 사용자 홈이 아니라 임시 config 디렉터리를 주입해 수행한다.

## token 로깅 금지 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 저장 성공 로그 | token 저장 성공 | 로그에는 provider와 성공 여부만 있고 token 원문은 없다. |
| 저장 실패 로그 | 파일 쓰기 실패 mock | 오류 로그에 access token, refresh token, token response 원문이 없다. |
| 로드 실패 로그 | JSON parse 실패 | 깨진 파일 내용 전체와 token 후보 문자열이 출력되지 않는다. |
| OAuth flow 연결 로그 | token exchange 성공 후 저장 | token response 원문이 출력되지 않는다. |
| redaction 적용 | token처럼 보이는 문자열 포함 | 출력 시 `[REDACTED]`로 마스킹된다. |

테스트용 token 값은 고유 문자열로 만든 뒤 stdout/stderr 전체에 해당 문자열이 없는지 확인한다.

예시 token fixture:

```txt
test-access-token-AA-should-not-leak
test-refresh-token-AA-should-not-leak
```

검증 기준:

- stdout에 fixture token 값이 없다.
- stderr에 fixture token 값이 없다.
- thrown error message에 fixture token 값이 없다.
- logger mock 호출 인자에 fixture token 값이 없다.

## 깨진 credentials fallback 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| JSON parse 불가 | `credentials.json`에 `{ broken` 저장 | 원문 출력 없이 경고 후 빈 credentials로 fallback한다. |
| root 타입 불일치 | credentials 내용이 배열 또는 문자열 | 빈 credentials로 fallback하거나 schema 오류를 안전하게 처리한다. |
| apiKeys namespace 타입 불일치 | `apiKeys`가 문자열 | API Key 원문 출력 없이 schema 오류를 안전하게 처리하고 OAuth 저장 시 덮어쓰지 않는다. |
| oauth namespace 타입 불일치 | `oauth.antigravity`가 문자열 | token 로드 시 null을 반환하고 재로그인 안내가 가능하다. |
| 저장 중 기존 파일 깨짐 | 깨진 credentials 파일 위에 token 저장 시도 | 기존 파일을 원문 출력 없이 백업한 뒤 새 credentials를 저장하며 token 원문은 출력하지 않는다. |

fallback은 조용히 mock 인증으로 전환하는 것이 아니다. token이 없으면 provider 호출 전에 재인증 필요 상태를 명확히 반환해야 한다.

## OAuth flow 연결 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| token exchange 성공 | mock token response 반환 | 필요한 필드만 추출해 `saveOAuthTokens()`를 호출한다. |
| token exchange 응답에 추가 필드 포함 | `scope`, `token_type`, provider raw payload 포함 | 저장 schema에는 허용된 필드만 들어간다. |
| token 저장 실패 | `saveOAuthTokens()` 실패 mock | OAuth 인증 성공으로 처리하지 않고 안전한 오류를 반환한다. |
| provider 이름 전달 | `antigravity oauth` flow | `antigravity` provider scope 아래 저장된다. |

## 보안 회귀 테스트

`AA` 단계 테스트에서는 다음이 발생하지 않아야 한다.

- 실제 사용자 `~/.config/convention/credentials.json` 읽기 또는 수정
- 실제 OAuth provider 네트워크 호출
- 실제 Git commit, reset, push
- credentials 파일 내용 전체 출력
- token 원문 출력
- `config.json`에 secret 저장

외부 네트워크 호출은 unit test에서 mock 처리한다.

## 권장 테스트 방식

권장 단위 테스트 대상은 다음 함수다.

- `loadCredentials()`
- `saveCredentials(credentials)`
- `saveOAuthTokens(provider, tokens)`
- `getOAuthTokens(provider)`
- `clearOAuthTokens(provider)`

권장 mock 대상은 다음과 같다.

- config 디렉터리 경로
- filesystem read/write
- chmod 또는 권한 제한 함수
- logger
- OAuth token exchange 결과

## 완료 기준

- token 저장/로드 테스트가 통과한다.
- provider별 token 분리 테스트가 통과한다.
- `config.json` secret 제외 테스트가 통과한다.
- 파일 권한 제한이 가능한 환경에서 적용되고, 실패 시 token 없는 경고만 출력된다.
- stdout/stderr/logger/error message 어디에도 token 원문이 없다.
- 깨진 credentials 파일이 있어도 원문 출력 없이 안전하게 fallback한다.
