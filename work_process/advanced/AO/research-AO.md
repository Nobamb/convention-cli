# AO. Non-interactive Mode Agent 구현 계획

## 작업 범위

AO 단계는 CI나 자동화 환경에서 사용할 수 있는 비대화형 실행 옵션을 구현하는 작업이다.

핵심 옵션은 `--yes`와 `--no-interactive`이다. `--no-interactive`는 prompt 호출을 금지하고, `--yes`는 명시적인 승인 플래그로 사용한다. 두 옵션은 사용자 입력을 기다리지 않도록 만들지만, 보안 gate와 외부 전송 정책을 생략하면 안 된다.

## 선행 조건

- AN 단계의 `isCI()`, `isGitHubActions()`, `shouldDisableInteractive()`가 존재한다.
- commit flow는 사용자 confirm 이후에만 commit을 실행한다.
- PR flow는 preview 또는 명시 승인 이후에만 생성한다.
- sensitive diff scan과 secret masking이 기존 flow에 연결되어 있다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `bin/convention.js`
- `src/commands/commit.js`
- `src/commands/pr.js`
- `src/utils/env.js`
- `src/utils/ui.js`
- `tests/non-interactive.test.js`
- `tests/cli-options.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## CLI 옵션 정책

추가할 옵션:

```text
--yes
--no-interactive
```

권장 의미:

- `--no-interactive`: 모든 prompt 호출 금지
- `--yes`: 명시 승인 플래그. confirm prompt가 필요한 단계에서 yes로 간주
- `--yes`만 있어도 prompt를 생략할 수 있지만, 로컬 환경에서는 경고 또는 명확한 정책 문서화가 필요
- `--no-interactive`만 있고 필수 승인이 필요한 경우에는 자동 승인하지 않고 실패

## Commit Flow 정책

commit flow에서는 아래 규칙을 따른다.

1. `--no-interactive`가 있으면 prompt 호출 금지
2. `--yes`가 있으면 commit confirm은 승인된 것으로 처리 가능
3. `--yes`가 없고 confirm이 필요한데 interactive가 false이면 commit을 실행하지 않고 실패
4. sensitive diff가 감지되면 `--yes`가 있어도 외부 provider 전송 정책이 명확하지 않으면 중단
5. AI 응답이 비어 있으면 prompt로 재입력받지 않고 실패

로컬 환경에서 `--yes`는 허용하되, confirm 보안 원칙을 문서화한다. 기본값은 여전히 사용자 confirm이다.

## PR Flow 정책

PR flow에서는 아래 규칙을 따른다.

1. `--print-only`는 prompt 없이 PR 제목/본문만 출력한다.
2. `--no-interactive`에서 PR 생성에 필요한 값이 없으면 실패한다.
3. `--yes`가 없는 상태에서 실제 `gh pr create`는 실행하지 않는다.
4. PR body 생성 전 secret scan 결과를 반영한다.
5. fork PR이나 secret 접근 제한이 있는 CI에서는 생성 대신 출력 모드를 권장한다.

## UI 계층 연결

`src/utils/ui.js`의 prompt 함수들은 runtime option을 받을 수 있어야 한다.

권장 패턴:

```js
confirmAction(message, { interactive = true, yes = false } = {})
```

동작:

- `yes === true`이면 true 반환
- `interactive === false`이면 prompt 호출 없이 오류 또는 false 반환
- 로컬 interactive이면 기존 prompt 실행

prompt 함수가 스스로 CI를 직접 판단하기보다, command 계층에서 runtime을 전달하는 편이 테스트와 정책 분리에 유리하다.

## 실패 처리 기준

비대화형 모드에서는 다음 상황을 명확한 오류로 처리한다.

- provider 설정 없음
- commit message 생성 실패
- commit message가 빈 문자열
- confirm이 필요한데 `--yes` 없음
- PR 생성에 필요한 remote/base/head 정보 부족
- 수동 입력이 필요한 상태
- 외부 전송 동의가 필요한 상태

오류 메시지는 사용자가 어떤 옵션을 추가하거나 설정해야 하는지 알려야 한다.

## 보안 기준

- `--yes`는 보안 scan을 우회하지 않는다.
- `--yes`는 외부 AI 전송 정책을 우회하지 않는다.
- `--no-interactive`는 자동 승인과 다르다.
- API Key, OAuth token, credentials 원문을 출력하지 않는다.
- CI 로그에 diff 원문, provider 응답 원문 전체를 출력하지 않는다.
- `git push`, `git reset`, `gh pr create`는 각각의 승인 정책을 유지한다.

## 완료 기준

- `--yes`와 `--no-interactive`가 CLI에서 파싱된다.
- 비대화형 모드에서 prompt 호출이 발생하지 않는다.
- `--no-interactive`만으로 위험 작업이 자동 승인되지 않는다.
- `--yes`가 있어도 보안 gate와 외부 전송 정책은 유지된다.
- CI에서 hanging 없이 성공 또는 명확한 실패로 종료한다.
