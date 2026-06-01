# proposal5: proposal4 upstream 자동 설정 보안 보완안

## 결론

`proposal4.md`의 목표인 "upstream이 없는 브랜치에서 `convention --push` 사용성을 개선한다"는 방향은 유효하다. 다만 현재 제안 그대로 구현하면 기존 `--push` 동작과 보안 경계를 넓히는 부분이 있다.

가장 큰 문제는 **비대화형 모드에서 `--yes`가 있으면 자동으로 `git push -u origin <branch>`를 실행한다는 제안**이다. 현재 `--yes`는 commit/PR/push 확인 prompt를 생략하기 위한 명시 승인으로 쓰이고 있지만, upstream이 없는 브랜치에서 `-u`까지 자동 수행하면 아래 두 가지 부작용이 추가된다.

- 원격 저장소에 새 브랜치를 생성하거나 갱신할 수 있다.
- 로컬 `.git/config`에 upstream 추적 설정을 기록한다.

즉 단순 push 승인보다 더 큰 상태 변경이므로, 기존 `--yes` 의미에 묶어 자동 승인하면 안 된다.

## proposal4에서 유지해도 되는 부분

아래 내용은 현재 프로젝트 보안 원칙과 잘 맞는다.

- `execFileSync` 또는 `spawnSync`를 argv 배열 방식으로 사용한다.
- 원격 저장소 이름은 `git remote` 결과에 있는 값으로만 제한한다.
- push 실패 시 Git stderr, remote URL, 인증 세부 정보를 그대로 출력하지 않는다.
- interactive 환경에서 upstream이 없을 때 사용자에게 선택지를 보여준다.
- 사용자가 취소하면 로컬 커밋만 유지하고 원격은 변경하지 않는다.

## 보안 및 기존 동작 영향

### 1. `--yes`만으로 upstream 자동 설정을 허용하면 안 됨

현재 `pushAfterSuccessfulCommit()`은 commit 성공 후 `--push`가 있을 때 별도 push 확인을 수행한다. 비대화형에서는 `--yes`가 있어야 push한다.

하지만 `git push -u origin <branch>`는 일반 `git push`보다 강한 동작이다. 원격 브랜치 생성과 로컬 upstream 설정을 동시에 수행한다. 따라서 `--yes`만으로 `-u`까지 자동 승인하면 사용자는 "push 승인"만 의도했는데 "upstream 생성/설정"까지 발생할 수 있다.

권장 정책:

- interactive 모드: upstream이 없으면 사용자에게 한 번 더 명확히 묻는다.
- non-interactive 모드: `--yes`만으로는 upstream을 자동 설정하지 않는다.
- 자동화가 필요하면 별도 명시 옵션을 추가한다. 예: `--set-upstream origin` 또는 `--push-upstream origin`

### 2. `origin`을 기본 remote로 자동 선택하는 것은 위험할 수 있음

많은 저장소에서 `origin`이 일반 기본값이지만, 항상 올바른 배포 대상은 아니다. fork, mirror, 개인 remote, 회사 내부 remote가 섞인 저장소에서는 `origin`이 의도한 upstream 대상이 아닐 수 있다.

권장 정책:

- interactive 선택지에서 `origin/<currentBranch>`를 추천값으로 보여주는 것은 가능하다.
- non-interactive 자동 실행에서는 `origin`을 암묵 기본값으로 쓰지 않는다.
- 명시 옵션이 들어온 경우에만 해당 remote를 사용한다.

### 3. branch 상태 검증이 필요함

`push -u <remote> <branch>`를 실행하려면 현재 branch 이름이 명확해야 한다. detached HEAD, 빈 branch 이름, 특수한 ref 상태에서는 자동 upstream 설정을 중단해야 한다.

권장 검증:

- `getCurrentBranchName()` 결과가 비어 있으면 중단한다.
- branch 이름은 Git이 반환한 현재 브랜치만 사용하고, 사용자 입력 branch 이름은 받지 않는다.
- 오류 메시지에는 remote URL이나 Git stderr 원문을 포함하지 않는다.

### 4. `getCurrentBranchName()`과 `getCurrentUpstreamName()` 공개 여부

proposal4는 `commit.js`에서 `getCurrentBranchName()`과 `getCurrentUpstreamName()`을 직접 호출하는 흐름을 제안한다. 현재 두 함수는 `src/core/git.js` 내부 helper다.

공개 export로 바꿀 수는 있지만, public contract가 늘어난다. 더 나은 방향은 core 계층에 push 의사결정에 필요한 좁은 함수만 추가하는 것이다.

권장 함수:

```js
export function getPushTargetStatus(): {
  branchName: string,
  upstreamName: string,
  remotes: string[]
}
```

또는 더 단순히 아래 함수만 추가한다.

```js
export function getRemotes(): string[]
export function hasUpstream(): boolean
export function pushWithUpstream(remoteName, branchName): void
```

단, `pushWithUpstream()` 내부에서 remote와 branch 검증을 다시 수행해야 한다.

### 5. remote 이름 검증은 `git remote` 교집합으로만 처리

사용자에게 직접 입력받은 remote 이름은 문자열 정규식만으로 허용하지 말고, 반드시 `getRemotes()` 결과와 비교해야 한다.

