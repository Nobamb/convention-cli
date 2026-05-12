# Phase Q --model provider 부분 지정 Agent Research

## 1. 개요

Phase Q는 사용자가 `convention --model <provider>`처럼 Provider만 지정했을 때 Provider 선택 단계를 건너뛰고 인증 방식과 모델 버전만 대화형으로 설정하는 단계다.

## 2. 작업 목표

- `setupModelWithProvider(provider)` 구현
- 지정된 provider 유효성 검증
- Provider 선택 UI 생략
- `selectAuthType(provider)` 실행
- authType에 따른 인증 정보 입력 또는 확인
- 모델 버전 선택 후 config 저장

## 3. 구현 범위

- 수정 대상: `src/commands/model.js`
- 연동 대상: `src/utils/validator.js`, `src/utils/ui.js`, `src/auth/apiKey.js`, `src/config/store.js`
- 주요 함수:
  - `setupModelWithProvider(provider)`
  - `isValidProvider(provider)`
  - `selectAuthType(provider)`
  - `selectModelVersion(models)`

## 4. 권장 구현 방향

- `runModelSetup(provider)` 형태로 호출되면 `setupModelWithProvider(provider)`로 위임한다.
- provider가 지원 목록에 없으면 mock fallback 없이 명확한 오류로 중단한다.
- `localLLM`은 authType을 `none`으로 자동 결정하거나 선택지를 `none`으로 제한한다.
- `gemini` 또는 `openaiCompatible`은 `api` 인증 방식 선택 후 API Key 입력/저장 흐름과 연결한다.
- 모델 목록 조회가 필요한 경우 Provider별 `listModels(config)` 라우팅을 사용한다.

## 5. 보안 및 안정성 기준

- 잘못된 provider를 조용히 mock으로 대체하지 않는다.
- API Key 입력이 필요한 경우 secret 입력만 사용한다.
- Provider 설정 전체를 로그로 출력하지 않는다.
- 이 단계에서도 Git 작업, AI commit message 생성, commit은 실행하지 않는다.

## 6. 다음 단계 연결

Phase Q가 완료되면 Provider는 이미 확정된 상태에서 authType과 modelVersion만 채우는 흐름이 완성된다. Phase R은 provider와 authType이 모두 지정된 경우로 범위를 더 좁힌다.
