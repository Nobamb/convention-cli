# Phase V Batch Mode Agent Research

## 1. 개요

Phase V는 `convention --batch` 실행 시 전체 변경사항을 하나의 Conventional Commits 메시지로 묶어 커밋하는 흐름을 구현하는 단계입니다. 구현 대상은 `src/commands/commit.js`의 `runBatchCommit()`입니다.

현재 `runBatchCommit()`은 안내 로그만 출력하는 placeholder 상태이므로, 이전 단계에서 준비된 Git wrapper, prompt 생성, Mock AI Provider, AI 응답 정리, 사용자 confirm, staging, commit 함수를 순서대로 연결해야 합니다.

## 2. 작업 목표

- `runBatchCommit(): Promise<void>`에 batch commit orchestration 구현
- Git 저장소 여부를 `isGitRepository()`로 확인
- 변경 파일 목록을 `getChangedFiles()`로 확인
- 민감 파일 제외가 반영된 전체 diff를 `getFullDiff()`로 추출
- `loadConfig()`로 language, provider, confirmBeforeCommit 설정 로드
- `buildCommitPrompt({ diff, language, mode: 'batch' })` 호출
- `generateCommitMessage(prompt, config)`로 Mock Provider 기반 메시지 생성
- `cleanAIResponse(response)`로 commit message 정리
- 사용자에게 commit message 표시 후 confirm
- confirm 승인 시 `addAll()` 호출 후 `commit(message)` 호출
- confirm 거부 시 staging/commit 미실행
- diff 원문, secret, credentials를 로그로 출력하지 않음

## 3. 권장 실행 순서

1. `isGitRepository()`가 `false`이면 사용자에게 오류를 안내하고 중단한다.
2. `getChangedFiles()`가 빈 배열이면 변경사항 없음 메시지를 안내하고 중단한다.
3. `getFullDiff()`를 호출한다.
4. 민감 파일 제외 후 diff가 비어 있으면 커밋 가능한 diff 없음으로 중단한다.
5. `loadConfig()`를 호출하고 language 기본값을 보정한다.
6. batch mode prompt를 생성한다.
7. AI 메시지를 생성하고 정리한다.
8. 정리된 commit message만 사용자에게 보여준다.
9. `confirmBeforeCommit`이 `true`이면 사용자 confirm을 받는다.
10. 승인된 경우에만 `addAll()`과 `commit(message)`를 순서대로 호출한다.

## 4. 보안 기준

- Git 명령은 `execFileSync` 또는 `spawnSync`의 argv 배열 방식만 사용한다.
- diff 원문, API key 후보 문자열, `.env` 내용, credentials 내용을 로그로 출력하지 않는다.
- 민감 파일 제외 기준은 `src/core/git.js`의 `getFileDiffs()`와 `getFullDiff()` 흐름을 재사용한다.
- 외부 AI Provider로 diff를 보내는 흐름은 1차 MVP에서 사용하지 않는다. provider가 `null` 또는 `mock`일 때만 기본 흐름을 허용한다.
- 사용자의 confirm 없이 `git commit`을 호출하지 않는다.

## 5. 에러 처리 기준

- Git 저장소가 아니면 commit flow를 시작하지 않는다.
- 변경사항이 없으면 AI prompt를 만들지 않는다.
- 민감 파일 제외 후 diff가 없으면 AI를 호출하지 않는다.
- AI 응답 정리 실패 시 staging/commit을 실행하지 않는다.
- `addAll()` 또는 `commit()` 실패 시 원본 에러를 상위로 전달하되 민감 정보를 출력하지 않는다.

## 6. 다음 단계 연결

Phase V의 결과는 `convention --batch` 옵션과 기본 실행의 batch mode 라우팅에서 사용됩니다. Phase X에서 `config.mode === 'batch'`인 경우 `runDefaultCommit()`이 이 함수를 호출해야 합니다.
