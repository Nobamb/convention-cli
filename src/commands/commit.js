import {
  DEFAULT_CONFIG,
  DEFAULT_LOCAL_LLM_BASE_URL,
} from "../config/defaults.js";
import { promptApiKey, saveApiKey } from "../auth/apiKey.js";
import { setupModelInteractively } from "./model.js";
import { loadConfig, saveConfig } from "../config/store.js";
import { loadValidatedTemplate } from "../templates/loader.js";
import { cleanAIResponse, generateLargeDiffCommitMessage } from "../core/ai.js";
import {
  addFile,
  commit,
  getChangedFiles,
  getFileDiffs,
  isGitRepository,
  push,
} from "../core/git.js";
import { maskSensitiveDiff } from "../core/security.js";
import { classifyChangedFiles, groupFilesByIntent } from "../core/grouping.js";
import { isUsageExhaustedError } from "../providers/errors.js";
import { error, info, success, warn } from "../utils/logger.js";
import {
  COMMIT_DECISIONS,
  GROUPING_DECISIONS,
  previewGrouping,
  selectGroupingDecision,
  confirmAction,
  confirmExternalAITransmission,
  previewCommitMessage,
  promptCommitMessageEdit,
  selectAIUsageExhaustedAction,
  selectCommitDecision,
  selectLocalLLMFallbackPolicy,
  selectLocalLLMFailureAction,
  selectPostFallbackConfigAction,
} from "../utils/ui.js";
import { isValidMode } from "../utils/validator.js";

const LOCAL_LLM_LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

/**
 * 실제 커밋 작업에 사용할 설정을 읽고 기본값을 보정합니다.
 *
 * `loadConfig()`는 설정 파일이 없거나 깨진 경우에도 `DEFAULT_CONFIG`를 반환하도록 설계되어 있지만,
 * command 계층에서도 language/provider/confirmBeforeCommit 같은 값이 누락될 수 있다는 전제로 한 번 더
 * 병합합니다. 이렇게 해두면 이후 `--model` 확장이나 사용자가 직접 수정한 config 파일 때문에 일부 필드가
 * 빠져도 1차 MVP commit flow가 예측 가능한 기본값으로 동작합니다.
 */
function loadRuntimeConfig() {
  const templateResult = loadValidatedTemplate();

  // 템플릿에 문제가 있는 경우 워닝 로그 출력
  for (const warningMessage of templateResult.warnings) {
    warn(warningMessage);
  }

  // 기본 설정과 설정 파일을 병합하고, 템플릿을 추가합니다.
  return {
    ...DEFAULT_CONFIG,
    ...loadConfig(),
    template: templateResult.template,
  };
}

/**
 * 사용자 확인이 필요한지 판단한 뒤 commit 승인 여부를 반환합니다.
 *
 * `confirmBeforeCommit`의 1차 MVP 기본값은 true입니다. false로 명시된 경우는 테스트나 사용자가 의도한
 * 자동화 환경으로 보고 confirm prompt를 생략합니다. 그 외에는 반드시 정리된 commit message를 보여준 뒤
 * 승인 여부를 받아 Git 히스토리 변경을 보호합니다.
 */
/**
 * 로컬 LLM이 로컬 호스트를 가리키는지 확인합니다.
 *
 * @param {*} baseURL
 * @returns
 */
function isLocalLLMBaseURLLocal(baseURL) {
  // URL 객체를 사용하여 host 추출
  // 기본값: DEFAULT_LOCAL_LLM_BASE_URL
  // baseURL이 존재하지 않거나 유효하지 않으면 false 반환
  try {
    const parsedURL = new URL(baseURL || DEFAULT_LOCAL_LLM_BASE_URL);
    return LOCAL_LLM_LOCAL_HOSTNAMES.has(parsedURL.hostname);
  } catch {
    return false;
  }
}

/**
 * 외부 AI Provider 인지 확인합니다.
 * @param {*} config
 * @returns
 */
function isExternalAIProvider(config = {}) {
  // gemini 또는 openaiCompatible이면 외부 AI Provider
  if (config.provider === "gemini" || config.provider === "openaiCompatible") {
    return true;
  }

  // localLLM이고 local hostname이면 로컬 AI Provider
  if (config.provider === "localLLM") {
    return !isLocalLLMBaseURLLocal(config.baseURL);
  }

  // 그 외의 경우는 false
  return false;
}

/**
 * 외부 AI Provider로 코드를 전송하기 전 사용자 승인을 확인합니다.
 * "confirmExternalTransmission" 설정에 따라 매번 묻거나, 한 번만 묻거나, 묻지 않습니다.
 *
 * @param {Object} config - 사용자 설정
 * @param {Object} options - UI용 추가 정보 (file 등)
 * @param {Object} sessionState - 현재 실행 세션 내의 승인 상태를 저장하는 객체
 * @returns {Promise<boolean>} 전송 승인 여부
 */
async function shouldSendDiffToAI(config, options = {}, sessionState = {}) {
  // 외부 AI Provider가 아니면(Mock, 로컬LLM 등) 사용자 확인 없이 true 반환
  if (!isExternalAIProvider(config)) {
    return true;
  }

  const mode = config.confirmExternalTransmission || "always";
  let forcePrompt = false;
  let warningMessage = "";

  // 민감 정보 강제 검사 (diff가 제공된 경우)
  if (options.diff) {
    const result = maskSensitiveDiff(options.diff);
    if (result.found) {
      forcePrompt = true;
      warningMessage =
        "⚠️ 민감정보 탐지됨! 코드를 외부로 전송하기 전 반드시 확인하세요.";
    }
  }

  // 강제 확인 조건이 아니면서 "never" 모드이면 확인 없이 승인
  if (!forcePrompt && mode === "never") {
    return true;
  }

  // 강제 확인 조건이 아니면서 "once" 모드이고 이미 이번 세션에서 승인받았다면 바로 승인
  if (
    !forcePrompt &&
    mode === "once" &&
    sessionState.externalTransmissionApproved
  ) {
    return true;
  }

  // 그 외(always, once의 첫 시도, 또는 민감정보 탐지로 인한 강제 프롬프트)에는 사용자에게 확인
  const approved = await confirmExternalAITransmission({
    provider: config.provider,
    baseURL: config.baseURL,
    warning: warningMessage,
    ...options,
  });

  // "once" 모드에서 승인한 경우 (정상 승인인 경우에만) 다음 파일부터는 묻지 않도록 세션 상태 기록
  if (approved && mode === "once" && !forcePrompt) {
    sessionState.externalTransmissionApproved = true;
  }

  return approved;
}

/**
 * 민감 정보를 마스킹한 diff를 반환합니다.
 * @param {*} diff
 * @param {*} config
 * @returns
 */
