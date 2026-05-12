# Phase P --model 전체 대화형 설정 Agent Research

## 1. 개요

Phase P는 사용자가 `convention --model`만 입력했을 때 Provider, 인증 방식, 모델 버전을 순서대로 선택하는 전체 대화형 설정 흐름을 구현하는 단계다. 이 단계의 목표는 CLI 인자가 없는 상태에서도 사용자가 필요한 설정을 끝까지 완료할 수 있게 만드는 것이다.

## 2. 작업 목표

- `setupModelInteractively()` 구현
- `selectProvider()`로 Provider 선택
- `selectAuthType(provider)`로 Provider별 인증 방식 선택
- Provider별 모델 목록 조회 또는 기본 모델 후보 제공
- `selectModelVersion(models)`로 모델 버전 선택
- 최종 설정을 `saveConfig()`로 저장
- 완료 메시지를 logger로 출력

## 3. 구현 범위

- 수정 대상: `src/commands/model.js`, `src/utils/ui.js`
- 연결 대상: `src/providers/index.js`, `src/config/store.js`
- 주요 함수:
  - `runModelSetup(...args)`
  - `setupModelInteractively()`
  - `selectProvider()`
  - `selectAuthType(provider)`
  - `selectModelVersion(models)`

## 4. 권장 구현 방향

- `runModelSetup()`에서 provider가 없으면 `setupModelInteractively()`로 위임한다.
- Provider 선택지는 `PROVIDERS` 또는 validator가 허용하는 Provider 목록과 일치해야 한다.
- localLLM 선택 시 `authType` 기본값은 `none`, `baseURL` 기본값은 `DEFAULT_LOCAL_LLM_BASE_URL`을 적용한다.
- API Key가 필요한 Provider는 인증 방식 선택 이후 credentials 저장 흐름과 연결한다.
- 모델 목록이 Provider에서 조회 가능하면 `listProviderModels(config)`를 사용하고, 조회 실패 시 명확한 안내와 함께 중단한다.

## 5. 보안 및 안정성 기준

- API Key는 대화형 secret 입력으로만 받으며 화면, 로그, 에러 메시지에 출력하지 않는다.
- config에는 Provider/Auth/Model/baseURL만 저장하고 secret은 저장하지 않는다.
- 외부 Provider 모델 조회가 네트워크를 사용할 수 있으므로 실패 메시지는 인증 정보나 원문 응답을 포함하지 않는다.
- 대화형 설정 완료 후 commit flow로 이어지지 않는다.

## 6. 다음 단계 연결

Phase P는 `--model` 인자가 전혀 없는 전체 설정 흐름이다. Phase Q, R, S는 일부 인자가 이미 지정된 경우 같은 저장 계약을 유지하면서 필요한 단계만 대화형으로 진행하도록 확장한다.
