# Phase N Git 변경 파일 목록 Agent Research

## 1. 개요

Phase N은 현재 Git 저장소의 변경 파일 목록을 가져오는 `getChangedFiles()` 구현 기준을 정리하는 단계입니다. 이 함수는 변경사항 없음 처리, batch diff 추출 전 확인, step 모드의 파일별 diff 대상 선정에 사용됩니다.

## 2. 작업 목표

- `src/core/git.js`에 `getChangedFiles(): string[]` 구현
- `git -c core.quotepath=false status --porcelain` 실행
- porcelain output에서 변경 파일 경로 파싱
- 수정, 신규, 삭제, rename 파일을 목록에 포함
- 변경사항이 없으면 빈 배열 반환
- 공백과 한글 파일명을 최대한 보존

## 3. Git 명령 기준

사용할 명령은 아래와 같습니다.

```bash
git -c core.quotepath=false status --porcelain
```

Node.js에서는 아래처럼 실행합니다.

```javascript
execFileSync("git", ["-c", "core.quotepath=false", "status", "--porcelain"], {
  encoding: "utf8"
});
```

`core.quotepath=false`는 한글, 일본어, 중국어 파일명이 octal escape로 표시되는 문제를 줄이기 위해 사용합니다. 전역 Git 설정을 바꾸지 않고 해당 명령에만 적용됩니다.

## 4. Porcelain 파싱 기준

일반 형식은 아래와 같습니다.

```text
XY path
```

앞의 두 글자는 index/worktree 상태이고, 세 번째 문자는 공백입니다. 기본 경로는 `line.slice(3)`으로 추출합니다.

예시:

```text
 M README.md
A  src/core/git.js
?? 한글파일.md
 D old-file.js
```

반환 예시:

```javascript
["README.md", "src/core/git.js", "한글파일.md", "old-file.js"]
```

### Rename 처리

rename 출력은 보통 아래 형태입니다.

```text
R  old-name.js -> new-name.js
```

1차 MVP에서는 이후 `git add`와 파일별 diff 대상에 사용할 현재 경로가 필요하므로 오른쪽 새 경로인 `new-name.js`를 반환합니다.

## 5. 빈 목록 및 에러 처리

- Git 출력이 빈 문자열이면 `[]` 반환
- Git 저장소 여부는 Phase M의 `isGitRepository()`에서 먼저 확인하는 흐름을 권장
- `getChangedFiles()` 자체는 Git 명령 실패를 숨기지 않고 호출자가 처리할 수 있게 두는 것이 적절

## 6. Untracked 파일 주의사항

`git status --porcelain`은 untracked 파일을 `?? file` 형태로 목록에 포함합니다. 하지만 Phase O/P의 `git diff HEAD`는 untracked-only 파일 내용을 반환하지 않습니다. 신규 파일의 diff가 필요하면 staged 상태이거나 별도 synthetic diff 정책이 필요합니다.

1차 MVP 문서에서는 이 한계를 명확히 남기고, untracked 파일 내용 직접 읽기는 보안 Gate가 정리된 이후 확장 범위로 둡니다.

## 7. 테스트 관점

- 변경사항 없음: `[]`
- tracked 파일 수정
- 신규 untracked 파일 목록 포함
- tracked 파일 삭제
- 공백 포함 파일명
- 한글 파일명
- rename 시 새 경로 반환

테스트는 격리된 임시 Git 저장소에서 수행하고 실제 사용자 저장소의 히스토리를 변경하지 않습니다.

## 8. 다음 단계

Phase N의 결과는 Phase O의 전체 diff 추출 전 변경사항 확인과 Phase P의 파일별 diff 입력으로 연결됩니다.
