# FIX-RS. convention --reset 개편 구현 계획

## 작업 범위

FIX-RS 단계는 `convention --reset`의 동작 기준을 "마지막 커밋 1개 취소"에서 "마지막 convention 실행 단위 취소"로 개편하는 작업이다.

현재 `convention --reset`은 `git reset HEAD~1` 기반으로 동작하기 때문에 batch 모드처럼 convention 실행 1회가 commit 1개를 만드는 경우에는 충분하다. 하지만 step 모드에서는 파일별로 여러 commit이 생성될 수 있고, 이 경우 사용자가 마지막 convention 실행 전체를 되돌리려면 `convention --reset`을 여러 번 반복해야 한다.

따라서 추천 방향은 commit 개수나 commit 시각을 추정하지 않고, 마지막 convention 실행을 transaction으로 기록한 뒤 해당 transaction의 `beforeHead`로 mixed reset하는 방식이다.

## 핵심 결론

추천 구현은 다음과 같다.

- 마지막 convention 실행 직전 HEAD를 `beforeHead`로 기록한다.
- 마지막 convention 실행 종료 후 HEAD를 `afterHead`로 기록한다.
- convention이 실제로 만든 commit hash 목록과 파일 목록을 함께 기록한다.
- `convention --reset` 실행 시 현재 HEAD가 기록된 `afterHead`와 정확히 일치할 때만 reset을 허용한다.
- reset 명령은 `git reset <beforeHead>`만 사용한다.
- `git reset --hard`는 계속 금지한다.
- transaction 기록이 없거나 HEAD가 일치하지 않으면 `HEAD~1`로 fallback하지 않고 안전하게 중단한다.

## 제외할 접근

### 파일 개수 기반 HEAD~N

파일 개수 또는 변경 파일 수를 기준으로 `HEAD~N`을 계산하는 방식은 사용하지 않는다.

이유는 다음과 같다.

- step 모드에서도 파일 1개가 반드시 commit 1개가 된다는 보장이 없다.
- preview, edit, cancel 흐름에 따라 일부 파일만 commit될 수 있다.
- 보안 필터나 민감 파일 제외로 변경 파일과 commit 개수가 달라질 수 있다.
- 향후 group 모드가 추가되면 여러 파일이 commit 1개로 묶일 수 있다.
- 중간 실패가 발생하면 convention 실행 안에서도 실제 commit 수가 유동적이다.

### 시간 범위 기반 commit 묶기

commit 시각이 가까운 commit을 convention 실행 결과로 추정하는 방식도 사용하지 않는다.

이유는 다음과 같다.

- 사용자가 convention 실행 직후 수동 commit을 만들 수 있다.
- 다른 도구가 같은 시간대에 commit을 생성할 수 있다.
- rebase, cherry-pick, amend 이후 timestamp만으로 출처를 판단하기 어렵다.
- Git 히스토리 조작은 추정 기반으로 처리하면 사용자 commit까지 되돌릴 위험이 있다.

## 추천 상태 파일

상태 파일은 저장소별 Git metadata 내부에 둔다.

```text
.git/convention/last-run.json
```

이 위치를 추천하는 이유는 다음과 같다.

- reset 대상은 Git 히스토리이므로 repository-local 상태가 맞다.
- `.git` 내부 파일은 실수로 commit되지 않는다.
- 프로젝트 working tree를 오염시키지 않는다.
- 전역 config에 저장하면 여러 저장소의 reset 상태가 섞일 수 있다.

## 상태 파일 schema

상태 파일에는 diff 원문, prompt 원문, AI 응답 원문, API Key, token, credentials를 저장하지 않는다. commit hash와 파일 경로처럼 reset 검증에 필요한 최소 정보만 저장한다.

```json
{
  "schemaVersion": 1,
  "repoRoot": "C:/path/to/repo",
  "startedAt": "2026-05-28T08:00:00.000Z",
  "finishedAt": "2026-05-28T08:00:15.000Z",
  "mode": "step",
  "beforeHead": "1111111111111111111111111111111111111111",
  "afterHead": "5555555555555555555555555555555555555555",
  "commits": [
    {
      "hash": "2222222222222222222222222222222222222222",
      "message": "docs: update README",
      "files": ["README.md"]
    },
    {
      "hash": "3333333333333333333333333333333333333333",
      "message": "test: add reset tests",
      "files": ["tests/reset-command.test.js"]
    }
  ]
}
```

검증 기준은 다음과 같다.

