# Phase 3 / Q Grouped Commit Flow Agent Research

## 1. 개요

Phase Q는 Phase M~P에서 준비한 파일 분류, 변경 의도 분석, 파일 그룹 생성, 그룹 미리보기 결과를 실제 커밋 흐름에 연결하는 단계입니다. 목표는 사용자가 승인한 그룹 단위로 diff를 다시 추출하고, 그룹별 prompt를 생성한 뒤 AI 커밋 메시지를 만들고, preview/confirm 이후에만 해당 그룹의 파일을 `git add` 및 `git commit`하는 것입니다.

이 단계는 여러 개의 커밋을 순차적으로 생성할 수 있으므로 원자적 작업이 아닙니다. 일부 그룹 커밋이 성공한 뒤 다음 그룹에서 실패하거나 사용자가 취소하면 이미 생성된 앞선 커밋은 자동으로 되돌리지 않습니다. rollback은 별도 안내만 제공하고, 자동 `git reset` 또는 `git reset --hard`는 수행하지 않습니다.

## 2. 작업 목표

- 그룹별 파일 목록을 입력으로 받아 각 그룹의 대상 파일만 처리합니다.
- 그룹별 파일 diff를 추출하고 민감 파일 제외 및 secret scan 정책을 유지합니다.
- 그룹별 commit prompt를 생성하고 provider routing을 통해 commit message를 생성합니다.
- 각 그룹마다 preview를 보여주고 사용자 confirm을 받은 뒤에만 Git 히스토리를 변경합니다.
- confirm이 거부된 그룹은 commit하지 않고 다음 그룹 처리 여부를 명확히 결정합니다.
- `--push`가 명시되지 않은 경우 push를 절대 실행하지 않습니다.
- raw diff, secret, token, API key, provider 원문 응답 전체를 로그로 출력하지 않습니다.

## 3. 구현 대상 범위

- `src/commands/commit.js`
  - grouped commit orchestration 추가
  - 그룹별 preview/confirm/commit 흐름 연결
  - 기존 batch/step flow와 confirm decision flow 재사용
- `src/core/grouping.js`
  - Phase O/P 결과 구조를 검증하거나 commit flow에서 사용할 수 있는 group shape 보정
  - 비어 있는 그룹, 중복 파일, 지원하지 않는 group type 방어
- `src/core/git.js`
  - 기존 `getFileDiffs(files)`, `addFile(file)`, `commit(message, files?)` 계약 재사용
  - 필요 시 `commit(message, files)`가 그룹 파일만 staging/commit하도록 안전하게 연결
- `src/core/prompt.js`
  - 기존 `buildCommitPrompt({ diff, language, mode })` 재사용 또는 `mode: "group"` 대응
- `src/core/ai.js`
  - 기존 `generateCommitMessage(prompt, config)` 및 `cleanAIResponse(response)` 재사용
- `src/utils/ui.js`
  - 그룹별 preview와 confirm UI 재사용 또는 `confirmAction(message)` 연결

## 4. 권장 입력과 출력

권장 그룹 입력 구조는 Phase O/P 결과를 그대로 사용합니다.

```javascript
[
  {
    groupName: "login-feature",
    type: "feat",
    files: ["src/auth/login.js", "src/pages/LoginPage.jsx"]
  },
  {
    groupName: "docs-update",
    type: "docs",
    files: ["README.md"]
  }
]
```

권장 처리 결과는 그룹별 성공, 건너뜀, 실패 상태를 남기는 형태입니다.

```javascript
[
  {
    groupName: "login-feature",
    status: "committed",
    files: ["src/auth/login.js", "src/pages/LoginPage.jsx"],
    message: "feat: add login flow"
  },
  {
    groupName: "docs-update",
    status: "cancelled",
    files: ["README.md"]
  }
]
```

결과 출력에는 commit message와 파일 목록 수준의 요약만 포함합니다. diff 원문, prompt 원문, provider 응답 원문 전체는 포함하지 않습니다.

## 5. 권장 함수 흐름

