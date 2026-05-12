# Phase R --model provider authType 부분 지정 Agent Research

## 1. 개요

Phase R은 사용자가 `convention --model <provider> <authType>`처럼 Provider와 인증 방식을 지정했을 때 인증 방식 선택 단계를 건너뛰고 필요한 인증 정보 확인과 모델 버전 선택만 진행하는 단계다.

## 2. 작업 목표

- `setupModelWithProviderAndAuth(provider, authType)` 구현
- provider와 authType 유효성 검증
- Provider/Auth 조합 검증
- API Key가 필요한 조합이면 secret 입력 또는 기존 credentials 확인
- 모델 버전 선택 UI 실행
- 최종 config 저장

## 3. 구현 범위

- 수정 대상: `src/commands/model.js`
- 연동 대상: `src/auth/apiKey.js`, `src/config/store.js`, `src/providers/index.js`, `src/utils/validator.js`
- 주요 함수:
  - `setupModelWithProviderAndAuth(provider, authType)`
  - `isValidProvider(provider)`
  - `isValidAuthType(authType)`
  - `promptApiKey(provider)`
  - `saveApiKey(provider, apiKey)`

## 4. 권장 구현 방향

- `runModelSetup(provider, authType)` 형태로 호출되면 이 단계 함수로 위임한다.
- `localLLM none`은 API Key 흐름 없이 모델 선택으로 진행한다.
- `gemini api`, `openaiCompatible api`는 credentials에 API Key가 없으면 secret 입력을 요청한다.
- authType이 Provider와 맞지 않으면 저장하지 않고 오류로 중단한다.
- 모델 버전은 Provider의 `listModels(config)` 결과 또는 Provider별 기본 목록을 통해 선택한다.

## 5. 보안 및 안정성 기준

- API Key 존재 여부는 안내할 수 있지만 원문 값은 절대 출력하지 않는다.
- credentials 파일 내용을 로그로 출력하지 않는다.
- `authType` 오류 시 Provider 설정을 부분 저장하지 않는다.
- 외부 모델 목록 조회 실패 시 원문 응답이나 인증 세부 정보를 출력하지 않는다.

## 6. 다음 단계 연결

Phase R이 완료되면 Provider/Auth가 명령행에서 고정된 상태로 모델 버전만 선택하는 흐름이 가능해진다. Phase S는 모델 버전까지 모두 지정되어 대화형 UI 없이 즉시 저장하는 흐름이다.