function prepareDiffForAI(diff, config) {
  // 외부 AI Provider가 아니면 diff 반환
  if (!isExternalAIProvider(config)) {
    return diff;
  }

  // 민감 정보 마스킹
  const result = maskSensitiveDiff(diff);

  // 민감 정보가 발견되면 경고 로그 출력
  if (result.found) {
    warn(
      "Sensitive-looking values were found in the Git diff and masked before external AI transmission.",
    );
  }

  // 마스킹된 diff 반환
  return result.diff;
}

/**
 * 파일별 diff를 AI 처리에 적합한 형태로 준비합니다.
 *
 * 외부 AI Provider를 사용하고, 해당 provider의 설정에 따라 diff를 마스킹할지 결정합니다.
 * 1. 내부 제공 모델(gemini 등)을 사용하는 경우에는 원본 diff를 그대로 전달합니다.
 * 2. 외부 제공 모델을 사용하는 경우(외부 AI provider)에는 `maskSensitiveDiff` 함수를 호출하여
 *    민감해 보이는 값을 마스킹 처리한 후 반환합니다.
 *
 * @param {Array<Object>} fileDiffs - 파일별 diff 정보 배열
 * @param {Object} config - AI 설정 객체
 * @returns {Array<Object>} AI 처리에 사용될 준비된 파일별 diff 정보 배열
 */

function prepareFileDiffsForAI(fileDiffs, config) {
  if (!Array.isArray(fileDiffs)) {
    return [];
  }

  // 대용량 diff chunk 요약도 외부 provider 호출 전에 같은 마스킹 정책을 거칩니다.
  return fileDiffs.map((entry) => ({
    ...entry,
    diff: prepareDiffForAI(entry.diff, config),
  }));
}

/**
 * 현재 provider가 새 API Key 입력 후 재시도할 수 있는지 판단합니다.
 *
 * localLLM은 일반적으로 API Key가 필요하지 않으므로 key 교체 선택지를 숨깁니다.
 * openaiCompatible은 authType이 api일 때만 Authorization header를 쓰는 설정으로 간주합니다.
 */
function canRetryWithApiKey(config = {}) {
  return (
    config.authType === "api" &&
    (config.provider === "gemini" || config.provider === "openaiCompatible")
  );
}

/**
 * 429/사용량 소진 오류 이후 사용자가 고른 복구 동작을 적용하고 다음 재시도 config를 반환합니다.
 *
 * API Key 교체는 credentials.json에만 저장하고, 이번 재시도에는 메모리 config.apiKey도 갱신합니다.
 * 이렇게 해야 기존 실행 중 config에 오래된 apiKey가 들어 있더라도 새 key로 즉시 재시도할 수 있습니다.
 */
async function recoverFromUsageExhaustedError(config) {
  const action = await selectAIUsageExhaustedAction({
    allowApiKey: canRetryWithApiKey(config),
  });

  if (action === "replaceApiKey") {
    const apiKey = await promptApiKey(config.provider);
    saveApiKey(config.provider, apiKey);

    // 새 API Key를 포함한 최신 설정을 반환합니다.
    return {
      stopped: false,
      config: {
        ...loadRuntimeConfig(),
        provider: config.provider,
        authType: config.authType,
        modelVersion: config.modelVersion,
        modelDisplayName: config.modelDisplayName,
        baseURL: config.baseURL,
        apiKey,
      },
    };
  }

  if (action === "switchModel") {
    // 기존 --model 대화형 설정 flow를 그대로 재사용해 provider/model/baseURL 저장 규칙을 한곳에 유지합니다.
    // 설정이 바뀐 뒤에는 loadRuntimeConfig()로 다시 읽어 다음 AI 호출과 전송 확인에 반영합니다.
    await setupModelInteractively();

    return {
      stopped: false,
      config: loadRuntimeConfig(),
    };
  }

  // stop 또는 prompt 취소는 모두 안전 중단으로 처리합니다. 아직 add/commit 전이므로 Git 히스토리 변경되지 않습니다.
  return {
    stopped: true,
    config,
  };
}

/**
 * 429 복구 이후 외부 전송 승인 상태를 다시 확인해야 하는지 판단합니다.
 *
 * 특히 `confirmExternalTransmission: "once"`는 "이번 실행에서 같은 외부 전송 대상에 대해 한 번 승인"이라는 의미로
 * 다뤄야 합니다. 429 이후 provider, baseURL, modelVersion, authType 등이 바뀌면 diff가 다른 외부 endpoint로 전송될 수 있으므로
 * 이전 승인 상태를 재사용하지 않고 다음 retry에서 다시 확인 질문을 띄웁니다.
 */
function shouldResetExternalTransmissionApproval(
  previousConfig = {},
  nextConfig = {},
) {
  return (
    previousConfig.provider !== nextConfig.provider ||
    previousConfig.baseURL !== nextConfig.baseURL ||
    previousConfig.modelVersion !== nextConfig.modelVersion ||
    previousConfig.authType !== nextConfig.authType
  );
}

/**
 * 세션 중 임시로 보관할 config를 복사합니다.
 *
 * config 객체에는 복구 과정에서 메모리 전용 apiKey가 붙을 수 있으므로
 * 원래 localLLM 복원용 snapshot에는 secret 성격의 값을 남기지 않습니다.
 * saveConfig()도 secret 제거를 수행하지만 세션 상태 자체도 secret을 들고 있지 않는 편이 안전합니다.
 */
function cloneConfigWithoutRuntimeSecrets(config = {}) {
  const { apiKey, token, secret, password, ...safeConfig } = config || {};
  return {
    ...safeConfig,
  };
}

/**
 * 현재 오류가 localLLM 응답 불능으로 복구 가능한 상황인지 판단합니다.
 *
 * localLLM은 대용량 diff를 처리하다가 AbortError, fetch failed, 빈 응답, HTTP 5xx 같은 형태로
 * 실패할 수 있습니다. 이 경우 Git 작업을 바로 중단하지 않고 사용자가 대체 모델/API를 고를 수 있게 합니다.
 */
function isLocalLLMUnavailableError(error, config = {}) {
  if (config.provider !== "localLLM") {
    return false;
  }

  // 429는 기존 사용량/rate limit 복구 흐름에서 처리하므로 여기서는 제외합니다.
  if (isUsageExhaustedError(error)) {
    return false;
  }

  // localLLM provider에서 발생한 그 밖의 생성 실패는 현재 diff를 처리하지 못한 상태로 간주합니다.
  return true;
}

/**
 * localLLM 실패 시 사용자 선택에 따라 현재 파일 건너뛰기, 전체 중단,
 * 또는 다른 localLLM/Cloud API provider로 전환 후 재시도를 준비합니다.
 *
 * setupModelInteractively()는 기존 --model 설정 flow를 재사용하므로 API Key는 credentials.json에만 저장되고
 * Cloud API로 바뀐 경우 createCommitMessageWithRecovery()의 다음 루프에서 외부 전송 확인 gate를 다시 통과합니다.
 */
