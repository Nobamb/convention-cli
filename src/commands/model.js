import { DEFAULT_LOCAL_LLM_BASE_URL, PROVIDERS } from "../config/defaults.js";
import { loadConfig, saveConfig } from "../config/store.js";
import { getApiKey, promptApiKey, saveApiKey } from "../auth/apiKey.js";
import { clearOAuthTokens, loadOAuthTokens, startOAuthFlow } from "../auth/oauth.js";
import { isGitHubCopilotOptedIn } from "../providers/github-copilot.js";
import { listProviderModels } from "../providers/index.js";
import { isUsageExhaustedError } from "../providers/errors.js";
import { normalizeLocalLLMConfig } from "../providers/localLLM.js";
import { success, warn } from "../utils/logger.js";
import {
  confirmExternalProviderRequest,
  confirmReplaceApiKey,
  selectAIUsageExhaustedAction,
  selectAuthType,
  selectCopilotSessionAction,
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
 *
 * @param {object} config - 기존 설정 객체.
 * @param {object} params - 변경할 설정값들.
 * @param {string} params.authType - 인증 방식.
 * @param {string} params.modelVersion - 모델 버전.
 * @returns {object} - 변경된 설정이 반영된 새 설정 객체.
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
 * @param {*} provider - provider 이름.
 * @throws {Error} provider가 유효하지 않은 경우.
 */
function assertProvider(provider) {
  // provider가 유효하지 않으면 에러를 던집니다.
  if (!isValidProvider(provider)) {
    throw new Error(`지원하지 않는 provider입니다: ${provider}`);
  }
}

/**
 * authType이 유효한지 확인합니다.
 *
 * @param {*} authType - authType 문자열.
 * @throws {Error} authType이 유효하지 않은 경우.
 */
function assertAuthType(authType) {
  // authType이 유효하지 않다면 에러를 던집니다.
  if (!isValidAuthType(authType)) {
    throw new Error(`지원하지 않는 authType입니다: ${authType}`);
  }
}

/**
 * 실제로 저장까지 허용하는 Provider/Auth 조합을 한 곳에서 관리합니다.
 * validator의 authType 목록은 이후 확장(oauth 등)을 위해 넓게 유지하되, 현재 MVP 설정 흐름에서는
 * diff 외부 전송 정책과 credentials 저장 구조가 준비된 조합만 통과시켜 잘못된 설정이 저장되지 않도록 합니다.
 *
 */
const SUPPORTED_AUTH_TYPES_BY_PROVIDER = {
  mock: ["none"],
  localLLM: ["none"],
  gemini: ["api"],
  openaiCompatible: ["api", "none"],
  antigravity: ["oauth"],
  "github-copilot": ["oauth"],
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
  antigravity: "antigravity-1",
  "github-copilot": "gpt-4.1",
};

/**
 * provider에 허용된 인증 방식 목록을 반환합니다.
 * 반환값은 prompts 선택지와 직접 지정 검증에서 함께 사용하므로, 지원 범위가 바뀌면 이 상수만 수정하면 됩니다.
 *
 * @param {string} provider - provider 이름.
 * @returns {string[]} - provider에 허용된 authType 배열.
 */
function getSupportedAuthTypes(provider) {
  // provider에 허용된 authType 배열을 반환합니다.
  return SUPPORTED_AUTH_TYPES_BY_PROVIDER[provider] ?? [];
}

/**
 * Provider/Auth 조합이 Phase 4에서 저장 가능한지 확인합니다.
 * oauth는 validator에는 존재하지만 아직 API 흐름과 토큰 저장 정책이 완성되지 않았으므로 명확한 오류로 중단합니다.
 *
 * @param {string} provider - provider 이름.
 * @param {string} authType - authType 문자열.
 * @throws {Error} Provider/Auth 조합이 유효하지 않은 경우.
 */
function assertProviderAuthType(provider, authType) {
  // Antigravity OAuth endpoint는 공식 검증 전이므로 안정 설정 flow에서 차단합니다.
  // 사용자가 명시 baseURL/experimental opt-in을 둔 provider 호출 경로와 OAuth login flow를 섞지 않기 위한 방어입니다.
  if (provider === "antigravity" && authType === "oauth") {
    throw new Error(
      "antigravity OAuth is experimental and disabled until official endpoints are verified.",
    );
  }

  // provider에 허용된 authType 배열을 가져옵니다.
  const supportedAuthTypes = getSupportedAuthTypes(provider);

  // provider에 authType이 포함되지 않으면 에러를 던집니다.
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
 * @param {*} modelVersion - modelVersion 문자열.
 * @throws {Error} modelVersion이 유효하지 않은 경우.
 */
function assertModelVersion(modelVersion) {
  // modelVersion이 유효하지 않다면 에러를 던집니다.
  if (!isValidModelVersion(modelVersion)) {
    throw new Error("modelVersion은 비어 있지 않은 문자열이어야 합니다.");
  }
}

/**
 * 저장 직전에 config에서 secret 성격의 필드를 제거합니다.
 * API Key는 credentials.json에만 저장해야 하므로, 실수로 config 병합 객체에 포함되더라도 파일에 남지 않게 합니다.
 *
 * @param {object} config - config 객체.
 * @returns {object} - config 객체.
 */
function removeSecretConfigFields(config) {
  // config에서 apiKey, token, secret, password를 제외한 나머지 속성을 safeConfig에 할당합니다.
  const { apiKey, token, secret, password, ...safeConfig } = config;

  // safeConfig를 반환합니다.
  return safeConfig;
}

/**
 * --model UI에서 보여줄 provider 목록을 구성합니다.
 * github-copilot은 preview SDK/OAuth 연동이므로 기본 목록에는 숨기고, config나 환경변수로 명시 opt-in 된 경우에만 추가합니다.
 *
 * @param {object} config - 현재 사용자 설정입니다.
 * @returns {string[]} 선택 가능한 provider 목록입니다.
 */
function getSelectableProviders(config) {
  // 기존 stable provider 목록은 그대로 유지해 기존 사용자의 선택 순서와 테스트 기대값을 흔들지 않습니다.
  const providers = [...PROVIDERS];

  // Copilot은 별도 opt-in 없이는 외부 OAuth/SDK 호출로 이어질 수 있으므로 기본 UI에는 노출하지 않습니다.
  if (isGitHubCopilotOptedIn(config)) {
    providers.push("github-copilot");
  }

  return providers;
}

/**
 * GitHub Copilot provider 사용이 명시적으로 허용되었는지 확인하고, 허용된 경우 config에 opt-in 값을 반영합니다.
 * 명령행에서 `--model github-copilot ...`처럼 provider를 직접 지정한 경우에는 실험 기능 안내 confirm을 거쳐 opt-in으로 간주합니다.
 *
 * @param {object} params
 * @param {string} params.provider - 선택된 provider 이름입니다.
 * @param {object} params.config - 현재 사용자 설정입니다.
 * @param {boolean} params.explicitProvider - 사용자가 CLI 인자로 provider를 직접 지정했는지 여부입니다.
 * @returns {Promise<object>} Copilot opt-in이 반영된 config입니다.
 */
async function ensureGitHubCopilotAllowed({
  provider,
  config,
  explicitProvider,
}) {
  // Copilot이 아닌 provider는 기존 설정을 그대로 사용합니다.
  if (provider !== "github-copilot") {
    return config;
  }

  // 이미 config 또는 환경변수로 opt-in 된 경우에는 추가 confirm 없이 진행합니다.
  if (isGitHubCopilotOptedIn(config)) {
    return {
      ...config,
      experimentalGitHubCopilot: true,
    };
  }

  // 기본 UI 목록에서는 Copilot을 숨기므로, 여기까지 온 경우는 명령행에서 provider를 직접 지정한 흐름입니다.
  if (!explicitProvider) {
    throw new Error(
      "github-copilot requires explicit experimental opt-in before it can be selected.",
    );
  }

  // preview SDK와 외부 Copilot 요청 특성을 사용자에게 명확히 알린 뒤에만 설정을 저장합니다.
  const confirmed = await confirmExternalProviderRequest({
    provider,
    action:
      "enable the experimental GitHub Copilot SDK/OAuth provider for this CLI",
  });

  if (!confirmed) {
    throw new Error("github-copilot experimental opt-in was canceled.");
  }

  return {
    ...config,
    experimentalGitHubCopilot: true,
  };
}

/**
 * Provider별 기본 설정을 기존 config와 병합합니다.
 * localLLM은 endpoint 기본값이 필요하고, 다른 Provider는 기존 baseURL을 보존하되 modelDisplayName은 modelVersion과 맞춥니다.
 *
 * @param {object} config - config 객체.
 * @param {object} params - params 객체.
 * @param {string} params.provider - provider 이름.
 * @param {string} params.authType - authType 문자열.
 * @param {string} params.modelVersion - modelVersion 문자열.
 * @returns {object} - config 객체.
 */
function buildModelConfig(config, { provider, authType, modelVersion }) {
  // config에 provider, authType, modelVersion을 할당합니다.
  const nextConfig = {
    ...config,
    provider,
    authType,
    modelVersion,
    modelDisplayName: modelVersion,
  };

  // provider가 localLLM이면
  if (provider === "localLLM") {
    // localLLM의 config를 빌드하고 반환합니다.
    return removeSecretConfigFields(
      buildLocalLLMConfig(nextConfig, { authType, modelVersion }),
    );
  }

  // removeSecretConfigFields를 통해 secret 성격의 필드를 제거한 nextConfig를 반환합니다.
  return removeSecretConfigFields(nextConfig);
}

/**
 * API Key가 필요한 Provider인 경우 credentials 저장소에 key가 있는지 확인하고, 없으면 secret prompt로 입력받아 저장합니다.
 * key의 존재 여부만 판단하며 원문 값은 출력하거나 config에 병합하지 않습니다.
 *
 * @param {string} provider - provider 이름.
 * @param {string} authType - authType 문자열.
 * @param {object} options - 옵션 객체.
 * @param {boolean} options.promptForExistingKey - 기존 API key를 다시 입력받을지 여부.
 */
async function ensureApiCredentials(
  provider,
  authType,
  { promptForExistingKey = true } = {},
) {
  // authType이 api가 아니면 종료
  if (authType !== "api") {
    return;
  }

  // provider의 api key를 가져옵니다.
  const existingKey = getApiKey(provider);

  // key가 있으면
  if (existingKey) {
    // promptForExistingKey가 false이면 종료
    if (!promptForExistingKey) {
      return;
    }

    // 이미 저장된 key가 있으면 사용자가 모델만 바꾸려는 상황일 수 있습니다.
    // key 원문은 절대 보여주지 않고, 교체 여부만 확인한 뒤 Yes일 때만 새 secret을 입력받습니다.
    const shouldReplaceApiKey = await confirmReplaceApiKey(provider);

    // 사용자가 교체를 원하지 않으면 종료
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
 * OAuth provider의 인증 상태를 확인하고 필요한 경우 로그인 flow를 실행합니다.
 * github-copilot은 기존 token이 있을 때 keep/logout/cancel 선택지를 제공해 token 원문을 출력하지 않고 session을 관리합니다.
 *
 * @param {string} provider - OAuth provider 이름입니다.
 * @param {object} config - OAuth 실행에 전달할 설정입니다.
 */
async function ensureOAuthCredentials(provider, config = {}) {
  // GitHub Copilot은 token 재사용 여부를 명시적으로 선택하게 해서 의도치 않은 재인증이나 token 삭제를 막습니다.
  if (provider === "github-copilot") {
    const existingTokens = loadOAuthTokens(provider);

    // token 값은 화면에 표시하지 않고 존재 여부만 기준으로 session 관리 UI를 보여줍니다.
    if (existingTokens?.accessToken) {
      const action = await selectCopilotSessionAction();

      if (action === "keep") {
        return;
      }

      if (action === "cancel") {
        throw new Error("GitHub Copilot OAuth setup was canceled.");
      }

      // 로그아웃은 provider별 token namespace만 지우며, 다른 provider의 credential은 건드리지 않습니다.
      const confirmed = await confirmExternalProviderRequest({
        provider,
        action: "remove the stored GitHub Copilot OAuth token and login again",
      });

      if (!confirmed) {
        throw new Error("GitHub Copilot OAuth logout was canceled.");
      }

      clearOAuthTokens(provider);
    }
  }

  // OAuth App client id/secret은 환경변수 기반 buildOAuthClientSettings에서 확인하며, secret prompt는 띄우지 않습니다.
  await startOAuthFlow({ provider, config });
}

/**
 * API Key 혹은 OAuth 인증을 유형에 맞게 조율하여 자격 증명을 획득합니다.
 *
 * @param {string} provider - AI provider 이름
 * @param {string} authType - 인증 타입 (api, oauth, none)
 * @param {object} options - 추가 옵션
 */
async function ensureCredentials(
  provider,
  authType,
  { promptForExistingKey = true, config = {} } = {},
) {
  // authType이 api이면
  if (authType === "api") {
    // API Key를 확인하거나 입력받습니다.
    await ensureApiCredentials(provider, authType, { promptForExistingKey });
  }
  // authType이 oauth이면
  else if (authType === "oauth") {
    // OAuth 인증을 진행하고 토큰을 저장합니다.
    await ensureOAuthCredentials(provider, config);
  }
}

/**
 * API Key provider에 이미 저장된 key가 있는 경우, 모델 목록 조회나 모델 선택을 계속하기 전에 교체 여부를 먼저 묻습니다.
 *
 * 저장된 key가 없는 첫 설정에서는 여기서 아무 것도 하지 않습니다. 새 key 입력은 기존 외부 요청 확인 gate 이후
 * `ensureApiCredentials()`에서 처리해, 사용자가 model list 요청을 거절한 경우 secret prompt가 뜨지 않도록 유지합니다.
 *
 * @param {string} provider - provider 이름.
 * @param {string} authType - authType 문자열.
 * @returns {Promise<boolean>} - true이면 API Key를 교체했음.
 */
async function askToReplaceExistingApiCredentials(provider, authType) {
  // authType이 api가 아니거나 API Key가 없으면 종료
  if (authType !== "api" || !getApiKey(provider)) {
    return false;
  }
  // API Key를 확인하거나 입력받습니다.
  await ensureApiCredentials(provider, authType);
  return true;
}

/**
 * Provider가 모델 목록을 제공하면 사용자에게 선택을 요청하고, 목록을 제공하지 않으면 Provider별 기본 모델을 사용합니다.
 * 직접 지정이 아닌 대화형 흐름에서만 호출되며, openaiCompatible의 외부 endpoint 조회는 별도 confirm 이후에만 수행됩니다.
 *
 * @param {object} config - config 객체.
 * @returns {Promise<string>} - modelVersion 문자열.
 */
async function resolveInteractiveModelVersion(config) {
  // Provider 모델 목록을 가져옵니다.
  const models = await listProviderModels(config);

  // 모델 목록이 있으면
  if (models.length > 0) {
    // 모델을 선택하고 modelVersion을 반환합니다.
    return selectModelVersion(models);
  }

  // config에 modelVersion이 없으면 DEFAULT_MODEL_VERSION_BY_PROVIDER에서 modelVersion을 가져옵니다.
  const fallbackModelVersion =
    config.modelVersion ?? DEFAULT_MODEL_VERSION_BY_PROVIDER[config.provider];

  // fallbackModelVersion이 유효한지 확인합니다.
  assertModelVersion(fallbackModelVersion);
  // 모델 목록이 없으면 fallbackModelVersion을 반환합니다.
  return fallbackModelVersion;
}

/**
 * 모델 목록 조회 중 HTTP 429가 발생하거나 연결에 실패했을 때 사용자 선택에 따라 안전하게 복구합니다.
 *
 * --model 흐름에서도 commit flow와 같은 원칙을 적용합니다. 실패 응답 본문은 provider 계층에서 읽지 않으므로
 * 여기서는 status만 보고 분기합니다. API Key 교체는 credentials.json에만 저장하고, 즉시 재시도할 수 있도록
 * 현재 메모리 config에도 새 key를 임시로 넣습니다.
 *
 * @param {object} config - config 객체.
 * @returns {Promise<{switchedConfig: object|null, modelVersion: string, config: object}>} - modelVersion 문자열.
 */
async function resolveInteractiveModelVersionWithRecovery(config) {
  // currentConfig를 config로 설정합니다.
  let currentConfig = config;

  // while 루프를 실행합니다.
  while (true) {
    // try-catch 블록으로 에러를 처리합니다.
    try {
      // resolveInteractiveModelVersion 함수를 호출하여 modelVersion을 가져옵니다.
      return {
        switchedConfig: null,
        modelVersion: await resolveInteractiveModelVersion(currentConfig),
        config: currentConfig,
      };
    } catch (error) {
      // 에러가 429(사용량 소진)이면
      const is429 = isUsageExhaustedError(error);
      // 에러가 HTTP 에러이면
      const isHttpError = Number.isInteger(error?.status);

      if (is429) {
        // 에러가 429이면
        warn(
          "모델 목록 조회 중 AI Provider 사용량 한도 또는 rate limit에 도달했습니다.",
        );
      } else {
        // 에러가 429가 아니면
        warn(`모델 목록을 가져오지 못했습니다: ${error.message}`);
      }

      // 429(사용량 소진)가 아니더라도 모델 목록을 가져오지 못했다면(연결 실패 등)
      // 사용자에게 설정을 수정하거나 재시도할 기회를 주는 것이 좋습니다.
      // 사용자가 선택할 수 있는 액션을 가져옵니다.
      const action = await selectAIUsageExhaustedAction({
        // 에러 메시지를 설정합니다.
        message: is429
          ? "AI Provider 사용량 한도에 도달했습니다. 어떻게 할까요?"
          : "모델 목록을 가져오지 못했습니다. 어떻게 할까요?",
        // API Key로 인증한 경우
        allowApiKey: currentConfig.authType === "api",
        // 연결 실패(Ollama 미실행 등)인 경우 서버 기동 후 바로 '재시도'할 수 있게 옵션을 엽니다.
        allowRetry: !isHttpError || !is429,
      });

      // 사용자가 재시도를 선택하면
      if (action === "retry") {
        // 현재 config 그대로 다시 시도합니다.
        continue;
      }

      // 사용자가 API Key 교체를 선택하면
      if (action === "replaceApiKey") {
        // API Key를 입력받고 저장합니다.
        const apiKey = await promptApiKey(currentConfig.provider);
        saveApiKey(currentConfig.provider, apiKey);

        // 현재 config를 업데이트합니다.
        currentConfig = {
          ...currentConfig,
          apiKey,
        };
        continue;
      }
      // 사용자가 다른 모델 사용을 선택하면
      if (action === "switchModel") {
        // 기존 --model 대화형 설정 flow를 재사용합니다. 새 provider/model 설정이 저장되면
        // 호출자는 기존 provider 설정 저장을 중단하고 이 결과를 그대로 반환합니다.
        return {
          switchedConfig: await setupModelInteractively(),
          modelVersion: null,
          config: currentConfig,
        };
      }

      // 사용자가 아무것도 선택하지 않으면 에러를 던집니다.
      throw new Error("모델 설정이 오류 복구 단계에서 중단되었습니다.");
    }
  }
}

/**
 * 대화형 UI를 통한 localLLM 모델 선택 흐름입니다.
 *
 * @param {import('../types.js').Config} config - 설정 객체.
 * @param {string} authType - 인증 타입.
 */
export async function setupLocalLLMModelSelection({
  config = loadConfig(),
  authType = "none",
} = {}) {
  // config 파일의 기본 설정값을 가져옴
  const localConfig = buildLocalLLMConfig(config, { authType });
  // listModels 인터페이스를 호출하여 실제 서버의 모델 목록을 조회
  const models = await listProviderModels(localConfig);

  // selectModelVersion UI를 호출합니다.
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
 * @param {string} provider - provider 이름.
 * @returns {string[]} - 허용된 authType 목록.
 */
function getAuthTypesForProvider(provider) {
  // 해당 provider에 대해 지원되는 authType 목록을 가져옵니다.
  return getSupportedAuthTypes(provider);
}

/**
 * 대화형 설정을 통해 모델 구성을 진행합니다.
 * @param {object} params - 매개변수 객체
 * @param {string} params.provider - provider 이름
 * @param {string} params.authType - 인증 타입
 * @param {string} params.modelVersion - modelVersion
 */
async function confirmExternalModelListRequest(config) {
  // openaiCompatible과 github-copilot은 모델 목록 조회가 외부 endpoint/SDK 요청이므로 사용자 확인을 받습니다.
  if (!["openaiCompatible", "github-copilot"].includes(config.provider)) {
    return true;
  }

  // 외부 provider는 모델 목록 조회가 필요하므로 사용자 확인
  const confirmed = await confirmExternalProviderRequest({
    provider: config.provider,
    action:
      config.provider === "github-copilot"
        ? "request the model list through the GitHub Copilot SDK"
        : "request the model list from the configured endpoint",
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
 * @param {object} params - 매개변수 객체
 * @param {string} params.provider - provider 이름
 * @param {string} params.authType - 인증 타입
 * @param {string} params.modelVersion - modelVersion
 */

export async function setupModelInteractively({
  provider,
  authType,
  modelVersion,
} = {}) {
  // 현재 설정을 로드합니다.
  const config = loadConfig();

  // 1. Provider 선택 (없을 경우)
  const selectedProvider = provider ?? (await selectProvider(getSelectableProviders(config)));
  // provider가 유효한지 확인합니다.
  assertProvider(selectedProvider);

  // 2. 인증 방식 선택 (없을 경우)
  const authTypes = getAuthTypesForProvider(selectedProvider);
  // 선택된 authType을 authType 변수에 할당합니다.
  let selectedAuthType = authType;

  // authType이 없으면 사용자에게 인증 방식 선택 UI를 보여줌
  if (!selectedAuthType) {
    // authType이 하나만 있으면 자동으로 선택
    if (authTypes.length === 1) {
      selectedAuthType = authTypes[0];
    } else {
      // authType이 여러 개 있으면 사용자에게 선택 UI를 보여줌
      selectedAuthType = await selectAuthType(authTypes);
    }
  }
  // authType이 유효한지 확인
  assertAuthType(selectedAuthType);
  // provider와 authType이 유효한지 확인ㄴ
  assertProviderAuthType(selectedProvider, selectedAuthType);

  // GitHub Copilot은 preview SDK/OAuth 연동이므로 명시 opt-in 확인 뒤에만 다음 단계로 진행합니다.
  const optInConfig = await ensureGitHubCopilotAllowed({
    provider: selectedProvider,
    config,
    explicitProvider: provider === "github-copilot",
  });

  // 직접 지정된 modelVersion은 UI를 건너뛰기 전에 저장 가능한 값인지 먼저 검증합니다.
  if (modelVersion !== undefined) {
    assertModelVersion(modelVersion);
  }

  // modelVersion이 없으면 모델 목록 조회 여부 확인
  const shouldRequestModelList = !modelVersion;
  // modelListConfig
  // config에 provider와 authType을 추가하여 모델 목록 조회를 위한 설정 객체 생성
  const modelListConfig = {
    ...optInConfig,
    provider: selectedProvider,
    authType: selectedAuthType,
  };
  // 기존 API 키를 교체할지 확인
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

  // 3. 자격 증명 확보 (API Key 입력 또는 OAuth 로그인 실행)
  await ensureCredentials(selectedProvider, selectedAuthType, {
    promptForExistingKey: !handledExistingApiKey,
    config: modelListConfig,
  });

  // 4. 모델 버전 선택 (없을 경우)
  let selectedModelVersion = modelVersion;
  // modelVersion이 없으면 모델 목록 조회
  if (!selectedModelVersion) {
    // 대화형 모델 버전 해결
    const modelResolution =
      await resolveInteractiveModelVersionWithRecovery(modelListConfig);
    // 모델 버전이 변경되었으면 설정 반환
    if (modelResolution.switchedConfig) {
      // 설정 반환
      return modelResolution.switchedConfig;
    }

    // 모델 버전 설정
    selectedModelVersion = modelResolution.modelVersion;
  }

  // 5. 최종 설정 병합 및 저장
  // config에 provider와 authType을 추가하여 모델 목록 조회를 위한 설정 객체 생성
  const nextConfig = buildModelConfig(optInConfig, {
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
 * Provider만 CLI 인자로 지정된 경우의 Phase Q 흐름입니다.
 * Provider 선택 UI는 건너뛰고, 인증 방식과 모델 버전만 필요한 만큼 대화형으로 진행합니다.
 *
 * @param {string} provider - provider 이름
 * @returns {Promise<object>} - 설정 객체
 */
export async function setupModelWithProvider(provider) {
  // provider 검증
  assertProvider(provider);
  // 대화형 모델 설정 시작
  return setupModelInteractively({ provider });
}

/**
 * Provider와 authType이 CLI 인자로 지정된 경우의 Phase R 흐름입니다.
 * Provider/Auth 선택 UI는 건너뛰고, 인증 정보 확인과 모델 버전 선택만 진행합니다.
 *
 * @param {string} provider - provider 이름
 * @param {string} authType - 인증 타입
 * @returns {Promise<object>} - 설정 객체
 */
export async function setupModelWithProviderAndAuth(provider, authType) {
  // provider 검증
  assertProvider(provider);
  // authType 검증
  assertAuthType(authType);
  // provider authType 검증
  assertProviderAuthType(provider, authType);

  // 대화형 모델 설정 시작
  return setupModelInteractively({ provider, authType });
}

/**
 * Provider, authType, modelVersion을 모두 CLI 인자로 받은 Phase S 흐름입니다.
 * 모든 값이 이미 주어졌으므로 select UI와 모델 목록 조회 없이 검증과 credentials 확인 후 config를 저장합니다.
 *
 * @param {string} provider - ai 모델 제공자
 * @param {string} authType - 인증 방식
 * @param {string} modelVersion - 모델 버전
 * @returns {Promise<object>} - 설정이 완료된 config 객체
 */
export async function setupModelDirectly(provider, authType, modelVersion) {
  // Provider 검증
  assertProvider(provider);
  // AuthType 검증
  assertAuthType(authType);
  // Provider AuthType 검증
  assertProviderAuthType(provider, authType);
  // ModelVersion 검증
  assertModelVersion(modelVersion);

  // Config 파일 불러오기
  const config = loadConfig();
  // GitHub Copilot은 명령행에서 직접 지정한 경우에도 실험 기능 안내 confirm을 거친 뒤에만 저장합니다.
  const optInConfig = await ensureGitHubCopilotAllowed({
    provider,
    config,
    explicitProvider: provider === "github-copilot",
  });

  // AuthType에 따라 자격 증명 획득
  await ensureCredentials(provider, authType, { config: optInConfig });

  // Config 빌드
  const nextConfig = buildModelConfig(optInConfig, {
    provider,
    authType,
    modelVersion: modelVersion.trim(),
  });

  // 설정 저장
  saveConfig(nextConfig);
  // 성공 메시지 출력
  success(`${provider} 모델 설정이 저장되었습니다.`);
  // 설정 객체 반환
  return nextConfig;
}

/**
 * Model 커맨드 실행을 위한 메인 엔드포인트로, CLI 인자에 따라 setupModelDirectly, setupModelWithProviderAndAuth, setupModelWithProvider, setupModelInteractively를 호출합니다.
 * @param {string} provider - ai 모델 제공자
 * @param {string} authType - 인증 방식
 * @param {string} modelVersion - 모델 버전
 * @returns {Promise<object>} - 설정이 완료된 config 객체
 */
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
