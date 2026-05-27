# AH. GitHub PR Integration Agent 구현 계획

## 작업 범위

AH 단계는 생성된 PR 제목/본문을 GitHub PR 생성 흐름에 연결한다.

핵심 목표는 우선 PR 제목/본문을 출력하고, `gh` CLI 설치 및 인증 상태를 확인한 뒤, 사용자 동의가 있을 때만 `gh pr create`를 인자 배열 방식으로 실행하는 것이다.

이 단계는 PR 제목/본문 생성 자체는 담당하지 않는다. AE, AF 단계 결과를 사용한다.

## 선행 조건

- AD/AE/AF 단계로 PR prompt, title, body가 생성되어 있다.
- AG 단계로 GitHub owner/repo 또는 GitHub remote 여부를 확인할 수 있다.
- PR 생성은 반드시 preview 또는 명시적 `--yes` 정책 이후에만 실행한다.
- token, remote credential, 인증 세부 정보는 출력하지 않는다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/commands/pr.js`
- `src/core/github.js`
- `src/utils/ui.js`
- `src/utils/logger.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/core/github.js`에 다음 함수를 추가한다.

```js
export function isGhCliAvailable()
export function checkGhAuth()
export function createPullRequest({ title, body, base, head, draft })
```

`src/commands/pr.js`에는 다음 흐름을 둔다.

```js
export async function runPrCommand(options)
```

## PR 생성 흐름

권장 순서는 다음과 같다.

1. GitHub remote 감지
2. PR 제목/본문 생성 또는 전달
3. PR preview 출력
4. `print-only`이면 생성하지 않고 종료
5. `gh` CLI 설치 여부 확인
6. `gh auth status`로 인증 상태 확인
7. 사용자 confirm 또는 `--yes` 정책 확인
8. `gh pr create` 실행
9. 생성 결과 URL 출력

GitHub remote가 아니면 `gh pr create`를 실행하지 않고 PR 문서 출력 흐름으로 전환한다.

## gh CLI 실행 계획

명령 실행은 shell 문자열이 아니라 `spawnSync` 또는 `execFileSync` 인자 배열 방식으로 수행한다.

예상 인자:

```js
[
  "pr",
  "create",
  "--title",
  title,
  "--body",
  body,
  "--base",
  base,
  "--head",
  head
]
```

`draft` 옵션이 있으면 `--draft`를 추가한다.

title과 body를 shell 문자열에 직접 삽입하지 않는다.

## 인증 및 오류 처리

오류 처리 기준은 다음과 같다.

- `gh` CLI 없음: 설치 안내 후 print-only 결과 유지
- GitHub 인증 없음: `gh auth login` 안내
- GitHub remote 없음: PR 문서 출력만 수행
- PR 생성 실패: 안전한 오류 요약 출력
- remote URL 또는 token 포함 stderr: 원문 출력 금지

`gh auth status` 출력에는 민감 정보가 포함될 수 있으므로 원문 전체를 그대로 출력하지 않는다.

## 사용자 확인 정책

PR 생성은 원격에 상태를 남기는 작업이므로 반드시 확인이 필요하다.

허용 조건은 다음 중 하나다.

- 사용자가 preview에서 `Create PR`을 선택했다.
- non-interactive 환경에서 `--yes`가 명시됐고 보안 gate가 통과했다.

다음 경우에는 생성하지 않는다.

- `--print-only`
- `Cancel`
- `Edit manually` 이후 저장되지 않은 상태
- secret scan 실패
- GitHub remote 감지 실패
- gh 인증 실패

## 보안 기준

- GitHub token, OAuth token, API Key를 출력하지 않는다.
- remote URL credential을 출력하지 않는다.
- `gh` stderr/stdout 원문을 그대로 출력하지 않는다.
- PR body에 secret이 포함되면 생성하지 않는다.
- shell 문자열로 `gh pr create`를 실행하지 않는다.
- PR 생성 실패 후 commit, push, reset을 자동 실행하지 않는다.

## 완료 기준

- 생성된 PR title/body가 먼저 preview 또는 출력된다.
- `gh` CLI 설치 여부와 인증 상태를 확인한다.
- 사용자 동의 또는 `--yes`가 있을 때만 `gh pr create`가 실행된다.
- 명령 실행은 인자 배열 방식으로 수행된다.
- 인증 정보와 remote credential이 로그에 노출되지 않는다.
- GitHub remote가 없으면 PR 생성 대신 문서 출력 흐름으로 전환된다.
