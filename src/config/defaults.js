// 사용자 설정 파일이 아직 없을 때 CLI가 공통으로 사용하는 1차 MVP 기본 설정값입니다.
// 이후 설정 저장/로드 로직은 이 객체를 기준으로 누락된 사용자 설정을 보완합니다.
export const DEFAULT_CONFIG = {
  // 기본 커밋 모드입니다. "step"은 변경 파일별로 커밋 메시지를 생성하는 흐름입니다.
  mode: "step",
  // 기본 커밋 메시지 언어입니다. "ko"는 한국어 메시지 생성을 의미합니다.
  language: "ko",
  // 1차 MVP에서는 실제 외부 AI Provider를 아직 선택하지 않은 초기 상태를 허용합니다.
  provider: null,
  // API Key, OAuth 등 인증 방식은 Provider 확장 단계에서 설정되므로 기본값은 null입니다.
  authType: null,
  // 실제 모델 버전은 --model 확장 단계에서 설정되므로 초기에는 비워 둡니다.
  modelVersion: null,
  // OpenAI-compatible 또는 local LLM endpoint가 필요할 때 사용할 URL이며, 기본값은 미설정입니다.
  baseURL: null,
  // 사용자에게 표시할 모델 이름입니다. Provider/모델 선택 전에는 null 상태를 유지합니다.
  modelDisplayName: null,
  // Git 히스토리 보호를 위해 AI 메시지를 생성해도 커밋 전 사용자 확인을 기본으로 요구합니다.
  confirmBeforeCommit: true,
};

// CLI 설정값 검증과 command 분기에서 재사용할 수 있는 지원 커밋 모드 목록입니다.
export const SUPPORTED_MODES = ["step", "batch"];

// CLI 설정값 검증과 prompt 언어 선택에서 재사용할 수 있는 지원 언어 목록입니다.
export const SUPPORTED_LANGUAGES = ["ko", "en", "jp", "cn"];

/**
 * 2차 MVP에서 실제 설정 및 라우팅 대상으로 다루는 Provider 목록입니다.
 * mock(테스트용), localLLM(로컬 서버용), gemini(클라우드용) 등이 포함됩니다.
 */
export const PROVIDERS = ["mock", "localLLM", "gemini", "openaiCompatible"];

/**
 * localLLM의 기준 endpoint입니다. Ollama의 기본 포트인 11434를 기본값으로 사용합니다.
 * OpenAI 호환 API를 제공하는 서버들이 주로 사용하는 `/v1` 경로를 포함합니다.
 */
export const DEFAULT_LOCAL_LLM_BASE_URL = "http://localhost:11434/v1";

/**
 * 지원 계획이 확정된 Stable Provider와 실험적인 Experimental Provider를 분리하여 정의합니다.
 */
export const STABLE_PROVIDERS = [
  "gemini",
  "github-copilot",
  "codex",
  "claude",
  "grok",
  "deepseek",
  "kimi",
  "glm",
  "localLLM",
];

/**
 * 실험적인 Provider 목록입니다.
 */
export const EXPERIMENTAL_PROVIDERS = ["antigravity", "manus"];
