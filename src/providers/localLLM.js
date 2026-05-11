import { DEFAULT_LOCAL_LLM_BASE_URL } from "../config/defaults.js";
import { isValidBaseURL } from "../utils/validator.js";

// 로컬 서버가 꺼져 있거나 응답이 늦을 경우 CLI가 무한히 대기하는 것을 방지하기 위한 Timeout(기본 5초)
// 로컬 LLM의 생성(Inference) 작업은 시간이 오래 걸릴 수 있으므로 별도의 긴 타임아웃(기본 60초)을 설정합니다.
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_GENERATE_TIMEOUT_MS = 60000;

/**
 * localLLM 설정을 실제 요청에 사용할 수 있는 형태로 정규화합니다.
 * 사용자가 `convention --model localLLM` 처럼 최소한의 정보만 입력한 경우에도
 * 기본값(none 인증, 기본 baseURL)을 보완하여 이후 로직에서 에러가 발생하지 않게 합니다.
 */
export function normalizeLocalLLMConfig(config = {}) {
  return {
    ...config,
    provider: "localLLM",
    authType: config.authType ?? "none",
    baseURL: config.baseURL || DEFAULT_LOCAL_LLM_BASE_URL,
  };
}

/**
 * localLLM은 로컬 네트워크 내에서 동작하므로 외부 API Key가 필요한 인증 방식을 거부합니다.
 * 잘못된 URL이 설정될 경우 fetch 단계에서 모호한 에러가 발생할 수 있으므로,
 * 조기에 baseURL 형식을 검증하여 사용자에게 명확한 피드백을 제공합니다.
 */
export function validateConfig(config = {}) {
  const normalizedConfig = normalizeLocalLLMConfig(config);
  if (normalizedConfig.authType !== "none") {
    throw new Error('localLLM provider는 authType "none"만 지원합니다.');
  }

  if (!isValidBaseURL(normalizedConfig.baseURL)) {
    throw new Error("localLLM baseURL must be a valid http(s) URL.");
  }

  return true;
}

// URL의 마지막 슬래시 제거
function trimTrailingSlash(value) {
  return value.replace(/\/+$/u, "");
}

// OpenAI 호환 모델 목록 조회 엔드포인트인 `/models`를 baseURL 뒤에 안전하게 붙입니다.
function buildModelsURL(baseURL) {
  return `${trimTrailingSlash(baseURL)}/models`;
}

/**
 * 로컬 서버가 꺼져 있거나 응답이 늦을 경우 CLI가 무한히 대기하는 것을 방지하기 위해
 * AbortController를 이용한 Timeout(기본 5초) 처리를 수행합니다.
 */
async function fetchJSON(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Timeout(기본 5초) 처리를 수행합니다.
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    // HTTP 상태 코드가 200-299가 아닐 경우 에러 발생
    if (!response.ok) {
      throw new Error(`localLLM 요청 실패 (상태 코드: ${response.status})`);
    }

    // JSON 파싱
    return await response.json();
  } finally {
    // Timeout(기본 5초) 처리를 해제
    clearTimeout(timeout);
  }
}

/**
 * OpenAI 호환 API(`data: [...]`)와 일부 로컬 서버의 변형된 응답(`models: [...]`)에서
 * 사용 가능한 모델 ID(또는 이름)를 안전하게 추출합니다.
 */
export function parseModelIds(payload) {
  const candidates = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];

  // 모델 ID(또는 이름)를 안전하게 추출
  return (
    candidates
      // 모델 ID(또는 이름)를 추출
      .map((model) => {
        if (typeof model === "string") {
          return model;
        }

        return model?.id ?? model?.name ?? model?.model;
      })
      // filter를 통해 유효한 모델 ID만 반환
      .filter(
        (modelId) => typeof modelId === "string" && modelId.trim().length > 0,
      )
  );
}

/**
 * 서버가 응답 가능한 상태인지 boolean 값으로 반환합니다.
 * 이 단계에서는 상세 에러보다는 '연결 가능 여부' 자체에 집중하여 상위 계층에서 활용하게 합니다.
 */
