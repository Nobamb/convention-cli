# AI. PR Preview Agent 구현 계획

## 작업 범위

AI 단계는 생성된 PR 제목과 본문을 사용자에게 보여주고 다음 행동을 선택하게 하는 preview UX를 정의한다.

제공할 선택지는 다음과 같다.

- Create PR
- Edit manually
- Print only
- Cancel

실제 GitHub PR 생성은 AH 단계의 함수를 호출한다. AI 단계는 사용자 결정 흐름과 안전한 출력 정책을 담당한다.

## 선행 조건

- AE 단계에서 PR title이 생성되어 있다.
- AF 단계에서 PR body가 생성되어 있다.
- AH 단계의 PR 생성 함수가 존재한다.
- PR body/title에 대한 secret scan이 가능하다.
- non-interactive 모드와 `--yes` 정책이 정의되어 있다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/commands/pr.js`
- `src/utils/ui.js`
- `src/utils/logger.js`
- `src/core/security.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 권장 함수 구조

`src/utils/ui.js`에 다음 함수를 추가한다.

```js
export async function selectPrPreviewAction({ title, body })
export async function editPrManually({ title, body })
export function printPrPreview({ title, body })
```

`src/commands/pr.js`는 preview 결과를 받아 후속 작업을 결정한다.

```js
export async function handlePrPreview({ title, body, options })
```

## Preview 출력 계획

출력은 사용자가 원격 PR 생성 전에 검토할 수 있을 만큼 명확해야 한다.

권장 출력 항목은 다음과 같다.

- PR Title
- PR Body
- target base branch
- head branch
- changed files summary
- print-only 또는 create 가능 여부

secret scan 결과가 위험 상태이면 preview는 가능하더라도 Create PR 선택지는 비활성화하거나 생성 단계에서 중단한다.

## 선택지 처리 계획

각 선택지의 동작은 다음과 같다.

- `Create PR`: 사용자 confirm 또는 `--yes` 정책이 있을 때 AH 단계의 create 함수 호출
- `Edit manually`: title/body를 사용자 입력으로 수정 후 다시 preview
- `Print only`: markdown title/body를 출력하고 종료
- `Cancel`: 아무 원격 작업 없이 종료

`Edit manually` 이후에도 빈 title/body, secret 포함 여부, markdown 구조를 다시 검증한다.

## Non-interactive 및 --yes 정책

non-interactive 환경에서는 prompt를 띄우지 않는다.

권장 정책:

- `--print-only`: title/body 출력 후 종료
- `--yes`: 보안 gate와 필수 값 검증 통과 시 Create PR 실행 가능
- `--yes` 없음: Create PR을 실행하지 않고 명확한 오류 또는 print-only 안내
- CI 환경: 기본적으로 print-only를 권장

`--yes`가 있어도 secret scan, GitHub remote 확인, gh auth 확인은 우회하지 않는다.

## Manual Edit 계획

수동 편집은 title과 body를 모두 지원한다.

검증 기준은 다음과 같다.

- title은 빈 문자열이면 안 된다.
- body는 빈 문자열이면 안 된다.
- title은 한 줄이어야 한다.
- body는 markdown으로 유지한다.
- secret pattern이 있으면 저장하지 않거나 다시 확인을 요구한다.

편집 후에는 다시 preview로 돌아간다.

## 보안 기준

- preview에도 secret 원문을 출력하지 않는다.
- PR body에 raw diff 전체를 출력하지 않는다.
- Create PR은 사용자 선택 또는 `--yes` 없이 실행하지 않는다.
- `--yes`는 보안 gate를 우회하지 않는다.
- Cancel과 Print only는 원격 작업을 수행하지 않는다.
- 실패 시 commit, push, reset을 자동 실행하지 않는다.

## 완료 기준

- PR title/body preview가 표시된다.
- 사용자는 Create PR, Edit manually, Print only, Cancel 중 하나를 선택할 수 있다.
- Edit manually 후 다시 검증과 preview가 수행된다.
- Print only와 Cancel은 원격 작업을 수행하지 않는다.
- Create PR은 사용자 확인 또는 `--yes` 정책이 있을 때만 실행된다.
- secret 원문이 preview와 로그에 노출되지 않는다.
