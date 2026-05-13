import { DEFAULT_LOCAL_LLM_BASE_URL, PROVIDERS } from "../config/defaults.js";
import { loadConfig, saveConfig } from "../config/store.js";
import { getApiKey, promptApiKey, saveApiKey } from "../auth/apiKey.js";
import { listProviderModels } from "../providers/index.js";
import { isUsageExhaustedError } from "../providers/errors.js";
import { normalizeLocalLLMConfig } from "../providers/localLLM.js";
import { success, warn } from "../utils/logger.js";
import {
  confirmExternalProviderRequest,
  confirmReplaceApiKey,
  selectAIUsageExhaustedAction,
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
 * 실제로 저장까지 허용하는 Provider/Auth 조합을 한 곳에서 관리합니다.
 * validator의 authType 목록은 이후 확장(oauth 등)을 위해 넓게 유지하되, 현재 MVP 설정 흐름에서는
 * diff 외부 전송 정책과 credentials 저장 구조가 준비된 조합만 통과시켜 잘못된 설정이 저장되지 않도록 합니다.
 */
const SUPPORTED_AUTH_TYPES_BY_PROVIDER = {
  mock: ["none"],
  localLLM: ["none"],
  gemini: ["api"],
  openaiCompatible: ["api", "none"],
};

/**
 * Provider별 기본 모델명을 정의합니다.
 * 대화형 모델 목록 조회를 지원하지 않거나 사용자가 직접 모델명을 고르지 않는 경우에도
 * config에는 비어 있지 않은 modelVersion이 저장되어 이후 commit flow가 같은 schema를 사용할 수 있습니다.
 */
const DEFAULT_MODEL_VERSION_BY_PROVIDER = {
  mock: "mock",
  gemini: "gemini-3-flash-preview",
  openaiCompatible: "latest",
};

/**
 * provider에 허용된 인증 방식 목록을 반환합니다.
 * 반환값은 prompts 선택지와 직접 지정 검증에서 함께 사용하므로, 지원 범위가 바뀌면 이 상수만 수정하면 됩니다.
 *
 * @param {string} provider
 * @returns {string[]}
 */
function getSupportedAuthTypes(provider) {
  return SUPPORTED_AUTH_TYPES_BY_PROVIDER[provider] ?? [];
}

/**
 * Provider/Auth 조합이 Phase 4에서 저장 가능한지 확인합니다.
 * oauth는 validator에는 존재하지만 아직 API 흐름과 토큰 저장 정책이 완성되지 않았으므로 명확한 오류로 중단합니다.
 *
 * @param {string} provider
 * @param {string} authType
 */
function assertProviderAuthType(provider, authType) {
  const supportedAuthTypes = getSupportedAuthTypes(provider);

  if (!supportedAuthTypes.includes(authType)) {
    throw new Error(
      `${provider} provider는 authType ${authType} 설정을 지원하지 않습니다.`,
    );
  }
}

/**
 * modelVersion이 직접 입력되었을 때 저장 가능한 문자열인지 확인합니다.
 * 공백 문자열을 그대로 저장하면 이후 Provider 호출 단계에서 원인을 찾기 어려운 오류가 발생하므로
 * config 저장 전에 빠르게 차단합니다.
 *
 * @param {*} modelVersion
 */
function assertModelVersion(modelVersion) {
  if (!isValidModelVersion(modelVersion)) {
    throw new Error("modelVersion은 비어 있지 않은 문자열이어야 합니다.");
  }
}

/**
 * 저장 직전에 config에서 secret 성격의 필드를 제거합니다.
 * API Key는 credentials.json에만 저장해야 하므로, 실수로 config 병합 객체에 포함되더라도 파일에 남지 않게 합니다.
 *
 * @param {object} config
 * @returns {object}
 */
function removeSecretConfigFields(config) {
  const { apiKey, token, secret, password, ...safeConfig } = config;

  return safeConfig;
}

/**
 * Provider별 기본 설정을 기존 config와 병합합니다.
 * localLLM은 endpoint 기본값이 필요하고, 다른 Provider는 기존 baseURL을 보존하되 modelDisplayName은 modelVersion과 맞춥니다.
 *
 * @param {object} config
 * @param {object} params
 * @param {string} params.provider
 * @param {string} params.authType
 * @param {string} params.modelVersion
 * @returns {object}
 */
function buildModelConfig(config, { provider, authType, modelVersion }) {
  const nextConfig = {
    ...config,
    provider,
    authType,
    modelVersion,
    modelDisplayName: modelVersion,
  };

  if (provider === "localLLM") {
    return removeSecretConfigFields(
      buildLocalLLMConfig(nextConfig, { authType, modelVersion }),
    );
  }

  return removeSecretConfigFields(nextConfig);
}

/**
 * API Key가 필요한 Provider인 경우 credentials 저장소에 key가 있는지 확인하고, 없으면 secret prompt로 입력받아 저장합니다.
 * key의 존재 여부만 판단하며 원문 값은 출력하거나 config에 병합하지 않습니다.
 *
 * @param {string} provider
 * @param {string} authType
 */
async function ensureApiCredentials(
  provider,
  authType,
  { promptForExistingKey = true } = {},
) {
  if (authType !== "api") {
    return;
  }

  const existingKey = getApiKey(provider);

  if (existingKey) {
    if (!promptForExistingKey) {
      return;
    }

    // 이미 저장된 key가 있으면 사용자가 모델만 바꾸려는 상황일 수 있습니다.
    // key 원문은 절대 보여주지 않고, 교체 여부만 확인한 뒤 Yes일 때만 새 secret을 입력받습니다.
    const shouldReplaceApiKey = await confirmReplaceApiKey(provider);

    if (!shouldReplaceApiKey) {
      return;
    }
  }

  // 저장된 key가 없거나 사용자가 교체를 선택한 경우에만 password prompt를 띄웁니다.
  // 입력값은 credentials.json으로만 저장하고 config.json에는 병합하지 않습니다.
  const apiKey = await promptApiKey(provider);
  saveApiKey(provider, apiKey);
}

/**
 * API Key provider에 이미 저장된 key가 있는 경우, 모델 목록 조회나 모델 선택을 계속하기 전에 교체 여부를 먼저 묻습니다.
 *
 * 저장된 key가 없는 첫 설정에서는 여기서 아무 것도 하지 않습니다. 새 key 입력은 기존 외부 요청 확인 gate 이후
 * `ensureApiCredentials()`에서 처리해, 사용자가 model list 요청을 거절한 경우 secret prompt가 뜨지 않도록 유지합니다.
 */
async function askToReplaceExistingApiCredentials(provider, authType) {
  if (authType !== "api" || !getApiKey(provider)) {
    return false;
  }

  await ensureApiCredentials(provider, authType);
  return true;
}

/**
 * Provider가 모델 목록을 제공하면 사용자에게 선택을 요청하고, 목록을 제공하지 않으면 Provider별 기본 모델을 사용합니다.
 * 직접 지정이 아닌 대화형 흐름에서만 호출되며, openaiCompatible의 외부 endpoint 조회는 별도 confirm 이후에만 수행됩니다.
 *
 * @param {object} config
 * @returns {Promise<string>}
 */
async function resolveInteractiveModelVersion(config) {
  const models = await listProviderModels(config);

  if (models.length > 0) {
    return selectModelVersion(models);
  }

  const fallbackModelVersion =
    config.modelVersion ?? DEFAULT_MODEL_VERSION_BY_PROVIDER[config.provider];

  assertModelVersion(fallbackModelVersion);
  return fallbackModelVersion;
}

/**
 * 모델 목록 조회 중 HTTP 429가 발생하거나 연결에 실패했을 때 사용자 선택에 따라 안전하게 복구합니다.
 *
 * --model 흐름에서도 commit flow와 같은 원칙을 적용합니다. 실패 응답 본문은 provider 계층에서 읽지 않으므로
 * 여기서는 status만 보고 분기합니다. API Key 교체는 credentials.json에만 저장하고, 즉시 재시도할 수 있도록
 * 현재 메모리 config에도 새 key를 임시로 넣습니다.
 */
async function resolveInteractiveModelVersionWithRecovery(config) {
  let currentConfig = config;

  while (true) {
    try {
      return {
        switchedConfig: null,
        modelVersion: await resolveInteractiveModelVersion(currentConfig),
        config: currentConfig,
      };
    } catch (error) {
      const is429 = isUsageExhaustedError(error);
      const isHttpError = Number.isInteger(error?.status);

      // 429(사용량 소진)가 아니더라도 모델 목록을 가져오지 못했다면(연결 실패 등)
      // 사용자에게 설정을 수정하거나 재시도할 기회를 주는 것이 좋습니다.
      if (is429) {
        warn("모델 목록 조회 중 AI Provider 사용량 한도 또는 rate limit에 도달했습니다.");
      } else {
        warn(`모델 목록을 가져오지 못했습니다: ${error.message}`);
      }

      const action = await selectAIUsageExhaustedAction({
        message: is429
          ? "AI Provider 사용량 한도에 도달했습니다. 어떻게 할까요?"
          : "모델 목록을 가져오지 못했습니다. 어떻게 할까요?",
        allowApiKey: currentConfig.authType === "api",
        // 연결 실패(Ollama 미실행 등)인 경우 서버 기동 후 바로 '재시도'할 수 있게 옵션을 엽니다.
        allowRetry: !isHttpError || !is429,
      });

      if (action === "retry") {
        // 현재 config 그대로 다시 시도합니다.
        continue;
      }

      if (action === "replaceApiKey") {
        const apiKey = await promptApiKey(currentConfig.provider);
        saveApiKey(currentConfig.provider, apiKey);

        currentConfig = {
          ...currentConfig,
          apiKey,
        };
        continue;
      }

      if (action === "switchModel") {
        // 기존 --model 대화형 설정 flow를 재사용합니다. 새 provider/model 설정이 저장되면
        // 호출자는 기존 provider 설정 저장을 중단하고 이 결과를 그대로 반환합니다.
        return {
          switchedConfig: await setupModelInteractively(),
          modelVersion: null,
          config: currentConfig,
        };
      }

      throw new Error("모델 설정이 오류 복구 단계에서 중단되었습니다.");
    }
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
  return getSupportedAuthTypes(provider);
}

/**
 * 대화형 설정을 통해 모델 구성을 진행합니다.
 * @param {object} params
 * @param {string} params.provider
 * @param {string} params.authType
 * @param {string} params.modelVersion
 */
async function confirmExternalModelListRequest(config) {
  // openaiCompatible provider 이외에는 모델 목록 조회가 필요 없으므로 true 반환
  if (config.provider !== "openaiCompatible") {
    return true;
  }

  // openaiCompatible provider는 모델 목록 조회가 필요하므로 사용자 확인
  const confirmed = await confirmExternalProviderRequest({
    provider: config.provider,
    action: "request the model list from the configured endpoint",
    baseURL: config.baseURL,
  });

  // 사용자가 모델 목록 조회를 취소한 경우 경고 메시지 출력
  if (!confirmed) {
    warn(
      "External provider model list request was canceled. No provider request was performed.",
    );
  }

  return confirmed;
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

  // authType이 없으면 사용자에게 인증 방식 선택 UI를 보여줌
  if (!selectedAuthType) {
    if (authTypes.length === 1) {
      selectedAuthType = authTypes[0];
    } else {
      selectedAuthType = await selectAuthType(authTypes);
    }
  }
  // authType이 유효한지 확인
  assertAuthType(selectedAuthType);
  assertProviderAuthType(selectedProvider, selectedAuthType);

  // 직접 지정된 modelVersion은 UI를 건너뛰기 전에 저장 가능한 값인지 먼저 검증합니다.
  if (modelVersion !== undefined) {
    assertModelVersion(modelVersion);
  }

  // modelVersion이 없으면 모델 목록 조회 여부 확인
  const shouldRequestModelList = !modelVersion;
  // modelListConfig
  // config에 provider와 authType을 추가하여 모델 목록 조회를 위한 설정 객체 생성
  const modelListConfig = {
    ...config,
    provider: selectedProvider,
    authType: selectedAuthType,
  };
  const handledExistingApiKey = await askToReplaceExistingApiCredentials(
    selectedProvider,
    selectedAuthType,
  );

  // 외부 모델 목록 조회 확인
  // 사용자가 모델 목록 조회를 거부하면 에러 발생
  if (
    shouldRequestModelList &&
    !(await confirmExternalModelListRequest(modelListConfig))
  ) {
    throw new Error("External provider model list request was canceled.");
  }

  // 3. API Key 입력 (필요 시)
  await ensureApiCredentials(selectedProvider, selectedAuthType, {
    promptForExistingKey: !handledExistingApiKey,
  });

  // 4. 모델 버전 선택 (없을 경우)
  let selectedModelVersion = modelVersion;
  if (!selectedModelVersion) {
    const modelResolution =
      await resolveInteractiveModelVersionWithRecovery(modelListConfig);

    if (modelResolution.switchedConfig) {
      return modelResolution.switchedConfig;
    }

    selectedModelVersion = modelResolution.modelVersion;
  }

  // 5. 최종 설정 병합 및 저장
  // config에 provider와 authType을 추가하여 모델 목록 조회를 위한 설정 객체 생성
  const nextConfig = buildModelConfig(config, {
    provider: selectedProvider,
    authType: selectedAuthType,
    modelVersion: selectedModelVersion,
  });

  // config에 provider와 authType을 추가하여 모델 목록 조회를 위한 설정 객체 생성
  saveConfig(nextConfig);
  // 모델 설정 완료 메시지
  success(`${selectedProvider} 모델 설정이 저장되었습니다.`);

  return nextConfig;
}

/**
 * --model 커맨드의 메인 엔드포인트입니다.
 * @param {*} provider
 * @param {*} authType
 * @param {*} modelVersion
 */
/**
 * Provider만 CLI 인자로 지정된 경우의 Phase Q 흐름입니다.
 * Provider 선택 UI는 건너뛰고, 인증 방식과 모델 버전만 필요한 만큼 대화형으로 진행합니다.
 *
 * @param {string} provider
 * @returns {Promise<object>}
 */
export async function setupModelWithProvider(provider) {
  assertProvider(provider);
  return setupModelInteractively({ provider });
}

/**
 * Provider와 authType이 CLI 인자로 지정된 경우의 Phase R 흐름입니다.
 * Provider/Auth 선택 UI는 건너뛰고, 인증 정보 확인과 모델 버전 선택만 진행합니다.
 *
 * @param {string} provider
 * @param {string} authType
 * @returns {Promise<object>}
 */
export async function setupModelWithProviderAndAuth(provider, authType) {
  assertProvider(provider);
  assertAuthType(authType);
  assertProviderAuthType(provider, authType);

  return setupModelInteractively({ provider, authType });
}

/**
 * Provider, authType, modelVersion을 모두 CLI 인자로 받은 Phase S 흐름입니다.
 * 모든 값이 이미 주어졌으므로 select UI와 모델 목록 조회 없이 검증과 credentials 확인 후 config를 저장합니다.
 *
 * @param {string} provider
 * @param {string} authType
 * @param {string} modelVersion
 * @returns {Promise<object>}
 */
export async function setupModelDirectly(provider, authType, modelVersion) {
  assertProvider(provider);
  assertAuthType(authType);
  assertProviderAuthType(provider, authType);
  assertModelVersion(modelVersion);

  const config = loadConfig();

  await ensureApiCredentials(provider, authType);

  const nextConfig = buildModelConfig(config, {
    provider,
    authType,
    modelVersion: modelVersion.trim(),
  });

  saveConfig(nextConfig);
  success(`${provider} 紐⑤뜽 ?ㅼ젙????λ릺?덉뒿?덈떎.`);

  return nextConfig;
}

export async function runModelSetup(provider, authType, modelVersion) {
  // modelVersion까지 모두 전달된 경우에는 자동화 환경에서 사용할 수 있도록 UI 없이 직접 저장합니다.
  if (modelVersion !== undefined) {
    return setupModelDirectly(provider, authType, modelVersion);
  }

  // provider와 authType만 전달된 경우에는 모델 선택만 대화형으로 진행합니다.
  if (authType !== undefined) {
    return setupModelWithProviderAndAuth(provider, authType);
  }

  // provider만 전달된 경우에는 Provider 선택을 건너뛰고 나머지 값을 대화형으로 채웁니다.
  if (provider !== undefined) {
    return setupModelWithProvider(provider);
  }

  // 아무 인자도 없으면 전체 대화형 설정 흐름을 실행합니다.
  return setupModelInteractively();
}
