# Phase B Provider 인터페이스 정의 Agent Research

## 1. 개요

Phase B는 2차 MVP의 첫 단계로, AI Provider들이 공통으로 따라야 할 인터페이스를 정의합니다. 구현 대상은 `src/providers/index.js`, `src/providers/mock.js`, 그리고 (필요시) `src/providers/types.js` 또는 `src/providers/contracts.js` 입니다.

기존 1차 MVP에서는 `src/core/ai.js`에 Mock 로직이 직접 하드코딩되거나 혼재되어 있을 수 있습니다. 이번 단계의 핵심 목표는 `core/ai.js`가 구체적인 Provider(Mock, LocalLLM, Gemini 등)의 구현 세부 사항을 알 필요 없이 동일한 방식으로 함수를 호출할 수 있도록 라우팅 구조의 초안을 마련하는 것입니다.

## 2. 작업 목표

- `generateCommitMessage` 함수 인터페이스 정의
- `listModels` 함수 인터페이스 정의
- `validateConfig` 함수 인터페이스 정의
- Provider 공통 함수명 정의 및 모듈화
- Provider 라우팅 구조 초안 작성 (`index.js`)

## 3. 권장 인터페이스 (Contracts)

각 Provider는 최소한 아래의 함수들을 노출(export)해야 합니다.

```javascript
/**
 * @typedef {Object} ProviderConfig
 * @property {string} provider - e.g., 'mock', 'localLLM', 'gemini'
 * @property {string} [baseURL]
 * @property {string} [authType]
 * @property {string} [modelVersion]
 */

/**
 * 커밋 메시지를 생성합니다.
 * @param {Object} args
 * @param {string} args.prompt - AI에게 전달할 프롬프트 텍스트
 * @param {ProviderConfig} args.config - 사용자의 Provider 관련 설정
 * @returns {Promise<string>} 생성된 커밋 메시지
 */
export async function generateCommitMessage({ prompt, config }) {
  // Provider 특정 구현...
}

/**
 * 선택 가능한 모델 목록을 조회합니다.
 * (모든 Provider가 동적 모델 목록을 지원하는 것은 아님. 미지원 시 빈 배열이나 에러 반환 가능)
 * @param {ProviderConfig} config
 * @returns {Promise<string[]>} 사용 가능한 모델명 배열
 */
export async function listModels(config) {
  // Provider 특정 구현...
}

/**
 * 설정이 이 Provider를 사용하기에 유효한지 검증합니다.
 * @param {ProviderConfig} config
 * @returns {boolean}
 */
export function validateConfig(config) {
  // Provider 특정 구현...
}
```

## 4. Provider 라우팅 구조 초안 (`index.js`)

```javascript
// src/providers/index.js
import * as mockProvider from "./mock.js";
// 추후 추가: import * as localLLMProvider from './localLLM.js';
// 추후 추가: import * as geminiProvider from './gemini.js';

export function getProvider(providerName) {
  switch (providerName) {
    case "mock":
      return mockProvider;
    // case 'localLLM': return localLLMProvider;
    // case 'gemini': return geminiProvider;
    default:
      // 정의되지 않은 provider의 경우 에러를 던지거나, fallback으로 mock을 반환할지 정책 결정 (2차 MVP에서는 지원 안 함 에러 권장)
      throw new Error(`지원하지 않는 Provider입니다: ${providerName}`);
  }
}
```

## 5. 보안 및 안정성 기준

- Provider 인터페이스 정의 파일에서는 API Key나 민감한 토큰이 로그로 누출되지 않도록 구조적으로 방어해야 합니다.
- 전체 config 객체를 로깅하는 대신, 필요한 필드(예: `provider` 이름)만 로깅합니다.
- `core/ai.js`는 순수하게 `getProvider(config.provider).generateCommitMessage(...)` 형태만을 호출해야 합니다.

## 6. 다음 단계 연결

이 단계에서 인터페이스가 합의되면, Phase C에서는 기존의 Mock 로직을 이 `mock.js`로 완전히 옮기고, `core/ai.js`가 새로운 인터페이스를 통해 호출하도록 리팩토링합니다.
