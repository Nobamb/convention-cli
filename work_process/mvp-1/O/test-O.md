# Phase O Git Diff 전체 추출 Agent Test

`research-O.md`의 구현 기준을 바탕으로, `getFullDiff()`가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `getFullDiff()` export 확인 | `src/core/git.js` 코드 확인 | 다른 모듈에서 `getFullDiff`를 import할 수 있다. |
| V-2 | diff 명령 확인 | Git command 실행 코드 확인 | `git -c core.quotepath=false diff HEAD`를 사용한다. |
| V-3 | 인자 배열 방식 확인 | Git command 실행 코드 확인 | shell 문자열이 아니라 `["-c", "core.quotepath=false", "diff", "HEAD"]` 배열을 사용한다. |
| V-4 | UTF-8 출력 확인 | child process 옵션 확인 | `encoding: "utf8"`을 지정한다. |
| V-5 | staged/unstaged 포함 기준 확인 | 구현 및 테스트 확인 | `git diff HEAD` 기준으로 staged와 unstaged tracked 변경을 포함한다. |
| V-6 | untracked 한계 문서화 확인 | 테스트 문서 확인 | untracked-only 파일 내용은 기본 diff에 포함되지 않는다고 명시한다. |
| V-7 | raw diff 로그 금지 확인 | `console`/logger 사용 검색 | diff 원문을 출력하지 않는다. |

## 2. 기능 테스트 항목

### T-1: 변경사항 없음
- **준비:** initial commit 이후 변경사항이 없는 clean repo를 준비한다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** 빈 문자열 `""`을 반환한다.

### T-2: unstaged tracked 변경 포함
- **준비:** tracked 파일을 수정하고 `git add`는 하지 않는다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** 반환 diff에 `diff --git`과 수정 내용이 포함된다.

### T-3: staged 변경 포함
- **준비:** tracked 파일을 수정한 뒤 `git add <file>`로 staged 상태를 만든다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** staged 변경도 diff에 포함된다.

### T-4: staged와 unstaged 변경 동시 포함
- **준비:** 파일 A는 staged, 파일 B는 unstaged 상태로 만든다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** 두 파일의 변경 diff가 모두 포함된다.

### T-5: tracked 파일 삭제
- **준비:** initial commit된 파일을 삭제한다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** 삭제 diff 또는 `deleted file` 정보가 포함된다.

### T-6: 한글 파일명 diff
- **준비:** `한글파일.md`를 tracked 상태로 만든 뒤 수정한다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** diff header에서 한글 파일명이 readable하게 표시된다.

### T-7: staged 신규 파일 포함
- **준비:** 새 파일을 만들고 내용을 작성한 뒤 `git add <file>`로 staged 상태를 만든다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** 반환 diff에 `diff --git`, `new file mode`, 신규 파일 내용이 포함된다.

### T-8: untracked-only 파일 미포함
- **준비:** 새 파일을 만들되 `git add` 하지 않는다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** untracked-only 파일 내용은 diff에 포함되지 않는다.

### T-9: raw diff 미출력
- **준비:** `console.log`, `console.error`, logger 함수를 spy 또는 mock 처리한다.
- **실행:** diff가 있는 상태에서 `getFullDiff()`를 호출한다.
- **예상 결과:** diff 문자열은 반환되지만 console/logger에는 출력되지 않는다.

### T-10: Git 저장소 밖 실패 흐름
- **준비:** Git 저장소가 아닌 임시 디렉터리에서 테스트를 수행한다.
- **실행:** `getFullDiff()`를 호출한다.
- **예상 결과:** Git 명령 실패가 호출자에게 전달되며, 사용자 친화 메시지는 command layer에서 처리한다.

## 3. 테스트 절차

1. 원래 작업 디렉터리를 `originalCwd`로 저장한다.
2. 임시 디렉터리에 테스트용 Git 저장소를 생성한다.
3. `git init`, local `user.email`, local `user.name` 설정을 수행한다.
4. 기본 파일을 만들고 테스트 repo 내부에서만 initial commit을 생성한다.
5. 케이스별로 staged, unstaged, staged 신규 파일, untracked-only 파일, 삭제, 한글 파일명 변경을 만든다.
6. `process.chdir(repoDir)` 상태에서 `getFullDiff()`를 호출한다.
7. 반환 diff 문자열에 필요한 header나 변경 내용이 포함되는지 확인한다.
8. raw diff가 console/logger로 출력되지 않았는지 spy로 확인한다.
9. 테스트 종료 후 `process.chdir(originalCwd)`로 복원한다.

## 4. 테스트 환경 주의사항

- 실제 사용자 저장소에서 commit 테스트를 하지 않습니다.
- 테스트용 initial commit은 임시 저장소 안에서만 수행합니다.
- `getFullDiff()`는 diff 원문을 반환하지만 출력하지 않아야 합니다.
- untracked-only 파일 내용은 `git diff HEAD`에 포함되지 않습니다.
- 민감 파일, credentials, private key, `.env` 내용을 테스트 출력에 포함하지 않습니다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** Phase O 완료 및 batch 모드 prompt 생성 단계 진입 가능
- **실패 항목 존재 시:** `git diff HEAD` 사용 여부, staged 포함 여부, `core.quotepath=false`, raw diff 로그 금지, untracked 한계 문서화를 우선 점검합니다.

## 8-2. 신규 untracked 파일 테스트 갱신

`init/prompt.md` 8-2 기준에 따라 untracked-only 신규 파일은 더 이상 제외 대상이 아닙니다.

- 새 파일을 만들고 `git add` 하지 않은 상태에서 `getFullDiff()`를 호출하면 `new file mode`와 파일 내용이 포함되어야 합니다.
- 새 디렉터리 아래 여러 파일을 만들면 `git status --porcelain -uall` 기준으로 파일 단위 diff가 생성되어야 합니다.
- `.env`, `.env.local`, `*.pem`, `*.key`, `credentials.json`, `secrets.json` 같은 민감 신규 파일은 diff에 포함되지 않아야 합니다.
- batch commit flow에서는 신규 일반 파일이 confirm 이후 `git add` 및 `git commit`까지 한 번에 처리되어야 합니다.