export async function checkConnection(config = {}) {
  const normalizedConfig = normalizeLocalLLMConfig(config);
  validateConfig(normalizedConfig);

  // 로컬 LLM 서버가 응답 가능한 상태인지 확인
  try {
    await fetchJSON(
      buildModelsURL(normalizedConfig.baseURL),
      normalizedConfig.timeoutMs,
    );
    // 응답 가능
    return true;
  } catch {
    // 연결 실패
    return false;
  }
}

/**
 * 로컬 서버에서 사용 가능한 모델 목록을 가져옵니다.
 * 서버 미기동 시 사용자가 취해야 할 조치(Ollama/LM Studio 실행 확인 등)를 에러 메시지에 포함합니다.
 */
export async function listModels(config = {}) {
  // 설정을 정규화하고 유효성을 검증
  const normalizedConfig = normalizeLocalLLMConfig(config);
  validateConfig(normalizedConfig);

  // 로컬 LLM 서버에서 모델 목록을 가져옴
  let payload;

  // 로컬 LLM 서버에 연결 시도 (Timeout 기본 5초)
  try {
    payload = await fetchJSON(
      buildModelsURL(normalizedConfig.baseURL),
      normalizedConfig.timeoutMs,
    );
    // 연결 실패
  } catch {
    throw new Error(
      "로컬 LLM 서버에 연결할 수 없습니다. Ollama 또는 LM Studio가 실행 중인지 확인해 주세요.",
    );
  }

  // 모델 ID(또는 이름)를 안전하게 추출
  const modelIds = parseModelIds(payload);

  // 유효한 모델 ID가 없는 경우
  if (modelIds.length === 0) {
    throw new Error("로컬 LLM 서버에서 사용할 수 있는 모델을 찾지 못했습니다.");
  }

  // modelID 반환
  return modelIds;
}

/**
 * 로컬 LLM 서버의 Chat Completions 엔드포인트를 호출하여 커밋 메시지를 생성합니다.
 *
 * [특이사항]
 * - 로컬 환경이므로 API Key 없이 동작합니다.
 * - temperature를 낮게(0.2) 설정하여 일관된 컨벤션 준수 결과를 유도합니다.
 * - AbortController를 통해 네트워크 타임아웃을 관리합니다.
 */
export async function generateCommitMessage({ prompt, config = {} }) {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new TypeError("prompt는 비어 있지 않은 문자열이어야 합니다.");
  }
  // 설정 정규화 및 유효성 검증
  const normalizedConfig = normalizeLocalLLMConfig(config);
  validateConfig(normalizedConfig);

  // modelVersion 설정이 필요한지 확인
  if (!normalizedConfig.modelVersion) {
    throw new Error("localLLM modelVersion 설정이 필요합니다.");
  }

  // Chat Completions 엔드포인트 URL 생성
  const chatCompletionsURL = `${trimTrailingSlash(normalizedConfig.baseURL)}/chat/completions`;
  // AbortController 지정
  const controller = new AbortController();
  // setTimeout으로 Timeout 설정
  // 60초(기본값) 내에 응답이 없으면 AbortController를 호출하여 요청을 중단
  const timeout = setTimeout(
    () => controller.abort(),
    normalizedConfig.timeoutMs ?? DEFAULT_GENERATE_TIMEOUT_MS,
  );

  try {
    // 로컬 LLM 서버에 POST 요청
    const response = await fetch(chatCompletionsURL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: normalizedConfig.modelVersion,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      // signal
      // controller.signal을 통해 지정된 시간(5초) 내에 응답이 없으면 요청을 중단
      signal: controller.signal,
    });

    // HTTP 상태 코드가 200-299가 아닐 경우 에러 발생
    if (!response.ok) {
      throw new Error("localLLM 커밋 메시지 생성 요청에 실패했습니다.");
    }
    // 응답 JSON 파싱
    const payload = await response.json();
    // 커밋 메시지 추출
    const message = payload?.choices?.[0]?.message?.content;

    // 커밋 메시지가 비어 있을 경우 에러 발생
    if (typeof message !== "string" || message.trim().length === 0) {
      throw new Error(
        "localLLM 응답에 커밋 메시지 내용이 포함되어 있지 않습니다.",
      );
    }
    // 커밋 메시지 반환
    return message.trim();
  } finally {
    // Timeout 설정 해제
    clearTimeout(timeout);
  }
}
