import {
  PROVIDERS,
  SUPPORTED_LANGUAGES,
  SUPPORTED_MODES,
} from "../config/defaults.js";

export function isValidMode(mode) {
  return SUPPORTED_MODES.includes(mode);
}

export function isValidLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

export function isValidProvider(provider) {
  return PROVIDERS.includes(provider);
}

/**
 * --model 설정에서 허용하는 인증 방식을 검증합니다.
 * localLLM은 `none`, Gemini/OpenAI-compatible은 `api` 또는 `oauth`를 지원할 예정입니다.
 */
export function isValidAuthType(authType) {
  return ["none", "api", "oauth"].includes(authType);
}

/**
 * modelVersion은 각 Provider 내부에서 모델을 식별하는 고유 값이므로 비어 있지 않은 문자열인지 확인합니다.
 */
export function isValidModelVersion(modelVersion) {
  return typeof modelVersion === "string" && modelVersion.trim().length > 0;
}

/**
 * baseURL이 fetch API에서 사용할 수 있는 올바른 http/https 형식인지 검증합니다.
 *
 * [상세 설명]
 * - localLLM 서버 주소가 잘못 입력되었을 때 발생하는 불분명한 네트워크 에러를 방지하기 위해 조기에 형식을 체크합니다.
 * - URL 객체 파싱을 통해 프로토콜까지 확인합니다.
 */
export function isValidBaseURL(baseURL) {
  if (typeof baseURL !== "string" || baseURL.trim().length === 0) {
    return false;
  }
  // parsedURL을 사용해서 프로토콜을 확인합니다.
  try {
    const parsedURL = new URL(baseURL);
    // http 또는 https 프로토콜인지 확인합니다.
    return parsedURL.protocol === "http:" || parsedURL.protocol === "https:";
  } catch {
    // 유효하지 않은 URL 형식입니다.
    return false;
  }
}