`runGroupedCommit()` 또는 동등한 orchestration 함수는 아래 순서를 따릅니다.

```javascript
async function runGroupedCommit({ groups, config, push = false }) {
  assertGitRepository();
  const normalizedGroups = validateCommitGroups(groups);
  const results = [];

  for (const group of normalizedGroups) {
    const fileDiffs = getFileDiffs(group.files);
    const safeDiff = buildSafeGroupDiff(fileDiffs);
    const prompt = buildCommitPrompt({
      diff: safeDiff,
      language: config.language,
      mode: "group"
    });
    const message = cleanAIResponse(
      await generateCommitMessage(prompt, config)
    );

    previewGroupCommit({ group, message });
    const confirmed = await confirmAction("이 그룹을 커밋하시겠습니까?");

    if (!confirmed) {
      results.push({ groupName: group.groupName, status: "cancelled", files: group.files });
      continue;
    }

    for (const file of group.files) {
      addFile(file);
    }

    commit(message, group.files);
    results.push({ groupName: group.groupName, status: "committed", files: group.files, message });
  }

  if (push) {
    await confirmAndPushAfterGroupedCommit(results);
  }

  return results;
}
```

실제 구현에서는 `buildSafeGroupDiff()` 안에서 기존 diff 보안 gate를 재사용해야 합니다. 민감 파일 제외, 민감정보 패턴 탐지, 필요 시 마스킹, 외부 provider 전송 확인 정책이 그룹별 diff에도 동일하게 적용되어야 합니다. 민감 파일 후보가 그룹에 포함된 경우 기본 정책은 해당 파일을 AI prompt뿐 아니라 grouped staging/commit 대상에서도 제외하는 것입니다. 사용자가 민감 파일까지 커밋하려면 별도 경고와 명시 confirm을 거쳐야 하며, 그 경우에도 파일 내용과 diff 원문은 출력하지 않습니다.

## 6. 그룹별 Commit Gate

각 그룹은 독립적으로 아래 gate를 통과해야 합니다.

1. 그룹 파일 목록 검증
2. 그룹 파일 diff 추출
3. 민감 파일을 AI 분석, staging, commit 대상에서 기본 제외
4. 민감정보 패턴 탐지 및 마스킹
5. 외부 AI provider 전송 확인 또는 설정 정책 확인
6. AI commit message 생성
7. AI 응답 정리
8. 그룹명, 파일 목록, commit message preview
9. 사용자 confirm
10. 그룹 파일만 `git add`
11. 그룹 commit 실행

confirm 이전에는 `git add`, `git commit`, `git push`를 호출하지 않습니다. 사용자가 한 그룹을 취소하면 해당 그룹의 Git 작업은 수행하지 않습니다.

## 7. Git 처리 기준

- Git 명령은 반드시 `execFileSync` 또는 `spawnSync` 인자 배열 방식으로 실행합니다.
- 파일 경로와 commit message를 shell 문자열에 직접 삽입하지 않습니다.
- 그룹 파일 staging은 `git add <file>`을 파일별로 실행하거나 기존 `addFile(file)` wrapper를 사용합니다.
- 전체 staging인 `git add -A`는 grouped flow에서 사용하지 않습니다.
- commit은 해당 그룹 파일만 포함해야 하며, 이전 그룹 처리 중 남은 staged 상태가 섞이지 않도록 사전 상태를 확인합니다.
- 그룹 파일 중 diff가 비어 있는 파일은 해당 그룹에서 제외하거나 사용자에게 건너뜀으로 안내합니다.
- 민감 파일 후보가 그룹에 포함되어 있으면 기본적으로 해당 파일은 `addFile(file)` 대상에서 제외합니다. 별도 사용자 confirm을 받은 경우에만 민감 파일 staging을 허용하되, diff 원문과 파일 내용은 preview/log에 출력하지 않습니다.

## 8. Rollback 및 Non-Atomic Caveat

Grouped commit flow는 여러 commit을 순차적으로 생성하기 때문에 전체 작업이 atomic하지 않습니다.

