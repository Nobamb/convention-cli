# Phase P Git Diff 파일별 추출 Agent Research

## 1. 개요

Phase P는 step 모드에서 사용할 파일별 diff를 추출하는 `getFileDiffs(files)` 구현 기준을 정리하는 단계입니다. Phase N의 변경 파일 목록을 입력받아 각 파일의 diff를 분리된 배열로 반환합니다.

## 2. 작업 목표

- `src/core/git.js`에 `getFileDiffs(files): { file: string, diff: string }[]` 구현
- 각 파일마다 `git -c core.quotepath=false diff HEAD -- <file>` 실행
- 공백, 한글 파일명을 shell quoting 없이 안전 처리
- diff가 없는 파일은 결과에서 제외
- diff 원문을 logger나 console에 출력하지 않음

## 3. Git 명령 기준

파일별 diff 명령은 아래 의미로 실행합니다.

```bash
git -c core.quotepath=false diff HEAD -- <file>
```

Node.js에서는 파일 경로를 하나의 argv로 전달합니다.

```javascript
execFileSync("git", ["-c", "core.quotepath=false", "diff", "HEAD", "--", file], {
  encoding: "utf8"
});
```

`--` 구분자는 파일명이 `-`로 시작하거나 Git 옵션처럼 해석되는 문제를 막습니다.

## 4. 공백 및 한글 파일명 처리

금지 방식:

```javascript
execSync(`git diff HEAD -- ${file}`);
```

허용 방식:

```javascript
execFileSync("git", ["-c", "core.quotepath=false", "diff", "HEAD", "--", file], {
  encoding: "utf8"
});
```

파일명은 argv 배열의 단일 인자로 전달되므로 공백과 한글이 shell에서 분해되지 않습니다.

## 5. diff 없음 처리

파일 목록에 포함되어 있어도 diff가 비어 있을 수 있습니다.

- untracked-only 파일
- 이미 변경이 사라진 파일
- 잘못 전달된 파일
- Git diff 기준상 출력이 없는 pathspec

`diff.trim()`이 비어 있으면 결과 배열에 포함하지 않습니다. 단, 반환하는 diff는 원본 줄바꿈을 보존합니다.

```javascript
if (!diff.trim()) {
  continue;
}

fileDiffs.push({ file, diff });
```

## 6. staged 및 untracked 기준

`git diff HEAD -- <file>`은 staged와 unstaged tracked 변경을 HEAD 기준으로 함께 보여줍니다. 따라서 step 모드의 커밋 메시지 생성 기준으로 적합합니다.

다만 untracked-only 파일은 `git diff HEAD -- <file>`로 내용이 나오지 않습니다. 신규 파일 diff 테스트는 파일을 staged 상태로 만든 뒤 확인해야 합니다. untracked 파일 내용을 직접 읽는 구현은 민감 파일 제외와 secret 탐지 기준이 먼저 필요하므로 Phase P 범위에서 제외합니다.

## 7. 에러 처리 기준

- `files`가 배열이 아니면 `TypeError`를 던지는 방향을 권장
- 빈 배열이면 `[]` 반환
- 문자열이 아니거나 빈 문자열인 항목은 제외
- Git 명령 실패는 숨기지 않고 호출자에게 전달
- 특정 파일 실패를 무시하면 불완전한 diff로 AI 메시지를 만들 수 있으므로 1차 MVP에서는 전체 중단을 권장

## 8. 보안 및 로그 기준

- shell 문자열 interpolation 금지
- 파일 경로는 argv 배열의 단일 인자로 전달
- diff 원문 출력 금지
- 파일명 목록도 불필요하게 전체 출력하지 않음
- 테스트는 격리된 Git 저장소에서만 수행

## 9. 테스트 관점

- 여러 파일 변경 시 `{ file, diff }[]` 반환
- 파일별 diff가 서로 분리됨
- 공백 포함 파일명 처리
- 한글 파일명 처리
- staged 신규 파일 diff 처리
- untracked-only 파일은 diff 없음으로 제외
- diff 없는 파일 제외
- 빈 배열 입력 시 `[]`
- 잘못된 입력 시 TypeError

## 10. 다음 단계

Phase P의 결과는 Phase W step commit flow에서 파일별 prompt 생성, Mock AI 메시지 생성, 파일별 confirm, 파일별 `git add` 및 `git commit` 순서로 연결됩니다.
