# Phase U --push Agent Research

## 1. 개요

Phase U는 `convention --push` 실행 시 기존 commit flow가 정상 완료된 뒤 현재 브랜치를 원격 저장소로 push하도록 연결하는 단계다. `init/prompt.md` 21/21-1, `init/02_mvp-2.md`의 U 단계, `init/00_rule.md`, `AGENTS.md`의 Git/보안 규칙을 기준으로 한다.

## 2. 작업 목표

- commander에 `--push` 옵션 추가
- `convention --push`가 commit flow를 실행한 뒤 성공한 경우에만 push 실행
- `src/core/git.js`에 `push()` 함수 구현
- Git 명령은 `execFileSync` 또는 `spawnSync`와 argv 배열로 실행
- push 실패 시 token, 원격 URL, 인증 세부 정보가 노출되지 않도록 처리
- push 전 현재 branch/status 안내가 가능하면 사용자에게 명확히 표시
- push 단독 실행 여부는 명확히 문서화

## 3. 구현 범위

- 수정 대상: `bin/convention.js`, `src/commands/commit.js`, `src/core/git.js`
- 연동 대상: `src/utils/logger.js`, `src/utils/ui.js`
- 주요 함수:
  - `push(): void`
  - `runDefaultCommit(options?)`
  - `runStepCommit(options?)`
  - `runBatchCommit(options?)`

## 4. 권장 구현 방향

- `bin/convention.js`에서 `--push` boolean 옵션을 받고 설정 명령(`--set-mode`, `--language`, `--model`, `--reset`)보다 뒤의 commit flow에만 연결한다.
- `--step`, `--batch`가 있으면 해당 mode commit 후 push하고, 옵션 없는 `convention --push`는 저장된 mode에 따라 commit 후 push한다.
- commit이 취소되거나 실패하면 push를 실행하지 않는다.
- `push()`는 우선 `git push` 또는 정책상 필요한 경우 `git push origin HEAD`를 argv 배열로 실행한다.
- push 전 `git branch --show-current`, `git status --short --branch` 등으로 branch/upstream 정보를 확인할 수 있으면 안내에 활용한다.
- upstream이 없거나 원격 저장소가 없으면 안전한 일반 오류 메시지로 중단하고, Git stderr 원문 전체를 그대로 출력하지 않는다.
- push 성공 메시지는 branch 이름 정도만 포함하고 remote URL, token, credential helper 세부 정보는 포함하지 않는다.

## 5. 보안 및 안정성 기준

- `execSync` 문자열 조합을 사용하지 않는다.
- `git push` 명령에 사용자 입력을 shell 문자열로 삽입하지 않는다.
- push 실패 시 원격 URL, access token, username/password, credential helper 출력이 노출되지 않도록 sanitize한다.
- 실제 사용자 저장소에서 자동 push 테스트를 수행하지 않고 격리된 테스트 원격 저장소를 사용한다.
- commit 전 confirm 정책은 기존 commit flow를 따른다.
- push 전 추가 confirm 여부는 W 단계와 충돌하지 않도록 정책을 분리해 둔다. Phase U에서는 commit 완료 후 push 연결을 구현하고, W 단계에서 commit confirm과 별개의 push confirm 정책을 최종 확정한다.

## 6. 완료 기준

- `node bin/convention.js --help`에 `--push` 옵션이 표시된다.
- `convention --push` 실행 시 commit 성공 후 `push()`가 호출된다.
- commit 취소 또는 실패 시 push가 실행되지 않는다.
- `push()`는 `execFileSync("git", ["push"], ...)` 또는 동등한 argv 배열 방식으로 실행된다.
- push 실패 메시지에 token, 인증 정보, 민감한 remote URL이 포함되지 않는다.
- branch/upstream 상태 안내가 가능한 범위에서 제공된다.
