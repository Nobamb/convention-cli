# Phase P Git Diff 파일별 추출 Agent Test

`research-P.md`의 구현 기준을 바탕으로, `getFileDiffs(files)`가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `getFileDiffs(files)` export 확인 | `src/core/git.js` 코드 확인 | 다른 모듈에서 `getFileDiffs`를 import할 수 있다. |
| V-2 | 파일별 diff 명령 확인 | Git command 실행 코드 확인 | `git -c core.quotepath=false diff HEAD -- <file>` 의미로 실행한다. |
| V-3 | 인자 배열 방식 확인 | Git command 실행 코드 확인 | 파일 경로를 shell 문자열이 아니라 argv 배열의 단일 인자로 전달한다. |
| V-4 | `--` pathspec 구분자 확인 | Git args 확인 | `["diff", "HEAD", "--", file]` 구조를 사용한다. |
| V-5 | UTF-8 출력 확인 | child process 옵션 확인 | `encoding: "utf8"`을 지정한다. |
| V-6 | 입력 검증 확인 | 함수 구현 확인 | 배열이 아닌 입력은 `TypeError`, 빈 배열은 `[]`로 처리한다. |
| V-7 | 빈 diff 제외 확인 | 함수 구현 확인 | `diff.trim()`이 비어 있는 파일은 결과에서 제외한다. |
| V-8 | raw diff 로그 금지 확인 | `console`/logger 사용 검색 | 파일별 diff 원문을 출력하지 않는다. |

## 2. 기능 테스트 항목

### T-1: 파일별 diff 반환
- **준비:** tracked 파일 `normal.js`를 수정한다.
- **실행:** `getFileDiffs(["normal.js"])`를 호출한다.
- **예상 결과:** `[{ file: "normal.js", diff: "..." }]` 형태로 반환되고 diff에 `diff --git`이 포함된다.

### T-2: 여러 파일 diff 분리
- **준비:** 파일 A와 파일 B를 각각 수정한다.
- **실행:** `getFileDiffs(["a.js", "b.js"])`를 호출한다.
- **예상 결과:** 각 파일이 별도 배열 원소로 반환된다.

### T-3: 공백 포함 파일명
- **준비:** tracked 파일 `file with space.js`를 수정한다.
- **실행:** `getFileDiffs(["file with space.js"])`를 호출한다.
- **예상 결과:** 파일명이 잘리지 않고 diff가 반환된다.

### T-4: 한글 파일명
- **준비:** tracked 파일 `한글파일.js`를 수정한다.
- **실행:** `getFileDiffs(["한글파일.js"])`를 호출한다.
- **예상 결과:** 반환 객체의 `file` 값이 한글 파일명 그대로이고 diff header도 readable하게 표시된다.

### T-5: tracked 파일 삭제
- **준비:** tracked 파일 `delete-me.js`를 삭제한다.
- **실행:** `getFileDiffs(["delete-me.js"])`를 호출한다.
- **예상 결과:** 삭제 diff가 반환된다.

### T-6: staged 신규 파일
- **준비:** 새 파일을 만들고 `git add <file>`로 staged 상태를 만든다.
- **실행:** `getFileDiffs(["new-file.js"])`를 호출한다.
- **예상 결과:** 신규 파일 diff가 반환된다.

### T-7: untracked-only 파일 제외
- **준비:** 새 파일을 만들지만 `git add` 하지 않는다.
- **실행:** `getFileDiffs(["untracked.js"])`를 호출한다.
- **예상 결과:** `git diff HEAD -- untracked.js`가 빈 diff를 반환하므로 결과 배열에서 제외된다.

### T-8: diff 없는 파일 제외
- **준비:** 변경사항이 없는 tracked 파일 경로를 전달한다.
- **실행:** `getFileDiffs(["clean.js"])`를 호출한다.
- **예상 결과:** `[]`를 반환한다.

### T-9: 빈 배열 입력
- **준비:** 별도 변경사항과 무관하게 빈 배열을 준비한다.
- **실행:** `getFileDiffs([])`를 호출한다.
- **예상 결과:** `[]`를 반환한다.

### T-10: 잘못된 입력
- **준비:** `null`, `undefined`, 문자열 단일값 같은 배열이 아닌 입력을 준비한다.
- **실행:** `getFileDiffs(null)` 같은 호출을 수행한다.
- **예상 결과:** `TypeError`를 던진다.

### T-11: raw diff 미출력
- **준비:** `console.log`, `console.error`, logger 함수를 spy 또는 mock 처리한다.
- **실행:** diff가 있는 상태에서 `getFileDiffs(files)`를 호출한다.
- **예상 결과:** diff 문자열은 반환되지만 console/logger에는 출력되지 않는다.

## 3. 테스트 절차

1. 원래 작업 디렉터리를 `originalCwd`로 저장한다.
2. 임시 디렉터리에 테스트용 Git 저장소를 생성한다.
3. `git init`, local `user.email`, local `user.name` 설정을 수행한다.
4. `normal.js`, `file with space.js`, `한글파일.js`, `delete-me.js`, `clean.js` 등을 만들고 initial commit을 생성한다.
5. 케이스별로 파일 수정, 삭제, staged 신규 파일, untracked-only 파일 상태를 만든다.
6. `process.chdir(repoDir)` 상태에서 `getFileDiffs(files)`를 호출한다.
7. 반환 배열의 길이, `file` 값, diff 포함 여부, 빈 diff 제외 여부를 확인한다.
8. raw diff가 console/logger로 출력되지 않았는지 spy로 확인한다.
9. 테스트 종료 후 `process.chdir(originalCwd)`로 복원한다.

## 4. 테스트 환경 주의사항

- 실제 사용자 저장소에서 commit 테스트를 하지 않습니다.
- 테스트용 initial commit은 임시 저장소 안에서만 수행합니다.
- Git 명령은 테스트 코드에서도 가능하면 인자 배열 방식으로 작성합니다.
- untracked-only 파일은 `getChangedFiles()` 목록에는 나올 수 있지만 `getFileDiffs()` 결과에서는 제외될 수 있습니다.
- diff 원문, secret 후보, `.env`, credentials 내용을 출력하지 않습니다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** Phase P 완료 및 Phase W step commit flow 진입 가능
- **실패 항목 존재 시:** `--` pathspec 구분자, argv 배열 파일 경로 전달, `core.quotepath=false`, 빈 diff 제외, untracked-only 처리, raw diff 로그 금지를 우선 점검합니다.
