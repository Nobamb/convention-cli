# Phase F Manual Edit Agent Research

## 1. 개요

Phase F는 사용자가 AI가 생성한 커밋 메시지를 직접 수정할 수 있게 하는 단계입니다. AI 메시지는 기본값으로 제공하되, 최종 commit에는 사용자가 수정한 메시지가 사용되어야 합니다.

## 2. 작업 목표

- Edit manually 선택 시 기존 AI 메시지를 기본값으로 입력창에 표시합니다.
- 사용자가 수정한 메시지를 반환합니다.
- 빈 메시지, 공백뿐인 메시지, 지나치게 긴 입력을 안전하게 처리합니다.
- 수정된 메시지를 다시 preview하거나 commit 선택으로 이어갈 수 있게 decision flow와 연결합니다.
- Conventional Commits 형식 검증은 경고 또는 hard fail 정책 중 하나로 명확히 정합니다.

## 3. 구현 범위

- `src/utils/ui.js`
  - `promptCommitMessageEdit(currentMessage)`
- `src/commands/commit.js`
  - edit 선택 처리
  - 수정 메시지 검증 후 commit 흐름 연결
- `src/core/ai.js`
  - `cleanAIResponse()`와 별개로 사용자 입력 정리 기준 재사용 여부 검토
- `src/utils/validator.js`
  - 필요 시 commit message validation 추가

## 4. 권장 구현 방향

manual edit은 AI 호출 없이 동작해야 합니다. 입력값은 앞뒤 공백을 제거하고 빈 값이면 다시 입력을 요구하거나 cancel 처리합니다.

사용자 수정 후에는 두 가지 방식 중 하나를 선택합니다.

1. 수정 메시지를 다시 preview하고 Commit/Cancel 선택
2. 수정 메시지 확인 후 바로 commit 선택 UI로 이동

3차 Phase 1의 일관성을 위해 첫 번째 방식을 권장합니다.

## 5. 보안 및 안정성 기준

- 사용자가 입력한 메시지를 shell 문자열에 삽입하지 않고 `execFileSync("git", ["commit", "-m", message])` 흐름을 유지합니다.
- 빈 메시지로 commit하지 않습니다.
- prompt 취소는 안전한 cancel로 처리합니다.
- 사용자 입력 메시지에 secret이 있을 가능성이 있으므로 불필요한 로그 반복 출력은 피합니다.

## 6. 완료 기준

- 사용자는 AI 메시지를 직접 수정할 수 있습니다.
- 수정된 메시지가 최종 commit message로 사용됩니다.
- 빈 입력 또는 취소 시 commit이 실행되지 않습니다.
- batch/step 모두 manual edit 흐름을 사용할 수 있습니다.

