# Phase V --reset Agent Test

`research-V.md` 기준으로 `--reset` 명령이 안전하게 라우팅되고, 사용자 확인 이후에만 `git reset HEAD~1`을 실행하는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| V-V-1 | CLI 라우팅 | `bin/convention.js` 확인 | `--reset` 옵션이 `runReset()`으로 라우팅되고 commit flow를 실행하지 않는다. |
| V-V-2 | 허용 reset 명령 | `src/core/git.js` 확인 | `execFileSync("git", ["reset", "HEAD~1"])` 또는 동일한 argv 배열 방식만 사용한다. |
| V-V-3 | hard reset 금지 | 전체 코드 검색 | `git reset --hard` 구현이나 `--hard` 전달 경로가 없다. |
| V-V-4 | confirm 필수 | `src/commands/reset.js` 확인 | `resetLastCommit()` 호출 전 `confirmAction()` 결과를 확인한다. |
| V-V-5 | 오류 출력 정리 | reset 오류 처리 확인 | Git stderr, token, secret, 원격 URL을 그대로 출력하지 않는다. |

## 2. 기능 테스트 항목

### V-T-1: 사용자가 reset을 취소

- **준비:** 격리된 임시 Git 저장소에 커밋 1개 이상 생성
- **실행:** `convention --reset` 실행 후 confirm 질문에서 No 선택
- **예상 결과:** `git reset`이 실행되지 않고 HEAD가 그대로 유지된다.

### V-T-2: 최근 커밋 취소

- **준비:** 격리된 임시 Git 저장소에 파일 변경 후 커밋 생성
- **실행:** `convention --reset` 실행 후 confirm 질문에서 Yes 선택
- **예상 결과:** HEAD가 이전 커밋으로 이동하고 최근 커밋의 변경사항은 working tree에 남는다.

### V-T-3: commit flow 미실행

- **준비:** `runDefaultCommit`, `runStepCommit`, `runBatchCommit`, `push` 호출 여부를 mock 처리
- **실행:** `convention --reset`
- **예상 결과:** reset flow만 실행되고 commit message 생성, git add, git commit, push가 호출되지 않는다.

### V-T-4: Git 저장소 밖 실행

- **준비:** Git 저장소가 아닌 임시 디렉터리
- **실행:** `convention --reset`
- **예상 결과:** reset을 실행하지 않고 Git 저장소가 아니라는 안전한 오류 메시지를 출력한다.

### V-T-5: reset 실패 처리

- **준비:** reset할 이전 커밋이 없거나 Git reset 실패를 mock 처리
- **실행:** `convention --reset` 후 Yes 선택
- **예상 결과:** 실패 메시지는 간결하게 출력되고 raw stderr, token, secret은 노출되지 않는다.

## 3. 테스트 절차

1. 임시 디렉터리에 테스트 Git 저장소를 만든다.
2. 사용자 이름과 이메일을 테스트 저장소에만 설정한다.
3. 파일을 생성하고 첫 커밋을 만든다.
4. 파일을 수정하고 두 번째 커밋을 만든다.
5. `convention --reset`을 실행해 confirm 취소와 승인 흐름을 각각 검증한다.
6. `git status --porcelain`과 `git log --oneline`으로 working tree 보존과 HEAD 이동을 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** `--reset`은 사용자 확인 후 최근 커밋만 취소하고 변경사항을 working tree에 보존한다.
- **실패 항목 존재 시:** confirm 누락, 잘못된 reset 인자, commit flow 혼입, 오류 메시지 노출 여부를 우선 수정한다.
