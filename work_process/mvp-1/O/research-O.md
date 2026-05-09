# Phase O Git Diff 전체 추출 Agent Research

## 1. 개요

Phase O는 batch 모드에서 사용할 전체 Git diff를 추출하는 `getFullDiff()` 구현 기준을 정리하는 단계입니다. 반환된 diff는 이후 prompt 생성과 Mock AI Provider 기반 커밋 메시지 생성에 사용됩니다.

## 2. 작업 목표

- `src/core/git.js`에 `getFullDiff(): string` 구현
- `git -c core.quotepath=false diff HEAD` 실행
- staged 및 unstaged tracked 변경사항 포함
- UTF-8 문자열 반환
- diff 원문을 logger나 console에 출력하지 않음

## 3. Git 명령 기준

사용할 명령은 아래와 같습니다.

```bash
git -c core.quotepath=false diff HEAD
```

Node.js 구현 예시:

```javascript
execFileSync("git", ["-c", "core.quotepath=false", "diff", "HEAD"], {
  encoding: "utf8"
});
```

`git diff HEAD`는 HEAD 기준으로 working tree와 index를 비교하므로 staged 변경과 unstaged tracked 변경을 함께 포함합니다.

## 4. 포함 및 제외 기준

| 변경 상태 | 포함 여부 | 기준 |
| :--- | :--- | :--- |
| staged tracked 변경 | 포함 | `git diff HEAD`에 포함 |
| staged 신규 파일 | 포함 | `git add` 후 index에 올라간 신규 파일은 `git diff HEAD`에 new file diff로 포함 |
| unstaged tracked 변경 | 포함 | `git diff HEAD`에 포함 |
| tracked 파일 삭제 | 포함 | 삭제 diff 포함 |
| rename | Git diff 표현 기준 | 기본 diff 출력에 따름 |
| untracked-only 파일 | 기본 미포함 | `git diff HEAD`가 내용 diff를 만들지 않음 |

untracked 파일 내용까지 포함하려면 파일 내용을 직접 읽거나 synthetic diff를 만들어야 합니다. 이는 민감 파일 제외, binary 파일, 대용량 파일, secret 탐지 기준이 필요하므로 Phase O 범위에서 제외합니다.

## 5. raw diff 로그 출력 금지

`getFullDiff()`는 diff 문자열을 반환하지만 출력하지 않습니다.

금지 예시:

```javascript
console.log(diff);
logger.info(diff);
logger.error(diff);
```

diff에는 API key, token, password, private key, 내부 코드가 포함될 수 있으므로 로그에 남기지 않습니다. 출력이 필요하면 파일 개수나 처리 단계 같은 메타 정보만 사용합니다.

tracked 민감 파일의 diff는 raw Git diff 함수의 반환값에 포함될 수 있습니다. 따라서 Phase O는 diff를 출력하지 않고, 민감 파일 제외와 secret scanning은 prompt 생성 또는 외부 AI 전송 전 보안 Gate에서 처리해야 합니다.

## 6. 에러 처리 기준

- Git 저장소 여부는 Phase M의 `isGitRepository()`에서 선확인 권장
- `getFullDiff()`는 Git 명령 실패를 호출자에게 전달
- 에러 메시지에 diff 원문이나 민감정보를 포함하지 않음
- 변경사항이 없으면 Git 명령은 빈 문자열을 반환하므로 정상 케이스로 처리

## 7. 테스트 관점

- 변경사항 없음: 빈 문자열 반환
- tracked 파일 unstaged 변경 diff 포함
- staged 변경 diff 포함
- staged 신규 파일 diff 포함
- staged와 unstaged가 함께 있을 때 모두 포함
- 한글 파일명 diff header가 readable하게 출력
- Git 저장소 밖 실패 처리
- raw diff가 logger/console로 출력되지 않음

신규 파일 diff를 확인해야 한다면 untracked 상태가 아니라 staged 상태로 만든 뒤 테스트합니다.

## 8. 다음 단계

Phase O의 `getFullDiff()`는 Phase V batch commit flow에서 `buildCommitPrompt({ diff, language, mode: "batch" })` 입력으로 연결됩니다.

## 8-2. 신규 untracked 파일 처리 갱신

`init/prompt.md` 8-2 요구에 따라, 새로 생성했지만 아직 `git add` 하지 않은 파일도 `convention` 실행 대상에 포함합니다.

- `getChangedFiles()`는 `git status --porcelain -uall` 기준으로 untracked 디렉터리 내부 파일까지 수집합니다.
- tracked/staged 변경은 기존처럼 `git diff HEAD -- <file>` 결과를 사용합니다.
- untracked-only 신규 파일은 confirm 전 실제 staging하지 않고 `git diff --no-index -- /dev/null <file>`로 new-file diff를 생성합니다.
- 민감 파일(`.env`, `.env.*`, `*.pem`, `*.key`, `credentials.json`, `secrets.json`, private key 계열)은 기존처럼 diff/prompt/commit 대상에서 제외합니다.
