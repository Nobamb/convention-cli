# Phase M Git 저장소 확인 Agent Test

`research-M.md`의 구현 기준을 바탕으로, `isGitRepository()`가 1차 MVP 요구사항을 충족하는지 확인하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-1 | `isGitRepository()` export 확인 | `src/core/git.js` 코드 확인 | 다른 모듈에서 `isGitRepository`를 import할 수 있다. |
| V-2 | Git 명령 확인 | `src/core/git.js` 코드 확인 | `git rev-parse --is-inside-work-tree`를 사용한다. |
| V-3 | 인자 배열 방식 확인 | Git command 실행 코드 확인 | `execFileSync("git", ["rev-parse", "--is-inside-work-tree"], ...)` 또는 동등한 `spawnSync` 배열 방식을 사용한다. |
| V-4 | shell 문자열 금지 확인 | `rg "execSync|shell:\\s*true" src/core/git.js` | `execSync`와 `shell: true`를 사용하지 않고, `execFileSync("git", ["rev-parse", "--is-inside-work-tree"], ...)` 또는 동등한 `spawnSync("git", [...])` 인자 배열 방식을 사용한다. |
| V-5 | boolean 반환 확인 | 함수 구현 확인 | Git 저장소 내부는 `true`, 실패 또는 저장소 밖은 `false`를 반환한다. |
| V-6 | core 출력 없음 확인 | 함수 구현 확인 | `isGitRepository()` 내부에서 `console` 또는 logger를 직접 호출하지 않는다. |
| V-7 | 변경 명령 없음 확인 | `src/core/git.js` 코드 확인 | Phase M에서 `git add`, `git commit`, `git reset`을 실행하지 않는다. |

## 2. 기능 테스트 항목

### T-1: Git 저장소 내부 실행
- **준비:** 임시 디렉터리를 만들고 `git init`을 실행한 뒤 해당 디렉터리에서 테스트를 수행한다.
- **실행:** `isGitRepository()`를 호출한다.
- **예상 결과:** `true`를 반환한다.

### T-2: Git 저장소 밖 실행
- **준비:** Git 저장소가 아닌 임시 디렉터리를 만든 뒤 해당 디렉터리에서 테스트를 수행한다.
- **실행:** `isGitRepository()`를 호출한다.
- **예상 결과:** 예외를 던지지 않고 `false`를 반환한다.

### T-3: Git 명령 실패 상황
- **준비:** `execFileSync` 또는 `spawnSync`를 mock 처리해 Git 명령 실패를 발생시킨다.
- **실행:** `isGitRepository()`를 호출한다.
- **예상 결과:** 예외를 외부로 던지지 않고 `false`를 반환한다.

### T-4: 출력 부작용 없음
- **준비:** `console.log`, `console.error`, logger 함수를 spy 또는 mock 처리한다.
- **실행:** Git 저장소 내부/외부에서 `isGitRepository()`를 호출한다.
- **예상 결과:** core 함수는 사용자 메시지를 직접 출력하지 않는다.

### T-5: command layer 연결 가능성
- **준비:** `src/commands/commit.js`에서 Git flow 진입 전에 호출할 수 있는지 import 경로를 확인한다.
- **실행:** `isGitRepository()` 반환값이 `false`일 때 command layer에서 `error()`로 안내하고 flow를 중단하는 구조를 점검한다.
- **예상 결과:** core의 boolean 결과를 command layer가 사용할 수 있다.

## 3. 테스트 절차

1. 원래 작업 디렉터리를 `originalCwd`로 저장한다.
2. OS 임시 디렉터리 하위에 Phase M 전용 테스트 디렉터리를 생성한다.
3. Git 저장소 내부 케이스용 하위 디렉터리를 만들고 `git init`을 실행한다.
4. `process.chdir(repoDir)` 후 `isGitRepository()`가 `true`를 반환하는지 확인한다.
5. Git 저장소 밖 케이스용 하위 디렉터리를 만들고 `process.chdir(nonRepoDir)` 후 `false`를 반환하는지 확인한다.
6. Git 명령 실패 케이스는 child process 호출을 mock하거나 테스트 가능한 wrapper를 사용해 실패를 유도한다.
7. 각 케이스 종료 후 `process.chdir(originalCwd)`로 복원한다.
8. 임시 디렉터리는 테스트 종료 후 정리한다. 정리 전 대상 경로가 테스트용 임시 경로인지 확인한다.

## 4. 테스트 환경 주의사항

- 실제 사용자 저장소에서 `git add`, `git commit`, `git reset`을 실행하지 않습니다.
- Phase M 테스트는 read-only 저장소 확인에 한정합니다.
- Git 저장소 밖 실패 메시지는 core 함수가 아니라 command layer에서 확인합니다.
- `.env`, credentials, private key, diff 원문을 출력하지 않습니다.
- 테스트에서 임시 디렉터리를 삭제할 때는 경로가 테스트용 root 아래인지 먼저 확인합니다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** Phase M 완료 및 Phase N(`getChangedFiles()`) 진입 가능
- **실패 항목 존재 시:** Git 명령 배열 사용 여부, boolean 반환 규칙, core 출력 부작용, 저장소 밖 예외 처리를 우선 점검합니다.