권장 흐름:

1. `getRemotes()`로 실제 등록된 remote 이름을 가져온다.
2. 입력값이 그 목록에 없으면 중단한다.
3. Git 명령은 `["push", "-u", remoteName, branchName]` argv 배열로 실행한다.

## 수정된 권장 UX

### interactive 모드

upstream이 없고 `--push`가 요청된 경우:

```text
현재 브랜치 '<branch>'에 upstream이 없습니다. 어떻게 진행할까요?
  1. origin/<branch>로 upstream을 설정하고 push
  2. 다른 등록 remote 선택 후 upstream을 설정하고 push
  3. push 취소
```

조건:

- `origin`이 실제 remote 목록에 있을 때만 1번을 보여준다.
- 다른 remote 선택은 `git remote` 결과 목록에서 고르게 한다. 자유 텍스트 입력보다 select UI가 더 안전하다.
- 선택 취소 시 로컬 커밋은 유지하고 원격은 변경하지 않는다.

### non-interactive 모드

기본 정책:

```text
upstream이 없어 push를 진행할 수 없습니다.
비대화형 모드에서는 자동 upstream 설정을 수행하지 않습니다.
필요하면 먼저 git push -u <remote> <branch>를 직접 실행하거나, 명시 옵션을 사용하세요.
```

자동화 허용이 필요하다면 새 명시 옵션을 추가한다.

예시:

```bash
convention --batch --push --yes --set-upstream origin
```

이 경우에도 아래 조건을 모두 만족해야 한다.

- `--push`가 함께 있어야 한다.
- `--yes`가 함께 있어야 한다.
- remote 이름이 `git remote` 결과에 있어야 한다.
- 현재 branch 이름이 비어 있지 않아야 한다.

## 구현 제안

### `src/core/git.js`

추가 후보:

```js
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
```

```js
export function pushWithUpstream(remoteName, branchName) {
  const remotes = getRemotes();

  if (!remotes.includes(remoteName)) {
    throw new Error("Remote is not registered.");
  }

  if (typeof branchName !== "string" || branchName.trim().length === 0) {
    throw new Error("Current branch name could not be detected.");
  }

  try {
    execFileSync("git", ["push", "-u", remoteName, branchName], GIT_COMMAND_OPTIONS);
    logSuccess(`Pushed branch ${branchName} and set upstream to ${remoteName}/${branchName}.`);
  } catch {
    const message = buildPushFailureMessage(branchName, `${remoteName}/${branchName}`);
    logError(message);
    throw new Error(message);
  }
}
```

주의:

- remote URL은 조회하거나 출력하지 않는다.
- Git stderr 원문을 출력하지 않는다.
- branch 이름은 현재 Git에서 감지한 값만 사용한다.

### `src/utils/ui.js`

자유 텍스트 입력보다 등록 remote 목록 기반 select UI를 우선한다.

```js
export async function selectUpstreamRemote({ branchName, remotes }) {
  // origin이 있으면 첫 선택지로 두고, 나머지 remote도 선택지로 제공한다.
  // cancel은 항상 제공한다.
}
```

### `src/commands/commit.js`

`pushAfterSuccessfulCommit()` 변경 원칙:

1. 기존 upstream이 있으면 기존 `push()` 흐름 유지
2. upstream이 없고 interactive이면 remote 선택 UI 실행
3. upstream이 없고 non-interactive이면 기본 중단
4. 별도 명시 옵션이 있는 경우에만 `pushWithUpstream()` 허용

## CLI 옵션 제안

`proposal4`의 자동 origin fallback 대신 아래 옵션을 제안한다.

```bash
convention --push --set-upstream origin
```

규칙:

- `--set-upstream <remote>`는 `--push`와 함께만 허용한다.
- 설정 명령(`--model`, `--language`, `--set-mode`, `--template`)과 함께 쓰면 안 된다.
- `--reset`, `--pr`, `-am`, `-iam`, `-uam`과 함께 쓰면 안 된다.
- non-interactive에서 upstream이 없고 `--set-upstream`이 없으면 push를 중단한다.

## 테스트 추가 항목

- upstream이 있는 브랜치에서는 기존 `git push` 흐름 유지
- upstream이 없고 interactive에서 cancel하면 원격 변경 없음
- upstream이 없고 interactive에서 remote 선택 시 `git push -u <remote> <branch>` 실행
- upstream이 없고 non-interactive + `--yes`만 있으면 push 중단
- upstream이 없고 non-interactive + `--yes --set-upstream origin`이면 등록 remote 검증 후 push
- 등록되지 않은 remote 이름은 push 실행 전 거부
- detached HEAD에서는 upstream 설정 중단
- push 실패 메시지에 remote URL, token, Git stderr 원문이 포함되지 않음

## 최종 판정

`proposal4.md`는 interactive UX 개선안으로는 유효하지만, **비대화형 `--yes`만으로 upstream을 자동 설정하고 push하는 부분은 보안 및 기존 동작 의미에 영향을 준다.**

따라서 proposal4를 그대로 구현하지 말고, upstream 설정은 interactive 추가 확인 또는 별도 명시 옵션으로만 허용하는 방향으로 수정해야 한다.