async function recoverFromLocalLLMFailure(config, sessionState = {}) {
  // 최초 실패 시점의 localLLM 설정을 보관해 작업 종료 후 복원하거나 temporary 정책에서 다음 파일에 재사용합니다.
  if (!sessionState.originalLocalLLMConfig) {
    sessionState.originalLocalLLMConfig =
      cloneConfigWithoutRuntimeSecrets(config);
  }

  // convention 작업에 대한 사용자의 행동 정책을 결정합니다.
  const action = await selectLocalLLMFailureAction();

  // 사용자가 파일을 건너뛰기를 원하면 다음 파일 처리로 넘어갑니다.
  if (action === "skipFile") {
    return {
      skipped: true,
      stopped: false,
      config,
    };
  }

  // 사용자가 작업을 중단하기로 선택하면, 현재 세션을 종료합니다.
  if (action !== "switchModel") {
    return {
      stopped: true,
      config,
    };
  }

  // 사용자가 직접 다른 localLLM, gemini, openaiCompatible 등을 선택하도록 기존 모델 설정 UI를 재사용합니다.
  // 이 함수는 config.json을 갱신하므로 작업 종료 후 유지/복원 여부를 별도로 다시 묻습니다.
  const switchedConfig = await setupModelInteractively();
  sessionState.localLLMFallbackSwitched = true;

  const policy = await selectLocalLLMFallbackPolicy();
  sessionState.localLLMFallbackPolicy = policy;

  return {
    stopped: false,
    config: switchedConfig,
    // temporary 정책이면 현재 diff 재시도에만 대체 설정을 쓰고 다음 파일은 원래 localLLM 설정으로 돌아갑니다.
    configAfterSuccess:
      policy === "temporary"
        ? sessionState.originalLocalLLMConfig
        : switchedConfig,
  };
}

/**
 * localLLM 실패 복구 중 provider 설정이 바뀐 경우, convention 작업이 끝난 뒤
 * 사용자가 현재 대체 설정을 유지할지 원래 localLLM으로 복원할지 결정하게 합니다.
 */
async function finalizeLocalLLMFallbackConfig(sessionState = {}) {
  if (sessionState.localLLMFallbackFinalized) {
    return;
  }

  if (
    !sessionState.localLLMFallbackSwitched ||
    !sessionState.originalLocalLLMConfig
  ) {
    return;
  }

  // commit/push 예외와 finally 재진입에서도 같은 질문을 두 번 띄우지 않도록 먼저 완료 처리합니다.
  sessionState.localLLMFallbackFinalized = true;

  // convention 작업이 끝난 뒤, localLLM 장애 복구 과정에서 저장된 provider 설정의 유지 여부를 정합니다.
  const action = await selectPostFallbackConfigAction();

  // 사용자가 원래 localLLM으로 복원하기를 원하면 원래 localLLM 설정으로 복원합니다.
  if (action === "restoreOriginal") {
    saveConfig(sessionState.originalLocalLLMConfig);
    success("이전에 사용하던 localLLM 설정으로 복원했습니다.");
    return;
  }

  // 사용자가 현재 모델/API 설정을 유지하기로 선택하면, 현재 설정을 유지합니다.
  info("현재 모델/API 설정을 유지합니다.");
}

/**
 * diff가 존재하는 파일 목록만 기준으로 하나의 batch commit message를 생성합니다.
 *
 * `getChangedFiles()`에는 untracked-only 파일이나 민감 파일이 포함될 수 있습니다. 반면 `getFileDiffs()`는
 * diff가 비어 있거나 `.env`, key, credentials 계열로 분류되는 파일을 제외합니다. 따라서 batch mode에서도
 * AI prompt와 staging 대상은 반드시 `fileDiffs` 결과를 기준으로 삼아야 합니다.
 */
function collectCommittableFileDiffs() {
  // 변경된 파일 목록 수집
  const changedFiles = getChangedFiles();

  // 변경된 파일이 없으면 종료
  if (changedFiles.length === 0) {
    return { changedFiles, fileDiffs: [] };
  }

  // 변경된 파일 목록에서 diff 추출
  return {
    changedFiles,
    fileDiffs: getFileDiffs(changedFiles),
  };
}

/**
 * 파일별 diff 배열을 하나의 batch diff 문자열로 합칩니다.
 *
 * `getFullDiff()`도 내부적으로 민감 파일 제외를 수행하지만, batch commit에서 실제 staging 대상까지 같은
 * 기준으로 맞추기 위해 command 계층에서는 `getFileDiffs()` 결과를 직접 합칩니다. 이렇게 하면 prompt에
 * 들어간 파일과 커밋에 올라가는 파일이 달라지는 보안 사고를 줄일 수 있습니다.
 */
function joinDiffs(fileDiffs) {
  return fileDiffs.map(({ diff }) => diff).join("");
}

/**
 * 설정에서 재생성 최대 횟수를 읽습니다.
 * 잘못된 값이 저장되어 있어도 무한 루프가 생기지 않도록 DEFAULT_CONFIG 값으로 되돌립니다.
 */
function getMaxRegenerateCount(config = {}) {
  const value = Number(
    config.maxRegenerateCount ?? DEFAULT_CONFIG.maxRegenerateCount,
  );

  // 0도 허용합니다. 이 경우 Regenerate 선택지는 있어도 실제 재생성은 더 진행되지 않습니다.
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }

  return DEFAULT_CONFIG.maxRegenerateCount;
}

/**
 * commit decision flow의 마지막 단계에서만 호출하는 staging/commit helper입니다.
 * prompt 생성이나 preview 단계에서는 절대 이 함수를 부르지 않아 사용자 승인 전 Git 히스토리 변경을 막습니다.
 */
function stageAndCommit(message, filesToCommit) {
  // batch와 step 모두 같은 helper를 쓰되, filesToCommit으로 실제 staging 대상을 제한합니다.
  for (const file of filesToCommit) {
    addFile(file);
  }

  // core/git.js의 commit()은 argv 배열 방식으로 git commit -m을 실행하므로 shell 문자열 삽입 위험을 줄입니다.
  commit(message, filesToCommit);
}

