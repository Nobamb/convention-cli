# AP. GitHub Actions Output Agent 테스트 계획

## 테스트 목표

GitHub Actions output 파일 기록이 단일 라인, multiline, 보안 redaction 조건에서 안전하게 동작하는지 검증한다.

중점 검증 항목은 다음과 같다.

- `$GITHUB_OUTPUT` 감지
- output 파일 append
- multiline delimiter 처리
- commit/pr flow 연결
- secret masking

## utility 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| output 사용 가능 | `GITHUB_OUTPUT`에 임시 파일 경로 설정 | `isGitHubOutputAvailable()`이 true를 반환한다. |
| output 없음 | env에 `GITHUB_OUTPUT` 없음 | false를 반환한다. |
| 단일 라인 output | `setOutput("commit_message", "feat: add x")` | 파일에 `commit_message=feat: add x`가 기록된다. |
| multiline output | `setOutput("pr_body", "line1\nline2")` | delimiter 형식으로 기록된다. |
| 여러 output | `setOutputs({ commit_message, pr_title })` | 각 output이 append된다. |

## output name 검증 테스트

| 케이스 | output name | 기대 결과 |
| --- | --- | --- |
| snake case | `commit_message` | 허용된다. |
| PR title | `pr_title` | 허용된다. |
| PR body | `pr_body` | 허용된다. |
| 공백 포함 | `commit message` | 거부된다. |
| command injection 형태 | `x<<EOF` | 거부된다. |
| 빈 이름 | `""` | 거부된다. |

## multiline 테스트

| 케이스 | value | 기대 결과 |
| --- | --- | --- |
| PR body markdown | `## Summary\n- item` | 원문 줄바꿈이 유지된다. |
| delimiter 유사 문자열 포함 | value에 기본 delimiter 포함 | 충돌하지 않는 delimiter를 다시 생성한다. |
| 빈 줄 포함 | `line1\n\nline3` | 빈 줄이 유지된다. |
| Windows newline | `line1\r\nline2` | 정상 기록된다. |

## commit flow 연결 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| commit message 생성 | provider mock | `commit_message` output이 기록된다. |
| 빈 commit message | provider가 빈 문자열 반환 | output을 기록하지 않고 실패한다. |
| output 파일 없음 | env 없음 | commit flow가 실패하지 않는다. |
| output append 실패 | 파일 권한 오류 mock | warn만 출력하고 본래 흐름을 유지한다. |

## PR flow 연결 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| PR title/body 생성 | PR generator mock | `pr_title`, `pr_body` output이 기록된다. |
| print-only | `--pr --print-only` | PR 생성 없이 output은 기록 가능하다. |
| PR body multiline | markdown body | delimiter 형식으로 기록된다. |
| PR 생성 실패 | gh failure mock | 이미 생성된 output 기록 정책이 명확하게 유지된다. |

## 보안 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| token redaction | value에 `TOKEN=abc` 포함 | output에는 `[REDACTED]` 또는 기록 거부가 적용된다. |
| API key redaction | value에 `API_KEY=abc` 포함 | secret 원문이 없다. |
| private key redaction | value에 `-----BEGIN PRIVATE KEY-----` 포함 | secret 원문이 없다. |
| diff 원문 출력 방지 | diff mock | diff 전체가 output으로 기록되지 않는다. |
| env 경로 출력 방지 | output path 설정 | `$GITHUB_OUTPUT` 경로가 로그에 출력되지 않는다. |

## 완료 기준

- 단일 라인과 multiline output이 테스트된다.
- `commit_message`, `pr_title`, `pr_body` 기록이 검증된다.
- output 기록 실패가 본래 CLI 흐름을 중단하지 않는다.
- secret 의심 값이 output에 원문으로 기록되지 않는다.
