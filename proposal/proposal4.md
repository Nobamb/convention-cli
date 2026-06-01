# proposal4: git push 시 자동 Upstream 지정 및 대화형 선택 기능 제안

## 결론

현재 `convention --push`는 로컬 브랜치에 연결된 업스트림(upstream)이 설정되어 있지 않은 경우, 단순히 푸시 실패 경고를 출력하고 종료됩니다. 이는 신규 브랜치를 생성하여 작업하는 빈도가 높은 개발자 환경에서 매번 수동으로 `git push -u origin <branch>`를 실행해 주어야 하는 번거로움을 유발합니다.

제안된 기능은 `convention --push`를 실행할 때 업스트림이 지정되지 않은 상태를 감지하면, 자동으로 오류를 발생시키는 대신 **안전한 대화형 프롬프트(Select UI)**를 통해 업스트림 설정 여부와 대상을 선택할 수 있도록 설계하는 것입니다.

이 제안은 사용자가 직접 언급한 3가지 선택지 흐름을 따르며, Git 보안 및 로컬 설정(config) 보호 원칙을 훼손하지 않는 안전장치를 포함합니다.

---

## 대화형 선택지 설계

업스트림이 설정되지 않은 브랜치에서 `convention --push`가 트리거되었을 때, 아래와 같은 대화형 UI를 제공합니다.

```text
? 현재 브랜치('<현재브랜치명>')에 업스트림(원격 추적 브랜치)이 설정되어 있지 않습니다. 어떻게 진행할까요?
  1) (추천) origin/<현재브랜치명>으로 업스트림 지정 후 push
  2) 다른 원격 저장소명 직접 입력하여 업스트림 지정 후 push
  3) push 취소 (로컬 커밋만 유지)
```

### 상세 선택지별 동작

1. **`origin/<현재브랜치명>` 지정 (1번)**:
   - 가장 일반적인 기본 원격 저장소인 `origin`을 대상으로 `git push -u origin <현재브랜치명>`을 실행합니다.
   - 실행 완료 후 로컬 브랜치가 `origin/<현재브랜치명>`에 연결됩니다.

2. **다른 원격 저장소명 직접 입력 (2번)**:
   - 사용자가 원격 저장소명(예: `upstream`, `personal` 등)을 텍스트로 직접 입력할 수 있는 하위 프롬프트를 띄웁니다.
   - 입력값 검증을 거친 후, `git push -u <입력된원격저장소명> <현재브랜치명>`을 실행합니다.

3. **취소 (3번)**:
   - 원격 푸시를 안전하게 중단합니다.
   - 기존과 동일하게 "로컬 커밋은 성공적으로 생성 및 유지되었으며 원격은 변경되지 않았다"는 취소 안내 메시지를 출력하고 종료합니다.

---

## 보안 및 안전 규칙 (Security & Safety Principles)

1. **비대화형 모드(CI, `--no-interactive`) 예외 처리**:
   - `runtime.interactive === false`인 비대화형 환경(CI/CD 파이프라인 등)에서는 사용자 입력을 대기하면 프로세스가 중단(hang)되므로 프롬프트를 띄우지 않습니다.
   - 이 경우, `--yes` 플래그가 함께 들어온 경우에만 `origin`을 기본값으로 하여 자동으로 업스트림을 지정하고 push하며, 그렇지 않은 경우에는 명확한 오류 안내 메시지와 함께 종료합니다.
2. **원격 저장소명 유효성 검증**:
   - 직접 입력(2번)을 사용할 때 로컬 저장소에 실제로 등록되어 있는 원격 저장소인지 `git remote` 출력 목록을 대조하여 검증합니다. 존재하지 않는 엉뚱한 원격 저장소명을 입력한 경우 즉시 에러로 중단하여 잘못된 명령 실행을 방지합니다.
3. **argv 배열 방식 실행 고수**:
   - 모든 Git 명령어는 `execFileSync` 또는 `spawnSync`를 사용해 argv 배열 방식으로 실행하여, 브랜치명이나 직접 입력받은 원격 저장소명이 셸 인젝션(Shell Injection)의 경로로 활용되지 못하게 고정합니다.
4. **민감 정보 마스킹 정책 유지**:
   - `-u` 설정 및 push 중 오류(네트워크 순동, 권한 만료 등)가 발생하여 stderr가 출력될 때, 그 안에 포함되어 있을 수 있는 remote URL, OAuth Token, API Key 등의 자격 증명이 로그에 그대로 노출되지 않도록 기존 마스킹 처리기(`buildPushFailureMessage`)를 통해 필터링합니다.

---

## 대상 파일 및 수정 예정 모듈

### 1. [git.js](</c:/(USER_FOLDER_NAME)/Desktop/develop/convention-cli/src/core/git.js>) [MODIFY]

- 현재 등록되어 있는 로컬 Git 원격 저장소 이름 목록을 조회하는 헬퍼 함수를 추가합니다.
- 업스트림을 명시적으로 설정하면서 push하는 새로운 wrapper 함수를 구현합니다.

