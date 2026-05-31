# AN. CI Mode Agent 구현 계획

## 작업 범위

AN 단계는 GitHub Actions를 포함한 CI 환경을 감지하고, CI에서는 interactive prompt가 자동으로 비활성화되도록 기반 유틸리티와 흐름 연결을 준비하는 작업이다.

핵심 목표는 `CI=true` 또는 `GITHUB_ACTIONS=true` 환경에서 사용자의 입력을 기다리는 동작을 만들지 않는 것이다. CI mode 감지는 commit flow, PR flow, update check, model setup 같은 후속 기능의 공통 판단 기준으로 사용할 수 있어야 한다.

## 선행 조건

- 기존 commit flow는 사용자 confirm 이후에만 `git add`와 `git commit`을 실행한다.
- 3차 고도화에서 AO 단계의 `--yes`, `--no-interactive` 옵션이 추가될 예정이다.
- CI 환경에서도 보안 gate는 유지되어야 하며, interactive prompt만 자동 비활성화한다.
- CI 감지는 외부 네트워크나 Git 명령 없이 환경변수만으로 판단한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/utils/env.js`
- `src/config/defaults.js`
- `bin/convention.js`
- `src/commands/commit.js`
- `src/commands/pr.js`
- `tests/env.test.js`
- `tests/ci-mode.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/utils/env.js`를 새로 만들고 다음 함수를 제공한다.

```js
export function isCI(env = process.env)
export function isGitHubActions(env = process.env)
export function shouldDisableInteractive(env = process.env, options = {})
```

권장 동작은 다음과 같다.

1. `isCI()`는 `env.CI === "true"`이면 true를 반환한다.
2. `isGitHubActions()`는 `env.GITHUB_ACTIONS === "true"`이면 true를 반환한다.
3. `shouldDisableInteractive()`는 CI 또는 GitHub Actions 환경이면 true를 반환한다.
4. 이후 AO 단계의 `--no-interactive` 옵션이 들어오면 CI가 아니어도 true를 반환할 수 있도록 옵션 인자를 받는다.
5. 환경변수 값은 대소문자 혼용 가능성을 최소한으로 허용하되, 너무 느슨한 truthy 판정은 피한다.

## CLI 연결 계획

`bin/convention.js`에서 command options를 구성할 때 CI 여부를 하위 command로 전달한다.

권장 전달 형태:

```js
const runtime = {
  isCI: isCI(),
  isGitHubActions: isGitHubActions(),
  interactive: !shouldDisableInteractive(process.env, options)
}
```

commit/pr flow는 `runtime.interactive === false`일 때 prompt 호출을 시도하지 않아야 한다.

## Commit Flow 연결 기준

CI mode에서 다음 동작을 금지한다.

- confirm prompt 대기
- 수동 입력 prompt 대기
- regenerate/edit 선택 UI 대기
- model setup 대화형 선택 UI 대기

CI mode에서 다음 동작은 유지한다.

- Git 저장소 확인
- 변경 파일 확인
- diff 보안 scan
- sensitive file exclude
- provider 설정 검증
- 커밋 메시지 생성
- 명확한 오류 출력

CI에서 commit을 실제 실행할지는 AO 단계의 `--yes` 정책과 함께 결정한다. AN 단계 자체에서는 CI 감지와 interactive 비활성화 기준만 만든다.

## Config 확장 검토

필요하다면 `DEFAULT_CONFIG`에 다음 형태의 옵션을 추가할 수 있다.

```json
{
  "interactive": true
}
```

다만 1차 구현에서는 환경변수와 CLI 옵션만으로 판단하고, config schema 확장은 AO 단계에서 최종 결정하는 것이 안전하다.

## 실패 처리 기준

CI mode에서 필요한 값이 부족하면 prompt로 물어보지 않고 명확한 오류로 종료한다.

예시:

- provider 설정이 없으면 `--model` 설정이 필요하다는 오류
- 외부 provider 전송 정책이 불명확하면 중단
- commit confirm이 필요한데 `--yes`가 없으면 중단
- PR 생성에 필요한 remote/base 정보가 없으면 중단

## 보안 기준

- CI 감지 중 환경변수 전체를 출력하지 않는다.
- `process.env` 전체를 로그로 남기지 않는다.
- CI라고 해서 보안 scan이나 secret masking을 생략하지 않는다.
- `--yes`가 없으면 사용자 승인 없이 commit, push, PR create를 실행하지 않는다.
- CI 환경에서도 API Key, OAuth token, credentials 원문을 출력하지 않는다.

## 완료 기준

- `isCI()`가 `CI=true`를 감지한다.
- `isGitHubActions()`가 `GITHUB_ACTIONS=true`를 감지한다.
- CI 환경에서 interactive prompt 호출 경로가 비활성화된다.
- CI 환경에서 필요한 입력이 없으면 prompt 대신 명확한 오류로 종료한다.
- CI mode가 기존 로컬 commit flow의 confirm 보안 원칙을 약화하지 않는다.