/**
 * AI 커밋 메시지 생성부터 사용자 승인, 최종 커밋까지의 핵심 공통 흐름을 제어합니다.
 * AI가 생성한 메시지를 사용자에게 보여주고(preview), 사용자의 결정(커밋, 재생성, 수동 수정, 취소)에 따라 루프를 돕니다.
 * 이 과정에서 429(사용량 초과) 오류 복구와 재생성 횟수 제한 등을 함께 관리합니다.
 *
 * @param {Object} params
 * @param {string} params.diff - AI에게 전달할 전체 diff 문자열
 * @param {Array} params.fileDiffs - 파일별 diff 정보 배열 (대용량 diff 분석 및 요약에 사용)
 * @param {Array} params.files - 커밋 대상 파일 경로 배열
 * @param {string} params.file - (Step 모드) 현재 처리 중인 단일 파일명
 * @param {Object} params.config - 현재 실행 환경의 런타임 설정
 * @param {string} params.mode - 실행 모드 ('step' 또는 'batch')
 * @param {Object} params.groupInfo - 그룹 정보
 * @param {Object} params.sessionState - 외부 전송 승인 등 세션 전반의 상태를 유지하는 객체
 * @param {Object} params.transmissionOptions - UI 출력 시 파일명 등 컨텍스트 정보
 */
export async function runCommitDecisionFlow({
  diff,
  fileDiffs,
  files,
  file,
  config,
  mode,
  groupInfo,
  sessionState,
  transmissionOptions = {},
}) {
  // 429 복구나 model switch가 발생하면 config가 바뀔 수 있으므로 현재 flow 내부 상태로 관리합니다.
  let currentConfig = config;
  // 현재 preview/commit 대상 메시지입니다. 최초 생성, 재생성, 수동 수정 결과가 여기에 들어갑니다.
  let currentMessage = null;
  // Regenerate를 몇 번 수행했는지 세어 maxRegenerateCount를 넘기지 않게 합니다.
  let regenerateCount = 0;
  // 설정에서 재생성 제한을 읽고, 이상한 값은 기본값으로 보정합니다.
  const maxRegenerateCount = getMaxRegenerateCount(config);
  // step 모드는 file 하나, batch 모드는 files 배열을 commit 대상으로 사용합니다.
  const filesToCommit = Array.isArray(files) ? files : [file].filter(Boolean);

  // 최초 AI 메시지를 생성합니다. 이 함수 내부에서 외부 AI 전송 확인과 429 복구가 함께 처리됩니다.
  const generated = await createCommitMessageWithRecovery({
    diff,
    fileDiffs,
    files: filesToCommit,
    language: currentConfig.language,
    mode,
    groupInfo,
    config: currentConfig,
    transmissionOptions,
    sessionState,
  });

  // 사용자가 외부 AI 전송을 거부했거나 429 복구를 중단하면 Git 작업 없이 종료합니다.
  if (generated.stopped) {
    warn(
      "AI commit message generation was stopped. No staging or commit was performed.",
    );

    // 사용자가 파일을 건너뛰기를 원하면 다음 파일 처리로 넘어갑니다.
    if (generated.skipped) {
      return {
        committed: false,
        skipped: true,
        config: generated.config ?? currentConfig,
      };
    }

    // 사용자가 작업을 중단하기로 선택하면, 현재 세션을 종료합니다.
    return {
      committed: false,
      stopped: true,
      config: generated.config ?? currentConfig,
    };
  }

  // 429 복구 중 provider/model/API key가 바뀌었을 수 있으므로 최신 config를 반영합니다.
  currentConfig = generated.config ?? currentConfig;
  // cleanAIResponse()까지 끝난 메시지를 decision loop의 시작 메시지로 사용합니다.
  currentMessage = generated.message;

  // 기존 1차/2차 자동화 호환 경로입니다.
  // confirmBeforeCommit이 true가 아니면 preview/decision prompt를 띄우지 않고 기존처럼 바로 commit합니다.
  if (currentConfig.confirmBeforeCommit !== true) {
    stageAndCommit(currentMessage, filesToCommit);
    return { committed: true, config: currentConfig };
  }

  // confirmBeforeCommit=true일 때만 사용자 검토 loop에 들어갑니다.
  // Regenerate/Edit 후에도 continue로 다시 preview를 보여주기 위해 while 루프를 사용합니다.
  while (true) {
    // 빈 AI 응답이나 빈 수동 수정 결과는 commit하지 않습니다.
    if (
      typeof currentMessage !== "string" ||
      currentMessage.trim().length === 0
    ) {
      warn(
        "AI returned an empty commit message. No staging or commit was performed.",
      );
      return { committed: false, config: currentConfig };
    }

    // preview와 decision UI에 넘길 안전한 metadata입니다.
    // diff 원문은 여기에 포함하지 않아 화면 출력 경로로 흘러가지 않게 합니다.
    const context = {
      files: filesToCommit,
      file,
      mode,
      provider: currentConfig.provider,
      modelVersion: currentConfig.modelVersion,
      regenerateCount,
      maxRegenerateCount,
    };

    // 사용자에게 메시지/파일/mode/provider를 보여줍니다. diff 원문은 출력하지 않습니다.
    previewCommitMessage({ message: currentMessage, ...context });

    // 사용자의 다음 행동을 안정적인 enum 값으로 받습니다.
    const decision = await selectCommitDecision({
      message: currentMessage,
      ...context,
    });

    // Commit 선택일 때만 실제 staging과 commit을 수행합니다.
    if (decision === COMMIT_DECISIONS.COMMIT) {
      stageAndCommit(currentMessage, filesToCommit);
      return { committed: true, config: currentConfig };
    }

    // Cancel은 항상 Git 작업 없이 종료합니다.
    if (decision === COMMIT_DECISIONS.CANCEL) {
      warn("Commit was canceled. No staging or commit was performed.");
      return { committed: false, config: currentConfig };
    }

    // Edit manually는 AI 호출 없이 사용자 입력을 받아 현재 메시지를 교체합니다.
    if (decision === COMMIT_DECISIONS.EDIT) {
      const editedMessage = await promptCommitMessageEdit(currentMessage);

      // 수정 prompt 취소 또는 빈 입력은 commit하지 않고 종료합니다.
      if (!editedMessage) {
        warn(
          "Commit message edit was canceled. No staging or commit was performed.",
        );
        return { committed: false, config: currentConfig };
      }

      // 사용자가 입력한 문자열도 AI 응답과 동일한 정리 규칙을 통과시켜 git commit -m에 안전한 형태로 만듭니다.
      currentMessage = cleanAIResponse(editedMessage);
      continue;
    }

    // Regenerate는 같은 diff를 유지하고 이전 메시지만 prompt에 추가해 새 메시지를 요청합니다.
    if (decision === COMMIT_DECISIONS.REGENERATE) {
      // 제한 횟수에 도달하면 AI를 더 호출하지 않고 사용자가 commit/edit/cancel 중 고르게 합니다.
      if (regenerateCount >= maxRegenerateCount) {
        warn(
          "Maximum regenerate count reached. Choose commit, edit, or cancel.",
        );
        continue;
      }

      // 이번 재생성 시도를 카운트합니다.
      regenerateCount += 1;

      // previousMessage를 넘겨 prompt.js에서 "이전 메시지와 다른 표현" 지시를 추가하게 합니다.
      const regenerated = await createCommitMessageWithRecovery({
        diff,
        fileDiffs,
        files: filesToCommit,
        language: currentConfig.language,
        mode,
        groupInfo,
        config: currentConfig,
        previousMessage: currentMessage,
        transmissionOptions,
        sessionState,
      });

      // 재생성 중단/실패도 commit으로 fallback하지 않습니다.
      if (regenerated.stopped) {
        warn(
          "AI commit message regeneration was stopped. No staging or commit was performed.",
        );

        // 사용자가 파일을 건너뛰기를 원하면 다음 파일 처리로 넘어갑니다.
        if (regenerated.skipped) {
          return {
            committed: false,
            skipped: true,
            config: regenerated.config ?? currentConfig,
          };
        }

        // 사용자가 작업을 중단하기로 선택하면, 현재 세션을 종료합니다.
        return {
          committed: false,
          stopped: true,
          config: regenerated.config ?? currentConfig,
        };
      }

      // 복구 과정에서 config가 바뀌었을 수 있으므로 최신 config와 새 메시지를 반영합니다.
      currentConfig = regenerated.config ?? currentConfig;
      currentMessage = regenerated.message;
    }
  }
}

