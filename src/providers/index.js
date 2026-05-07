import * as mockProvider from './mock.js';

/**
 * 지원하는 AI Provider 모듈들의 레지스트리입니다.
 * 2차 MVP 확장 단계에서 gemini, localLLM 등이 여기에 추가됩니다.
 */
const PROVIDER_MODULES = {
  mock: mockProvider,
};

/**
 * 설정된 provider 이름에 해당하는 모듈을 반환합니다.
 * @param {string} providerName - 사용할 provider 명칭 (null일 경우 'mock' 사용)
 * @returns {object} 해당 provider 모듈
 * @throws {Error} 지원하지 않거나 필수 인터페이스가 구현되지 않은 경우
 */
export function getProvider(providerName) {
  const normalizedProviderName = providerName ?? 'mock';
  const provider = PROVIDER_MODULES[normalizedProviderName];

  // 등록되지 않은 provider 요청 시 에러 발생
  if (!provider) {
    throw new Error(`Unsupported provider: ${normalizedProviderName}`);
  }

  // 필수 인터페이스(generateCommitMessage) 구현 여부 확인
  if (typeof provider.generateCommitMessage !== 'function') {
    throw new Error(`Provider does not implement generateCommitMessage: ${normalizedProviderName}`);
  }

  return provider;
}

/**
 * 지정된 provider를 통해 커밋 메시지를 생성합니다.
 * @param {object} params
 * @param {string} params.prompt - AI에게 전달할 프롬프트
 * @param {object} params.config - 사용자 설정 (provider 포함)
 * @returns {Promise<string>} 생성된 커밋 메시지
 */
export async function generateWithProvider({ prompt, config = {} }) {
  const provider = getProvider(config.provider);
  return provider.generateCommitMessage({ prompt, config });
}

/**
 * 특정 provider가 지원하는 모델 목록을 조회합니다.
 * @param {object} config - 사용자 설정
 * @returns {Promise<string[]>} 모델 목록 (지원하지 않는 경우 빈 배열)
 */
export async function listProviderModels(config = {}) {
  const provider = getProvider(config.provider);

  // listModels 인터페이스는 선택 사항입니다.
  if (typeof provider.listModels !== 'function') {
    return [];
  }

  return provider.listModels(config);
}
