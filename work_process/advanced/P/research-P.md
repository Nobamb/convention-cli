# Phase 3 / P Grouping Preview Agent Research

## 1. 개요

Phase 3 / P는 O 단계의 File Grouping Agent가 제안한 파일 그룹을 실제 커밋 실행 전에 사용자에게 보여주고, 사용자가 다음 행동을 선택할 수 있게 만드는 단계입니다.

이 단계는 그룹 자체를 생성하지 않습니다. 그룹 생성은 `src/core/grouping.js` 또는 이전 단계의 책임이고, P 단계는 `src/utils/ui.js`와 `src/commands/commit.js`에서 그룹 제안 결과를 안전하게 표시하고 결정 흐름으로 전달하는 역할에 집중합니다.

핵심 원칙은 그룹 제안을 승인받기 전에는 `git add`, `git commit`, `git push`가 절대 실행되지 않아야 한다는 점입니다.

## 2. 작업 목표

- AI 또는 rule 기반 grouping 결과를 사용자에게 사람이 읽기 쉬운 형태로 표시합니다.
- 그룹별 type, groupName, 파일 목록을 출력합니다.
- 사용자 선택지를 `Yes`, `Edit manually`, `Use batch instead`, `Cancel`로 제공합니다.
- 사용자가 `Yes`를 선택한 경우에만 grouped commit flow로 진행할 수 있게 합니다.
- 사용자가 `Edit manually`를 선택하면 그룹 편집 흐름으로 진입할 수 있게 결정값을 반환합니다.
- 사용자가 `Use batch instead`를 선택하면 그룹 커밋 대신 기존 batch commit flow로 전환합니다.
- 사용자가 `Cancel`을 선택하면 안전하게 종료하고 Git 히스토리를 변경하지 않습니다.
- preview 출력에는 diff 원문, secret, API Key, token, credentials 내용을 포함하지 않습니다.

## 3. 구현 범위

### `src/utils/ui.js`

권장 추가 함수:

- `previewGroups(groups)`
- `selectGroupingDecision(groups)` 또는 `confirmGroupingPreview(groups)`
- `editGroupsManually(groups)` 또는 이후 Q 단계와 연결 가능한 placeholder 인터페이스

`previewGroups(groups)`는 그룹 목록을 출력만 담당합니다. 반환값 없이 UI 표시 책임만 가지는 구조가 단순합니다.

`selectGroupingDecision(groups)`는 사용자 선택을 표준화된 문자열로 반환합니다.

권장 반환값:

```javascript
{
  action: "accept" | "edit" | "batch" | "cancel",
  groups
}
```

### `src/commands/commit.js`

권장 연결 위치:

- grouping flow 진입 후 그룹 생성 결과를 받은 직후
- 그룹별 diff 추출 또는 그룹별 AI commit message 생성 전
- 어떤 Git staging/commit 작업보다 이전

권장 흐름:

```javascript
const groups = await groupFilesByIntent(fileDiffs, config);
const decision = await selectGroupingDecision(groups);

if (decision.action === "cancel") {
  info("그룹 커밋을 취소했습니다.");
  return;
}

if (decision.action === "batch") {
  return runBatchCommit({ push });
}

if (decision.action === "edit") {
  const editedGroups = await editGroupsManually(groups);
  return runGroupedCommitFlow(editedGroups, { push });
}

return runGroupedCommitFlow(groups, { push });
```

실제 함수명은 기존 코드 스타일에 맞춰 조정하되, decision 값은 문자열 상수나 객체로 명확히 유지합니다.

## 4. UI 출력 기준

출력 예시:

```text
AI가 다음과 같이 커밋 그룹을 제안했습니다.

Group 1: feat / login-feature

- src/auth/login.js
- src/pages/LoginPage.jsx

Group 2: docs / docs-update

- README.md

이 그룹으로 커밋하시겠습니까?

> Yes
> Edit manually
> Use batch instead
> Cancel
```

표시해야 할 정보:

- 그룹 번호
- 권장 commit type
- groupName
- 파일 경로 목록

