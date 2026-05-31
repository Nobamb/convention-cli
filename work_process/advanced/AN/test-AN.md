# AN. CI Mode Agent 테스트 계획

## 테스트 목표

CI 환경 감지와 interactive prompt 비활성화가 안전하게 동작하는지 검증한다.

중점 검증 항목은 다음과 같다.

- `isCI()` 감지
- `isGitHubActions()` 감지
- interactive prompt 비활성화
- 필요한 값이 없을 때 prompt 대신 오류 처리
- 보안 gate 유지

## env utility 테스트

| 케이스 | env | 기대 결과 |
| --- | --- | --- |
| CI true | `{ CI: "true" }` | `isCI()`가 true를 반환한다. |
| CI false | `{ CI: "false" }` | `isCI()`가 false를 반환한다. |
| CI 없음 | `{}` | `isCI()`가 false를 반환한다. |
| GitHub Actions true | `{ GITHUB_ACTIONS: "true" }` | `isGitHubActions()`가 true를 반환한다. |
| GitHub Actions false | `{ GITHUB_ACTIONS: "false" }` | `isGitHubActions()`가 false를 반환한다. |
| 둘 다 true | `{ CI: "true", GITHUB_ACTIONS: "true" }` | 두 함수가 모두 true를 반환한다. |

## interactive 비활성화 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| CI 환경 | `CI=true` | confirm prompt가 호출되지 않는다. |
| GitHub Actions 환경 | `GITHUB_ACTIONS=true` | confirm prompt가 호출되지 않는다. |
| 로컬 환경 | env 없음 | 기존 interactive flow가 유지된다. |
| CI + 필요한 값 누락 | provider 또는 confirm 정책 누락 | prompt 대신 명확한 오류로 실패한다. |
| CI + no-interactive 예정 옵션 | options mock | `shouldDisableInteractive()`가 true를 반환한다. |

## commit flow 연결 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| CI batch 실행 | `CI=true node bin/convention.js --batch` | 사용자 입력 대기 없이 실행 또는 안전 실패한다. |
| CI step 실행 | `CI=true node bin/convention.js --step` | 파일별 선택 prompt가 호출되지 않는다. |
| CI 기본 실행 | config mode 존재 | mode는 읽되 prompt가 호출되지 않는다. |
| CI confirm 필요 | `confirmBeforeCommit: true`, `--yes` 없음 | commit을 실행하지 않고 실패한다. |
| CI 보안 scan | diff에 `API_KEY=` 포함 | secret scan은 계속 실행된다. |

## PR flow 연결 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| CI PR print | `GITHUB_ACTIONS=true` | PR preview prompt 없이 출력 흐름으로 진행한다. |
| CI PR create confirm 필요 | create 옵션 mock, `--yes` 없음 | PR 생성은 실행되지 않는다. |
| GitHub remote 없음 | CI 환경 | remote 입력 prompt 대신 오류 또는 print-only 안내를 출력한다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| env 전체 출력 방지 | env에 `TOKEN=secret` 포함 | stdout/stderr에 secret 값이 없다. |
| credentials 원문 출력 방지 | credentials mock | credentials 내용이 출력되지 않는다. |
| raw stack trace 방지 | env utility 오류 mock | 사용자 출력에 raw stack trace가 없다. |
| commit 자동 실행 방지 | CI, `--yes` 없음 | `git commit`이 호출되지 않는다. |
| push 자동 실행 방지 | CI, push 옵션 mock, confirm 없음 | `git push`가 호출되지 않는다. |

## 완료 기준

- CI/GitHub Actions 감지 함수가 테스트된다.
- CI 환경에서 prompt 호출이 발생하지 않는 것이 검증된다.
- CI 환경에서도 보안 scan과 confirm 정책이 유지된다.
- 필요한 입력이 없을 때 hanging 없이 명확히 실패한다.
