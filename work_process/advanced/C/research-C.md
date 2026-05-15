# Phase C Commit Preview Agent Research

## 1. 개요

Phase C는 AI가 생성한 커밋 메시지를 실제 `git add`와 `git commit` 전에 사용자에게 보여주는 미리보기 구조를 구현합니다. 기존 1차/2차 MVP의 confirm-before-commit 정책을 더 명확하게 만들고, 이후 Regenerate/Edit 흐름의 기반이 됩니다.

## 2. 작업 목표

- AI 생성 커밋 메시지를 commit 실행 전에 출력합니다.
- 변경 파일 요약, mode, provider, model 정보를 함께 보여줍니다.
- batch와 step 모드 모두 동일한 preview 함수를 사용합니다.
- diff 원문이나 민감정보가 preview에 노출되지 않게 합니다.
- preview 출력 후에만 사용자 결정 흐름으로 넘어가도록 commit flow를 정리합니다.

## 3. 구현 범위

- `src/commands/commit.js`
  - batch/step commit flow에서 preview 호출
  - commit 실행 전 순서 보장
- `src/utils/ui.js`
  - `previewCommitMessage({ message, files, mode, provider, modelVersion })`
- `src/utils/logger.js`
  - preview 출력에 사용할 안전한 info/success 메시지

## 4. 권장 구현 방향

preview 함수는 화면 출력만 담당하고 commit 여부 판단은 하지 않습니다. commit flow는 다음 순서를 유지합니다.

1. 변경 파일 확인
2. diff 추출 및 보안 gate
3. AI 메시지 생성
4. AI 응답 정리
5. preview 출력
6. 사용자 선택
7. `git add`
8. `git commit`

변경 파일은 파일명 목록만 보여주고, diff 내용은 출력하지 않습니다. provider 정보는 `provider / modelVersion`처럼 간단히 표시하되 config 객체 전체를 출력하지 않습니다.

## 5. 보안 및 안정성 기준

- diff 원문을 preview에 출력하지 않습니다.
- provider 설정 전체, baseURL에 포함될 수 있는 인증 정보, API Key를 출력하지 않습니다.
- 파일명은 Git status에서 얻은 상대 경로만 표시합니다.
- preview 출력 실패가 commit을 우회하게 만들지 않습니다.

## 6. 완료 기준

- `convention --batch`, `convention --step`, `convention` 모두 commit 전에 메시지 preview를 출력합니다.
- 사용자는 커밋 메시지, 변경 파일, mode/provider 정보를 확인할 수 있습니다.
- preview 이후 confirm 또는 decision flow가 실행되고, 사용자 승인 없이 commit이 실행되지 않습니다.

