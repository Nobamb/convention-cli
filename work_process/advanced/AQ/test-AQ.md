# AQ. Workflow Example Agent 테스트 계획

## 테스트 목표

GitHub Actions 사용 예시 문서가 안전하고 실행 가능한 형태로 작성되었는지 검증한다.

중점 검증 항목은 다음과 같다.

- `docs/github-actions.md` 존재
- README 링크 또는 요약 존재
- workflow YAML 예시의 기본 타당성
- 안전한 옵션 사용
- secret 노출 주의사항 포함

## 문서 존재 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| GitHub Actions 문서 | `docs/github-actions.md` 확인 | 파일이 존재한다. |
| README 연결 | `README.md` 확인 | GitHub Actions 문서 링크 또는 요약이 있다. |
| 제목 확인 | 문서 내용 확인 | GitHub Actions 또는 CI 관련 제목이 있다. |
| 옵션 설명 | 문서 내용 확인 | `--no-interactive`, `--print-only` 설명이 있다. |

## workflow 예시 검증

| 케이스 | 확인 항목 | 기대 결과 |
| --- | --- | --- |
| checkout 사용 | `actions/checkout@v4` | 포함된다. |
| Node setup | `actions/setup-node@v4` 또는 Node 설치 방식 | 포함된다. |
| CLI 설치 | `npm install -g convention-cli` | 포함된다. |
| 안전 실행 | `convention --pr --print-only --no-interactive` | 포함된다. |
| fetch depth | `fetch-depth: 0` 또는 base diff 가능 설명 | 포함 또는 설명된다. |

## 옵션 정책 문서 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| `--no-interactive` 설명 | CI에서 prompt를 띄우지 않는다고 설명한다. |
| `--yes` 설명 | 자동 승인 옵션이며 보안 gate를 우회하지 않는다고 설명한다. |
| `--print-only` 설명 | PR 생성 없이 출력만 한다고 설명한다. |
| `--pr` 설명 | PR 제목/본문 생성 흐름이라고 설명한다. |
| `--batch` 설명 | commit message output 예시에서 사용할 수 있다. |

## secret 문서 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| 실제 secret 없음 | 문서에 실제 API Key/token처럼 보이는 값이 없다. |
| GitHub Secrets 안내 | repository secrets 사용 안내가 있다. |
| fork PR 주의 | fork PR에서 secret 제한을 설명한다. |
| echo 금지 안내 | secret을 로그에 출력하지 말라고 안내한다. |
| 권한 최소화 | `permissions` 예시 또는 최소 권한 설명이 있다. |

## YAML 품질 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| YAML code fence | 문서의 workflow 블록 | `yaml` fenced code block을 사용한다. |
| 들여쓰기 | workflow 예시 | GitHub Actions YAML로 해석 가능한 들여쓰기다. |
| on pull_request | trigger 예시 | pull_request 또는 workflow_dispatch 예시가 있다. |
| output step id | output 사용 예시 | step `id`와 output 참조가 일관된다. |

## 금지 예시 테스트

| 금지 항목 | 기대 결과 |
| --- | --- |
| `npm publish` 자동 실행 | 문서 예시에 포함되지 않는다. |
| `git reset --hard` | 포함되지 않는다. |
| token 직접 echo | 포함되지 않는다. |
| credentials 원문 출력 | 포함되지 않는다. |
| 무조건 PR 생성 | `--yes` 없는 자동 PR 생성 예시가 없다. |

## 완료 기준

- GitHub Actions 문서와 README 연결이 검증된다.
- 기본 workflow 예시가 안전한 옵션 중심으로 작성된다.
- secret, fork PR, permissions 주의사항이 포함된다.
- 금지 명령이나 실제 secret 값이 문서에 포함되지 않는다.