- Group 1 commit 성공 후 Group 2에서 실패하면 Group 1 commit은 남습니다.
- 사용자가 중간 그룹에서 취소해도 이전 그룹 commit은 유지됩니다.
- 자동 rollback을 구현하지 않습니다.
- `git reset --hard`는 금지합니다.
- rollback 안내가 필요하면 `convention --reset` 또는 수동 `git reset HEAD~1` 성격의 soft reset만 설명합니다.
- 이미 여러 그룹이 commit된 뒤 되돌리려면 사용자가 몇 개의 commit을 되돌릴지 직접 판단해야 합니다.

오류 메시지는 "이미 완료된 커밋은 유지됩니다"처럼 상태를 명확히 설명하되, Git stderr 원문에 민감정보가 있을 수 있으므로 그대로 출력하지 않습니다.

## 9. Push 기준

- grouped commit flow는 기본적으로 push하지 않습니다.
- `--push`가 명시된 경우에만 모든 그룹 처리가 끝난 뒤 push를 고려합니다.
- 일부 그룹만 commit된 상태에서 push할지 여부는 사용자 confirm을 다시 받아야 합니다.
- push 실패 시 token, remote URL의 인증 정보, provider credential을 출력하지 않습니다.
- push는 그룹별 commit 성공 결과 요약 이후 별도 단계로 취급합니다.

## 10. 실패 처리 기준

- 그룹 목록이 비어 있으면 commit flow를 시작하지 않습니다.
- 그룹의 `files`가 비어 있으면 해당 그룹을 건너뜁니다.
- 중복 파일이 여러 그룹에 포함되면 시작 전에 오류로 중단하거나 사용자에게 재그룹화를 요구합니다.
- 그룹 diff가 비어 있으면 AI 호출 없이 해당 그룹을 건너뜁니다.
- AI 응답이 비어 있거나 Conventional Commits 형식에 맞지 않으면 commit하지 않습니다.
- provider 오류가 발생하면 해당 그룹 commit을 중단하고 다음 그룹 진행 여부를 사용자에게 확인합니다.
- commit 실패 시 다음 그룹으로 계속 진행할지 기본값은 중단입니다.
- 어떤 실패에서도 raw diff fallback으로 외부 provider에 재전송하지 않습니다.

## 11. 보안 및 로그 기준

- raw diff를 stdout, stderr, logger, preview에 출력하지 않습니다.
- prompt 원문을 출력하지 않습니다.
- provider 응답 원문 전체를 출력하지 않습니다.
- API key, OAuth token, password, private key, `DATABASE_URL`, `AWS_ACCESS_KEY_ID` 등 secret 후보를 출력하지 않습니다.
- 민감 파일 후보 `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `credentials.json`, `secrets.json`은 기본적으로 AI 분석 대상과 grouped staging/commit 대상에서 제외합니다. 별도 사용자 confirm 없이 민감 파일을 커밋하지 않습니다.
- 그룹 preview에는 그룹명, type, 파일 목록, 정리된 commit message만 보여줍니다.
- 외부 AI provider 사용 시 사용자 확인 또는 명시 설정 정책 없이 diff를 전송하지 않습니다.

## 12. 완료 기준

- 승인된 그룹마다 그룹 파일만 staging되고 commit됩니다.
- 민감 파일 후보는 별도 confirm이 없는 한 staging/commit되지 않습니다.
- 승인되지 않은 그룹은 Git 히스토리를 변경하지 않습니다.
- 여러 그룹이 순차 commit될 수 있고, non-atomic caveat이 사용자와 문서에 명확히 남습니다.
- `--push`가 없는 경우 push가 실행되지 않습니다.
- `--push`가 있는 경우에도 grouped commit 완료 후 별도 confirm gate를 거칩니다.
- 로그와 에러 메시지에 raw diff, secret, provider 원문 응답 전체가 노출되지 않습니다.
- 기존 batch/step commit flow의 confirm gate와 security gate를 우회하지 않습니다.
