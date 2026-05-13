# Phase W Push/Reset 안전 확인 Agent Test

`research-W.md` 기준으로 push/reset 같은 위험 Git 명령이 사용자 확인 없이 실행되지 않고, 취소 시 안전하게 종료되는지 검증한다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| W-V-1 | reset confirm 필수 | `runReset()` 호출 경로 확인 | `confirmAction()`이 true일 때만 `resetLastCommit()`이 호출된다. |
| W-V-2 | hard reset 금지 | `src/core/git.js`, `src/commands/reset.js` 검색 | `--hard` reset 구현이 없다. |
| W-V-3 | push 확인 정책 | commit 완료 후 push 경로 확인 | push 실행 전 확인 여부가 명확히 분리되어 있다. |
| W-V-4 | 취소 안전 종료 | `confirmAction()` 반환값 처리 확인 | false, 취소, 예외 상황에서 위험 Git 명령이 실행되지 않는다. |
| W-V-5 | secret 출력 방지 | push/reset error 처리 확인 | token, API Key, 인증 포함 remote URL, credentials 원문을 출력하지 않는다. |

## 2. 기능 테스트 항목

### W-T-1: reset 확인 승인

- **준비:** 격리된 임시 Git 저장소에 테스트 commit 2개를 만든다.
- **실행:** `convention --reset` 실행 후 확인 질문에 Yes를 선택한다.
- **예상 결과:** `git reset HEAD~1`만 실행되고, 최근 commit은 취소되며 변경사항은 working tree에 남는다.

### W-T-2: reset 확인 거부

- **준비:** 격리된 임시 Git 저장소에 테스트 commit을 만든다.
- **실행:** `convention --reset` 실행 후 확인 질문에 No를 선택한다.
- **예상 결과:** `resetLastCommit()`이 호출되지 않고 Git 히스토리는 변경되지 않는다.

### W-T-3: reset 입력 취소

- **준비:** `confirmAction()`이 취소 또는 false를 반환하도록 mock 처리한다.
- **실행:** `runReset()`을 호출한다.
- **예상 결과:** reset 명령은 실행되지 않고 안전한 취소 안내 후 종료된다.

### W-T-4: push 확인 승인

- **준비:** 격리된 테스트 저장소와 mock remote를 구성하고 push 함수를 spy 처리한다.
- **실행:** commit flow 완료 후 `--push` 확인 질문에 Yes를 선택한다.
- **예상 결과:** commit 이후 push가 1회 호출된다.

### W-T-5: push 확인 거부

- **준비:** commit은 성공하고 `confirmAction()`은 false를 반환하도록 구성한다.
- **실행:** `convention --push` 흐름을 실행한다.
- **예상 결과:** commit은 완료되지만 push는 실행되지 않고 취소 안내가 출력된다.

### W-T-6: push 실패 메시지 마스킹

- **준비:** 인증 정보가 포함된 remote URL 형태의 stderr를 반환하도록 push 실패를 mock 처리한다.
- **실행:** push 흐름을 실행한다.
- **예상 결과:** 출력 메시지에 token, password, API Key, remote URL 인증부가 포함되지 않는다.

## 3. 테스트 절차

1. 실제 작업 저장소가 아닌 임시 Git 저장소 또는 fixture에서만 실행한다.
2. `confirmAction()`, `push()`, `resetLastCommit()`은 unit test에서 mock 또는 spy로 호출 여부를 확인한다.
3. 실제 remote push가 필요한 테스트는 수행하지 않고 mock remote 또는 실패 mock으로 대체한다.
4. 실패 출력 검증 시 secret 후보 문자열이 로그에 포함되지 않는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** reset과 push가 사용자 확인 정책을 따르며, 취소 및 실패 상황에서도 Git 히스토리와 secret이 안전하게 보호된다.
- **실패 항목 존재 시:** confirm 분기, 취소 처리, stderr 마스킹, reset 명령 제한을 우선 수정한다.
