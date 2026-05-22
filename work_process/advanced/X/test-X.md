# X. OAuth Provider Config Agent 테스트 계획

## 테스트 목표

OAuth provider별 설정이 `src/auth/oauthProviders.js`에서 안전하게 분리 관리되는지 검증한다.

핵심 검증 대상은 다음과 같다.

- 지원 provider config 조회
- 필수 설정 누락 감지
- 없는 provider와 invalid provider 처리
- mock fallback 금지
- secret 로그 출력 금지
- URL 검증
- scope 검증
- client 설정 검증

테스트는 실제 OAuth 서버로 네트워크 요청을 보내지 않는다.

## 지원 Provider Config 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| GitHub OAuth 설정 조회 | `getOAuthProviderConfig("github")` 호출 | `authUrl`, `tokenUrl`, `scopes`, `client`가 포함된 설정을 반환한다. |
| Gemini OAuth 설정 조회 | OAuth 지원 provider로 등록된 경우 `getOAuthProviderConfig("gemini")` 호출 | provider별 URL과 scope가 분리된 설정으로 반환된다. |
| provider 목록 조회 | `listOAuthProviders()` 호출 | OAuth 지원 provider 이름만 배열로 반환한다. |
| registry 원본 보호 | 반환된 설정 객체를 테스트에서 수정 | 내부 registry가 오염되지 않도록 복사본을 반환하거나 변경 영향이 없어야 한다. |
| provider별 scope 분리 | 서로 다른 provider 설정 조회 | 각 provider가 서로 다른 scope 배열을 독립적으로 가진다. |

## Missing 또는 Invalid Provider 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| provider 없음 | `undefined` | `OAuth provider is required` 수준의 명확한 오류로 실패한다. |
| provider null | `null` | 명확한 오류로 실패한다. |
| provider 빈 문자열 | `""` | 명확한 오류로 실패한다. |
| 지원하지 않는 provider | `"unknown"` | `Unsupported OAuth provider: unknown` 형태의 오류로 실패한다. |
| OAuth 미지원 provider | `"mock"` | mock fallback 없이 unsupported 오류로 실패한다. |
| localLLM 입력 | `"localLLM"` | OAuth provider가 아니므로 명확한 오류로 실패한다. |
| 대소문자 불일치 | `"GitHub"` | registry key와 일치하지 않으므로 명확한 오류로 실패한다. |

## No Provider Fallback 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| unknown provider 설정 조회 | provider를 `"unknown"`으로 지정 | `mock` 설정을 반환하지 않는다. |
| OAuth 미지원 provider 설정 조회 | provider를 `"mock"`으로 지정 | `src/providers/mock.js` 또는 mock provider routing이 호출되지 않는다. |
| 설정 검증 실패 | `authUrl`이 invalid인 provider config 사용 | 기본 provider로 대체하지 않고 오류로 중단한다. |
| client 설정 누락 | client id 환경 변수가 없는 상태 | 임의 기본 client로 대체하지 않고 오류로 중단한다. |

권장 검증 방식은 mock provider 모듈 또는 provider router 호출 여부를 spy로 확인하고 호출 횟수가 0인지 검사하는 것이다.

## URL 검증 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| 정상 authUrl | `https://github.com/login/oauth/authorize` | 검증 성공 |
| 정상 tokenUrl | `https://github.com/login/oauth/access_token` | 검증 성공 |
| 빈 authUrl | `""` | `authUrl` 오류로 실패 |
| 빈 tokenUrl | `""` | `tokenUrl` 오류로 실패 |
| 상대 경로 | `"/oauth/authorize"` | URL 검증 실패 |
| 잘못된 문자열 | `"not a url"` | URL 검증 실패 |
| 위험 scheme | `"javascript:alert(1)"` | URL 검증 실패 |
| http URL | `"http://example.com/token"` | 운영 provider 설정에서는 실패한다. localhost 예외가 있다면 별도 테스트로 고정한다. |
| localhost 개발 URL | `"http://localhost:3000/token"` | 운영 provider registry에서는 실패한다. 테스트 전용 provider는 `allowInsecureLoopback: true` 같은 명시 플래그가 있을 때만 별도 fixture에서 허용한다. |

오류 메시지에는 실패 필드명과 provider 이름만 포함하고 민감 query 값은 포함하지 않아야 한다.

