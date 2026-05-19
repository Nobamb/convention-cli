# V. Template Command Agent 구현 계획

## 작업 범위

V 단계는 Template Command Agent로서 템플릿 관련 CLI 명령을 라우팅하고 `src/commands/template.js` 명령 모듈을 연결하는 작업만 담당한다.

구현 대상 명령은 다음과 같다.

- `convention --template`
- `convention --template init`
- `convention --template show`
- `convention --template validate`

`--template` 계열은 설정/관리 명령이므로 commit flow를 실행하지 않아야 한다. `--set-mode`, `--language`, `--model`과 같은 설정 명령 우선순위를 따른다.

## 선행 조건

이 단계는 Phase 4의 R, S, T, U 작업 결과를 사용한다.

- R: 템플릿 schema와 기본 템플릿 정의
- S: 프로젝트/사용자/기본 템플릿 로드 우선순위
- T: 템플릿 validation 및 invalid template fallback
- U: commit prompt에 템플릿 적용

V 단계는 위 기능을 새로 재정의하지 않고 CLI에서 호출 가능한 명령 흐름으로 노출한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `bin/convention.js`
- `src/commands/template.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## CLI 라우팅 계획

`bin/convention.js`는 `commander` 옵션 파싱 이후 `--template`이 존재하면 commit flow보다 먼저 분기한다.

라우팅 우선순위는 다음 순서를 따른다.

1. `--help`, `-h`
2. `--set-mode`
3. `--language`
4. `--model`
5. `--template`
6. `--reset`
7. `--step`, `--batch`, 기본 commit flow

`--template` 분기에서는 다음 규칙을 적용한다.

- `convention --template`은 기본적으로 템플릿 상태 또는 사용 가능한 하위 명령 안내를 출력한다.
- `convention --template init`은 프로젝트 템플릿 파일 생성을 호출한다.
- `convention --template show`는 현재 적용될 템플릿을 출력한다.
- `convention --template validate`는 현재 적용될 템플릿을 검증한다.
- 알 수 없는 하위 명령은 명확한 오류를 출력하고 commit flow로 fallback하지 않는다.

## `src/commands/template.js` 계획

권장 함수는 다음과 같다.

```js
export async function runTemplateCommand(action)
export async function initTemplate()
export async function showTemplate()
export async function validateCurrentTemplate()
```

각 함수의 역할은 다음과 같다.

- `runTemplateCommand(action)`: `init`, `show`, `validate` 분기와 기본 안내를 담당한다.
- `initTemplate()`: 프로젝트 루트의 `.convention/template.json` 또는 합의된 템플릿 경로에 기본 템플릿을 생성한다.
- `showTemplate()`: loader가 선택한 템플릿과 출처를 표시한다.
- `validateCurrentTemplate()`: validator 결과를 표시하고, invalid template이면 fallback 여부와 fallback 대상을 명확히 알린다.

## 템플릿 초기화 규칙

`init`은 사용자 데이터를 덮어쓰지 않는다.

- 기존 템플릿 파일이 있으면 overwrite 여부를 확인하거나 안전하게 중단한다.
- 자동 overwrite는 하지 않는다.
- 생성 경로는 문자열 연결 대신 `path.join()`을 사용한다.
- 프로젝트 루트 탐색은 현재 Git 저장소 범위 안에서만 수행한다.
- 생성되는 템플릿에는 secret, token, 사용자 diff 원문을 포함하지 않는다.

## 템플릿 출력 규칙

`show`는 템플릿 내용을 사람이 확인할 수 있게 출력하되 raw 파일 전체를 그대로 dump하지 않고, 알려진 안전 필드 중심으로 요약하거나 redaction을 적용한다. 다음을 반드시 지킨다.

- diff 원문, credentials, API key, token을 출력하지 않는다.
- `API_KEY=`, `SECRET=`, `TOKEN=`, `PASSWORD=`, `PRIVATE_KEY`, `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `-----BEGIN PRIVATE KEY-----` 패턴이 템플릿 값에 포함되면 원문 대신 `[REDACTED]`로 표시한다.
- 템플릿 출처를 함께 표시한다.
- invalid template이 발견되어 기본 템플릿으로 fallback된 경우 경고와 fallback 출처를 표시한다.
- 출력은 `src/utils/logger.js`의 `info()`, `warn()`, `success()`, `error()`를 사용한다.

## 템플릿 검증 규칙

`validate`는 다음 항목을 확인한다.

- 필수 필드 존재 여부: `name`, `language`, `format`, `types`, `rules`
- `types`가 배열이며 허용 Conventional Commits type만 포함하는지 여부
- `format`이 문자열이며 `{type}`과 `{message}` 같은 필수 placeholder를 충족하는지 여부
- `language`가 지원 언어인지 여부
- `rules.maxLength`, `rules.requireScope`, `rules.allowEmoji` 타입이 올바른지 여부
- invalid template 발견 시 CLI가 죽지 않고 기본 템플릿 fallback 결과를 표시하는지 여부

## Commit Flow 차단 조건

`--template` 계열 명령은 어떤 경우에도 아래 흐름을 호출하지 않는다.

- `runDefaultCommit()`
- `runStepCommit()`
- `runBatchCommit()`
- `getChangedFiles()`
- `getFullDiff()`
- `getFileDiffs()`
- `generateCommitMessage()`
- `git add`
- `git commit`
- `git push`

이 원칙은 `convention --template`, `convention --template init`, `convention --template show`, `convention --template validate` 모두에 적용한다.

## 오류 처리 계획

오류는 조용히 mock 또는 commit flow로 fallback하지 않는다.

- 알 수 없는 template action: 지원 action 목록을 출력하고 non-zero 종료를 고려한다.
- 템플릿 JSON parse 실패: 파일 경로와 parse 실패 사실만 출력하고 원문 전체는 출력하지 않는다.
- 템플릿 schema 불일치: 실패 필드와 사유를 요약한다.
- 파일 생성 실패: 권한 또는 경로 문제를 요약하되 secret이나 전체 파일 내용을 출력하지 않는다.

## 보안 기준

V 단계는 diff를 외부 AI로 전송하지 않는다. 그래도 템플릿 명령이 파일을 읽고 출력할 수 있으므로 다음 보안 규칙을 지킨다.

- `.env`, credentials, private key 파일을 템플릿 후보로 읽지 않는다.
- credentials 파일 내용을 출력하지 않는다.
- API Key, OAuth Token, Secret 문자열이 출력에 포함되지 않도록 logger redaction 정책을 재사용한다.
- Git 명령이 필요할 경우 `execFileSync` 또는 `spawnSync`에 argv 배열을 사용한다.
- 실제 commit, reset, push를 수행하지 않는다.

## 완료 기준

- `convention --template`이 commit flow 없이 안내 또는 현재 템플릿 상태를 출력한다.
- `convention --template init`이 기본 템플릿을 안전하게 생성한다.
- `convention --template show`가 현재 적용 템플릿과 출처를 출력한다.
- `convention --template validate`가 템플릿 검증 결과를 출력한다.
- invalid template은 명확한 경고와 함께 기본 템플릿 fallback으로 처리된다.
- 모든 template command는 commit flow를 실행하지 않는다.
