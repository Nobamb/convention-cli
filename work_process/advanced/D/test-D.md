# Phase D Confirm UX Agent Test

`research-D.md` 기준으로 커밋 전 다중 선택 UX가 의도대로 분기하고 안전 취소를 보장하는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| D-V-1 | decision UI 함수 존재 | `src/utils/ui.js` 확인 | commit decision을 반환하는 함수가 존재한다. |
| D-V-2 | 선택지 enum 사용 | UI/commit 코드 확인 | 화면 문자열 대신 `commit`, `regenerate`, `edit`, `cancel` 같은 내부 값으로 분기한다. |
| D-V-3 | 기존 confirm 유지 | `src/utils/ui.js` 확인 | reset/push 등에 쓰는 `confirmAction()`이 제거되지 않았다. |
| D-V-4 | commit 명시 선택 보장 | `src/commands/commit.js` 확인 | `commit` 선택일 때만 git add/commit이 호출된다. |

## 2. 기능 테스트 항목

### D-T-1: Commit 선택

- **준비:** decision UI를 `commit` 반환으로 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** preview 이후 `git add`와 `git commit` 단계로 진행한다.

### D-T-2: Regenerate 선택

- **준비:** decision UI를 `regenerate` 반환으로 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** 즉시 commit하지 않고 재생성 흐름으로 분기한다.

### D-T-3: Edit manually 선택

- **준비:** decision UI를 `edit` 반환으로 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** 즉시 commit하지 않고 수동 수정 입력 흐름으로 분기한다.

### D-T-4: Cancel 선택

- **준비:** decision UI를 `cancel` 반환으로 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** git add/commit 없이 안전 종료한다.

### D-T-5: prompt 취소 또는 예외

- **준비:** prompts가 undefined를 반환하거나 예외를 던지게 mock한다.
- **실행:** decision UI를 호출한다.
- **예상 결과:** `cancel`과 동일하게 처리되고 commit이 실행되지 않는다.

## 3. 테스트 절차

1. UI 함수는 mock으로 각 선택값을 강제한다.
2. Git 명령 wrapper는 spy/mock으로 호출 여부를 검증한다.
3. 실제 commit은 격리 저장소에서만 수행한다.
4. reset/push confirm 테스트가 회귀하지 않는지 기존 테스트를 함께 실행한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** commit 전 결정 UX가 안전하게 확장됨.
- **실패 항목 존재 시:** decision enum, 취소 처리, commit 호출 조건을 우선 수정한다.