/**
 * 커밋이 완료된 후 원격 저장소로 push할지 확인하고 실행합니다.
 * @param {object} options 옵션
 * @param {boolean} options.push push 여부
 * @returns {Promise<void>}
 */
async function pushAfterSuccessfulCommit(options = {}) {
  // push는 원격 저장소에 Git 히스토리 전파하므로 새 커밋이 실제로 만들어진 뒤에만 실행합니다.
  if (!options.push) {
    return;
  }

  // push 확인은 commit message 확인과 별개입니다. confirmBeforeCommit=false는 커밋 확인만 생략하는 설정이므로,
  // 원격 히스토리를 바꾸는 push는 항상 별도 confirmAction 승인을 받아야 합니다.
  const approved = await confirmAction(
    "커밋이 완료되었습니다. 현재 브랜치를 원격 저장소로 push할까요?",
  );

  if (!approved) {
    warn(
      "사용자가 push를 취소했습니다. 로컬 커밋은 유지되고 원격 저장소는 변경되지 않았습니다.",
    );
    return;
  }

  // 실제 push는 core wrapper에 위임합니다. wrapper는 Git stderr를 그대로 노출하지 않아
  // remote URL, token, credential helper 출력 같은 민감 정보가 사용자 메시지에 섞이지 않게 합니다.
  push();
}

// 단계별 기본 fallback 의도들
const GROUP_FALLBACK_INTENTS = new Set([
  "feat",
  "fix",
  "refactor",
  "docs",
  "style",
  "test",
  "chore",
]);

/**
 * fileType 계약을 command 계층에서 정규화합니다.
 *
 * 현재 core/grouping.js 구현은 일부 환경에서 category를 반환할 수 있으므로,
 * 여기서는 fileType을 기준 계약으로 삼고 기존 grouping helper 호환을 위해 category만 보조로 채웁니다.
 */
function normalizeFileClassification(classification = {}) {
  // category fallback
  const fileType =
    classification.fileType || classification.category || "unknown";

  // category를 fileType으로 보정
  return {
    ...classification,
    fileType,
    category: fileType,
  };
}

/**
 * 외부 AI를 호출하지 않는 규칙 기반 intent fallback입니다.
 *
 * grouped preview 전에 파일별 AI 의도 분석을 수행하면 외부 전송 confirm gate를 우회할 수 있으므로,
 * 그룹 제안 단계에서는 로컬 규칙만 사용합니다. 실제 commit message 생성은 runCommitDecisionFlow 안에서
 * 기존 외부 AI 전송 확인과 preview/confirm gate를 그대로 거칩니다.
 */
function inferGroupedIntentByRules({ fileType, diff = "" }) {
  // docs, test, style, dependency, config, generated, unknown 파일은 각각 docs, test, style, chore로 추론합니다.
  if (fileType === "docs") return "docs";
  if (fileType === "test") return "test";
  if (fileType === "style") return "style";
  if (["dependency", "config", "generated", "unknown"].includes(fileType)) {
    return "chore";
  }

  // diff가 문자열이라면 소문자로 변환
  const lowerDiff = typeof diff === "string" ? diff.toLowerCase() : "";

  // diff에 fix, bug, error, exception, fail, failure, regression 키워드가 포함되어 있다면 fix로 추론
  if (/\b(fix|bug|error|exception|fail|failure|regression)\b/.test(lowerDiff)) {
    return "fix";
  }

  // diff에 export, new command, new option, add, added, create, created 키워드가 포함되어 있다면 feat로 추론
  if (
    /\b(export|new command|new option|add|added|create|created)\b/.test(
      lowerDiff,
    )
  ) {
    return "feat";
  }

  // diff에 refactor, rename, move, split, extract, cleanup, restructure 키워드가 포함되어 있다면 refactor로 추론
  if (
    /\b(refactor|rename|move|split|extract|cleanup|restructure)\b/.test(
      lowerDiff,
    )
  ) {
    return "refactor";
  }

  // 위 조건에 모두 해당하지 않으면 chore로 추론
  return "chore";
}

/**
 * 그룹 생성 전용 metadata를 만듭니다.
 *
 * 이 단계에서는 diff 원문을 출력하지 않고, provider도 호출하지 않습니다. diff는 로컬 규칙 판정에만 사용하고
 * 반환 metadata에는 포함하지 않아 preview 출력 경로로 원문이 흘러가지 않게 합니다.
 */
function buildRuleBasedGroupingItems(fileDiffs) {
  // 파일들의 경로를 기반으로 카테고리를 분류합니다.
  const classifications = classifyChangedFiles(
    fileDiffs.map(({ file }) => file),
  );
  // 파일별 카테고리를 Map 형태로 변환합니다.
  const classificationByFile = new Map(
    classifications.map((classification) => [
      classification.file,
      normalizeFileClassification(classification),
    ]),
  );

  // fileDiffs를 순회하면서
  return fileDiffs.map(({ file, diff }) => {
    // 파일별 카테고리를 가져옵니다.
    const classification = normalizeFileClassification(
      classificationByFile.get(file) ?? { file, fileType: "unknown" },
    );
    // 파일의 카테고리와 diff를 기반으로 의도를 추론합니다.
    const intent = inferGroupedIntentByRules({
      fileType: classification.fileType,
      diff,
    });

    // 규칙 기반으로 파일에 대한 metadata를 만듭니다.
    return {
      file,
      fileType: classification.fileType,
      category: classification.fileType,
      intent: GROUP_FALLBACK_INTENTS.has(intent) ? intent : "chore",
      summary: `규칙 기반 ${classification.fileType} 변경`,
      confidence: "low",
      source: "rule",
    };
  });
}

