# AU. Security Review Agent 테스트 계획

## 테스트 목표

3차 고도화 이후 API Key, OAuth token, diff, PR body, CI output, reset/push 흐름에서 보안 규칙이 유지되는지 검증한다.

중점 검증 항목은 다음과 같다.

- OAuth state/PKCE 검증
- token/API Key 로그 노출 방지
- credentials 저장 분리
- diff 외부 전송 gate
- large diff chunk 로그 노출 방지
- PR body secret 방지
- CI secret 노출 방지
- reset/push confirm 정책

## OAuth 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| state 생성 | OAuth 시작 | 예측하기 어려운 state가 생성된다. |
| state 일치 | callback mock | 인증 flow가 계속된다. |
| state 불일치 | callback mock | 인증 flow가 중단된다. |
| PKCE 생성 | verifier/challenge 생성 | challenge가 verifier와 규칙에 맞게 연결된다. |
| callback timeout | server mock | token 저장 없이 안전하게 실패한다. |

## secret 로그 노출 테스트

| 케이스 | 입력 | 기대 결과 |
| --- | --- | --- |
| API Key | `API_KEY=abc123` | stdout/stderr에 `abc123`이 없다. |
| OAuth token | `gho_secret_token` | token 원문이 없다. |
| refresh token | credentials mock | 원문이 출력되지 않는다. |
| private key | PEM mock | private key 원문이 없다. |
| provider error | error message에 secret 포함 | redaction 후 출력된다. |

## credentials 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| config 저장 | API Key provider 설정 | `config.json`에 secret이 없다. |
| credentials 저장 | API Key mock | `credentials.json`에만 저장된다. |
| credentials 출력 | load 실패 mock | 파일 원문을 출력하지 않는다. |
| 파일 권한 | 저장 후 확인 가능 환경 | 사용자 읽기/쓰기 제한을 시도한다. |
| env secret | env 기반 API Key | env var 값은 출력하지 않는다. |

## diff 외부 전송 테스트

| 케이스 | diff | 기대 결과 |
| --- | --- | --- |
| `.env` 변경 | 민감 파일 fixture | 외부 전송 대상에서 제외된다. |
| `API_KEY=` 포함 | secret diff fixture | provider 호출 전 중단 또는 확인 정책을 따른다. |
| safe diff | 일반 변경 | 정책상 허용된 provider 호출만 진행한다. |
| provider raw response | 긴 응답 mock | 원문 전체를 로그에 출력하지 않는다. |
| unsupported provider | provider 이름 오류 | mock fallback 없이 오류로 중단한다. |

## large diff/PR/CI 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| large diff chunk | chunk 원문 mock | logger에 chunk 원문 전체가 없다. |
| grouping summary | diff 포함 summary mock | diff 원문이 그대로 출력되지 않는다. |
| PR body secret | body에 `TOKEN=abc` | PR body가 redacted 되거나 생성이 중단된다. |
| GitHub Actions output | secret 포함 output | output에 secret 원문이 없다. |
| CI env | `GITHUB_TOKEN=abc` | env 값 원문이 출력되지 않는다. |

## reset/push confirm 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| push confirm 없음 | push 옵션 mock | commit 완료와 정책 확인 전 push하지 않는다. |
| push 실패 stderr | token 포함 stderr mock | token 원문 없이 실패 메시지를 출력한다. |
| reset confirm 거절 | transaction 있음 | reset을 실행하지 않는다. |
| reset 기록 없음 | transaction 없음 | 자동 reset을 중단한다. |
| reset hard 금지 | 코드/명령 검색 | `git reset --hard` 호출이 없다. |

## 49번 감사 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| B~AV 문서 보안 항목 | 각 단계 test/research에 필요한 보안 기준이 있다. |
| 파일 경로 | `work_process/advanced/<STEP>/research-<STEP>.md`와 `test-<STEP>.md`가 일관된다. |
| MVP 회귀 위험 | confirm, provider error, reset/push 정책을 약화하지 않는다. |
| 범위 일치 | `init/03_advanced.md`의 3차 범위를 벗어나지 않는다. |

## 완료 기준

- OAuth, credentials, diff, PR, CI, reset/push 보안 테스트가 정리된다.
- secret 원문이 stdout/stderr/output에 남지 않는 경로가 검증된다.
- `init/00_rule.md`의 보안 원칙과 Git 히스토리 보호 원칙을 위반하지 않는다.
- 최종 감사 기준이 테스트 항목으로 반영된다.
