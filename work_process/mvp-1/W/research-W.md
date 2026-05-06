# Phase W Step Mode Agent Research

## 1. 개요

Phase W는 `convention --step` 실행 시 변경된 파일을 파일별로 확인하고, 각 파일의 diff를 기준으로 별도 commit message를 생성한 뒤 사용자 confirm 후 파일별 commit을 수행하는 단계입니다. 구현 대상은 `src/commands/commit.js`의 `runStepCommit()`입니다.

현재 `runStepCommit()`은 안내 로그만 출력하는 placeholder 상태입니다. Phase M~U에서 준비한 Git wrapper, prompt 생성, Mock AI Provider, AI 응답 정리 기능을 파일 단위 workflow로 연결해야 합니다.

## 2. 작업 목표

- `runStepCommit(): Promise<void>`에 step commit orchestration 구현
- Git 저장소 여부 확인
- 변경 파일 목록 확인
- `getFileDiffs(files)`로 파일별 diff 추출
- 민감 파일과 diff가 없는 파일 제외
- 파일별로 `buildCommitPrompt({ diff, language, mode: 'step' })` 호출
- 파일별로 `generateCommitMessage()`와 `cleanAIResponse()` 호출
- 파일명과 정리된 commit message를 사용자에게 표시
- 파일별 confirm 승인 시 `addFile(file)` 후 `commit(message)` 호출
- 파일별 confirm 거부 시 해당 파일은 staging/commit하지 않고 다음 파일로 진행
- 일부 파일 처리 실패 시 나머지 파일 처리 정책을 명확히 유지

## 3. 권장 실행 순서

1. `isGitRepository()`가 `false`이면 중단한다.
2. `getChangedFiles()`로 변경 파일을 가져온다.
3. 변경 파일이 없으면 중단한다.
4. `getFileDiffs(files)`로 커밋 가능한 파일별 diff만 만든다.
5. 파일별 diff 목록이 비어 있으면 중단한다.
6. 설정을 로드하고 language, provider, confirmBeforeCommit 값을 사용한다.
7. 각 `{ file, diff }`에 대해 step mode prompt를 생성한다.
8. AI 메시지를 생성하고 정리한다.
9. 사용자 confirm을 받는다.
10. 승인된 파일만 `addFile(file)` 후 `commit(message)`를 호출한다.
11. 거부된 파일은 건너뛰고 다음 파일로 진행한다.

## 4. 파일별 처리 기준

- prompt에는 현재 파일의 diff만 포함한다.
- commit 전에는 해당 파일만 `addFile(file)`로 staging한다.
- 파일 경로는 shell 문자열에 삽입하지 않고 Git argv 배열로 전달한다.
- 공백, 한글, 일본어, 중국어 파일명을 그대로 처리할 수 있어야 한다.
- 삭제 파일과 rename 파일도 `getChangedFiles()`와 `getFileDiffs()`의 결과를 기준으로 처리한다.

## 5. 실패 처리 기준

- 특정 파일의 AI 생성 또는 cleanup이 실패하면 해당 파일 commit은 수행하지 않는다.
- 특정 파일의 `addFile()` 또는 `commit()`이 실패하면 원본 에러를 전달하거나 사용자에게 실패를 안내한다.
- 한 파일 실패 후 전체를 즉시 중단할지, 다음 파일로 계속할지는 구현 시 일관되게 정하고 테스트에 반영한다. 1차 MVP에서는 예측 가능성을 위해 즉시 중단이 권장된다.
- confirm 거부는 에러가 아니라 skip으로 처리한다.

## 6. 보안 기준

- 민감 파일은 `getFileDiffs()`에서 제외된 결과만 사용한다.
- diff 원문과 secret 후보 문자열을 로그로 출력하지 않는다.
- 외부 AI Provider 전송은 1차 MVP 기본 흐름에서 사용하지 않는다.
- 사용자 confirm 없이 어떤 파일도 commit하지 않는다.

## 7. 다음 단계 연결

Phase W의 결과는 `convention --step` 옵션과 기본 실행의 step mode 라우팅에서 사용됩니다. Phase X에서 `config.mode`가 `step`이거나 유효하지 않을 때 `runDefaultCommit()`이 이 함수를 호출해야 합니다.
