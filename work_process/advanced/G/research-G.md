# Phase G Commit Decision Flow Agent Research

## 1. 개요

Phase G는 Phase C~F에서 만든 Preview, Confirm UX, Regenerate, Manual Edit을 하나의 commit decision flow로 통합합니다. batch와 step 모두 같은 결정 흐름을 사용해야 하며, 사용자가 명시적으로 Commit을 선택하기 전에는 Git 히스토리를 변경하지 않아야 합니다.

## 2. 작업 목표

- AI 메시지 생성 후 preview를 출력합니다.
- 사용자 선택을 받아 Commit, Regenerate, Edit, Cancel로 분기합니다.
- Regenerate는 AI 재호출 후 다시 preview로 돌아갑니다.
- Edit은 사용자 입력 후 다시 preview 또는 commit 결정으로 돌아갑니다.
- Commit 선택 시에만 `git add`와 `git commit`을 실행합니다.
- batch/step commit flow에서 중복 구현을 줄이고 공통 함수로 관리합니다.

## 3. 구현 범위

- `src/commands/commit.js`
  - `runCommitDecisionFlow()` 또는 동등한 공통 함수
  - batch/step 흐름 연결
- `src/utils/ui.js`
  - preview, decision, manual edit 함수 통합 사용
- `src/core/ai.js`
  - message generation 재사용
- `src/core/git.js`
  - add/commit 호출 순서 유지

## 4. 권장 구현 방향

공통 decision flow는 아래 입력을 받는 형태가 적합합니다.

```javascript
async function runCommitDecisionFlow({
  initialPrompt,
  diff,
  files,
  config,
  mode,
  commitFiles
}) {
  // generate -> preview -> decision loop -> commit/cancel
}
```

`commitFiles`가 있으면 step 모드처럼 파일별 add/commit을 수행하고, 없으면 batch 모드처럼 전체 add/commit을 수행합니다. decision loop는 상태를 명확히 관리해야 합니다.

## 5. 보안 및 안정성 기준

- decision flow 어디에서도 사용자 confirm 없이 commit하지 않습니다.
- Regenerate/Edit 이후에도 commit 전 preview를 다시 거칩니다.
- Cancel은 항상 Git 작업 없이 종료합니다.
- AI 실패, prompt 실패, 빈 메시지, 재생성 제한 초과는 commit으로 fallback하지 않습니다.
- diff 원문과 secret을 출력하지 않습니다.

## 6. 완료 기준

- `convention --batch`, `convention --step`, `convention`이 동일한 decision flow를 사용합니다.
- Commit / Regenerate / Edit manually / Cancel이 모두 의도대로 동작합니다.
- 사용자 승인 전 `git add`와 `git commit`이 실행되지 않습니다.
- 기존 1차/2차 commit flow, `--push`, `--reset` 정책을 깨지 않습니다.

