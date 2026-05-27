# AH. GitHub PR Integration Agent 테스트 계획

## 테스트 목표

생성된 PR 제목/본문이 GitHub PR 생성 흐름에 안전하게 연결되는지 검증한다.

중점 검증 항목은 다음과 같다.

- title/body preview 우선 출력
- `gh` CLI 설치 확인
- `gh auth status` 확인
- 사용자 confirm 이후 생성
- `--print-only` 처리
- token/remote credential 출력 방지
- `gh pr create` 인자 배열 실행

## PR 생성 흐름 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 생성 | title/body, GitHub remote, gh auth ok, confirm yes | `gh pr create`가 호출된다. |
| preview 우선 | 정상 생성 준비 | PR 생성 전 title/body가 출력된다. |
| confirm no | 사용자 선택 Cancel | `gh pr create`가 호출되지 않는다. |
| `--yes` | non-interactive와 `--yes` | 보안 gate 통과 시 confirm 없이 생성한다. |
| `--print-only` | print-only option | title/body만 출력하고 생성하지 않는다. |
| draft PR | `draft: true` | `--draft` 인자가 포함된다. |

## gh CLI 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| gh 설치됨 | `gh --version` mock success | 다음 단계로 진행한다. |
| gh 없음 | command not found mock | 설치 안내 후 PR 생성하지 않는다. |
| gh auth ok | `gh auth status` success | PR 생성 가능 상태로 처리한다. |
| gh auth fail | auth status fail | `gh auth login` 안내 후 PR 생성하지 않는다. |
| gh stderr secret | stderr에 token 유사 문자열 포함 | 원문 stderr가 출력되지 않는다. |

## 명령 인자 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| title 전달 | `feat: add pr flow` | `--title`, title이 별도 인자로 전달된다. |
| body 전달 | markdown body | `--body`, body가 별도 인자로 전달된다. |
| base/head 전달 | base `main`, head `feature/a` | `--base main --head feature/a` 인자가 포함된다. |
| 특수문자 title | title에 따옴표와 괄호 포함 | shell 문자열 삽입 없이 안전하게 전달된다. |
| 긴 body | 여러 줄 markdown body | 한 인자로 안전하게 전달된다. |

## Remote 처리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| GitHub remote | AG detector가 owner/repo 반환 | PR 생성 흐름 진행 |
| GitHub remote 없음 | detector null | PR 문서 출력 흐름으로 전환 |
| credential remote | remote URL에 token 포함 | token 원문 로그 없음 |
| 여러 remote | preferred remote 지정 | 지정 remote 기준으로 생성 |

## 보안 Gate 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| PR body secret 포함 | body에 `TOKEN=abc` | PR 생성 중단 |
| title secret 포함 | title에 `API_KEY=abc` | PR 생성 중단 |
| raw diff 포함 | body에 diff 원문 포함 | scan 실패 또는 생성 중단 |
| 인증 실패 후 side effect | gh auth fail | commit, push, reset 호출 없음 |

## 완료 기준

- 사용자 확인 전 `gh pr create`가 실행되지 않는다.
- `--print-only`는 원격 작업을 수행하지 않는다.
- `gh` CLI 미설치/미인증 상태가 안전하게 처리된다.
- `gh pr create`가 인자 배열 방식으로 호출된다.
- token, Authorization header, remote credential이 출력되지 않는다.