/**
 * preview와 commit flow 사이에서 그룹 파일 구성이 정확한지 확인합니다.
 *
 * 중복 파일이나 누락 파일이 있으면 어떤 그룹도 commit하지 않습니다. 그룹 커밋은 여러 commit을 순차로 만들 수
 * 있으므로 시작 전에 대상 파일 집합을 확정해 두는 것이 안전합니다.
 */
function validateGroupedCommitPlan(groups, expectedFiles) {
  // 배열 상에 groups가 포함되어있지 않거나 groups의 개수가 0개라면 빈 배열이므로 valid 리턴
  if (!Array.isArray(groups) || groups.length === 0) {
    return { valid: false, reason: "empty" };
  }

  // 배열 상에 expectedFiles가 포함되어있지 않다면 expected에 expectedFiles를 추가
  const expected = new Set(expectedFiles);
  // seen은 배열 상에 groups에 포함되어있는 파일들의 개수를 추적합니다.
  const seen = new Set();

  // 그룹들의 파일들을 순회하면서
  for (const group of groups) {
    // 그룹 상에 group.files가 포함되어있지 않거나 group.files의 개수가 0개라면 빈 배열이므로 valid 리턴
    if (!Array.isArray(group.files) || group.files.length === 0) {
      return { valid: false, reason: "emptyGroup", groupName: group.groupName };
    }

    // 그룹의 파일들을 순회하면서
    for (const file of group.files) {
      // 예상 파일에 포함되지 않은 파일이 있다면 valid 리턴
      if (!expected.has(file)) {
        return { valid: false, reason: "unexpectedFile", file };
      }

      // seen에 파일이 포함되어있다면 중복된 파일이므로 valid 리턴
      if (seen.has(file)) {
        return { valid: false, reason: "duplicateFile", file };
      }
      // seen에 파일 추가
      seen.add(file);
    }
  }

  // 예상 파일의 파일들을 순회하면서
  for (const file of expected) {
    // seen에 파일이 포함되어있지 않다면 누락된 파일이므로 valid 리턴
    if (!seen.has(file)) {
      return { valid: false, reason: "missingFile", file };
    }
  }

  // 유효성 검증 통과
  return { valid: true };
}

/**
 * 하나의 diff를 기준으로 AI commit message를 만들고 git commit에 넣기 좋은 문자열로 정리합니다.
 *
 * prompt 생성, provider routing, AI 응답 정리는 각각 core 모듈의 책임입니다. command 계층은 이 함수에서
 * 세 단계를 순서대로 연결하되, diff 원문이나 AI raw response를 로그로 출력하지 않습니다.
 */
async function createCommitMessage({
  diff,
  fileDiffs,
  files,
  language,
  mode,
  config,
  previousMessage,
}) {
  // 민감 정보 마스킹
  const safeDiff = prepareDiffForAI(diff, config);
  const safeFileDiffs = prepareFileDiffsForAI(fileDiffs, config);

  // prompt 생성
  // AI 모델을 통해 commit message 생성
  const rawMessage = await generateLargeDiffCommitMessage({
    diff: safeDiff,
    fileDiffs: safeFileDiffs,
    files,
    config,
    language,
    mode,
    previousMessage,
    template: config.template,
  });

  // AI 모델의 응답 정리
  return cleanAIResponse(rawMessage);
}

/**
 * AI commit message를 만들되, HTTP 429/사용량 소진 오류에서는 사용자 선택에 따라 안전하게 재시도합니다.
 *
 * 각 재시도 전에 외부 전송 gate를 다시 통과합니다. 사용자가 provider를 바꾸면 전송 대상도 바뀔 수 있으므로
 * 이전 승인만 믿고 diff를 새 endpoint로 보내지 않습니다. 이 함수가 stopped를 반환하면 호출자는 staging/commit 없이 종료합니다.
 */
async function createCommitMessageWithRecovery({
  diff,
  fileDiffs,
  files,
  language,
  mode,
  config,
  previousMessage,
  transmissionOptions = {},
  sessionState,
  skipInitialTransmission = false,
}) {
  // 설정
  let currentConfig = config;
  // 전송 skip 여부
  let shouldSkipTransmission = skipInitialTransmission;
  // temporary fallback은 현재 diff 성공 후 다음 파일부터 원래 localLLM config로 되돌리기 위해 결과 config를 따로 보관합니다.
  let configAfterSuccessfulGeneration = null;

  // 트랜잭션
  while (true) {
    // 전송 확인
    const transmissionApproved = shouldSkipTransmission
      ? true
      : await shouldSendDiffToAI(
          currentConfig,
          { ...transmissionOptions, diff },
          sessionState,
        );

    // 첫 시도 이후(재시도 루프)에는 반드시 전송 확인을 다시 거칩니다.
    shouldSkipTransmission = false;

    // 전송이 승인되지 않았다면 종료
    if (!transmissionApproved) {
      return {
        stopped: true,
        message: null,
      };
    }

    // try/catch 블록
    try {
      // commit message 생성
      const message = await createCommitMessage({
        diff,
        fileDiffs,
        files,
        language: currentConfig.language || language,
        mode,
        config: currentConfig,
        previousMessage,
      });

      // 트랜잭션 내에서 config가 변경되었을 경우, 원래 config로 복원합니다.
      const resultConfig = configAfterSuccessfulGeneration ?? currentConfig;
      configAfterSuccessfulGeneration = null;

      // commit message 생성 성공
      return {
        stopped: false,
        message,
        config: resultConfig,
      };
      // 사용량 소진 오류 catch
    } catch (providerError) {
      // localLLM 사용 불가능 오류 catch
      if (isLocalLLMUnavailableError(providerError, currentConfig)) {
        warn(
          "localLLM이 현재 diff를 처리하지 못했습니다. 다른 localLLM 또는 API 사용 여부를 확인합니다.",
        );

        // 복구 로직
        const localRecovery = await recoverFromLocalLLMFailure(
          currentConfig,
          sessionState,
        );

        // 파일 건너뛰기
        if (localRecovery.skipped) {
          return {
            stopped: true,
            skipped: true,
            message: null,
            config: localRecovery.config,
          };
        }
        // 작업 중단
        if (localRecovery.stopped) {
          return {
            stopped: true,
            message: null,
            config: localRecovery.config,
          };
        }

        // 외부 전송 승인 초기화
        if (
          shouldResetExternalTransmissionApproval(
            currentConfig,
            localRecovery.config,
          )
        ) {
          // localLLM에서 Cloud API 또는 다른 endpoint로 바뀌면 이전 승인 상태를 재사용하지 않습니다.
          sessionState.externalTransmissionApproved = false;
        }

        // config 업데이트
        currentConfig = localRecovery.config;
        // configAfterSuccess는 recovery가 성공해서 원래 설정으로 돌아가는 경우에만 사용합니다.
        // 즉시 next iteration으로 넘어가므로 별도 저장 없이 루프 시작 시점에 반영하면 충분합니다.
        configAfterSuccessfulGeneration =
          localRecovery.configAfterSuccess ?? null;
        // 다음 루프에서 복구된 설정으로 다시 시도
        continue;
      }
      // 사용량 소진 오류 catch
      if (!isUsageExhaustedError(providerError)) {
        throw providerError;
      }
      // 사용량 소진 오류 시 경고
      warn(
        "AI Provider 사용량 한도 또는 rate limit으로 commit message 생성이 중단되었습니다.",
      );
      // 사용량 소진 오류 복구
      const recovery = await recoverFromUsageExhaustedError(currentConfig);

      // 복구가 중단되었는지 확인
      if (recovery.stopped) {
        return {
          stopped: true,
          message: null,
          config: recovery.config,
        };
      }

      // 외부 전송 승인 초기화
      if (
        shouldResetExternalTransmissionApproval(currentConfig, recovery.config)
      ) {
        // provider/model/baseURL/authType 등이 바뀌면 같은 diff라도 전송 대상이 바뀔 수 있습니다.
        // 이전 provider에 대해 받은 "once" 승인을 새 provider에 재사용하지 않도록 세션 승인을 초기화합니다.
        sessionState.externalTransmissionApproved = false;
      }

      // 복구된 설정을 현재 설정으로 반영하여 루프를 재시도합니다.
      currentConfig = recovery.config;
    }
  }
}

