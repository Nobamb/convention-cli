# Phase V --reset Agent Research

## 1. 개요

Phase V는 2차 MVP의 `--reset` 명령을 구현하기 위한 작업 범위를 정리한다. 목표는 사용자가 명시적으로 확인한 경우에만 최근 커밋을 `git reset HEAD~1`로 취소하고, 변경 내용은 working tree에 남기도록 보장하는 것이다.

참고 기준은 `init/prompt.md`의 22/22-1, `init/00_rule.md`, `init/02_mvp-2.md`, `AGENTS.md`의 Git/보안 규칙이다.

## 2. 작업 목표

- commander에 `--reset` 옵션을 추가한다.
- `--reset`은 commit flow와 분리해 `runReset()`으로 라우팅한다.
- `runReset()`은 실행 전 사용자 confirm을 반드시 받는다.
- Git 명령은 `git reset HEAD~1`만 허용한다.
- reset 이후 변경사항이 working tree에 남는다는 안내를 출력한다.
- `--hard`, `--soft`, 임의 ref 입력 등 확장 reset 옵션은 구현하지 않는다.
- Git 오류 메시지는 token, 원격 URL, secret이 노출되지 않도록 정리해 출력한다.

## 3. 구현 범위

- 수정 대상:
  - `bin/convention.js`
  - `src/commands/reset.js`
  - `src/core/git.js`
  - `src/utils/ui.js`
  - `src/utils/logger.js`
- 주요 함수:
  - `runReset(): Promise<void>`
  - `resetLastCommit(): void`
  - `confirmAction(message)`

## 4. 권장 구현 방향

- `bin/convention.js`에서 `--reset`을 설정 명령처럼 최우선 분기 처리하고 commit flow를 실행하지 않는다.
- `src/commands/reset.js`는 Git 저장소 여부를 확인한 뒤 reset 위험성을 안내하고 `confirmAction()`으로 사용자 확인을 받는다.
- 사용자가 취소하면 Git 명령을 실행하지 않고 안전하게 종료한다.
- `src/core/git.js`의 `resetLastCommit()`은 `execFileSync("git", ["reset", "HEAD~1"], { encoding: "utf-8" })` 형태만 사용한다.
- shell 문자열 조합, 사용자 입력 ref 전달, `git reset --hard` 구현은 금지한다.
- reset 성공 시 최근 커밋은 취소되었고 변경사항은 working tree에 남아 있음을 명확히 안내한다.
- reset 실패 시 Git stderr 원문을 그대로 출력하지 말고 짧은 오류 문구로 정리한다.

## 5. 보안 및 안정성 기준

- 사용자 confirm 없이 reset을 실행하지 않는다.
- `git reset HEAD~1` 외 reset 명령은 허용하지 않는다.
- `git reset --hard`는 구현하지 않는다.
- Git 명령은 `execFileSync` 또는 `spawnSync`와 argv 배열 방식으로 실행한다.
- 테스트는 실제 사용자 저장소가 아닌 격리된 임시 Git 저장소에서만 수행한다.
- Git 오류, 원격 URL, 인증 정보, secret 값을 로그에 그대로 출력하지 않는다.
- reset은 Git 히스토리를 바꾸는 작업이므로 취소 시 side effect가 없어야 한다.

## 6. 완료 기준

- `convention --reset` 실행 시 사용자 확인 질문이 먼저 표시된다.
- 사용자가 거절하면 `git reset`이 호출되지 않는다.
- 사용자가 승인하면 `git reset HEAD~1`만 실행된다.
- reset 이후 최근 커밋의 변경사항이 working tree에 남는다.
- `--reset` 실행 시 commit message 생성, git add, git commit, push가 실행되지 않는다.
- reset 실패 메시지에 secret 또는 인증 세부 정보가 포함되지 않는다.
