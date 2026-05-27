# AD. PR Prompt Agent 구현 계획

## 작업 범위

AD 단계는 Git 변경 정보와 commit history를 바탕으로 PR 제목과 본문 생성을 위한 prompt를 만드는 작업만 담당한다.

핵심 목표는 현재 branch, base branch, commit log, diff summary, 변경 파일 목록을 안전하게 수집하고, 원본 diff를 그대로 노출하지 않는 PR 생성 prompt를 `buildPrPrompt()`로 구성하는 것이다.

이 단계는 실제 PR 제목 생성, 본문 생성, GitHub PR 생성은 수행하지 않는다. AE, AF, AH 단계가 후속으로 담당한다.

## 선행 조건

이 단계는 1차/2차 MVP와 3차 고도화의 기존 보안 gate를 전제로 한다.

- Git 저장소 확인 로직이 존재한다.
- 변경 파일 목록과 diff 추출 로직이 존재한다.
- large diff 요약 또는 diff summary를 사용할 수 있다.
- 민감 파일 제외와 secret scan 정책이 유지된다.
- provider 호출 전 사용자 확인 또는 설정 정책이 적용된다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/core/prPrompt.js`
- `src/core/git.js`
- `src/core/diff.js`
- `src/core/security.js`
- `src/commands/pr.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/prPrompt.js`에 다음 함수를 추가한다.

```js
export function buildPrPrompt({
  currentBranch,
  baseBranch,
  commitLog,
  diffSummary,
  changedFiles,
  language,
  template
})
```

역할은 다음과 같다.

- `currentBranch`: PR head branch 이름
- `baseBranch`: PR target branch 이름
- `commitLog`: base branch 이후 commit 요약
- `diffSummary`: 원본 diff가 아닌 안전한 변경 요약
- `changedFiles`: 변경 파일 목록
- `language`: PR 제목/본문 생성 언어
- `template`: project template 또는 PR template 설정

반환값은 provider에 전달할 prompt 문자열이다.

## Git 정보 수집 계획

PR prompt에 필요한 Git 정보는 shell 문자열이 아니라 `execFileSync` 또는 `spawnSync`의 인자 배열 방식으로 수집한다.

권장 수집 항목은 다음과 같다.

1. 현재 branch: `git branch --show-current`
2. base branch 후보: `main`, `master`, remote default branch 또는 config 값
3. commit log: `git log --oneline <base>..HEAD`
4. 변경 파일 목록: `git diff --name-only <base>...HEAD`
5. diff summary: raw diff가 아닌 통계, 파일별 요약, large diff summary

base branch를 판단할 수 없으면 명확한 오류 또는 사용자 입력 흐름으로 넘긴다. 조용히 임의 branch로 PR prompt를 만들지 않는다.

## Secret Scan 및 Diff 원문 보호

PR prompt는 외부 AI provider로 전달될 수 있으므로 원본 diff를 그대로 포함하지 않는 것을 기본값으로 한다.

보안 처리 순서는 다음과 같다.

1. 변경 파일 목록 수집
2. 민감 파일 제외
3. diff 또는 summary 대상에 secret scan 적용
4. 필요한 경우 `[REDACTED]` 마스킹
5. 원본 diff 대신 summary를 prompt에 포함
6. 외부 provider 전송 전 기존 confirm 또는 policy gate 적용

금지되는 출력은 다음과 같다.

- raw diff 전체
- `.env`, `credentials.json`, private key 파일 내용
- API Key, token, password, private key 값
- GitHub remote URL에 포함된 credential

## Prompt 구성 원칙

생성 prompt는 PR 제목과 본문을 동시에 만들 수 있도록 충분한 구조를 제공하되, 결과 형식은 후속 AE/AF 단계가 쉽게 분리할 수 있게 한다.

권장 prompt 요구사항은 다음과 같다.

- PR 제목은 간결하게 작성한다.
- PR 본문은 `Summary`, `Changes`, `Tests` 섹션을 포함한다.
- 변경 파일 목록과 commit log를 근거로 한다.
- 추측을 최소화하고 확인되지 않은 테스트는 실행하지 않았다고 표시한다.
- Conventional Commits 스타일과 충돌하지 않는 제목을 선호한다.
- secret 또는 token처럼 보이는 문자열을 출력하지 않는다.
- markdown code block으로 결과 전체를 감싸지 않는다.

## Template 연동 계획

프로젝트에 PR template이 있으면 prompt에 반영한다.

검색 후보는 다음과 같다.

- `.github/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.convention/pr-template.md`
- config의 template 설정

template이 있어도 secret scan과 출력 정책을 우선한다. template 파일이 깨졌거나 너무 길면 안전한 요약 또는 기본 구조로 fallback한다.

## 오류 처리 계획

오류는 명확하게 분리한다.

- Git 저장소 아님: PR prompt 생성 불가
- base branch 확인 불가: base branch 설정 필요
- 변경 사항 없음: PR prompt 생성 대상 없음
- secret scan 실패: 외부 전송 중단
- diff summary 생성 실패: raw diff fallback 금지, 안전한 요약 실패로 중단

어떤 오류에서도 commit, push, reset, PR 생성이 자동 실행되지 않는다.

## 완료 기준

- `buildPrPrompt()`가 현재 branch, base branch, commit log, diff summary, changed files를 입력받아 PR 생성 prompt를 반환한다.
- prompt에는 PR 제목/본문 생성 기준이 명확히 포함된다.
- raw diff와 secret 값이 prompt에 그대로 들어가지 않는다.
- 민감 파일 제외와 secret scan 정책이 재사용된다.
- base branch 또는 변경 사항이 없을 때 명확히 중단한다.
- Git 명령은 인자 배열 방식으로만 실행하도록 계획된다.
