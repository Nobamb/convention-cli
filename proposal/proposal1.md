# proposal1: `convention --reset` 개편안

## 배경

현재 `convention --reset`은 `git reset HEAD~1`만 실행한다.

이 방식은 batch 모드처럼 한 번의 `convention` 실행이 커밋 1개만 만들 때는 충분하다. 하지만 step 모드에서는 파일별로 여러 커밋이 만들어질 수 있다. 예를 들어 변경 파일 5개를 step 모드로 커밋했다면, 사용자가 그 실행 전체를 되돌리려면 `convention --reset`을 5번 반복해야 한다.

35-2에서 고민한 핵심은 다음이다.

- 마지막 `convention` 실행에서 만든 커밋 수 N을 기준으로 `HEAD~N`까지 reset할 것인가
- 마지막으로 convention이 커밋한 파일 목록을 로컬 파일에 저장해두고 그 개수만큼 reset할 것인가
- 마지막 커밋 시간대가 비슷한 커밋들을 묶어서 reset할 것인가
- 더 안전하고 명확한 방식이 있는가

## 결론

추천안은 **마지막 convention 실행 단위를 transaction으로 기록하고, reset 시 커밋 개수나 시간대가 아니라 `beforeHead`로 정확히 되돌리는 방식**이다.

즉, `HEAD~N`을 직접 계산해서 reset하기보다 다음 정보를 저장한다.

- convention 실행 직전 HEAD: `beforeHead`
- convention 실행 후 HEAD: `afterHead`
- convention이 만든 commit hash 목록
- 실행 mode: `step`, `batch`, `group`
- 커밋된 파일 목록
- 실행 시각

그리고 `convention --reset` 실행 시 현재 HEAD가 `afterHead`와 정확히 같으면 아래처럼 되돌린다.

```js
git reset <beforeHead>
```

여기서 reset은 기존과 동일하게 mixed reset이다. 따라서 commit만 취소되고 변경사항은 working tree에 남는다. `git reset --hard`는 계속 금지한다.

## 왜 파일 개수나 시간대보다 transaction 기록 방식이 좋은가

### 1. 파일 개수 기반 `HEAD~N`은 실제 커밋 수와 어긋날 수 있다

step 모드에서 보통 “파일 수 = 커밋 수”처럼 보일 수 있지만 항상 그렇지는 않다.

예상 가능한 예외:

- 민감 파일 또는 diff가 없는 파일은 커밋 대상에서 제외될 수 있다.
- 사용자가 중간 preview에서 일부 파일 commit을 취소할 수 있다.
- localLLM/API 오류로 일부 파일만 커밋되고 나머지는 중단될 수 있다.
- 향후 group 모드에서는 한 커밋이 여러 파일을 포함할 수 있다.
- 같은 실행 안에서도 regenerate/edit/cancel 흐름에 따라 커밋 수가 달라질 수 있다.

따라서 “마지막 convention 실행에 포함된 파일 N개”를 저장하고 `HEAD~N`을 실행하면 실제 convention이 만든 커밋 범위보다 더 많이 또는 더 적게 되돌릴 수 있다.

### 2. 시간대 기반 추정은 사용자 커밋을 잘못 포함할 수 있다

마지막 커밋 시각과 가까운 커밋들을 묶는 방식은 구현은 쉬워 보이지만 안전하지 않다.

위험한 케이스:

- 사용자가 convention 직후 직접 `git commit`을 실행한 경우
- 다른 도구가 같은 시간대에 commit을 만든 경우
- rebase, cherry-pick, amend 이후 commit timestamp가 섞이는 경우
- 시스템 시간 또는 timezone 차이로 기준이 흔들리는 경우

reset은 Git 히스토리를 되돌리는 작업이므로 추정 기반으로 처리하면 안 된다. 특히 사용자 커밋을 convention 커밋으로 오인해 reset하는 순간 데이터 안전 원칙을 깰 수 있다.

### 3. commit hash 기반 transaction 기록이 가장 명확하다

convention이 직접 만든 commit hash를 기록하면 “어떤 커밋이 convention 실행 결과인지”를 추정하지 않아도 된다.

다만 reset 실행 자체는 commit hash 목록을 하나씩 세기보다 `beforeHead`로 되돌리는 편이 더 단순하고 안전하다.

예:

```json
{
  "schemaVersion": 1,
  "repoRoot": "C:/Users/USER/Desktop/develop/convention-cli",
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
    },
    {
      "hash": "5555555555555555555555555555555555555555",
      "message": "fix: improve reset flow",
      "files": ["src/commands/reset.js"]
    }
  ]
}
```

이 기록이 있으면 사용자는 `convention --reset` 한 번으로 마지막 convention 실행 전체를 되돌릴 수 있다.