/**
 *
 * 유효하지 않은 mode는 batch로 오해하지 않고 기본값인 step으로 되돌립니다. 이 함수는 라우팅만 담당하며
 * Git diff 추출, 사용자 confirm, staging, commit은 각각 `runStepCommit()` 또는 `runBatchCommit()`에 위임합니다.
 */
export async function runDefaultCommit(options = {}) {
  // 현재 config 로드
  const config = loadRuntimeConfig();
  // mode 유효성 검증, 유효하지 않은 mode는 기본값인 step으로 되돌립니다.
  const mode = isValidMode(config.mode) ? config.mode : DEFAULT_CONFIG.mode;

  // batch 모드이면 batch commit 실행
  if (mode === "batch") {
    return runBatchCommit(options);
  }

  // step 모드이면 step commit 실행
  return runStepCommit(options);
}

/**
 * 각 파일은 자신의 diff만 prompt에 포함하고, 사용자가 승인한 경우에만 해당 파일을 staging한 뒤 commit합니다.
 * 한 파일의 confirm을 거부하는 것은 오류가 아니므로 다음 파일로 넘어갑니다. 반면 AI 생성, staging, commit
 * 자체가 실패하면 Git 상태를 애매하게 만들 수 있으므로 예외를 상위로 전달해 즉시 중단합니다.
 */
export async function runStepCommit(options = {}) {
  // Git 저장소인지 확인
  if (!isGitRepository()) {
    error("Git 저장소 안에서 실행해야 합니다.");
    return;
  }

  // 설정 파일 읽기
  let config = loadRuntimeConfig();

  // 변경된 파일 목록과 diff 추출
  const { changedFiles, fileDiffs } = collectCommittableFileDiffs();

  // 변경된 파일이 없으면 종료
  if (changedFiles.length === 0) {
    info("커밋할 변경사항이 없습니다.");
    return;
  }

  // 커밋 가능한 diff가 없으면 종료
  if (fileDiffs.length === 0) {
    warn(
      "커밋 가능한 diff가 없습니다. 민감 파일 또는 diff가 없는 파일은 제외됩니다.",
    );
    return;
  }

  // 커밋 횟수 초기화
  let committedCount = 0;

  // 세션 내 승인 상태 추적을 위한 객체
  const sessionState = {
    externalTransmissionApproved: false,
  };

  // 변경된 파일 목록 순회
  try {
    for (const { file, diff } of fileDiffs) {
      // step 모드는 파일별 diff와 파일명 하나를 공통 decision flow에 넘깁니다.
      // 각 파일마다 preview/decision이 독립적으로 동작합니다.
      const decisionResult = await runCommitDecisionFlow({
        diff,
        fileDiffs: [{ file, diff }],
        file,
        config,
        mode: "step",
        sessionState,
        transmissionOptions: { file },
      });

      // provider/model 전환 같은 복구 결과를 다음 파일 처리에도 최신 config로 반영합니다.
      config = decisionResult.config ?? config;

      // 작업 중지
      if (decisionResult.stopped) {
        break;
      }

      // 실제 commit이 생성된 경우에만 성공 카운트를 올립니다.
      if (decisionResult.committed) {
        committedCount += 1;
        success(`${file} commit completed.`);
      }
    }

    // 커밋 횟수 확인
    // 승인한 커밋이 없으면 안내 메시지 출력
    // step 모드는 파일별로 커밋을 건너뛸 수 있으므로, 최소 1개 이상 성공했을 때만 push를 후속 실행합니다.
    await pushAfterSuccessfulCommit({
      push: options.push && committedCount > 0,
    });

    if (committedCount === 0) {
      info("사용자가 승인한 커밋이 없습니다.");
    }
  } finally {
    // localLLM 실패로 임시 provider/API 전환을 했다면 commit/push 예외가 발생해도
    // 작업 종료 시점에 현재 설정 유지 또는 기존 localLLM 복원 여부를 반드시 확인합니다.
    await finalizeLocalLLMFallbackConfig(sessionState);
  }
}

/**
 * 보안상 prompt에 포함된 diff와 실제 staging 대상이 일치해야 합니다. 그래서 `git add -A`로 모든 변경을
 * 무조건 올리지 않고, 민감 파일 제외를 통과한 `fileDiffs` 목록만 `addFile(file)`로 staging합니다. 결과적으로
 * batch mode는 "하나의 commit message"를 만들지만, 커밋 대상은 검증된 파일로 제한됩니다.
 */
