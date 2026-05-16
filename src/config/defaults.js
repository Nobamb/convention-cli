// 사용자 설정 파일이 아직 없을 때 CLI가 공통으로 사용하는 기본 설정값입니다.
// 3차 고도화부터는 설정 항목이 계속 늘어나므로, 이 파일의 DEFAULT_CONFIG가 migration 기준 schema 역할도 합니다.
export const CURRENT_CONFIG_VERSION = 3;

export const DEFAULT_CONFIG = {
  // 3차 고도화부터 설정 schema migration을 위해 현재 config 구조 버전을 기록합니다.
  configVersion: CURRENT_CONFIG_VERSION,
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
  // 커밋 전 생성된 메시지와 파일 요약을 보여주는 3차 UX 기본값입니다.
  previewBeforeCommit: true,
  // AI 메시지 재생성 무한 루프를 막기 위한 기본 제한값입니다.
  maxRegenerateCount: 3,
  // 팀 컨벤션 템플릿은 Phase 4에서 확장하며, 초기값은 미설정입니다.
  template: null,
  // 외부 AI Provider로 코드를 보낼 때 사용자 확인을 받을지 여부입니다.
  // "always": 매번 확인, "once": 첫 번째 전송 시에만 확인, "never": 확인 없이 바로 전송
  confirmExternalTransmission: "always",
  // 대용량 diff 처리 여부를 판단하기 위한 기본 임계값입니다.
  largeDiffThreshold: {
    // diff 문자열 전체 길이가 이 값을 넘으면 chunking 후보가 됩니다.
    maxCharacters: 10000,
    // 변경 파일 수가 이 값을 넘으면 대용량 변경으로 간주할 수 있습니다.
    maxFiles: 10,
    // diff line 수가 이 값을 넘으면 요약 흐름으로 전환할 수 있습니다.
    maxLines: 300,
  },
  // npm update check 기능의 기본 활성화 여부입니다. Phase 7에서 실제 동작과 연결됩니다.
  updateCheck: true,
  // 마지막 update check 시각입니다. null이면 아직 확인한 적이 없다는 의미입니다.
  lastUpdateCheckAt: null,
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
