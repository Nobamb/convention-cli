import {
  DEFAULT_CONFIG,
  DEFAULT_LOCAL_LLM_BASE_URL,
} from "../config/defaults.js";
import { promptApiKey, saveApiKey } from "../auth/apiKey.js";
import { setupModelInteractively } from "./model.js";
import { loadConfig } from "../config/store.js";
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
import { isUsageExhaustedError } from "../providers/errors.js";
import { error, info, success, warn } from "../utils/logger.js";
import {
  COMMIT_DECISIONS,
  confirmAction,
  confirmExternalAITransmission,
  previewCommitMessage,
  promptCommitMessageEdit,
  selectAIUsageExhaustedAction,
  selectCommitDecision,
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
  return {
    ...DEFAULT_CONFIG,
    ...loadConfig(),
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
      warningMessage = "⚠️ 민감정보 탐지됨! 코드를 외부로 전송하기 전 반드시 확인하세요.";
    }
  }

  // 강제 확인 조건이 아니면서 "never" 모드이면 확인 없이 승인
  if (!forcePrompt && mode === "never") {
    return true;
  }

  // 강제 확인 조건이 아니면서 "once" 모드이고 이미 이번 세션에서 승인받았다면 바로 승인
  if (!forcePrompt && mode === "once" && sessionState.externalTransmissionApproved) {
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
function shouldResetExternalTransmissionApproval(previousConfig = {}, nextConfig = {}) {
  return (
    previousConfig.provider !== nextConfig.provider ||
    previousConfig.baseURL !== nextConfig.baseURL ||
    previousConfig.modelVersion !== nextConfig.modelVersion ||
    previousConfig.authType !== nextConfig.authType
  );
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

// 설정에서 재생성 최대 횟수를 읽습니다.
// 잘못된 값이 저장되어 있어도 무한 루프가 생기지 않도록 DEFAULT_CONFIG 값으로 되돌립니다.
function getMaxRegenerateCount(config = {}) {
  const value = Number(config.maxRegenerateCount ?? DEFAULT_CONFIG.maxRegenerateCount);

  // 0도 허용합니다. 이 경우 Regenerate 선택지는 있어도 실제 재생성은 더 진행되지 않습니다.
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }

  return DEFAULT_CONFIG.maxRegenerateCount;
}

// commit decision flow의 마지막 단계에서만 호출하는 staging/commit helper입니다.
// prompt 생성이나 preview 단계에서는 절대 이 함수를 부르지 않아 사용자 승인 전 Git 히스토리 변경을 막습니다.
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
    config: currentConfig,
    transmissionOptions,
    sessionState,
  });

  // 사용자가 외부 AI 전송을 거부했거나 429 복구를 중단하면 Git 작업 없이 종료합니다.
  if (generated.stopped) {
    warn("AI commit message generation was stopped. No staging or commit was performed.");
    return { committed: false, config: currentConfig };
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
    if (typeof currentMessage !== "string" || currentMessage.trim().length === 0) {
      warn("AI returned an empty commit message. No staging or commit was performed.");
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
        warn("Commit message edit was canceled. No staging or commit was performed.");
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
        warn("Maximum regenerate count reached. Choose commit, edit, or cancel.");
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
        config: currentConfig,
        previousMessage: currentMessage,
        transmissionOptions,
        sessionState,
      });

      // 재생성 중단/실패도 commit으로 fallback하지 않습니다.
      if (regenerated.stopped) {
        warn("AI commit message regeneration was stopped. No staging or commit was performed.");
        return { committed: false, config: currentConfig };
      }

      // 복구 과정에서 config가 바뀌었을 수 있으므로 최신 config와 새 메시지를 반영합니다.
      currentConfig = regenerated.config ?? currentConfig;
      currentMessage = regenerated.message;
    }
  }
}

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
    warn("사용자가 push를 취소했습니다. 로컬 커밋은 유지되고 원격 저장소는 변경되지 않았습니다.");
    return;
  }

  // 실제 push는 core wrapper에 위임합니다. wrapper는 Git stderr를 그대로 노출하지 않아
  // remote URL, token, credential helper 출력 같은 민감 정보가 사용자 메시지에 섞이지 않게 합니다.
  push();
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
      return {
        stopped: false,
        message: await createCommitMessage({
          diff,
          fileDiffs,
          files,
          language: currentConfig.language || language,
          mode,
          config: currentConfig,
          previousMessage,
        }),
        config: currentConfig,
      };
    // 사용량 소진 오류 catch
    } catch (providerError) {
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
        };
      }

      // 외부 전송 승인 초기화
      if (shouldResetExternalTransmissionApproval(currentConfig, recovery.config)) {
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
  const config = loadRuntimeConfig();
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

    // 429 복구 중 provider/model이 바뀌었으면 다음 파일 처리에도 새 config를 사용합니다.
    config = decisionResult.config ?? config;

    // 실제 commit이 생성된 경우에만 성공 카운트를 올립니다.
    if (decisionResult.committed) {
      committedCount += 1;
      success(`${file} commit completed.`);
    }
  }

  // 커밋 횟수 확인
  // 승인한 커밋이 없으면 안내 메시지 출력
  // step 모드는 파일별로 커밋을 건너뛸 수 있으므로, 최소 1개 이상 성공했을 때만 push를 후속 실행합니다.
  await pushAfterSuccessfulCommit({ push: options.push && committedCount > 0 });

  if (committedCount === 0) {
    info("사용자가 승인한 커밋이 없습니다.");
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
  // batch 모드는 여러 파일 diff를 하나의 prompt 입력으로 합칩니다.
  const batchDiff = joinDiffs(fileDiffs);
  // 다만 staging 대상은 fileDiffs를 통과한 파일 목록으로만 제한합니다.
  const filesToCommit = fileDiffs.map(({ file }) => file);
  // batch도 step과 같은 decision flow를 사용해 UX와 보안 정책을 통일합니다.
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

  // 사용자가 Cancel했거나 AI 생성이 중단되면 push도 실행하지 않습니다.
  if (!decisionResult.committed) {
    warn("사용자가 batch 커밋을 취소했습니다.");
    return;
  }

  // commit이 실제로 성공한 뒤에만 push 확인 및 push를 진행합니다.
  await pushAfterSuccessfulCommit(options);
  success("Batch commit completed.");
}
