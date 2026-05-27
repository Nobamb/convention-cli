# AG. GitHub Remote Detector Agent 구현 계획

## 작업 범위

AG 단계는 Git remote 설정에서 GitHub `owner/repo`를 안전하게 추출하는 로직을 정의한다.

이 단계는 PR 제목/본문 생성이나 `gh pr create` 실행을 담당하지 않는다. AH 단계가 GitHub PR 생성 흐름을 담당한다.

## 선행 조건

- Git 저장소 확인 로직이 존재한다.
- Git 명령은 인자 배열 방식으로 실행한다.
- remote URL 또는 Git stderr에 credential이 포함될 수 있으므로 출력 시 redaction이 필요하다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/core/git.js`
- `src/core/github.js`
- `src/utils/logger.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/github.js`에 다음 함수를 추가한다.

```js
export function parseGitHubRemoteUrl(remoteUrl)
export function detectGitHubRemote({ preferredRemote = "origin" } = {})
```

반환 형태는 다음과 같다.

```js
{
  remote: "origin",
  owner: "openai",
  repo: "convention-cli",
  urlType: "https"
}
```

GitHub remote가 아니면 `null`을 반환하거나 명확한 상태 객체를 반환한다.

## 지원 Remote 형식

다음 형식을 지원한다.

```txt
https://github.com/owner/repo.git
https://github.com/owner/repo
git@github.com:owner/repo.git
ssh://git@github.com/owner/repo.git
```

GitHub Enterprise는 3차 기본 범위에서는 optional로 둔다. 지원하려면 config에 허용 host를 명시하도록 한다.

## Remote 선택 정책

권장 순서는 다음과 같다.

1. `origin` remote가 GitHub이면 사용한다.
2. `upstream` remote가 GitHub이면 후보로 사용한다.
3. 여러 GitHub remote가 있으면 preferred remote 또는 사용자 선택으로 넘긴다.
4. GitHub remote가 없으면 PR 생성 대신 PR 문서 출력 흐름으로 전환한다.

GitHub가 아닌 remote에서 억지로 owner/repo를 추출하지 않는다.

## Credential Redaction

remote URL에는 credential이 포함될 수 있다.

예시는 다음과 같다.

```txt
https://token@github.com/owner/repo.git
https://user:token@github.com/owner/repo.git
```

출력 또는 오류 메시지에는 credential을 제거한 URL만 사용한다.

```txt
https://github.com/owner/repo.git
```

remote URL 원문을 logger에 그대로 출력하지 않는다.

## 오류 처리 계획

- Git 저장소 아님: remote 감지 불가
- remote 없음: PR 문서 출력 모드로 전환 가능
- GitHub remote 없음: GitHub PR 생성 불가, print-only 안내
- remote URL parse 실패: 안전한 오류로 중단
- 여러 후보 존재: preferredRemote 설정 또는 사용자 선택 필요

어떤 오류에서도 `gh pr create`, push, reset, commit은 자동 실행하지 않는다.

## 완료 기준

- HTTPS와 SSH GitHub remote에서 owner/repo를 추출한다.
- GitHub가 아닌 remote는 명확히 구분한다.
- remote URL의 credential은 로그와 오류 메시지에 노출되지 않는다.
- GitHub remote가 없을 때 PR 문서 출력 흐름으로 넘길 수 있다.
- Git 명령은 인자 배열 방식으로 실행하도록 계획된다.
