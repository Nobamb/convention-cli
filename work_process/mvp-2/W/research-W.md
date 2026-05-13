# Phase W Push/Reset 안전 확인 Agent Research

## 1. 개요

Phase W는 `--push`, `--reset`처럼 Git 히스토리 또는 원격 저장소 상태에 영향을 주는 명령을 실행하기 전에 사용자 확인을 강제하는 안전 장치 단계다.

`init/prompt.md` 23/23-1, `init/00_rule.md`, `init/02_mvp-2.md`, `AGENTS.md` 기준에 따라 reset은 확인 없이 절대 실행하지 않고, 취소 시 안전하게 종료하며, push/reset 과정에서 secret이나 원격 인증 정보가 노출되지 않도록 한다.

## 2. 작업 목표

- `reset` 실행 전 `confirmAction()` 확인을 필수 적용
- 사용자가 No 또는 취소를 선택하면 Git 명령 실행 없이 정상 종료
- `push` 실행 전 확인 정책을 명확히 적용
- commit confirm과 별개로 push/reset 확인 메시지 통일
- `confirmAction(message)`의 반환값 기준을 모든 위험 명령에서 동일하게 사용
- push/reset 실패 메시지에 token, API Key, 인증 포함 remote URL이 노출되지 않도록 제한

## 3. 구현 범위

- 수정 대상 후보: `src/utils/ui.js`, `src/commands/reset.js`, `src/commands/commit.js`
- 연동 대상 후보: `src/core/git.js`, `bin/convention.js`, `src/utils/logger.js`
- 주요 함수:
  - `confirmAction(message)`
  - `runReset()`
  - `runDefaultCommit()`
  - `runStepCommit()`
  - `runBatchCommit()`
  - `push()`
  - `resetLastCommit()`

## 4. 권장 구현 방향

- reset 흐름은 `confirmAction()`이 명시적으로 `true`를 반환한 경우에만 `resetLastCommit()`을 호출한다.
- reset 취소 시에는 error가 아니라 안내 메시지로 종료하고, exit code는 실패로 다루지 않는다.
- push는 commit 완료 후 실행되는 별도 위험 동작으로 보고, commit confirm과 분리된 push confirm을 받는 방향을 기본 정책으로 둔다.
- `confirmBeforeCommit`이 `false`여도 reset 확인은 비활성화하지 않는다.
- push 확인 정책은 `confirmBeforeCommit`과 혼동하지 않도록 별도 메시지 또는 내부 조건으로 분리한다.
- `confirmAction()`은 사용자 취소, Ctrl+C, 빈 응답 같은 케이스에서 안전한 false로 수렴하도록 한다.
- Git 명령은 기존 규칙대로 `execFileSync` 또는 `spawnSync`에 argv 배열을 전달한다.

## 5. 보안 및 안정성 기준

- `git reset HEAD~1` 외 reset 변형은 허용하지 않는다.
- `git reset --hard`는 구현하지 않는다.
- 사용자 확인 전에는 `resetLastCommit()`과 `push()`가 호출되지 않아야 한다.
- push 실패 시 stderr 원문을 그대로 출력하지 않는다.
- remote URL, token, password, API Key, credentials 내용은 로그에 출력하지 않는다.
- reset 완료 후 변경사항이 working tree에 남는다는 안내를 출력한다.
- 실제 사용자 저장소에서 자동 commit, push, reset 테스트를 수행하지 않는다.

## 6. 완료 기준

- `convention --reset`은 사용자 확인이 true일 때만 `git reset HEAD~1`을 실행한다.
- reset 확인에서 No 또는 취소를 선택하면 Git 히스토리가 변경되지 않는다.
- `convention --push`는 commit 이후 push 실행 전 확인 정책이 적용된다.
- 공통 확인 UI의 취소 동작이 위험 명령에서 일관되게 안전 종료된다.
- push/reset 성공/실패 메시지에 secret 또는 인증 세부 정보가 포함되지 않는다.
