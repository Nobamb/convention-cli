# Phase O --model CLI 라우팅 Agent Research

## 1. 개요

Phase O는 `convention --model` 명령을 CLI 진입점에서 인식하고 `src/commands/model.js`의 모델 설정 흐름으로 연결하는 단계다. 이 단계는 실제 Provider 설정을 완성하기보다, 사용자가 입력한 인자 개수와 값을 손실 없이 command 계층으로 전달하는 라우팅 책임에 집중한다.

## 2. 작업 목표

- `bin/convention.js`에 `--model [values...]` 옵션 추가
- `convention --model`, `convention --model <provider>`, `convention --model <provider> <authType>`, `convention --model <provider> <authType> <modelVersion>` 패턴 수집
- `runModelSetup(provider, authType, modelVersion)` 호출로 command 계층에 위임
- `--model` 실행 후 commit flow가 실행되지 않도록 조기 종료
- `--set-mode`, `--language` 같은 설정 명령보다 `--model`을 설정 명령 우선순위 안에서 처리

## 3. 구현 범위

- 수정 대상: `bin/convention.js`
- 연결 대상: `src/commands/model.js`
- 필수 함수: `runModelSetup(provider, authType, modelVersion)`

## 4. 권장 구현 방향

- commander의 variadic optional option인 `--model [values...]` 형태를 사용한다.
- `program.opts().model`이 배열이면 `[provider, authType, modelVersion]`로 구조 분해한다.
- `--model`이 전달된 경우 `await runModelSetup(...)` 이후 반드시 `return`한다.
- 옵션 parsing 계층에서는 provider 유효성 검증을 직접 수행하지 않고 `model.js`로 위임한다.
- shell 문자열 조합이나 외부 명령 실행은 이 단계에 포함하지 않는다.

## 5. 보안 및 안정성 기준

- CLI 인자를 로그에 그대로 출력하지 않는다. 특히 향후 API Key가 인자로 들어오는 설계는 금지한다.
- 잘못된 provider/authType/modelVersion 처리 책임은 `src/commands/model.js` 또는 validator 계층에 둔다.
- `--model`은 설정 명령이므로 Git diff 추출, AI 호출, commit을 실행하지 않는다.

## 6. 다음 단계 연결

Phase O가 끝나면 Phase P~S에서 인자 개수별 설정 흐름을 구현할 수 있다. `bin/convention.js`는 라우팅만 담당하고, 실제 대화형 UI와 config 저장은 이후 단계에서 `src/commands/model.js`에 집중한다.
