# Phase G Commit Decision Flow Agent Test

`research-G.md` 기준으로 Preview, Commit, Regenerate, Edit, Cancel 흐름이 batch/step 모두에서 하나의 안전한 decision flow로 동작하는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| G-V-1 | 공통 decision flow 존재 | `src/commands/commit.js` 확인 | batch/step이 재사용할 수 있는 공통 함수가 있다. |
| G-V-2 | commit 호출 조건 | commit flow 확인 | `commit` 선택일 때만 git add/commit이 호출된다. |
| G-V-3 | regenerate/edit 후 preview | commit flow 확인 | 메시지 변경 후 preview가 다시 실행된다. |
| G-V-4 | 기존 명령 회귀 방지 | CLI 라우팅 확인 | `--push`, `--reset`, `--set-mode`, `--language`, `--model`의 우선순위가 유지된다. |

## 2. 기능 테스트 항목

### G-T-1: batch Commit 흐름

- **준비:** 격리 Git 저장소에 변경 파일을 만들고 decision UI를 `commit`으로 mock한다.
- **실행:** `convention --batch` 흐름을 실행한다.
- **예상 결과:** preview 후 `git add -A`, `git commit -m <message>` 순서로 실행된다.

### G-T-2: batch Cancel 흐름

- **준비:** decision UI를 `cancel`로 mock한다.
- **실행:** `convention --batch` 흐름을 실행한다.
- **예상 결과:** git add/commit 없이 종료한다.

### G-T-3: Regenerate 후 Commit

- **준비:** decision UI가 `regenerate` 이후 `commit`을 반환하도록 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** AI가 재호출되고 새 메시지가 preview된 뒤 commit된다.

### G-T-4: Edit 후 Commit

- **준비:** decision UI가 `edit` 이후 `commit`을 반환하고 edit UI가 수정 메시지를 반환하도록 mock한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** 수정된 메시지가 preview된 뒤 그 메시지로 commit된다.

### G-T-5: step 모드 파일별 흐름

- **준비:** 변경 파일 2개를 만들고 step flow를 실행한다.
- **실행:** 각 파일 또는 step 단위 decision을 `commit`으로 mock한다.
- **예상 결과:** 각 대상 파일에 맞는 add/commit이 수행되고 batch용 `git add -A`로 모든 파일을 한 번에 staging하지 않는다.

### G-T-6: AI 실패 시 commit 차단

- **준비:** provider가 에러 또는 빈 응답을 반환하도록 mock한다.
- **실행:** decision flow를 실행한다.
- **예상 결과:** preview/commit 단계로 넘어가지 않고 안전하게 실패한다.

### G-T-7: push 연결 회귀 확인

- **준비:** `--push` 옵션과 decision `commit`을 mock하고 push 함수 호출을 spy한다.
- **실행:** commit flow를 실행한다.
- **예상 결과:** commit 완료 후에만 push가 호출되며, cancel 시 push도 호출되지 않는다.

## 3. 테스트 절차

1. batch와 step을 별도 케이스로 나눈다.
2. UI 선택은 mock으로 고정해 비대화형 테스트가 가능하게 한다.
3. Git 작업은 격리 저장소 또는 git wrapper spy로 검증한다.
4. 기존 1차/2차 테스트(`npm test`)를 함께 실행해 회귀를 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** 3차 Phase 1 사용자 검토 UX가 하나의 안전한 commit decision flow로 완성됨.
- **실패 항목 존재 시:** commit 호출 조건, loop 상태 관리, step/batch 분리 기준을 우선 수정한다.

