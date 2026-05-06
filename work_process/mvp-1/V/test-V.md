# Phase V Batch Mode Agent Test

`research-V.md` 기준으로 `runBatchCommit()`이 1차 MVP의 batch commit 흐름을 충족하는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | 함수 export 확인 | `src/commands/commit.js` 확인 | `runBatchCommit`을 import할 수 있다. |
| V-2 | Git 저장소 확인 연결 | 코드 구조 확인 | `isGitRepository()` 실패 시 흐름이 중단된다. |
| V-3 | 변경 파일 확인 연결 | 코드 구조 확인 | `getChangedFiles()` 결과가 비면 AI 호출이 없다. |
| V-4 | 전체 diff 추출 연결 | 코드 구조 확인 | `getFullDiff()` 결과로 prompt를 만든다. |
| V-5 | batch prompt 생성 | 코드 구조 확인 | `buildCommitPrompt({ mode: 'batch' })`가 호출된다. |
| V-6 | Mock AI 및 cleanup 연결 | 코드 구조 확인 | `generateCommitMessage()`와 `cleanAIResponse()`가 순서대로 호출된다. |
| V-7 | confirm 이후 commit | 코드 구조 확인 | 사용자 승인 이후에만 `addAll()`과 `commit()`이 호출된다. |
| V-8 | 민감 정보 로그 금지 | console/logger 검색 | diff 원문이나 secret 후보 문자열을 출력하지 않는다. |

## 2. 기능 테스트 항목

### T-1: Git 저장소가 아닌 경우
- **준비:** Git 저장소가 아닌 임시 디렉터리에서 실행한다.
- **실행:** `runBatchCommit()` 또는 `convention --batch`
- **예상 결과:** Git 저장소가 아니라는 안내 후 종료하고 AI, add, commit을 호출하지 않는다.

### T-2: 변경사항이 없는 경우
- **준비:** clean 상태의 격리된 Git 테스트 저장소를 만든다.
- **실행:** `runBatchCommit()`
- **예상 결과:** 변경사항 없음 안내 후 종료하고 prompt 생성, AI 호출, commit을 하지 않는다.

### T-3: batch commit 정상 흐름
- **준비:** 격리된 Git 테스트 저장소에 tracked 파일 변경을 만든다.
- **실행:** confirm 입력을 승인으로 제공하고 `runBatchCommit()`을 실행한다.
- **예상 결과:** Mock Provider 메시지 `chore: update project files`가 정리되어 표시되고, `git add -A` 후 `git commit -m`이 실행된다.

### T-4: confirm 거부
- **준비:** 변경사항이 있는 격리된 Git 테스트 저장소를 만든다.
- **실행:** confirm 입력을 거부로 제공한다.
- **예상 결과:** `addAll()`과 `commit()`이 호출되지 않고 Git 히스토리가 변경되지 않는다.

### T-5: 민감 파일만 변경된 경우
- **준비:** `.env` 또는 `credentials.json`만 변경한다.
- **실행:** `runBatchCommit()`
- **예상 결과:** 민감 파일 제외 후 커밋 가능한 diff가 없다는 흐름으로 중단하고 AI 호출 및 commit을 하지 않는다.

### T-6: 일반 파일과 민감 파일이 같이 변경된 경우
- **준비:** 일반 tracked 파일과 `.env` 파일을 함께 변경한다.
- **실행:** `runBatchCommit()`
- **예상 결과:** prompt에는 일반 파일 diff만 반영되고, 민감 파일 내용은 출력되거나 AI로 전달되지 않는다.

### T-7: AI 응답 정리 실패
- **준비:** AI Provider test double이 빈 응답을 반환하도록 구성한다.
- **실행:** `runBatchCommit()`
- **예상 결과:** cleanup 에러로 중단되고 `addAll()`과 `commit()`은 호출되지 않는다.

## 3. 테스트 절차

1. `tests/`에 batch command 단위 테스트를 추가한다.
2. Git 조작은 실제 사용자 저장소가 아닌 임시 디렉터리 또는 fixture 저장소에서 수행한다.
3. AI Provider와 사용자 confirm은 test double로 대체한다.
4. commit 테스트는 격리된 저장소에서만 수행하고 실제 작업 저장소의 히스토리를 변경하지 않는다.
5. console/logger spy로 diff 원문과 secret 후보 문자열이 출력되지 않는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** Phase V 완료 및 Phase X batch 라우팅 연결 가능
- **실패 항목 존재 시:** confirm gate, 민감 파일 제외, Git add/commit 호출 순서를 우선 점검한다.
