import { createProviderHTTPError } from "./errors.js";

// 기본 타임아웃 시간(60초)
const DEFAULT_TIMEOUT_MS = 60000;
// 검증되지 않은 API 메시지 문구
const UNVERIFIED_API_MESSAGE =
  "Antigravity API is experimental and not confirmed to be OpenAI-compatible. Set experimentalAntigravity=true and provide an explicit baseURL to use it.";

/**
 * Antigravity는 공식 API baseURL과 OpenAI-compatible 계약이 아직 검증되지 않았습니다.
 * 그래서 기본 endpoint를 절대 추정하지 않고, 사용자가 실험 기능 opt-in과 baseURL을 둘 다 제공할 때만 요청합니다.
 *
 * @param {object} config - 설정 객체.
 * @returns {string} - Antigravity API의 기본 URL.
 */
function resolveExperimentalBaseURL(config = {}) {
  // Antigravity 실험 기능이 활성화되지 않았으면 에러를 던집니다.
  if (config.experimentalAntigravity !== true) {
    throw new Error(UNVERIFIED_API_MESSAGE);
  }

  // Antigravity 설정이 없거나 baseURL이 없으면 에러를 던집니다.
  if (
    typeof config.baseURL !== "string" ||
    config.baseURL.trim().length === 0
  ) {
    throw new Error(UNVERIFIED_API_MESSAGE);
  }
  // baseURL에서 공백을 제거한 후, 문자열의 끝에 있는 하나 이상의 슬래시를 제거합니다.
  return config.baseURL.trim().replace(/\/+$/u, "");
}

/**
 * 현재 구현은 사용자가 명시한 endpoint가 OpenAI-compatible이라고 직접 검증한 경우에만 동작합니다.
 * 공식 계약이 나오기 전까지는 baseURL 기본값, 기본 모델명, 안정 기능처럼 보이는 fallback을 제공하지 않습니다.
 *
 * @param {object} params - 파라미터 객체.
 * @param {string} params.prompt - 커밋 메시지를 생성하기 위한 프롬프트.
 * @param {object} params.config - 설정 객체.
 * @param {object} params.headers - HTTP 헤더 객체.
 * @returns {Promise<string>} - 생성된 커밋 메시지.
 */
export async function generateCommitMessage({
  prompt,
  config = {},
  headers = {},
}) {
  // 프롬프트가 유효한지 확인합니다.
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new TypeError("prompt must be a non-empty string");
  }

  // baseURL을 확인합니다.
  const baseURL = resolveExperimentalBaseURL(config);
  // modelVersion을 확인합니다.
  const modelVersion = config.modelVersion;
  // modelVersion이 문자열이 아니거나 공백ㄴ이면 에러를 던집니다.
  if (typeof modelVersion !== "string" || modelVersion.trim().length === 0) {
    throw new Error(
      "Antigravity experimental requests require an explicit modelVersion.",
    );
  }

  // 요청 시간 초과를 위한 AbortController 생성.
  const controller = new AbortController();
  // timeout 시간 설정
  const timeout = setTimeout(
    // timeout 시간 초과 시 요청을 중단합니다.
    () => controller.abort(),
    // timeout 시간
    // config에 있는 timeoutMs값 또는 기본 timeout 시간 사용.ㄴ
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // HTTP 요청
  try {
    // fetch API를 사용하여 HTTP 요청을 보냅니다.
    // URL은 baseURL과 /chat/completions를 합친 값입니다.
    const response = await fetch(`${baseURL}/chat/completions`, {
      // HTTP 메서드는 POST입니다.
      method: "POST",
      // HTTP 헤더
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      // HTTP 요청 본문
      body: JSON.stringify({
        model: modelVersion.trim(),
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      // 요청 취소를 위한 signal
      signal: controller.signal,
    });

    // HTTP 응답이 성공적이지 않은 경우
    if (!response.ok) {
      // Provider HTTP 에러 생성
      throw createProviderHTTPError({
        provider: "Antigravity",
        action: "commit message",
        response,
      });
    }

    // HTTP 응답을 JSON으로 파싱.
    const payload = await response.json();
    // 커밋 메시지 추출.
    const message = payload?.choices?.[0]?.message?.content;

    // 커밋 메시지가 유효한지 확인.
    // 메시지가 문자열이 아니거나 빈 문자열이면 에러를 던짐.
    if (typeof message !== "string" || message.trim().length === 0) {
      throw new Error("Antigravity response did not include a commit message.");
    }

    // 커밋 메시지 반환.
    return message.trim();
  } finally {
    // timeout 설정 해제.
    clearTimeout(timeout);
  }
}

/**
 * 모델 목록 조회도 명시 opt-in/baseURL 없이는 외부 요청을 하지 않습니다.
 *
 * @param {object} config - 설정 객체.
 * @param {object} options - 옵션 객체.
 * @param {object} options.headers - HTTP 헤더 객체.
 * @returns {Promise<string[]>} - 모델 목록.
 */
export async function listModels(config = {}, { headers = {} } = {}) {
  // baseURL 확인.
  const baseURL = resolveExperimentalBaseURL(config);
  // 요청 취소를 위한 controller 생성.
  const controller = new AbortController();
  // timeout 설정.
  const timeout = setTimeout(
    // timeout 시간 초과 시 요청을 중단합니다.
    () => controller.abort(),
    // timeout 시간
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    // fetch API를 사용하여 HTTP 요청을 보냅니다.
    // URL은 baseURL과 /models를 합친 값입니다.
    const response = await fetch(`${baseURL}/models`, {
      // HTTP 메서드는 GET입니다.
      method: "GET",
      // HTTP 헤더
      headers: {
        accept: "application/json",
        ...headers,
      },
      // 요청 취소를 위한 signal
      signal: controller.signal,
    });

    // HTTP 응답이 성공적이지 않은 경우
    if (!response.ok) {
      // Provider HTTP 에러 생성
      throw createProviderHTTPError({
        provider: "Antigravity",
        action: "model list",
        response,
      });
    }
    // HTTP 응답을 JSON으로 파싱.
    const payload = await response.json();
    // data가 배열이 아니면 빈 배열로 초기화.
    const models = Array.isArray(payload?.data) ? payload.data : [];

    return (
      models
        // model id 추출.
        .map((model) => (typeof model === "string" ? model : model?.id))
        // 유효한 model id만 필터링.
        .filter((model) => typeof model === "string" && model.trim().length > 0)
    );
  } finally {
    // timeout 설정 해제.
    clearTimeout(timeout);
  }
}

/**
 * Antigravity 모델 설정의 유효성을 검사합니다.
 * @param {object} config - 설정 객체.
 * @returns {boolean} - 설정이 유효하면 true.
 */
export function validateConfig(config = {}) {
  // 설정 확인.
  resolveExperimentalBaseURL(config);
  // 설정이 유효하면 true 반환.
  return true;
}
