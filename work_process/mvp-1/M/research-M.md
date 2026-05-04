# Phase M Git 저장소 확인 Agent Research

## 1. 개요

Phase M은 Convention CLI가 현재 실행 위치가 Git 저장소 내부인지 확인하는 단계입니다. 1차 MVP의 Git 변경 파일 확인, diff 추출, commit flow는 모두 Git 저장소 안에서만 동작해야 하므로 `isGitRepository()`는 Git 관련 작업의 선행 안전 장치입니다.

현재 `src/core/git.js`는 비어 있으므로 Phase M부터 `AGENTS.md`의 함수 계약에 맞춰 Git core 함수를 채워나가는 것이 좋습니다.

## 2. 작업 목표

- `src/core/git.js`에 `isGitRepository(): boolean` 구현
- `git rev-parse --is-inside-work-tree` 실행 결과로 Git 저장소 여부 판단
- Git 저장소 내부이면 `true`, 저장소 밖이거나 Git 명령 실패 시 `false` 반환
- Git 명령은 `execFileSync` 또는 `spawnSync`를 인자 배열 방식으로 실행
- core 함수에서는 사용자 메시지를 직접 출력하지 않고 command layer에서 logger로 처리

## 3. 구현 기준

### 3.1. Git 명령

사용할 명령은 아래와 같습니다.

```bash
git rev-parse --is-inside-work-tree
```

Node.js에서는 shell 문자열이 아니라 인자 배열로 실행합니다.

```javascript
execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
});
```

금지 예시:

```javascript
execSync("git rev-parse --is-inside-work-tree");
execSync(`git rev-parse ${userInput}`);
```

### 3.2. 반환 규칙

- stdout을 `trim()` 했을 때 `true`이면 `true`
- stdout이 `false`이거나 예상과 다르면 `false`
- Git 저장소 밖, Git 미설치, PATH 문제, 권한 문제 등 Git 명령 실패 시 `false`
- 예외를 사용자에게 그대로 노출하지 않음

### 3.3. 출력 책임 분리

`isGitRepository()`는 boolean만 반환합니다. 사용자에게 보여줄 메시지는 `src/commands/commit.js` 같은 command layer에서 처리합니다.

```javascript
if (!isGitRepository()) {
  error("Git 저장소 안에서 실행해 주세요.");
  return;
}
```

## 4. 보안 및 데이터 보호 기준

- shell 문자열 interpolation을 사용하지 않습니다.
- 사용자 입력을 Git 명령 문자열에 삽입하지 않습니다.
- Git 저장소 밖 파일을 읽지 않습니다.
- `.env`, credentials, private key, diff 원문을 출력하지 않습니다.
- `git add`, `git commit`, `git reset` 같은 변경 명령은 Phase M에서 실행하지 않습니다.

## 5. 테스트 관점

테스트는 실제 사용자 저장소가 아닌 격리된 임시 디렉터리에서 수행합니다.

- Git 저장소 내부에서 `true` 반환
- Git 저장소 밖에서 `false` 반환
- Git 명령 실패 상황에서 `false` 반환
- shell 문자열이 아니라 인자 배열로 Git 명령을 실행하는지 정적 확인

테스트 편의를 위해 내부 helper가 필요할 수 있지만, 공개 함수 계약은 `isGitRepository(): boolean`으로 유지합니다.

## 6. 연결 파일 및 다음 단계

- 구현 대상: `src/core/git.js`
- 이후 연결 대상: `src/commands/commit.js`
- 사용자 메시지 출력: `src/utils/logger.js`
- 다음 단계: Phase N의 `getChangedFiles()` 구현 전 Git 저장소 여부 확인 흐름과 연결