표시하지 말아야 할 정보:

- 파일 diff 원문
- chunk 원문
- provider 응답 원문 전체
- API Key, OAuth token, credentials
- `.env`, `*.pem`, `*.key`, `credentials.json`, `secrets.json` 내용

## 5. 결정값 처리 기준

### Yes

- 사용자가 그룹 제안을 승인한 상태입니다.
- 이후 Q 단계 또는 grouped commit flow에서 그룹별 commit message preview와 commit confirm을 다시 수행해야 합니다.
- P 단계의 Yes는 "그룹 구성을 승인"하는 의미이지, 즉시 commit을 승인하는 의미가 아닙니다.
- 따라서 Yes 직후에도 바로 `git add`나 `git commit`을 실행하면 안 됩니다.

### Edit manually

- 사용자가 그룹을 직접 수정하려는 상태입니다.
- 수동 편집 UI는 최소한 다음을 지원하는 방향으로 설계합니다.
  - 파일을 다른 그룹으로 이동
  - 그룹 이름 수정
  - commit type 수정
  - 그룹 병합 또는 분리
- 수동 편집 결과가 빈 그룹, 중복 파일, 누락 파일을 만들지 않도록 검증해야 합니다.
- 편집 완료 후에도 grouped commit message preview와 commit confirm을 별도로 거쳐야 합니다.

### Use batch instead

- grouping flow를 중단하고 기존 batch commit flow를 사용합니다.
- batch flow에서도 기존 preview/confirm 안전 규칙을 유지해야 합니다.
- batch로 전환하더라도 사용자 confirm 전에는 commit하지 않습니다.

### Cancel

- 작업을 즉시 종료합니다.
- `git add`, `git commit`, `git push`를 호출하지 않습니다.
- 취소 메시지는 간단히 출력하고 diff 원문을 포함하지 않습니다.

## 6. 안전 기준

- 그룹 preview는 Git 히스토리를 변경하지 않는 읽기 전용 단계입니다.
- 사용자 승인 없이 commit flow로 넘어가지 않습니다.
- P 단계의 승인은 grouped commit 실행 승인과 구분합니다. 최종 commit은 그룹별 commit message preview 이후 별도 confirm이 필요합니다.
- 외부 AI provider로 diff를 보낼 때는 기존 보안 gate와 외부 전송 확인 정책을 우선합니다.
- grouping 결과가 비어 있으면 commit flow를 중단합니다.
- 모든 changed file은 정확히 하나의 그룹에만 속해야 합니다.
- 그룹 preview 실패, prompt 실패, interactive prompt 실패 시 안전하게 종료하고 Git 작업을 수행하지 않습니다.

## 7. 실패 처리 기준

- 그룹 목록이 빈 배열이면 오류 메시지를 출력하고 종료합니다.
- 그룹에 파일이 하나도 없으면 해당 그룹을 제거하거나 사용자에게 다시 편집을 요구합니다.
- 같은 파일이 여러 그룹에 중복되면 commit flow를 중단합니다.
- changed file 목록에는 있지만 어떤 그룹에도 없는 파일이 있으면 commit flow를 중단합니다.
- 사용자가 수동 편집에서 빈 입력을 제출하면 재입력 또는 취소를 제공합니다.
- 비대화형 환경에서는 grouping preview가 필요한 경우 명확한 오류로 중단하거나 이후 CI/non-interactive 정책에서 정의한 옵션만 허용합니다.

## 8. 완료 기준

- grouping 결과가 사용자에게 명확히 preview 됩니다.
- `Yes`, `Edit manually`, `Use batch instead`, `Cancel` 선택지가 제공됩니다.
- 각 선택지가 `commit.js`에서 명확한 분기로 처리됩니다.
- `Yes`는 그룹 승인만 의미하며 즉시 commit하지 않습니다.
- `Cancel`과 실패 케이스에서는 Git 히스토리가 변경되지 않습니다.
- preview 출력에 diff 원문과 secret이 노출되지 않습니다.
- 기존 batch/step commit flow의 confirm 안전 규칙을 깨지 않습니다.
