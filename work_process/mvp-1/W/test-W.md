# Phase W Step Mode Agent Test

`research-W.md` 기준으로 `runStepCommit()`이 파일별 commit workflow를 충족하는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | 함수 export 확인 | `src/commands/commit.js` 확인 | `runStepCommit`을 import할 수 있다. |
| V-2 | Git 저장소 확인 연결 | 코드 구조 확인 | Git 저장소가 아니면 흐름이 중단된다. |
| V-3 | 변경 파일 목록 연결 | 코드 구조 확인 | `getChangedFiles()`를 사용한다. |
| V-4 | 파일별 diff 연결 | 코드 구조 확인 | `getFileDiffs(files)`를 사용한다. |
| V-5 | step prompt 생성 | 코드 구조 확인 | 파일별로 `buildCommitPrompt({ mode: 'step' })`가 호출된다. |
| V-6 | 파일별 AI cleanup 연결 | 코드 구조 확인 | 파일별로 AI 응답을 정리한다. |
| V-7 | 파일별 confirm gate | 코드 구조 확인 | 승인된 파일만 `addFile()`과 `commit()`을 호출한다. |
| V-8 | 민감 정보 로그 금지 | console/logger 검색 | 파일 diff 원문과 secret 후보 문자열을 출력하지 않는다. |

## 2. 기능 테스트 항목

### T-1: 여러 파일 각각 커밋
- **준비:** 격리된 Git 테스트 저장소에 두 개 이상의 tracked 파일 변경을 만든다.
- **실행:** 모든 파일 confirm을 승인하고 `runStepCommit()`을 실행한다.
- **예상 결과:** 각 파일마다 prompt, AI 생성, cleanup, `addFile(file)`, `commit(message)`가 순서대로 실행된다.

### T-2: 파일별 confirm 거부
- **준비:** 두 개 이상의 변경 파일을 만든다.
- **실행:** 첫 번째 파일은 거부, 두 번째 파일은 승인한다.
- **예상 결과:** 거부한 파일은 commit되지 않고, 승인한 파일만 staging 및 commit된다.

### T-3: diff가 없는 파일 제외
- **준비:** 변경 파일 목록에 diff가 없는 파일이 포함되도록 test double을 구성한다.
- **실행:** `runStepCommit()`
- **예상 결과:** diff가 없는 파일은 prompt 생성과 commit 대상에서 제외된다.

### T-4: 민감 파일 제외
- **준비:** `.env`, `*.pem`, `credentials.json` 등 민감 파일과 일반 파일을 같이 변경한다.
- **실행:** `runStepCommit()`
- **예상 결과:** 민감 파일은 prompt, AI 호출, add, commit 대상에서 제외되고 일반 파일만 처리된다.

### T-5: 일부 파일 AI 응답 실패
- **준비:** 특정 파일에 대해서만 AI Provider test double이 빈 응답을 반환하도록 구성한다.
- **실행:** `runStepCommit()`
- **예상 결과:** 해당 파일은 commit되지 않으며, 구현 정책에 따라 즉시 중단 또는 명확한 skip 처리가 발생한다.

### T-6: 파일 staging 실패
- **준비:** `addFile(file)` test double이 에러를 던지도록 구성한다.
- **실행:** `runStepCommit()`
- **예상 결과:** `commit(message)`는 호출되지 않고 실패가 사용자에게 전달된다.

### T-7: 공백 및 non-ASCII 파일명
- **준비:** `docs/한글 파일.md`, `space name.txt` 같은 파일을 변경한다.
- **실행:** `runStepCommit()`
- **예상 결과:** 파일 경로가 shell 문자열로 깨지지 않고 `addFile(file)`에 단일 인자로 전달된다.

## 3. 테스트 절차

1. command layer 단위 테스트에서는 Git, AI, prompt, confirm 함수를 test double로 분리한다.
2. 실제 Git commit이 필요한 검증은 임시 저장소에서만 수행한다.
3. confirm 입력은 자동화 가능한 stdin mock 또는 UI helper mock으로 처리한다.
4. 민감 파일 제외 테스트에서는 secret 후보 문자열이 console/logger로 출력되지 않는지 spy로 확인한다.
5. 실패 케이스에서 Git 히스토리가 변경되지 않았는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** Phase W 완료 및 Phase X step 라우팅 연결 가능
- **실패 항목 존재 시:** 파일별 diff 분리, confirm gate, 파일 경로 argv 전달, 실패 처리 정책을 우선 점검한다.
