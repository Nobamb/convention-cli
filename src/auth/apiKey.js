import { loadCredentials, saveCredentials } from "../config/store.js";
import { promptSecret } from "../utils/ui.js";

/**
 *  assertProviderName
 * provider가 string 타입이고, 공백이 아닌지 확인한다.
 * string 타입이 아니거나, 공백이 맞다면 TypeError를 throw 한다
 * @param {*} provider
 */

function assertProviderName(provider) {
  if (typeof provider !== "string" || provider.trim().length === 0) {
    throw new TypeError("provider must be a non-empty string");
  }
}

/**
 * assertApiKey
 * apiKey가 string 타입이고, 공백이 아닌지 확인한다.
 * string 타입이 아니거나, 공백이 맞다면 TypeError를 throw 한다
 * @param {*} apiKey
 */

function assertApiKey(apiKey) {
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new TypeError("API Key must be a non-empty string");
  }
}

/**
 * promptApiKey
 * provider를 받아서 해당 provider의 API Key를 prompt로 입력받는다.
 * @param {*} provider
 * @returns {Promise<string>}
 */

export async function promptApiKey(provider) {
  assertProviderName(provider);
  return promptSecret(`${provider} API Key를 입력하세요.`);
}

/**
 * saveApiKey
 * provider와 apiKey를 받아서 해당 provider의 API Key를 저장한다.
 * 저장 전 providerName과 apiKey를 각각 assertProviderName, assertApiKey를 사용해서 검증한다.
 * 저장할 때 @config/store.js의 loadCredentials() 함수를 사용해서 기존에 저장된 credentials를 불러온다.
 * 불러온 credentials를 기반으로 @config/store.js의 saveCredentials() 함수를 사용해서 해당 provider의 API Key를 저장한다.
 * @param {*} provider
 * @param {*} apiKey
 */
export function saveApiKey(provider, apiKey) {
  // provider와 apiKey를 검증
  // provider와 apiKey를 검증
  assertProviderName(provider);
  assertApiKey(apiKey);

  // 기존에 저장된 credentials를 불러온다.
  const credentials = loadCredentials();

  // credentials에 provider와 apiKey를 저장한다.
  // 기존에 저장된 provider가 있다면 해당 provider의 apiKey를 업데이트하고, 없다면 새로 추가한다.
  // authType은 "api"로 고정한다.
  // 공백 제거한 값을 저장한다.
  saveCredentials({
    ...credentials,
    [provider]: {
      ...(credentials[provider] ?? {}),
      authType: "api",
      apiKey: apiKey.trim(),
    },
  });
}

/**
 * getApiKey
 * provider를 받아서 해당 provider의 API Key를 반환한다.
 * @param {*} provider
 * @returns {string}
 */
export function getApiKey(provider) {
  // provider를 검증
  assertProviderName(provider);

  // 기존에 저장된 credentials를 불러온다.
  const credentials = loadCredentials();

  // credentials에서 provider의 API Key를 가져온다.
  const apiKey = credentials?.[provider]?.apiKey;

  // API Key가 없거나 공백이면 null을 반환한다.
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return null;
  }

  // API Key를 반환한다.
  return apiKey;
}
