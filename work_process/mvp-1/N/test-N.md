# Phase N Git 변경 파일 목록 Agent Plan

## 1. 목표

`src/core/git.js`에 `getChangedFiles(): string[]`를 구현해 현재 Git 저장소의 변경 파일 목록을 반환합니다.

## 2. 구현 작업

- `execFileSync("git", ["-c", "core.quotepath=false", "status", "--porcelain"], { encoding: "utf8" })` 실행
- 출력이 비어 있으면 `[]` 반환
- 각 line은 `line.slice(3)`으로 path 추출
- rename line에 ` -> `가 있으면 오른쪽 새 경로 반환
- 빈 줄은 제외

권장 helper:

```javascript
function parseChangedFileLine(line) {
  const rawPath = line.slice(3);
  const renameSeparator = " -> ";

  if (rawPath.includes(renameSeparator)) {
    return rawPath.split(renameSeparator).pop();
  }

  return rawPath;
}
```

## 3. 테스트 계획

- clean repo에서 빈 배열 반환
- tracked 파일 수정 시 파일명 반환
- untracked 파일 생성 시 파일명 반환
- tracked 파일 삭제 시 파일명 반환
- 공백 포함 파일명 반환
- 한글 파일명 반환
- rename은 새 파일명 반환

신규 파일 diff 테스트와 혼동하지 않도록, Phase N은 목록 포함 여부만 확인합니다.

## 4. 완료 기준

- `getChangedFiles()`가 `string[]` 반환
- `core.quotepath=false`와 `encoding: "utf8"` 적용
- shell 문자열 interpolation 미사용
- 변경사항이 없을 때 `[]` 반환
- 공백/한글 파일명 테스트 항목 포함

## 5. 보안 기준

- 변경 파일 목록과 diff 원문을 불필요하게 출력하지 않음
- Git 명령은 인자 배열 방식만 사용
- 테스트는 임시 Git repo에서 수행
- destructive Git 명령을 추가하지 않음
