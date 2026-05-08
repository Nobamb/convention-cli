import * as mockProvider from "./mock.js";
import * as localLLMProvider from "./localLLM.js";

/**
 * 지원하는 AI Provider 모듈들의 레지스트리입니다.
 */
const PROVIDER_MODULES = {
  mock: mockProvider,
  localLLM: localLLMProvider,
};

/**
 * 설정된 provider 이름에 해당하는 모듈을 반환합니다.
 * @param {string} providerName - 사용할 provider 명칭 (null일 경우 'mock' 사용)
 * @returns {object} 해당 provider 모듈
 * @throws {Error} 지원하지 않거나 필수 인터페이스가 구현되지 않은 경우
 */
export function getProvider(providerName) {
  const normalizedProviderName = providerName ?? "mock";
  const provider = PROVIDER_MODULES[normalizedProviderName];

  // 등록되지 않은 provider 요청 시 에러 발생
  if (!provider) {
    throw new Error(`Unsupported provider: ${normalizedProviderName}`);
  }

  // 모든 Provider는 커밋 메시지 생성을 위한 generateCommitMessage 인터페이스를 반드시 구현해야 합니다.
  if (typeof provider.generateCommitMessage !== "function") {
    throw new Error(
      `Provider does not implement generateCommitMessage: ${normalizedProviderName}`,
    );
  }

  return provider;
}

/**
 * 지정된 provider를 통해 커밋 메시지를 생성합니다.
 * @param {object} params
 * @param {string} params.prompt - AI에게 전달할 프롬프트
 * @param {object} params.config - 사용자 설정 (provider 포함)
 * @returns {Promise<string>} 생성된 커밋 메시스
 */
export async function generateWithProvider({ prompt, config = {} }) {
  const provider = getProvider(config.provider);
  return provider.generateCommitMessage({ prompt, config });
}

/**
 * 특정 provider가 지원하는 모델 목록을 조회합니다.
 * 모든 Provider가 모델 조회를 지원하지는 않으므로(예: mock), 인터페이스 구현 여부를 먼저 확인합니다.
 * 구현되지 않은 경우 빈 배열을 반환하여 UI 계층에서 안전하게 처리할 수 있도록 합니다.
 *
 * @param {object} config - 사용자 설정
 * @returns {Promise<string[]>} 모델 목록 (지원하지 않는 경우 빈 배열)
 */
export async function listProviderModels(config = {}) {
  const provider = getProvider(config.provider);

  // listModels 인터페이스는 선택 사항(Optional)입니다.
  if (typeof provider.listModels !== "function") {
    return [];
  }

  // 모델 목록 반환
  return provider.listModels(config);
}