- `schemaVersion`은 `1`이어야 한다.
- `beforeHead`, `afterHead`, commit `hash`는 `/^[0-9a-f]{40}$/i`를 통과해야 한다.
- `commits`는 배열이어야 한다.
- `commits`가 비어 있으면 reset 대상으로 보지 않는다.
- `files`는 문자열 배열이어야 하며 Git 저장소 밖 절대 경로를 기록하지 않는다.
- `message`는 preview 용도로만 사용하며 reset 명령에는 전달하지 않는다.

## 생성 또는 수정 대상

예상 구현 파일은 다음과 같다.

- `src/core/resetState.js`
- `src/core/git.js`
- `src/commands/commit.js`
- `src/commands/reset.js`
- `bin/convention.js`
- `src/commands/help.js`
- `tests/reset-phase-fix-rs.test.js`
- `init/00_rule.md`
- `AGENTS.md`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획과 테스트 항목만 정리한다.

## 권장 함수 구조

`src/core/resetState.js`를 새로 추가한다.

```js
export function getResetStatePath()
export function loadLastConventionRun()
export function saveLastConventionRun(transaction)
export function clearLastConventionRun()
export function validateLastConventionRun(transaction)
```

각 함수의 책임은 다음과 같다.

- `getResetStatePath()`는 현재 Git 저장소의 `.git/convention/last-run.json` 경로를 반환한다.
- `loadLastConventionRun()`은 상태 파일이 없으면 `null`을 반환하고, JSON parse 실패 또는 schema 오류는 안전한 오류로 변환한다.
- `saveLastConventionRun(transaction)`은 최소 schema 검증 후 저장한다.
- `clearLastConventionRun()`은 reset 성공 후 상태 파일을 제거하거나 별도 archive 파일로 이동한다.
- `validateLastConventionRun(transaction)`은 hash, 배열, mode, 시간 필드 등 기본 schema를 검증한다.

`src/core/git.js`에는 아래 helper를 추가한다.

```js
export function getCurrentHead()
export function resetToCommit(commitHash)
```

주의할 점은 다음과 같다.

- `getCurrentHead()`는 `git rev-parse HEAD`를 argv 배열 방식으로 호출한다.
- `resetToCommit(commitHash)`는 40자리 commit hash만 받는다.
- `resetToCommit()`은 `execFileSync("git", ["reset", commitHash])` 형태로 실행한다.
- 임의 ref 문자열, shell 문자열, `--hard` 옵션을 받지 않는다.

## commit flow 연결 계획

commit flow는 batch, step, group 흐름 모두 같은 transaction 모델을 사용해야 한다.

### 1. 실행 시작 시점

commit을 만들기 직전에 현재 HEAD를 기록한다.

```js
const transaction = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  mode,
  beforeHead: getCurrentHead(),
  commits: []
};
```

아직 commit이 하나도 생성되지 않은 상태에서는 `last-run.json`을 저장하지 않는다. 실패한 실행 기록이 정상 실행 기록을 덮어쓰면 reset 대상이 잘못될 수 있기 때문이다.

### 2. commit 성공 직후

`git commit`이 성공한 직후 `getCurrentHead()`로 새 commit hash를 읽고 transaction에 추가한다.

```js
transaction.commits.push({
  hash: getCurrentHead(),
  message,
  files
});
```

commit 실패, 사용자 cancel, 보안 gate 실패 시에는 commit 목록에 추가하지 않는다.

### 3. 실행 종료 시점

하나 이상의 commit이 생성된 경우에만 `afterHead`와 `finishedAt`을 채우고 저장한다.

```js
transaction.afterHead = getCurrentHead();
transaction.finishedAt = new Date().toISOString();
saveLastConventionRun(transaction);
```

기존 `last-run.json`은 최신 convention 실행 기록으로 덮어쓴다. 이 동작은 "마지막 convention 실행"만 reset 대상으로 삼겠다는 정책과 일치한다.

## reset command 흐름

`runReset()`은 다음 순서로 개편한다.

1. Git 저장소인지 확인한다.
2. `.git/convention/last-run.json`을 로드한다.
3. 상태 파일이 없으면 자동 reset을 중단한다.
4. 상태 파일 schema를 검증한다.
5. 현재 HEAD를 조회한다.
6. 현재 HEAD와 `state.afterHead`가 같은지 확인한다.
7. 되돌릴 commit 목록과 파일 목록을 preview로 보여준다.
8. 사용자 confirm을 받는다.
9. `resetToCommit(state.beforeHead)`를 실행한다.
10. reset 성공 후 상태 파일을 제거하거나 `last-reset.json`으로 이동한다.

현재 HEAD가 `state.afterHead`와 다르면 자동 reset을 중단해야 한다. 마지막 convention 실행 이후 사용자가 직접 commit을 추가했을 가능성이 있기 때문이다.

