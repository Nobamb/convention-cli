# Phase P Git Diff 파일별 추출 Agent Plan

## 1. 목표

`src/core/git.js`에 `getFileDiffs(files)`를 구현해 step 모드에서 파일별 diff 기반 커밋 메시지 생성을 지원합니다.

## 2. 구현 작업

- 입력 `files`가 배열인지 검증
- 빈 배열이면 `[]` 반환
- 문자열이 아니거나 빈 문자열인 항목은 skip
- 각 파일에 대해 `git -c core.quotepath=false diff HEAD -- file` 실행
- diff가 빈 문자열이면 결과에서 제외
- `{ file, diff }` 형태로 반환

권장 구현:

```javascript
export function getFileDiffs(files) {
  if (!Array.isArray(files)) {
    throw new TypeError("files must be an array");
  }

  const fileDiffs = [];

  for (const file of files) {
    if (typeof file !== "string" || file.length === 0) {
      continue;
    }

    const diff = execFileSync("git", ["-c", "core.quotepath=false", "diff", "HEAD", "--", file], {
      encoding: "utf8"
    });

    if (!diff.trim()) {
      continue;
    }

    fileDiffs.push({ file, diff });
  }

  return fileDiffs;
}
```

## 3. 테스트 계획

- 임시 Git repo에서 tracked 파일 수정 후 파일별 diff 반환
- 여러 파일 변경 시 배열 원소가 파일별로 분리됨
- 공백 포함 파일명 diff 반환
- 한글 파일명 diff 반환
- tracked 파일 삭제 diff 반환
- staged 신규 파일 diff 반환
- untracked-only 파일은 diff 없음으로 제외
- 변경 없는 파일은 결과에서 제외
- `getFileDiffs([])`는 `[]`
- `getFileDiffs(null)`은 `TypeError`

테스트용 repo에서는 initial commit을 만든 뒤 변경을 생성합니다. 실제 사용자 저장소에서는 commit 테스트를 하지 않습니다.

## 4. 완료 기준

- `getFileDiffs(files)` export
- 반환 타입이 `{ file: string, diff: string }[]`
- Git 명령이 인자 배열 방식
- `--` pathspec 구분자 사용
- `core.quotepath=false`와 UTF-8 출력 처리
- diff 없는 파일 제외
- diff 원문 로그 출력 없음

## 5. 보안 체크리스트

- shell 문자열 interpolation 미사용
- 파일 경로를 argv 단일 인자로 전달
- raw diff 출력 금지
- destructive Git 명령 추가 금지
- 테스트는 격리된 임시 저장소에서 수행

## 6. 다음 연결

Phase W의 `runStepCommit()`은 `getChangedFiles()`로 변경 파일 목록을 구한 뒤 `getFileDiffs(files)`를 호출해 파일별 prompt 생성 단계로 넘깁니다.
