import {
  DEFAULT_LOCAL_LLM_BASE_URL,
  PROVIDERS,
} from "../config/defaults.js";
import { loadConfig, saveConfig } from "../config/store.js";
import { getApiKey, promptApiKey, saveApiKey } from "../auth/apiKey.js";
import { listProviderModels } from "../providers/index.js";
import { normalizeLocalLLMConfig } from "../providers/localLLM.js";
import { success } from "../utils/logger.js";
import {
  selectAuthType,
  selectModelVersion,
  selectProvider,
} from "../utils/ui.js";
import {
  isValidAuthType,
  isValidModelVersion,
  isValidProvider,
} from "../utils/validator.js";

/**
 *
 * [상세 설명]
 * 사용자가 CLI에서 입력한 부분적인 설정을 받아 2차 MVP의 localLLM 기본값과 병합합니다.
 * modelDisplayName은 UI에서 사용자에게 보여줄 친화적인 이름을 저장하는 용도로 사용됩니다.
 */
function buildLocalLLMConfig(config, { authType, modelVersion } = {}) {
  // Config 파일에서 저장된 값과 CLI 옵션에서 전달된 값을 병합하여 정규화된 설정을 반환합니다.
  const normalizedConfig = normalizeLocalLLMConfig({
    // config 파일의 기본 설정값을 가져옴
    ...config,
    // CLI 옵션으로 authType이 전달되었는지 확인하고, 전달되지 않았으면 기본값 "none"을 사용합니다.
    authType: authType ?? config.authType ?? "none",
    // CLI 옵션으로 modelVersion이 전달되었는지 확인하고, 전달되지 않았으면 config의 modelVersion을 사용합니다.
    modelVersion: modelVersion ?? config.modelVersion,
    // CLI 옵션으로 baseURL이 전달되었는지 확인하고, 전달되지 않았으면 DEFAULT_LOCAL_LLM_BASE_URL을 사용합니다.
    baseURL: config.baseURL ?? DEFAULT_LOCAL_LLM_BASE_URL,
  });

  // 정규화된 설정을 반환합니다.
  return {
    // normalizedConfig의 기본 설정값을 가져옴
    ...normalizedConfig,
    // modelVersion이 있으면 이를 표시용 이름으로도 사용합니다.
    modelDisplayName: normalizedConfig.modelVersion ?? config.modelDisplayName,
  };
}

/**
 * provider가 유효한지 확인합니다.
 *
 * @param {*} provider
 */
function assertProvider(provider) {
  if (!isValidProvider(provider)) {
    throw new Error(`지원하지 않는 provider입니다: ${provider}`);
  }
}

/**

 authType이 유효한지 확인합니다.
 
 @param {*} authType 

*/
function assertAuthType(authType) {
  if (!isValidAuthType(authType)) {
    throw new Error(`지원하지 않는 authType입니다: ${authType}`);
  }
}

/**
 * 대화형 UI를 통한 localLLM 모델 선택 흐름입니다.
 *
 * @param {import('../types.js').Config} config
 * @param {string} authType
 */
export async function setupLocalLLMModelSelection({
  config = loadConfig(),
  authType = "none",
} = {}) {
  // config 파일의 기본 설정값을 가져옴
  const localConfig = buildLocalLLMConfig(config, { authType });
  // listModels 인터페이스를 호출하여 실제 서버의 모델 목록을 조회
  const models = await listProviderModels(localConfig);

  // H 단계에서 추가된 selectModelVersion UI를 호출합니다.
  const modelVersion = await selectModelVersion(models);

  // 모델 선택 결과를 바탕으로 설정 파일을 저장합니다.
  const nextConfig = buildLocalLLMConfig(localConfig, {
    authType,
    modelVersion,
  });

  // 설정 파일을 저장합니다.
  saveConfig(nextConfig);
  // 성공 메시지를 출력합니다.
  success("localLLM 모델 설정이 저장되었습니다.");

  // 정규화된 설정을 반환합니다.
  return nextConfig;
}

/**
 * 특정 Provider에 대해 허용된 authType 목록을 반환합니다.
 * @param {string} provider
 * @returns {string[]}
 */
function getAuthTypesForProvider(provider) {
  if (provider === "localLLM") {
    return ["none"];
  }
  return ["api", "oauth"];
}

/**
 * 대화형 설정을 통해 모델 구성을 진행합니다.
 * @param {object} params
 * @param {string} params.provider
 * @param {string} params.authType
 * @param {string} params.modelVersion
 */
export async function setupModelInteractively({
  provider,
  authType,
  modelVersion,
} = {}) {
  const config = loadConfig();

  // 1. Provider 선택 (없을 경우)
  const selectedProvider = provider ?? (await selectProvider(PROVIDERS));
  assertProvider(selectedProvider);

  // 2. 인증 방식 선택 (없을 경우)
  const authTypes = getAuthTypesForProvider(selectedProvider);
  let selectedAuthType = authType;

  if (!selectedAuthType) {
    if (authTypes.length === 1) {
      selectedAuthType = authTypes[0];
    } else {
      selectedAuthType = await selectAuthType(authTypes);
    }
  }
  assertAuthType(selectedAuthType);

  // 3. API Key 입력 (필요 시)
  if (selectedAuthType === "api") {
    const existingKey = getApiKey(selectedProvider);
    if (!existingKey) {
      const apiKey = await promptApiKey(selectedProvider);
      saveApiKey(selectedProvider, apiKey);
    }
  }

  // 4. 모델 버전 선택 (없을 경우)
  let selectedModelVersion = modelVersion;
  if (!selectedModelVersion) {
    // 임시 config 생성 (모델 조회를 위함)
    const tempConfig = {
      ...config,
      provider: selectedProvider,
      authType: selectedAuthType,
    };
    const models = await listProviderModels(tempConfig);
    if (models.length > 0) {
      selectedModelVersion = await selectModelVersion(models);
    } else {
      // 모델 목록 조회를 지원하지 않거나 가져올 수 없는 경우 기본값 처리
      selectedModelVersion = config.modelVersion || "latest";
    }
  }

  // 5. 최종 설정 병합 및 저장
  const nextConfig = {
    ...config,
    provider: selectedProvider,
    authType: selectedAuthType,
    modelVersion: selectedModelVersion,
    modelDisplayName: selectedModelVersion,
  };

  // localLLM 전용 기본값 처리
  if (selectedProvider === "localLLM") {
    Object.assign(nextConfig, buildLocalLLMConfig(nextConfig));
  }

  saveConfig(nextConfig);
  success(`${selectedProvider} 모델 설정이 저장되었습니다.`);

  return nextConfig;
}

/**
 * --model 커맨드의 메인 엔드포인트입니다.
 * @param {*} provider
 * @param {*} authType
 * @param {*} modelVersion
 */
export async function runModelSetup(provider, authType, modelVersion) {
  // 모든 인자가 생략되었거나 하나라도 interactive가 필요한 경우 setupModelInteractively 호출
  return setupModelInteractively({ provider, authType, modelVersion });
}
