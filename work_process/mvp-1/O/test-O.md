# Phase O Git Diff 전체 추출 Agent Plan

## 1. 목표

`src/core/git.js`에 `getFullDiff(): string`을 구현해 batch 모드에서 사용할 전체 diff 문자열을 반환합니다.

## 2. 구현 작업

- `execFileSync` 또는 `spawnSync` 인자 배열 방식 사용
- `git -c core.quotepath=false diff HEAD` 실행
- `encoding: "utf8"` 지정
- diff 문자열을 그대로 반환
- diff 원문 출력 없음

권장 구현:

```javascript
export function getFullDiff() {
  return execFileSync("git", ["-c", "core.quotepath=false", "diff", "HEAD"], {
    encoding: "utf8"
  });
}
```

## 3. 테스트 계획

- clean repo에서 `""` 반환
- tracked 파일 unstaged 변경이 diff에 포함
- staged 변경이 diff에 포함
- staged와 unstaged 변경이 함께 포함
- 한글 파일명 diff가 escape 중심으로 깨지지 않음
- Git 저장소 밖에서 에러 흐름 확인
- console/logger spy로 raw diff 미출력 확인

테스트 저장소는 임시 디렉터리에 만들고, `git config user.email`, `git config user.name`을 로컬로 설정한 뒤 initial commit을 생성합니다.

## 4. 완료 기준

- `getFullDiff()` export
- `git -c core.quotepath=false diff HEAD` 사용
- staged/unstaged tracked 변경 포함
- untracked-only 파일 내용 미포함 기준 문서화
- diff 원문을 로그로 출력하지 않음
- 실제 사용자 저장소에서 commit 테스트를 하지 않음

## 5. 후속 TODO

- 민감 파일 제외
- 민감정보 패턴 탐지 및 마스킹
- untracked 파일 내용 포함 정책
- 대용량 diff 제한
- 외부 AI 전송 전 사용자 확인 Gate
