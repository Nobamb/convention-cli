# Phase N Git 변경 파일 목록 Agent Test

`research-N.md`의 구현 기준을 바탕으로, `getChangedFiles()`가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `getChangedFiles()` export 확인 | `src/core/git.js` 코드 확인 | 다른 모듈에서 `getChangedFiles`를 import할 수 있다. |
| V-2 | status 명령 확인 | Git command 실행 코드 확인 | `git -c core.quotepath=false status --porcelain`을 사용한다. |
| V-3 | 인자 배열 방식 확인 | Git command 실행 코드 확인 | shell 문자열이 아니라 `["-c", "core.quotepath=false", "status", "--porcelain"]` 배열을 사용한다. |
| V-4 | UTF-8 출력 확인 | child process 옵션 확인 | `encoding: "utf8"`을 지정한다. |
| V-5 | 빈 목록 처리 확인 | 함수 구현 확인 | Git 출력이 비어 있으면 `[]`를 반환한다. |
| V-6 | path 파싱 기준 확인 | parser 구현 확인 | 일반 line은 `line.slice(3)` 기준으로 path를 추출한다. |
| V-7 | rename 처리 확인 | parser 구현 확인 | `old -> new` 형식은 새 경로를 반환한다. |
| V-8 | diff 로그 금지 확인 | `src/core/git.js` 출력 코드 확인 | 변경 파일 목록이나 diff 원문을 불필요하게 출력하지 않는다. |

## 2. 기능 테스트 항목

### T-1: 변경사항 없음
- **준비:** 임시 Git 저장소를 만들고 initial commit 이후 추가 변경을 만들지 않는다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** `[]`를 반환한다.

### T-2: tracked 파일 수정
- **준비:** initial commit된 `README.md`를 수정한다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** `["README.md"]`를 포함한다.

### T-3: 신규 untracked 파일
- **준비:** 아직 `git add` 하지 않은 `new-file.js`를 생성한다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** `["new-file.js"]`를 포함한다.

### T-4: tracked 파일 삭제
- **준비:** initial commit된 `old-file.js`를 삭제한다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** `["old-file.js"]`를 포함한다.

### T-5: 공백 포함 파일명
- **준비:** `file with space.js`를 생성하거나 수정한다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** 파일명이 잘리지 않고 `file with space.js`로 반환된다.

### T-6: 한글 파일명
- **준비:** `한글파일.md`를 생성하거나 수정한다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** octal escape가 아니라 `한글파일.md` 형태로 반환된다.

### T-7: rename 파일
- **준비:** tracked 파일 `old-name.js`를 `new-name.js`로 rename한다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** 1차 MVP 기준으로 새 경로 `new-name.js`를 반환한다.

### T-8: untracked 파일과 diff 단계 혼동 방지
- **준비:** untracked 파일만 존재하는 상태를 만든다.
- **실행:** `getChangedFiles()`를 호출한다.
- **예상 결과:** 목록에는 포함되지만, Phase O/P의 `git diff HEAD`에서는 내용 diff가 나오지 않는다는 점을 테스트 문서에 명시한다.

## 3. 테스트 절차

1. 원래 작업 디렉터리를 `originalCwd`로 저장한다.
2. 임시 디렉터리에 테스트용 Git 저장소를 생성한다.
3. `git init`을 실행하고, 테스트 repo 내부에서만 `user.email`, `user.name`을 설정한다.
4. 기본 파일을 생성한 뒤 `git add`와 `git commit -m "chore: initial commit"`으로 initial commit을 만든다.
5. 각 테스트 케이스마다 필요한 파일 수정, 생성, 삭제, rename을 수행한다.
6. `process.chdir(repoDir)` 상태에서 `getChangedFiles()`를 호출한다.
7. 반환 배열의 파일명, 공백, 한글, rename 새 경로를 검증한다.
8. 각 케이스 사이에는 새 임시 repo를 만들거나 working tree를 안전하게 재구성한다.
9. 테스트 종료 후 `process.chdir(originalCwd)`로 복원한다.

## 4. 테스트 환경 주의사항

- initial commit은 테스트용 임시 저장소에서만 수행합니다.
- 실제 사용자 저장소에서 commit, reset, destructive command를 실행하지 않습니다.
- `git status --porcelain` 출력은 파일 목록 확인용이며 diff 원문을 출력하지 않습니다.
- untracked 파일은 `getChangedFiles()` 목록에는 포함되지만 `git diff HEAD` 내용에는 포함되지 않을 수 있습니다.
- 파일명 자체도 사용자 데이터일 수 있으므로 전체 파일 목록을 로그로 남기지 않습니다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** Phase N 완료 및 Phase O/P diff 추출 단계 진입 가능
- **실패 항목 존재 시:** `core.quotepath=false`, UTF-8 encoding, `line.slice(3)` 파싱, rename 새 경로 반환, 빈 목록 처리를 우선 점검합니다.
