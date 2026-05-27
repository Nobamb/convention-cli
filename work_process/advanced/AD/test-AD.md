# AD. PR Prompt Agent 테스트 계획

## 테스트 목표

`buildPrPrompt()`가 PR 제목/본문 생성에 필요한 정보를 안전하게 prompt로 구성하는지 검증한다.

중점 검증 항목은 다음과 같다.

- 현재 branch와 base branch 반영
- commit log 반영
- diff summary 반영
- 변경 파일 목록 반영
- raw diff 및 secret 출력 방지
- base branch/변경 사항 오류 처리

## Prompt 구성 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 PR prompt 생성 | branch, base, commit log, diff summary, changed files 입력 | PR 제목과 본문 생성을 요청하는 prompt가 반환된다. |
| 현재 branch 포함 | `currentBranch: "feature/pr-flow"` | prompt에 head branch 정보가 포함된다. |
| base branch 포함 | `baseBranch: "main"` | prompt에 target branch 정보가 포함된다. |
| commit log 포함 | `feat: add pr command` commit log 입력 | commit log 요약이 prompt 근거로 포함된다. |
| 변경 파일 목록 포함 | `src/commands/pr.js`, `src/core/prPrompt.js` 입력 | 파일 목록이 prompt에 포함된다. |
| 언어 설정 반영 | `language: "ko"` | 한국어 PR 제목/본문 생성을 요구한다. |

## Raw Diff 보호 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| diff summary 사용 | raw diff와 summary를 모두 준비 | prompt에는 summary만 포함되고 raw diff는 포함되지 않는다. |
| secret 마스킹 | summary에 `API_KEY=abc` 포함 | prompt에는 `[REDACTED]`가 포함되고 원문 secret은 없다. |
| 민감 파일 제외 | `.env`, `credentials.json` 변경 파일 포함 | prompt 대상에서 제외되거나 민감 파일로 표시되고 내용은 없다. |
| private key 패턴 | `-----BEGIN PRIVATE KEY-----` 포함 | prompt 생성이 중단되거나 마스킹된다. |
| diff 원문 로그 방지 | logger mock 사용 | raw diff 전체가 stdout/stderr/logger에 출력되지 않는다. |

## Git 정보 수집 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 현재 branch 조회 | git mock이 `feature/a` 반환 | `currentBranch`에 반영된다. |
| base branch 조회 | config 또는 remote default가 `main` 반환 | `baseBranch`에 반영된다. |
| base branch 없음 | base branch 확인 실패 | 명확한 오류로 중단한다. |
| 변경 사항 없음 | changed files 빈 배열 | PR prompt 생성 대상 없음으로 중단한다. |
| Git 저장소 아님 | `isGitRepository()` false | Git 저장소 오류를 반환한다. |

## Template 반영 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| PR template 존재 | `.github/pull_request_template.md` fixture | template 섹션 구조가 prompt에 반영된다. |
| template 없음 | template 파일 없음 | 기본 `Summary`, `Changes`, `Tests` 구조를 사용한다. |
| template parse 실패 | 깨진 또는 너무 긴 template | 안전한 기본 prompt로 fallback한다. |
| template에 secret 포함 | template에 token 유사 문자열 포함 | secret은 마스킹되고 원문은 포함되지 않는다. |

## 오류 처리 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| secret scan 실패 | scanner mock throw | 외부 provider 전송 없이 중단한다. |
| summary 생성 실패 | diff summary 없음 | raw diff fallback 없이 오류를 반환한다. |
| commit log 없음 | commit log 빈 문자열 | 변경 파일과 summary 기반 prompt는 생성 가능하다. |
| branch 이름 특수문자 | branch에 `/`, `_`, `-` 포함 | shell 문자열 삽입 없이 안전하게 처리한다. |

## 보안 회귀 테스트

다음 문자열이 prompt, stdout, stderr, logger mock에 포함되지 않아야 한다.

- `API_KEY=`
- `SECRET=`
- `TOKEN=`
- `PASSWORD=`
- `-----BEGIN PRIVATE KEY-----`
- raw credentials JSON
- raw diff 전체

## 확인 명령 후보

실제 테스트 파일 구현 후 다음 명령으로 확인한다.

```bash
npm test
node --test
```

외부 provider 호출은 모두 mock 처리한다.

## 완료 기준

- 정상 prompt 구성 테스트가 통과한다.
- branch, commit log, diff summary, changed files가 prompt에 반영된다.
- raw diff와 secret 값이 prompt와 로그에 노출되지 않는다.
- base branch 없음, 변경 사항 없음, Git 저장소 아님 케이스가 안전하게 실패한다.
