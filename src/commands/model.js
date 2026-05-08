import { DEFAULT_LOCAL_LLM_BASE_URL } from "../config/defaults.js";
import { loadConfig, saveConfig } from "../config/store.js";
import { listProviderModels } from "../providers/index.js";
import { normalizeLocalLLMConfig } from "../providers/localLLM.js";
import { success } from "../utils/logger.js";
import { selectModelVersion } from "../utils/ui.js";
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
 * --model 커맨드의 메인 엔드포인트입니다.
 *
 * @param {*} provider
 * @param {*} authType
 * @param {*} modelVersion
 */
export async function runModelSetup(provider, authType, modelVersion) {
  // provider를 지정하지 않으면 에러를 발생시킵니다.
  if (!provider) {
    throw new Error(
      "provider를 지정해 주세요. E~H 단계에서는 localLLM을 지원합니다.",
    );
  }
  // provider가 유효한지 확인
  assertProvider(provider);

  // 현재 localLLM 구현에 집중하기 위해 다른 provider는 제한합니다.
  if (provider !== "localLLM") {
    throw new Error(
      `아직 이 단계에서 설정할 수 없는 provider입니다: ${provider}`,
    );
  }
  // authType을 지정하면 유효한지 확인
  if (authType !== undefined) {
    assertAuthType(authType);
  }

  // localLLM은 인증 정보(API Key)를 서버 외부로 보내지 않는 'none' 방식만 허용
  if (authType !== undefined && authType !== "none") {
    throw new Error("localLLM provider는 authType none만 지원합니다.");
  }
  // config 파일의 기본 설정값을 가져옴
  const config = loadConfig();

  /**
   * 사용자가 `convention --model localLLM none llama3`와 같이 모델명까지 입력한 경우.
   * 별도의 네트워크 조회나 UI 없이 즉시 설정을 저장.
   */
  if (modelVersion !== undefined) {
    // modelVersion이 유효한지 확인
    if (!isValidModelVersion(modelVersion)) {
      throw new Error("modelVersion은 비어 있지 않은 문자열이어야 합니다.");
    }
    // 모델 선택 결과를 바탕으로 설정 파일을 저장
    const nextConfig = buildLocalLLMConfig(config, {
      authType: authType ?? "none",
      modelVersion,
    });

    // 설정 파일을 저장
    saveConfig(nextConfig);
    // 성공 메시지를 출력
    success("localLLM 모델 설정이 저장되었습니다.");
    // 정규화된 설정을 반환
    return nextConfig;
  }

  /**
   * 모델명이 생략된 경우(예: `convention --model localLLM`) 서버에서 모델 목록을 받아 선택하게 합니다.
   */
  return setupLocalLLMModelSelection({
    config,
    authType: authType ?? "none",
  });
}
