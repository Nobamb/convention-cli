# Phase E Regenerate Agent Research

## 1. 개요

Phase E는 사용자가 AI 커밋 메시지가 마음에 들지 않을 때 같은 diff를 기반으로 새 메시지를 다시 생성하는 기능입니다. 재생성은 기존 preview/decision flow 안에서 반복되어야 하며, 무한 호출을 막기 위한 제한이 필요합니다.

## 2. 작업 목표

- Regenerate 선택 시 기존 diff와 config를 유지한 채 AI를 재호출합니다.
- 이전 메시지를 prompt에 포함해 다른 표현을 요청합니다.
- 재생성 횟수 제한을 둡니다.
- 재생성 후 다시 preview와 decision UI로 돌아갑니다.
- 재생성 실패 시 commit으로 우회하지 않고 사용자에게 안전하게 안내합니다.

## 3. 구현 범위

- `src/commands/commit.js`
  - decision loop
  - regenerate count 관리
- `src/core/prompt.js`
  - regeneration instruction 추가 함수 또는 옵션
- `src/core/ai.js`
  - 기존 `generateCommitMessage()` 재사용
- `src/config/defaults.js`
  - `maxRegenerateCount: 3`

## 4. 권장 구현 방향

commit flow 안에 decision loop를 두고, `regenerate` 선택 시 count를 증가시킵니다. count가 제한을 넘으면 사용자에게 안내하고 다시 decision UI로 돌아가거나 cancel 처리합니다.

재생성 prompt에는 아래 기준을 반영합니다.

- 이전 메시지와 다른 표현 사용
- 변경 의미 유지
- Conventional Commits 형식 유지
- 설정 언어 유지
- 커밋 메시지만 반환

## 5. 보안 및 안정성 기준

- 재생성 시에도 기존 보안 gate를 통과한 diff만 사용합니다.
- diff 원문을 로그로 출력하지 않습니다.
- 외부 provider 사용 시 기존 외부 전송 정책을 우회하지 않습니다.
- 재생성 실패 또는 빈 응답은 commit 실행으로 이어지지 않습니다.

## 6. 완료 기준

- 사용자가 Regenerate를 선택하면 새 메시지가 생성됩니다.
- 새 메시지는 다시 preview됩니다.
- 제한 횟수 초과 시 명확히 안내되고 무한 루프가 발생하지 않습니다.
- batch/step 모두 같은 regenerate 정책을 사용합니다.