```javascript
/**
 * 로컬 저장소에 등록된 모든 원격 저장소(remotes) 이름 목록을 배열로 가져옵니다.
 * @returns {string[]} 원격 저장소 이름 배열 (예: ['origin', 'upstream'])
 */
export function getRemotes() {
  try {
    const output = execFileSync("git", ["remote"], {
      ...GIT_COMMAND_OPTIONS,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.split(/\r?\n/u).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 지정한 원격 저장소와 브랜치명으로 업스트림을 지정하며 push합니다.
 * @param {string} remoteName - 원격 저장소 이름 (예: 'origin')
 * @param {string} branchName - 브랜치 이름
 */
export function pushWithUpstream(remoteName, branchName) {
  if (!remoteName || !branchName) {
    throw new TypeError("remoteName and branchName are required");
  }

  try {
    // git push -u <remote> <branch> 실행
    execFileSync(
      "git",
      ["push", "-u", remoteName, branchName],
      GIT_COMMAND_OPTIONS,
    );
    logSuccess(
      `Successfully set upstream to ${remoteName}/${branchName} and pushed.`,
    );
  } catch (error) {
    const message = buildPushFailureMessage(
      branchName,
      `${remoteName}/${branchName}`,
    );
    logError(message);
    throw new Error(message);
  }
}
```

### 2. [ui.js](</c:/(USER_FOLDER_NAME)/Desktop/develop/convention-cli/src/utils/ui.js%3E>) [MODIFY]

- 사용자에게 업스트림이 없을 때 선택할 행동을 보여주는 프롬프트 함수와 직접 원격지 이름을 입력받는 프롬프트 함수를 추가합니다.

```javascript
/**
 * 업스트림이 없을 때 사용자가 선택할 액션 프롬프트를 띄웁니다.
 * @param {string} branchName - 현재 브랜치명
 * @param {string[]} availableRemotes - 사용 가능한 원격지 목록
 * @returns {Promise<'origin' | 'custom' | 'cancel'>} 선택 결과
 */
export async function selectUpstreamSetupAction(
  branchName,
  availableRemotes = [],
) {
  // prompts 모듈을 활용하여 3가지 선택지 렌더링
}

/**
 * 사용자로부터 원격 저장소 이름을 직접 텍스트로 입력받습니다.
 * @param {string[]} validRemotes - 검증용 실제 등록된 원격지 목록
 * @returns {Promise<string>} 입력된 유효한 원격 저장소 이름
 */
export async function promptCustomRemoteName(validRemotes = []) {
  // prompts 모듈을 통해 text input을 제공받고 validRemotes 내에 존재하는지 유효성 검사 진행
}
```

### 3. [commit.js](</c:/(USER_FOLDER_NAME)/Desktop/develop/convention-cli/src/commands/commit.js>) [MODIFY]

- `pushAfterSuccessfulCommit` 함수 내부의 흐름을 확장하여, 업스트림이 없는 조건일 때 위의 대화형 선택지 UI를 실행하도록 연동합니다.

```javascript
async function pushAfterSuccessfulCommit(options = {}) {
  if (!options.push) {
    return;
  }

  let approved = false;

  if (options.interactive === false) {
    approved = options.yes === true;
  } else {
    approved = await confirmAction(
      "커밋이 완료되었습니다. 현재 브랜치를 원격 저장소로 push할까요?",
    );
  }

  if (!approved) {
    warn("사용자가 push를 취소했습니다.");
    return;
  }

  const branchName = getCurrentBranchName();
  const upstreamName = getCurrentUpstreamName();

  // 업스트림이 설정되어 있는 경우 기존과 동일하게 일반 push 실행
  if (upstreamName) {
    push();
    return;
  }

  // 업스트림이 설정되어 있지 않은 경우 처리 흐름
  const remotes = getRemotes();

  if (remotes.length === 0) {
    warn(
      "등록된 원격 저장소(remote)가 없어 push를 진행할 수 없습니다. 원격 저장소를 먼저 추가해 주세요.",
    );
    return;
  }

  if (options.interactive === false) {
    if (options.yes === true && remotes.includes("origin")) {
      info(
        "비대화형 모드 승인으로 인해 origin 원격지에 자동으로 업스트림을 지정하고 push합니다.",
      );
      pushWithUpstream("origin", branchName);
    } else {
      warn(
        "비대화형 모드에서는 업스트림 자동 지정을 위한 선택을 띄울 수 없어 push를 안전하게 취소합니다.",
      );
    }
    return;
  }

  const action = await selectUpstreamSetupAction(branchName, remotes);

  if (action === "origin") {
    pushWithUpstream("origin", branchName);
  } else if (action === "custom") {
    const customRemote = await promptCustomRemoteName(remotes);
    if (customRemote) {
      pushWithUpstream(customRemote, branchName);
    } else {
      warn("원격 저장소명 입력이 취소되었습니다. push를 취소합니다.");
    }
  } else {
    warn("업스트림 지정을 취소하였습니다. push를 진행하지 않습니다.");
  }
}
```

---

## 검증 및 테스트 계획

1. **업스트림 감지 유무 테스트**:
   - 격리된 테스트 저장소를 만들고, 업스트림이 있을 때와 없을 때 `pushAfterSuccessfulCommit` 로직이 올바르게 브랜치 갈래를 타는지 단위 테스트를 작성하여 검증합니다.
2. **프롬프트 UI 선택 제어 테스트**:
   - `selectUpstreamSetupAction`에서 각 선택 항목(1, 2, 3)을 마킹하고 취소 시 로컬 커밋 상태가 그대로 보존되는지 검증합니다.
3. **비대화형 환경 동작 테스트**:
   - `interactive === false` 조건에서 `--yes` 여부에 따라 push의 허용/차단과 원격지 기본값(`origin`) 매핑이 예외 없이 이루어지는지 검증합니다.
