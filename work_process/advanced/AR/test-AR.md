# AR. CI Security Agent 테스트 계획

## 테스트 목표

CI 환경에서 token, API Key, OAuth 정보, credentials 내용이 로그나 GitHub Actions output에 노출되지 않는지 검증한다.

중점 검증 항목은 다음과 같다.

- logger redaction
- auth 계층 masking
- GitHub Actions output redaction
- 환경변수 secret 처리
- PR from fork 주의 정책

## logger redaction 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| API_KEY 패턴 | `API_KEY=abc123` | 출력에 `abc123`이 없다. |
| SECRET 패턴 | `SECRET=my-secret` | 출력에 `my-secret`이 없다. |
| TOKEN 패턴 | `TOKEN=ghp_xxx` | token 원문이 없다. |
| PASSWORD 패턴 | `PASSWORD=pw` | password 원문이 없다. |
| private key | `-----BEGIN PRIVATE KEY-----` | private key 원문이 없다. |
| DATABASE_URL | `DATABASE_URL=postgres://user:pass@host/db` | credential 원문이 없다. |

## logger 함수별 테스트

| 함수 | 준비 | 기대 결과 |
| --- | --- | --- |
| `info()` | secret 포함 메시지 | redaction 후 출력한다. |
| `warn()` | secret 포함 메시지 | redaction 후 출력한다. |
| `error()` | secret 포함 메시지 | redaction 후 출력한다. |
| `success()` | secret 포함 메시지 | redaction 후 출력한다. |

## auth 계층 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| API Key 저장 성공 | key 입력 mock | 성공 메시지에 key 원문이 없다. |
| API Key 조회 | credentials mock | logger에 key 원문이 전달되지 않는다. |
| OAuth token 저장 | token mock | token 원문이 출력되지 않는다. |
| credentials parse 실패 | 깨진 credentials mock | 파일 원문과 stack trace가 출력되지 않는다. |
| 환경변수 API Key | env에 key 설정 | env var 이름은 표시 가능하나 값은 표시하지 않는다. |

## GitHub Actions output 보안 테스트

| 케이스 | output value | 기대 결과 |
| --- | --- | --- |
| commit_message secret 포함 | `fix: hide TOKEN=abc` | output에 `abc`가 없다. |
| pr_title secret 포함 | `fix: remove API_KEY=abc` | output에 secret 원문이 없다. |
| pr_body secret 포함 | markdown body with secret | redaction 후 기록되거나 기록이 거부된다. |
| credentials JSON | `{ "apiKey": "abc" }` | 원문 key가 기록되지 않는다. |
| diff 원문 | full diff mock | diff 전체를 output에 기록하지 않는다. |

## CI 환경 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| `CI=true` | secret env 포함 | stdout/stderr에 secret 값이 없다. |
| `GITHUB_ACTIONS=true` | `GITHUB_TOKEN` mock | token 값이 출력되지 않는다. |
| provider 실패 | error에 token 포함 mock | 사용자 출력에는 redacted 메시지만 있다. |
| network 실패 | raw error mock | 인증 URL/token이 출력되지 않는다. |
| no-interactive 실패 | 필요한 값 누락 | 오류 메시지에 secret 값이 없다. |

## PR from fork 문서/정책 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| docs 확인 | fork PR에서 secret 제한을 안내한다. |
| `pull_request_target` | 기본 권장 예시로 사용하지 않는다. |
| permissions | 최소 권한 예시가 있다. |
| external provider | fork PR에서 secret이 없을 수 있음을 안내한다. |
| print-only | 안전한 fallback으로 설명한다. |

## 외부 전송 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| sensitive diff | diff에 `API_KEY=` 포함 | 외부 provider 호출 전 중단 또는 확인 정책을 따른다. |
| cloud provider | CI + secret 감지 | 자동 전송하지 않는다. |
| local provider | CI + safe diff | 정책상 허용되면 진행 가능하다. |
| raw diff logging | large diff mock | diff 원문이 로그에 출력되지 않는다. |

## 완료 기준

- logger 함수 전체에 redaction이 적용되는 것이 검증된다.
- auth/credentials 계층이 secret 원문을 출력하지 않는 것이 검증된다.
- GitHub Actions output에 secret 원문이 기록되지 않는다.
- CI 실패 경로에서도 raw stack trace나 token이 노출되지 않는다.
- fork PR과 permissions 관련 보안 문서가 검증된다.
