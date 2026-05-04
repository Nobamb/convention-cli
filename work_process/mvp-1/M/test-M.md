# Phase M Git 저장소 확인 Agent Plan

## 1. 목표

`src/core/git.js`에 `isGitRepository(): boolean`을 구현해 현재 실행 위치가 Git work tree 내부인지 확인합니다.

## 2. 구현 작업

- `node:child_process`에서 `execFileSync`를 import
- `git rev-parse --is-inside-work-tree`를 인자 배열 방식으로 실행
- stdout이 `true`이면 `true` 반환
- Git 명령 실패 또는 저장소 밖 실행은 `false` 반환
- core 함수 내부에서는 logger나 console을 호출하지 않음

권장 구현 형태:

```javascript
import { execFileSync } from "node:child_process";

export function isGitRepository() {
  try {
    const output = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });

    return output.trim() === "true";
  } catch {
    return false;
  }
}
```

## 3. 테스트 계획

- 임시 디렉터리에 `git init` 후 `isGitRepository()`가 `true`를 반환하는지 확인
- Git 저장소가 아닌 임시 디렉터리에서 `false`를 반환하는지 확인
- Git 명령 실패 상황을 mock 또는 PATH 제어로 만들었을 때 `false`를 반환하는지 확인
- 실제 사용자 저장소에서 commit, reset, add를 실행하지 않음

## 4. 완료 기준

- `src/core/git.js`에서 `isGitRepository()`를 export
- Git 명령 실행 방식이 `execFileSync("git", [...])` 또는 동등한 `spawnSync` 인자 배열 방식
- Git 저장소 밖에서도 프로그램이 예외로 죽지 않고 command layer가 처리 가능한 boolean을 받음
- diff 원문이나 민감정보를 출력하지 않음

## 5. 다음 연결

Phase N 이후 Git 관련 함수는 command flow에서 `isGitRepository()` 확인 뒤 호출하는 흐름으로 연결합니다.