## 추천 저장 위치

추천 저장 위치는 **Git 저장소 내부의 `.git/convention/last-run.json`**이다.

이유:

- 저장소별 상태이므로 전역 config보다 repo-local이 맞다.
- `.git` 내부이므로 실수로 commit되지 않는다.
- 사용자 홈 전체 스캔이 필요 없다.
- 프로젝트 파일을 오염시키지 않는다.
- reset 대상이 Git 히스토리이므로 Git repository metadata에 가까운 위치가 자연스럽다.

대안으로 `.convention/state/last-run.json`도 가능하지만, 이 경우 `.gitignore` 누락 시 상태 파일이 commit될 수 있다. 상태 파일에는 secret이 없어야 하지만 commit hash, branch, 파일 경로가 들어가므로 굳이 working tree에 둘 이유가 없다.

## 권장 동작 설계

### 1. convention commit flow 시작 시 transaction 시작

commit flow가 실제 커밋을 만들기 직전에 현재 HEAD를 기록한다.

```js
const beforeHead = getCurrentHead();
const transaction = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  mode,
  beforeHead,
  commits: []
};
```

주의:

- 아직 커밋이 하나도 만들어지지 않았다면 state 파일을 저장하지 않는다.
- commit 생성 전부터 파일을 저장하면 실패한 실행이 마지막 정상 실행 기록을 덮어쓸 수 있다.

### 2. convention이 commit을 만들 때마다 commit hash 기록

`git commit` 성공 직후 `git rev-parse HEAD`로 새 commit hash를 읽고 transaction에 추가한다.

```js
transaction.commits.push({
  hash: getCurrentHead(),
  message,
  files
});
```

주의:

- commit 실패 시 추가하지 않는다.
- 사용자가 step 중 일부 파일을 cancel하면 실제 생성된 commit만 기록한다.
- push 여부는 reset 대상과 별개로 기록만 한다.

### 3. convention 실행 종료 시 transaction 확정 저장

하나 이상의 commit이 만들어졌을 때만 `afterHead`를 채우고 저장한다.

```js
transaction.afterHead = getCurrentHead();
transaction.finishedAt = new Date().toISOString();
saveLastConventionRun(transaction);
```

저장 시에는 기존 `last-run.json`을 덮어쓴다. 35-2에서 말한 “기존 내용을 지우고 해당 파일들을 넣는” 방향과 비슷하지만, 파일 목록만 저장하지 않고 commit hash와 before/after HEAD까지 같이 저장한다.

### 4. `convention --reset` 실행 시 state 검증

`convention --reset`은 다음 순서로 동작한다.

1. Git 저장소인지 확인
2. `.git/convention/last-run.json` 존재 여부 확인
3. state JSON parse 및 schema 검증
4. 현재 HEAD 조회
5. 현재 HEAD가 `state.afterHead`와 같은지 확인
6. reset 대상 commit 목록과 파일 목록 preview 출력
7. 사용자 confirm
8. `git reset <state.beforeHead>` 실행
9. state 파일 삭제 또는 `last-reset.json`으로 이동

현재 HEAD가 `state.afterHead`와 다르면 자동 reset을 거부한다.

이 제한은 중요하다. 마지막 convention 실행 이후 사용자가 직접 commit을 추가했다면, `git reset <beforeHead>`는 그 사용자 commit까지 같이 되돌릴 수 있기 때문이다.

거부 메시지 예:

```text
마지막 convention 실행 이후 다른 커밋이 추가되어 자동 reset을 중단합니다.
현재 HEAD와 기록된 afterHead가 다릅니다.
필요하면 git log를 확인한 뒤 수동으로 reset하세요.
```

## CLI UX 제안

### 기본 동작

```bash
convention --reset
```

기본 동작은 “마지막 convention 실행 전체를 되돌리기”로 바꾼다.

출력 예:

```text
마지막 convention 실행에서 생성된 3개 커밋을 취소합니다.

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

### legacy 동작이 필요할 때

기존 `HEAD~1` 동작을 유지하고 싶다면 별도 옵션으로 분리한다.

```bash
convention --reset-last-commit
```

또는 더 명확하게:

```bash
convention --reset --last-commit
```

다만 옵션 파싱 복잡도를 줄이려면 1차 구현에서는 legacy 옵션을 만들지 않아도 된다. state가 없을 때만 안내 메시지로 수동 명령을 제안하면 충분하다.

### state가 없을 때

state가 없으면 `HEAD~1`로 fallback하지 않는 편이 안전하다.

권장 메시지:

```text
마지막 convention 실행 기록을 찾을 수 없어 자동 reset을 중단합니다.
이전 방식으로 최근 커밋 1개만 취소하려면 git reset HEAD~1을 직접 실행하세요.
변경사항은 working tree에 남습니다.
```

자동 fallback을 하지 않는 이유:

- 사용자는 “마지막 convention 실행 전체 reset”을 기대했는데 `HEAD~1`만 되돌아가면 오해가 생긴다.
- 반대로 마지막 commit이 convention commit이 아닐 수도 있다.
- reset은 안전하게 실패하는 편이 낫다.

## 보안 및 데이터 안전 규칙

반드시 유지해야 할 규칙:

- `git reset --hard`는 구현하지 않는다.
- reset은 반드시 사용자 confirm 이후 실행한다.
- shell 문자열 조합을 사용하지 않고 `execFileSync("git", ["reset", beforeHead])`처럼 argv 배열을 사용한다.
- `beforeHead`, `afterHead`, commit hash는 `/^[0-9a-f]{40}$/i`로 검증한다.
- state 파일에 diff 원문, prompt 원문, AI 응답 원문, API Key, token, credentials를 저장하지 않는다.
- reset 실패 시 Git stderr 원문을 그대로 출력하지 않는다.
- 현재 HEAD가 state의 `afterHead`와 다르면 자동 reset하지 않는다.
- 이미 push된 커밋일 수 있으므로 remote rewrite는 절대 하지 않고 local reset만 수행한다.

## 기존 AGENTS.md 규칙과의 충돌

현재 `AGENTS.md`에는 `git reset HEAD~1`만 허용한다고 되어 있다.

이번 개편을 실제 구현하려면 이 규칙을 바꿔야 한다.

권장 변경:

```md
--reset 규칙:
- 기본 동작은 마지막 convention 실행 transaction 전체를 mixed reset으로 되돌린다.
- transaction 기록이 있고 현재 HEAD가 기록된 afterHead와 정확히 일치할 때만 `git reset <beforeHead>`를 허용한다.
- transaction 기록이 없거나 HEAD가 일치하지 않으면 자동 reset을 중단한다.
- legacy 최근 커밋 1개 reset을 지원할 경우에도 반드시 별도 옵션과 confirm을 요구한다.
- `git reset --hard`는 구현하지 않는다.
```

## 구현 범위 제안

### 1단계: transaction state 모듈 추가

추천 파일:

- `src/core/resetState.js`

추천 함수:

- `getResetStatePath(): string`
- `loadLastConventionRun(): object | null`
- `saveLastConventionRun(transaction): void`
- `clearLastConventionRun(): void`
- `validateLastConventionRun(transaction): boolean`

저장 위치:

- `.git/convention/last-run.json`

### 2단계: Git helper 확장

추천 함수:

- `getCurrentHead(): string`
- `resetToCommit(commitHash): void`

주의:

- `resetToCommit()`은 40자리 commit hash만 허용한다.
- 임의 ref 문자열을 받지 않는다.

### 3단계: commit flow에 transaction 기록 연결

연결 대상:

- batch commit
- step commit
- group commit

각 flow에서 commit 성공 직후 hash와 파일 목록을 기록한다.

### 4단계: reset command 개편

`runReset()`은 더 이상 무조건 `resetLastCommit()`만 호출하지 않는다.

새 흐름:

1. state 로드
2. 현재 HEAD와 state.afterHead 비교
3. preview 출력
4. confirm
5. `resetToCommit(state.beforeHead)`
6. state 삭제

### 5단계: 테스트 추가

중점 테스트:

- batch 모드 commit 1개 후 `--reset` 시 beforeHead로 복귀
- step 모드 commit N개 후 `--reset` 한 번으로 N개 모두 취소
- reset 후 변경사항이 working tree에 남는지 확인
- state가 없으면 자동 reset하지 않는지 확인
- state.afterHead와 현재 HEAD가 다르면 자동 reset하지 않는지 확인
- state에 잘못된 hash가 있으면 reset하지 않는지 확인
- push된 커밋이어도 remote 조작 없이 local reset만 하는지 확인
- `git reset --hard`가 코드에 없는지 확인

## 최종 추천

내 의견은 다음이다.

1. 파일 개수 기반 `HEAD~N`은 추천하지 않는다.
2. 시간대 기반 추정 reset도 추천하지 않는다.
3. 마지막 convention 실행을 transaction으로 저장하고, 현재 HEAD가 기록된 `afterHead`와 정확히 일치할 때만 `beforeHead`로 mixed reset하는 방식을 추천한다.

이 방식이 가장 안전하다.

- convention이 실제로 만든 커밋만 대상으로 삼을 수 있다.
- 사용자가 직접 만든 커밋을 실수로 reset할 가능성을 줄인다.
- step/batch/group 모드를 모두 같은 모델로 처리할 수 있다.
- 향후 PR 자동화, CI output, push 정책과도 충돌이 적다.
