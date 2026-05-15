# Phase E Regenerate Agent Test

`research-E.md` 기준으로 AI 커밋 메시지 재생성이 기존 diff를 유지하고 안전한 반복 흐름으로 동작하는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| E-V-1 | maxRegenerateCount 기본값 | `src/config/defaults.js` 확인 | 기본 제한값이 정의되어 있다. |
| E-V-2 | regeneration prompt 기준 | `src/core/prompt.js` 확인 | 이전 메시지와 다른 표현을 요구하는 instruction이 있다. |
| E-V-3 | decision loop 연결 | `src/commands/commit.js` 확인 | `regenerate` 선택 시 AI 재호출 후 preview로 돌아간다. |
| E-V-4 | 실패 시 commit 차단 | commit flow 확인 | 재생성 실패 또는 빈 응답 시 git commit이 호출되지 않는다. |

## 2. 기능 테스트 항목

### E-T-1: Regenerate 선택 시 AI 재호출

- **준비:** decision UI가 첫 번째는 `regenerate`, 두 번째는 `cancel`을 반환하도록 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** `generateCommitMessage()`가 2회 호출되고 commit은 실행되지 않는다.

### E-T-2: 이전 메시지 전달

- **준비:** 첫 번째 AI 응답을 `chore: update project files`로 mock한다.
- **실행:** Regenerate를 선택한다.
- **예상 결과:** 두 번째 prompt에 이전 메시지와 다른 표현 요청이 포함된다.

### E-T-3: 재생성 후 preview 재출력

- **준비:** 두 번째 AI 응답을 다른 메시지로 mock한다.
- **실행:** Regenerate를 선택한다.
- **예상 결과:** 새 메시지가 preview에 표시된다.

### E-T-4: 재생성 제한 초과

- **준비:** decision UI가 계속 `regenerate`를 반환하도록 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** `maxRegenerateCount`를 초과하면 추가 AI 호출을 하지 않고 안내 후 안전 종료 또는 decision으로 복귀한다.

### E-T-5: 재생성 실패

- **준비:** 두 번째 AI 호출이 에러를 던지게 mock한다.
- **실행:** Regenerate를 선택한다.
- **예상 결과:** 에러가 안전하게 처리되고 git add/commit이 실행되지 않는다.

## 3. 테스트 절차

1. AI provider는 mock으로 고정한다.
2. decision UI와 preview UI는 spy/mock 처리한다.
3. AI 호출 횟수, prompt 내용, commit 호출 여부를 검증한다.
4. 외부 네트워크 호출이 발생하지 않는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** 재생성 기능이 안전한 decision loop 안에서 동작함.
- **실패 항목 존재 시:** 재생성 횟수 제한, prompt 구성, 실패 처리부터 수정한다.