## Scope 검증 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| 정상 scopes | `["read:user"]` | 검증 성공 |
| Google style scope | `["https://www.googleapis.com/auth/generative-language"]` | 검증 성공 |
| scopes 누락 | `undefined` | 검증 실패 |
| scopes가 배열 아님 | `"read:user"` | 검증 실패 |
| 빈 배열 | `[]` | 검증 실패 |
| 빈 문자열 scope | `[""]` | 검증 실패 |
| 공백 scope | `["   "]` | 검증 실패 |
| 문자열이 아닌 scope | `["read:user", 123]` | 검증 실패 |
| 중복 scope | `["read:user", "read:user"]` | 순서를 유지한 normalized 배열 `["read:user"]`로 처리된다. |
| secret 의심 scope | `["TOKEN=abc"]` | 검증 실패하고 원문 값은 로그에 출력하지 않는다. |

## Client 설정 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| client id 환경 변수 존재 | 테스트 env에 `CONVENTION_GITHUB_CLIENT_ID` 설정 | client id를 사용할 수 있는 설정을 반환한다. |
| client id 환경 변수 누락 | 테스트 env에서 id 제거 | 명확한 오류로 실패한다. |
| secret 필요한 provider의 secret 존재 | `requiresSecret: true`, secret env 존재 | 검증 성공 |
| secret 필요한 provider의 secret 누락 | `requiresSecret: true`, secret env 없음 | 명확한 오류로 실패한다. |
| secret 불필요 provider | `requiresSecret: false` | secret env 없이도 검증 성공 |
| secret 원문 오류 노출 방지 | secret env 값을 테스트 문자열로 설정 후 실패 유도 | 오류와 로그에 secret 값이 포함되지 않는다. |

환경 변수 테스트는 실제 사용자 환경을 오염시키지 않도록 테스트 프로세스 안에서만 mock env 객체를 주입한다.

## No Secret Logging 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| client secret 설정 후 오류 발생 | `CONVENTION_GITHUB_CLIENT_SECRET="test-secret-value"` | 출력에 `test-secret-value`가 포함되지 않는다. |
| client id와 secret 동시 설정 | 검증 실패를 유도 | secret은 출력하지 않고 provider/필드 수준 메시지만 출력한다. |
| token 형태 문자열 포함 | scope 또는 URL query에 `access_token=abc` 포함 | 원문 token 값이 로그에 포함되지 않는다. |
| credentials 파일 존재 | 테스트 credentials fixture 생성 | `oauthProviders.js` 테스트가 credentials 내용을 읽거나 출력하지 않는다. |

권장 검증은 logger를 mock 처리해 `info`, `warn`, `error` 호출 인자를 검사하는 방식이다.

## 통합 연결 테스트 후보

X 단계 자체는 OAuth 전체 flow를 실행하지 않지만 W 단계 구조와 연결되는 최소 테스트는 필요하다.

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| oauth.js에서 provider config 조회 | `oauth.js`의 authorization URL 생성 함수가 config getter를 사용 | provider별 URL과 scope가 반영된다. |
| unsupported provider 전파 | oauth flow에 `"unknown"` 전달 | config 단계 오류가 그대로 전파되고 fallback이 없다. |
| token URL 사용 분리 | token 교환 함수가 provider config의 `tokenUrl` 사용 | provider별 token endpoint가 하드코딩되지 않는다. |

이 테스트는 네트워크 요청 없이 함수 호출과 mock fetch로만 검증한다.

## 격리 원칙

- 실제 사용자 Git 저장소에서 commit, reset, push를 수행하지 않는다.
- 실제 OAuth provider로 브라우저를 열거나 네트워크 요청을 보내지 않는다.
- 실제 `~/.config/convention/credentials.json`을 읽거나 수정하지 않는다.
- 테스트 env는 mock 객체로 주입하거나 테스트 종료 후 복원한다.
- API Key, OAuth token, client secret 원문을 fixture 출력에 남기지 않는다.

## 완료 기준

- 지원 provider의 OAuth config 조회와 검증이 성공한다.
- provider 누락, invalid provider, OAuth 미지원 provider가 명확한 오류로 실패한다.
- 어떤 실패 케이스에서도 mock provider fallback이 발생하지 않는다.
- `authUrl`, `tokenUrl`, `scopes`, client 설정 유효성 검증 테스트가 존재한다.
- secret, token, credentials 원문이 로그와 오류 메시지에 노출되지 않는다.
- 테스트는 외부 네트워크와 실제 사용자 credentials에 의존하지 않는다.
