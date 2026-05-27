# AI. PR Preview Agent 테스트 계획

## 테스트 목표

PR preview 흐름에서 생성된 제목/본문을 안전하게 표시하고, 사용자 선택에 따라 Create PR, Edit manually, Print only, Cancel이 정확히 동작하는지 검증한다.

중점 검증 항목은 다음과 같다.

- title/body preview 출력
- 선택지 처리
- manual edit 후 재검증
- print-only 원격 작업 없음
- cancel 원격 작업 없음
- `--yes` 정책
- secret 출력 방지

## Preview 출력 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 preview | title/body 입력 | PR Title과 PR Body가 출력된다. |
| branch 정보 포함 | base/head 입력 | target branch와 head branch가 출력된다. |
| changed files summary | 파일 요약 입력 | 변경 파일 요약이 출력된다. |
| body markdown 유지 | markdown body 입력 | markdown 구조가 유지된다. |
| 빈 title | title 빈 문자열 | preview 또는 create 전에 오류로 처리한다. |
| 빈 body | body 빈 문자열 | preview 또는 create 전에 오류로 처리한다. |

## 선택지 테스트

| 케이스 | 사용자 선택 | 기대 결과 |
| --- | --- | --- |
| Create PR | `Create PR` | AH 단계 create 함수가 호출된다. |
| Edit manually | `Edit manually` | 편집 UI가 호출되고 수정 후 preview로 돌아간다. |
| Print only | `Print only` | title/body만 출력하고 create 함수는 호출되지 않는다. |
| Cancel | `Cancel` | 아무 원격 작업 없이 종료한다. |
| 잘못된 선택 | invalid action mock | 안전한 오류 또는 재선택 처리 |

## Manual Edit 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| title 수정 | 새 title 입력 | 수정된 title로 다시 preview한다. |
| body 수정 | 새 body 입력 | 수정된 body로 다시 preview한다. |
| 빈 title 입력 | title을 빈 문자열로 수정 | 저장하지 않고 오류 처리한다. |
| 빈 body 입력 | body를 빈 문자열로 수정 | 저장하지 않고 오류 처리한다. |
| title 여러 줄 | title에 newline 포함 | 한 줄 제목 검증 오류 처리한다. |
| 편집 후 secret 포함 | body에 `TOKEN=abc` 추가 | Create PR을 중단한다. |

## Non-interactive 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| `--print-only` | non-interactive true | prompt 없이 title/body를 출력하고 종료한다. |
| `--yes` | non-interactive true, 보안 gate 통과 | Create PR 실행으로 진행할 수 있다. |
| `--yes` 없음 | non-interactive true | Create PR을 실행하지 않고 명확히 중단한다. |
| CI 환경 | `CI=true` | interactive prompt를 호출하지 않는다. |
| 보안 실패 + `--yes` | secret scan 실패 | `--yes`가 있어도 Create PR을 실행하지 않는다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| title secret | title에 `API_KEY=abc` | secret 원문이 출력되지 않고 생성 중단 |
| body secret | body에 `PASSWORD=abc` | secret 원문이 출력되지 않고 생성 중단 |
| raw diff body | body에 큰 diff 원문 포함 | preview 전 scan 또는 요약 정책으로 차단 |
| logger 출력 | logger mock 사용 | token, API Key, Authorization header 원문 없음 |
| Cancel 후 side effect | Cancel 선택 | gh, git commit, push, reset 호출 없음 |

## Create PR 연결 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| Create PR 선택 | AH create mock | title/body가 create 함수에 전달된다. |
| Create PR 실패 | create mock throw | 안전한 오류 요약을 출력한다. |
| Print only 이후 | print-only 선택 | create mock 호출 횟수 0 |
| Cancel 이후 | cancel 선택 | create mock 호출 횟수 0 |

## 완료 기준

- preview 출력과 선택지 처리가 테스트된다.
- Edit manually 후 재검증과 재preview가 테스트된다.
- non-interactive와 `--yes` 정책이 테스트된다.
- Print only와 Cancel에서 원격 작업이 발생하지 않는다.
- secret 원문이 preview, stdout, stderr, logger에 노출되지 않는다.