export async function runBatchCommit(options = {}) {
  // Git 저장소인지 확인
  if (!isGitRepository()) {
    error("Git 저장소 안에서 실행해야 합니다.");
    return;
  }

  // 설정 파일 읽기
  let config = loadRuntimeConfig();
  // 변경된 파일 목록과 diff 추출
  const { changedFiles, fileDiffs } = collectCommittableFileDiffs();

  // 변경된 파일이 없으면 종료
  if (changedFiles.length === 0) {
    info("커밋할 변경사항이 없습니다.");
    return;
  }

  // 커밋 가능한 diff가 없으면 종료
  if (fileDiffs.length === 0) {
    warn(
      "커밋 가능한 diff가 없습니다. 민감 파일 또는 diff가 없는 파일은 제외됩니다.",
    );
    return;
  }

  // batch 모드에서 커밋 가능한 diff가 변경된 파일보다 적으면 경고
  if (fileDiffs.length < changedFiles.length) {
    warn(
      "일부 파일은 민감 파일이거나 diff가 없어 batch 커밋 대상에서 제외됩니다.",
    );
  }

  // 외부 AI 전송 승인 확인 (Batch는 파일이 하나로 합쳐지므로 sessionState가 큰 의미는 없지만 일관성을 위해 유지)
  const sessionState = {
    externalTransmissionApproved: false,
  };
  try {
    // batch 모드에서는 여러 파일 diff를 하나의 prompt 입력으로 합칩니다.
    const batchDiff = joinDiffs(fileDiffs);
    // 다만 staging 대상은 민감 파일 필터를 통과한 파일 목록으로 제한합니다.
    const filesToCommit = fileDiffs.map(({ file }) => file);
    // batch도 step과 같은 decision flow를 사용해 UX와 보안 정책을 일관되게 유지합니다.
    const decisionResult = await runCommitDecisionFlow({
      diff: batchDiff,
      fileDiffs,
      files: filesToCommit,
      config,
      mode: "batch",
      sessionState,
    });

    // provider/model 전환 같은 복구 결과를 push 이전 최신 config로 반영합니다.
    config = decisionResult.config ?? config;

    // 사용자가 취소하거나 AI 생성이 중단되면 push를 실행하지 않습니다.
    if (!decisionResult.committed) {
      warn("사용자가 batch 커밋을 취소했습니다.");
      return;
    }

    // commit이 실제로 성공한 뒤에만 push 확인 및 push를 진행합니다.
    await pushAfterSuccessfulCommit(options);
    success("Batch commit completed.");
  } finally {
    // fallback provider/API를 config.json에 임시 저장한 뒤 commit, push, 사용자 취소,
    // 전송 거부 중 어느 경로로 끝나더라도 기존 localLLM 복원 여부를 빠뜨리지 않습니다.
    await finalizeLocalLLMFallbackConfig(sessionState);
  }
}

/**
 * 변경된 파일들을 의도별로 그룹화하여 커밋합니다.
 */
export async function runGroupedCommit(options = {}) {
  // Git 저장소인지 확인
  if (!isGitRepository()) {
    error("Git 저장소 안에서 실행해야 합니다.");
    return;
  }

  // 설정 파일 읽기
  let config = loadRuntimeConfig();

  // 변경된 파일 목록과 diff 추출
  const { changedFiles, fileDiffs } = collectCommittableFileDiffs();

  if (changedFiles.length === 0 || fileDiffs.length === 0) {
    info("커밋할 변경사항이 없습니다.");
    return;
  }

  // 파일 카테고리 분류
  const groupingItems = buildRuleBasedGroupingItems(fileDiffs);
  // 그룹 제안 단계에서는 외부 AI를 호출하지 않습니다.
  // per-file intent AI 분석은 외부 전송 확인 gate를 우회할 수 있으므로 fileType 계약과 로컬 규칙 fallback만 사용합니다.

  // 파일들을 그룹화
  const groups = groupFilesByIntent(groupingItems);

  // 그룹화된 파일이 없으면 종료
  if (groups.length === 0) {
    warn("그룹화된 파일이 없습니다. Git 작업 없이 종료합니다.");
    return;
  }

  // 그룹 미리보기 및 사용자 확인
  const filesToGroup = fileDiffs.map(({ file }) => file);
  const validation = validateGroupedCommitPlan(groups, filesToGroup);

  // 그룹 구성 유효성 검증, 유효하지 않은 경우 종료
  if (!validation.valid) {
    warn("그룹 파일 구성이 유효하지 않아 Git 작업 없이 종료합니다.");
    return;
  }

  // 그룹 미리보기
  previewGrouping(groups);
  // 그룹 결정
  const decision = await selectGroupingDecision();

  // 그룹 커밋 취소 시 종료
  if (decision === GROUPING_DECISIONS.CANCEL) {
    warn("그룹 커밋이 취소되었습니다.");
    return;
  }

  // batch 커밋 선택 시 batch commit 실행
  if (decision === GROUPING_DECISIONS.BATCH) {
    info("batch 커밋으로 진행합니다.");
    return runBatchCommit(options);
  }

  // 수정 선택 시 수정은 아직 지원되지 않음
  if (decision === GROUPING_DECISIONS.EDIT) {
    info("수동 수정은 아직 지원되지 않습니다. batch 커밋으로 진행합니다.");
    return runBatchCommit(options);
  }

  // 커밋 카운트 초기화
  let committedCount = 0;
  // 외부 전송 승인 상태 초기화
  const sessionState = {
    externalTransmissionApproved: false,
  };

  // 그룹별 파일 커밋
  try {
    // 그룹 반복 처리
    for (const group of groups) {
      // 그룹에 속한 파일들의 diff 추출
      const groupFileDiffs = fileDiffs.filter((f) =>
        group.files.includes(f.file),
      );
      // 그룹 diff 조인
      const groupDiff = joinDiffs(groupFileDiffs);
      // 그룹 파일 목록
      const groupFiles = groupFileDiffs.map(({ file }) => file);

      // 커밋 가능한 diff가 없으면 다음 그룹으로
      if (groupFileDiffs.length === 0) {
        warn(`Group ${group.groupName}에 커밋 가능한 diff가 없어 건너뜁니다.`);
        continue;
      }

      // 그룹별 파일만 기존 batch prompt/confirm flow에 전달합니다.
      // 그룹 preview의 Yes는 구성 승인일 뿐이며, 실제 commit은 아래 decision flow의 메시지 preview와 confirm 이후에만 수행됩니다.
      const decisionResult = await runCommitDecisionFlow({
        diff: groupDiff,
        fileDiffs: groupFileDiffs,
        files: groupFiles,
        file: `Group: ${group.groupName}`,
        transmissionOptions: { file: `Group: ${group.groupName}` },
        config,
        mode: "batch",
        sessionState,
      });

      // 최신 config로 업데이트
      config = decisionResult.config ?? config;

      // stop이면 루프 탈출
      if (decisionResult.stopped) {
        break;
      }

      // commit 되었다면 커밋 카운트 증가
      if (decisionResult.committed) {
        committedCount += 1;
        success(`Group ${group.groupName} commit completed.`);
      }
    }

    // 커밋이 성공한 경우에만 push 확인 및 push 수행
    await pushAfterSuccessfulCommit({
      push: options.push && committedCount > 0,
    });

    // commit count가 없다면 사용자에게 커밋이 없음을 알림
    if (committedCount === 0) {
      info("사용자가 승인한 커밋이 없습니다.");
    }
    // fallback provider/API를 config.json에 임시 저장한 뒤 commit, push, 사용자 취소,
    // 전송 거부 중 어느 경로로 끝나더라도 기존 localLLM 복원 여부를 빠뜨리지 않습니다.
  } finally {
    await finalizeLocalLLMFallbackConfig(sessionState);
  }
}
