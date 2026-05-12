# Phase S --model provider authType modelVersion 직접 지정 Agent Research

## 1. 개요

Phase S는 사용자가 `convention --model <provider> <authType> <modelVersion>`처럼 모든 값을 명령행 인자로 지정했을 때 대화형 UI 없이 즉시 설정을 저장하는 단계다.

## 2. 작업 목표

- `setupModelDirectly(provider, authType, modelVersion)` 구현
- provider/authType/modelVersion 유효성 검증
- Provider/Auth 조합 검증
- 필요한 인증 정보 존재 여부 확인
- 대화형 모델 선택 UI 없이 config 저장
- 저장 완료 메시지 출력

## 3. 구현 범위

- 수정 대상: `src/commands/model.js`
- 연동 대상: `src/config/store.js`, `src/config/defaults.js`, `src/auth/apiKey.js`, `src/utils/validator.js`
- 주요 함수:
  - `setupModelDirectly(provider, authType, modelVersion)`
  - `isValidProvider(provider)`
  - `isValidAuthType(authType)`
  - `isValidModelVersion(modelVersion)`
  - `getApiKey(provider)`

## 4. 권장 구현 방향

- `runModelSetup(provider, authType, modelVersion)`에서 세 인자가 모두 있으면 `setupModelDirectly()`로 위임한다.
- `modelVersion`은 빈 문자열, 공백 문자열, 배열, 객체를 거부한다.
- `modelDisplayName`은 기본적으로 `modelVersion`과 동일하게 저장한다.
- localLLM은 `baseURL`이 없으면 `DEFAULT_LOCAL_LLM_BASE_URL`을 저장한다.
- API Key가 필요한 Provider는 credentials에 key가 없으면 secret 입력을 요청하거나 명확한 안내 후 중단한다.

## 5. 보안 및 안정성 기준

- `modelVersion`은 저장 가능하지만 API Key는 config에 저장하지 않는다.
- 직접 지정 흐름에서도 secret을 CLI 인자로 받지 않는다.
- 잘못된 인자 조합을 mock provider로 fallback하지 않는다.
- 저장 전 기존 config의 `mode`, `language`, `confirmBeforeCommit` 값을 보존한다.

## 6. 다음 단계 연결

Phase S가 완료되면 자동화 환경에서 `--model` 설정을 비대화형으로 수행할 수 있다. Phase T는 이 결과가 config schema에 맞게 안정적으로 저장되고 이후 commit flow에서 사용되는지를 다룬다.
