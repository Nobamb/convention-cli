# Phase N Provider 라우터 Agent Research

## 1. 개요

Phase N은 Phase B에서 초안을 잡고, L과 M에서 구체화한 개별 Provider(Mock, LocalLLM, Gemini, OpenAICompatible)들을 하나의 공통 엔트리포인트에서 관리하도록 라우터를 완성하는 단계입니다. 

## 2. 작업 목표

- `src/providers/index.js` 완성
- 사용자의 `config.provider` 값에 따라 올바른 Provider 모듈을 동적으로 반환
- 각 Provider가 가진 `generateCommitMessage` 함수 매핑
- 로컬 모델 선택 등을 위해 `listModels` 함수도 동일하게 라우팅

## 3. 권장 구현 방향

- `getProvider(providerName)` 함수에서 `switch` 또는 매핑 객체를 사용하여 명확하게 분기 처리합니다.
- 입력된 `providerName`이 지원하지 않는 값일 경우 기본값(예: 예외 발생 후 설정 변경 안내) 처리 로직을 구비합니다.
- 라우팅 모듈 자체는 비즈니스 로직(AI 요청, HTTP 호출)을 갖지 않고, 순수하게 분배 역할만 수행하도록 책임(SRP)을 분리합니다.

## 4. 보안 및 안정성 기준

- 검증되지 않은 provider 문자열이 유입될 경우를 대비하여 `isValidProvider` 등(Phase D)의 함수를 앞단에 활용하여 유효성을 검사합니다.

## 5. 다음 단계 연결

라우터가 완성되면 `core/ai.js`는 단순히 `getProvider(config.provider)`만 호출하면 되며, Phase O부터 시작되는 CLI 명령어(`--model`) 연동의 핵심 뼈대가 완성됩니다.
