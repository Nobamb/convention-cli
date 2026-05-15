# Phase D Confirm UX Agent Research

## 1. 개요

Phase D는 기존 Yes/No confirm을 다중 선택 결정 UI로 확장합니다. 사용자는 AI 메시지를 확인한 뒤 Commit, Regenerate, Edit manually, Cancel 중 하나를 선택할 수 있어야 합니다.

## 2. 작업 목표

- 단순 confirm 대신 commit decision 선택지를 제공합니다.
- 선택 결과를 commit flow가 해석할 수 있는 안정적인 enum 값으로 반환합니다.
- interactive prompt가 취소되거나 입력이 비정상인 경우 안전하게 Cancel 처리합니다.
- 기존 `confirmAction(message)`은 reset/push 등 단순 확인이 필요한 곳에서 계속 사용할 수 있게 유지합니다.

## 3. 구현 범위

- `src/utils/ui.js`
  - `selectCommitDecision()` 또는 `confirmCommitDecision()`
  - 선택지: `commit`, `regenerate`, `edit`, `cancel`
- `src/commands/commit.js`
  - decision 결과에 따라 후속 흐름 분기

## 4. 권장 구현 방향

`prompts`의 select를 사용해 다중 선택 UI를 구성합니다. 반환값은 화면 텍스트가 아니라 내부 상수로 처리합니다.

```javascript
export const COMMIT_DECISIONS = {
  COMMIT: "commit",
  REGENERATE: "regenerate",
  EDIT: "edit",
  CANCEL: "cancel"
};
```

사용자 입력이 취소되면 `cancel`을 반환하여 commit이 실행되지 않게 합니다. 이 단계에서는 regenerate/edit 자체 구현보다 선택값을 안전하게 전달하는 구조가 핵심입니다.

## 5. 보안 및 안정성 기준

- 사용자가 `commit`을 명시적으로 선택하지 않으면 `git add`와 `git commit`을 실행하지 않습니다.
- reset/push confirm 정책을 이 변경으로 약화하지 않습니다.
- prompt 에러나 Ctrl+C는 안전 취소로 처리합니다.
- 선택지에 diff 원문이나 secret을 포함하지 않습니다.

## 6. 완료 기준

- Commit / Regenerate / Edit manually / Cancel 선택지가 제공됩니다.
- 선택 결과가 commit flow에 명확히 전달됩니다.
- 취소 또는 prompt 실패 시 commit이 발생하지 않습니다.

