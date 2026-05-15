# Phase F Manual Edit Agent Test

`research-F.md` 기준으로 사용자가 커밋 메시지를 직접 수정하고, 수정된 메시지로만 commit이 진행되는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| F-V-1 | manual edit UI 함수 존재 | `src/utils/ui.js` 확인 | `promptCommitMessageEdit()` 또는 동등한 함수가 존재한다. |
| F-V-2 | 기본값 전달 | UI 호출부 확인 | 기존 AI 메시지가 입력 기본값으로 전달된다. |
| F-V-3 | 빈 메시지 차단 | UI/validator 확인 | 빈 문자열 또는 공백 입력이 commit으로 전달되지 않는다. |
| F-V-4 | 안전한 git commit 인자 | `src/core/git.js` 확인 | commit message가 shell 문자열이 아니라 argv 배열로 전달된다. |

## 2. 기능 테스트 항목

### F-T-1: 기본 AI 메시지 표시

- **준비:** AI 응답을 `feat: add preview flow`로 mock한다.
- **실행:** Edit manually를 선택한다.
- **예상 결과:** 입력창 기본값으로 기존 AI 메시지가 전달된다.

### F-T-2: 수정 메시지로 commit

- **준비:** manual edit UI가 `feat: add decision flow`를 반환하도록 mock한다.
- **실행:** 이후 Commit을 선택한다.
- **예상 결과:** `git commit -m`에 수정된 메시지가 전달된다.

### F-T-3: 빈 메시지 거부

- **준비:** manual edit UI가 빈 문자열 또는 공백을 반환하도록 mock한다.
- **실행:** edit 흐름을 실행한다.
- **예상 결과:** git add/commit이 호출되지 않고 재입력 또는 cancel 처리된다.

### F-T-4: 입력 취소

- **준비:** manual edit UI가 undefined 또는 null을 반환하도록 mock한다.
- **실행:** Edit manually를 선택한다.
- **예상 결과:** 안전하게 cancel 처리되고 commit이 실행되지 않는다.

### F-T-5: 한글 메시지 처리

- **준비:** manual edit UI가 `feat: 사용자 검토 흐름 추가`를 반환하도록 mock한다.
- **실행:** 격리 저장소에서 commit까지 진행한다.
- **예상 결과:** UTF-8 메시지로 정상 commit된다.

## 3. 테스트 절차

1. prompts 입력은 mock 처리한다.
2. Git commit 호출 인자를 검증하거나 격리 저장소에서 실제 commit한다.
3. 빈 입력, 취소, 한글 입력을 별도 케이스로 나눈다.
4. stdout/stderr에 불필요한 메시지 반복 출력이 없는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** manual edit 기능이 안전하게 commit flow에 연결됨.
- **실패 항목 존재 시:** 빈 입력 처리와 commit message 전달 방식을 우선 수정한다.