## UX 문구 계획

상태가 정상인 경우:

```text
마지막 convention 실행에서 생성된 3개 commit을 취소합니다.

- docs: update README
  files: README.md
- test: add reset tests
  files: tests/reset-command.test.js
- fix: improve reset flow
  files: src/commands/reset.js

실행 명령: git reset <beforeHead>
변경사항은 삭제되지 않고 working tree에 남습니다.
계속할까요?
```

상태 파일이 없는 경우:

```text
마지막 convention 실행 기록을 찾을 수 없어 자동 reset을 중단합니다.
기존 방식으로 최근 commit 1개만 취소하려면 git reset HEAD~1을 직접 실행하세요.
변경사항은 working tree에 남습니다.
```

HEAD가 일치하지 않는 경우:

```text
마지막 convention 실행 이후 다른 commit이 추가되어 자동 reset을 중단합니다.
현재 HEAD와 기록된 afterHead가 일치하지 않습니다.
필요하면 git log를 확인한 뒤 수동으로 reset하세요.
```

## 보안 및 데이터 안전 기준

반드시 지켜야 할 기준은 다음과 같다.

- reset은 항상 사용자 confirm 이후 실행한다.
- `git reset --hard`는 구현하지 않는다.
- `HEAD~N` 자동 계산과 fallback은 사용하지 않는다.
- Git 명령은 `execFileSync` 또는 `spawnSync`에 argv 배열로 전달한다.
- 상태 파일에는 secret, raw diff, prompt, AI 응답 원문을 저장하지 않는다.
- Git stderr 원문을 그대로 출력하지 않는다.
- 현재 HEAD가 `afterHead`와 다르면 reset하지 않는다.
- push 여부와 관계없이 remote rewrite는 하지 않고 local mixed reset만 수행한다.

## 기존 규칙과의 충돌

현재 `AGENTS.md`에는 `git reset HEAD~1`만 허용한다고 되어 있다. 이 개편을 실제 구현하려면 상위 문서인 `init/00_rule.md`와 `AGENTS.md`의 reset 규칙을 먼저 갱신해야 한다.

권장 개정 방향은 다음과 같다.

- 기본 `--reset`은 마지막 convention transaction 전체를 mixed reset으로 되돌린다.
- transaction 기록이 있고 현재 HEAD가 기록된 `afterHead`와 일치할 때만 `git reset <beforeHead>`를 허용한다.
- transaction 기록이 없거나 HEAD가 일치하지 않으면 자동 reset을 중단한다.
- legacy 최근 commit 1개 reset이 필요하면 별도 옵션으로 분리하고, 기본값으로 fallback하지 않는다.
- `git reset --hard`는 계속 금지한다.

## 구현 단계

### 1단계: 문서 규칙 정렬

`init/00_rule.md`, `AGENTS.md`, help 문구에서 reset 정책을 먼저 정리한다. 구현보다 보안 규칙이 우선이므로 문서와 코드의 허용 범위가 일치해야 한다.

### 2단계: reset state 모듈 추가

`src/core/resetState.js`를 추가하고 상태 파일 경로 계산, 저장, 로드, 삭제, schema 검증을 구현한다.

### 3단계: Git helper 확장

`src/core/git.js`에 `getCurrentHead()`와 `resetToCommit(commitHash)`를 추가한다. hash 검증은 reset state 검증과 git helper 양쪽에서 방어적으로 수행한다.

### 4단계: commit flow transaction 연결

`runBatchCommit()`, `runStepCommit()`, 향후 group commit 흐름에서 commit 성공 후 transaction에 commit hash와 파일 목록을 기록한다.

### 5단계: reset command 개편

`src/commands/reset.js`에서 `resetLastCommit()` 직접 호출을 제거하고 transaction 검증 후 `resetToCommit(state.beforeHead)`를 호출한다.

### 6단계: 테스트 추가

격리된 임시 Git 저장소를 사용해 batch, step, 상태 없음, HEAD 불일치, invalid state, 보안 출력, `--hard` 미사용 여부를 검증한다.

## 완료 기준

- `convention --reset` 1회로 마지막 convention 실행에서 생성된 commit 전체를 취소할 수 있다.
- reset 후 변경사항은 working tree에 남는다.
- transaction 기록이 없으면 자동 reset하지 않는다.
- 현재 HEAD가 기록된 `afterHead`와 다르면 자동 reset하지 않는다.
- `git reset --hard`는 코드와 테스트 어디에서도 사용되지 않는다.
- 상태 파일에는 민감정보나 diff 원문이 저장되지 않는다.
- batch, step, 향후 group 모드가 같은 transaction 모델로 처리될 수 있다.
