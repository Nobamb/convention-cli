import {
  DEFAULT_CONFIG,
  DEFAULT_LOCAL_LLM_BASE_URL,
} from "../config/defaults.js";
import { promptApiKey, saveApiKey } from "../auth/apiKey.js";
import { setupModelInteractively } from "./model.js";
import { loadConfig } from "../config/store.js";
import { cleanAIResponse, generateCommitMessage } from "../core/ai.js";
import {
  addFile,
  commit,
  getChangedFiles,
  getFileDiffs,
  isGitRepository,
  push,
} from "../core/git.js";
import { buildCommitPrompt } from "../core/prompt.js";
import { maskSensitiveDiff } from "../core/security.js";
import { isUsageExhaustedError } from "../providers/errors.js";
import { error, info, success, warn } from "../utils/logger.js";
import {
  confirmAction,
  confirmCommit,
  confirmExternalAITransmission,
  selectAIUsageExhaustedAction,
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
async function shouldCommit(message, config, options = {}) {
  if (config.confirmBeforeCommit === false) {
    return true;
  }

  return confirmCommit(message, options);
}

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
async function createCommitMessage({ diff, language, mode, config }) {
  // 민감 정보 마스킹
  const safeDiff = prepareDiffForAI(diff, config);

  // prompt 생성
  const prompt = buildCommitPrompt({ diff: safeDiff, language, mode });

  // AI 모델을 통해 commit message 생성
  const rawMessage = await generateCommitMessage(prompt, config);

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
  language,
  mode,
  config,
  transmissionOptions = {},
  sessionState,
  skipInitialTransmission = false,
}) {
  let currentConfig = config;
  let shouldSkipTransmission = skipInitialTransmission;

  while (true) {
    const transmissionApproved = shouldSkipTransmission
      ? true
      : await shouldSendDiffToAI(
          currentConfig,
          { ...transmissionOptions, diff },
          sessionState,
        );

    // 첫 시도 이후(재시도 루프)에는 반드시 전송 확인을 다시 거칩니다.
    shouldSkipTransmission = false;

    if (!transmissionApproved) {
      return {
        stopped: true,
        message: null,
      };
    }

    try {
      return {
        stopped: false,
        message: await createCommitMessage({
          diff,
          language: currentConfig.language || language,
          mode,
          config: currentConfig,
        }),
        config: currentConfig,
      };
    } catch (providerError) {
      if (!isUsageExhaustedError(providerError)) {
        throw providerError;
      }

      warn(
        "AI Provider 사용량 한도 또는 rate limit으로 commit message 생성이 중단되었습니다.",
      );

      const recovery = await recoverFromUsageExhaustedError(currentConfig);

      if (recovery.stopped) {
        return {
          stopped: true,
          message: null,
        };
      }

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
    // 외부 AI Provider 인지 확인 (루프 내 최신 config 반영)
    const transmissionApproved = await shouldSendDiffToAI(
      config,
      { file, diff },
      sessionState,
    );

    // 외부 AI 전송이 승인되지 않으면 종료
    if (!transmissionApproved) {
      warn(
        "External AI transmission was canceled. No AI request, staging, or commit was performed.",
      );
      return;
    }

    // AI 모델을 통해 commit message 생성
    // 429 복구 과정에서 config가 바뀌면 result.config에 담겨 나옵니다.
    const result = await createCommitMessageWithRecovery({
      diff,
      language: config.language,
      mode: "step",
      config,
      transmissionOptions: { file },
      sessionState,
      skipInitialTransmission: true,
    });

    if (result.stopped) {
      warn(
        "AI commit message generation was stopped. No staging or commit was performed.",
      );
      return;
    }

    // 429 복구 중 API Key를 바꾸거나 provider/model을 전환했다면 이후 파일도 새 설정을 사용해야 합니다.
    // 그렇지 않으면 step 모드의 다음 파일에서 이미 소진된 provider를 다시 호출하거나 같은 복구 질문이 반복될 수 있습니다.
    config = result.config ?? config;

    const { message } = result;

    // 파일 및 커밋 메시지 정보 출력
    info(`파일: ${file}`);
    info(`커밋 메시지: ${message}`);

    // 커밋 승인 확인
    const approved = await shouldCommit(message, config, { file });

    // 커밋이 승인되지 않으면 다음 파일로 넘어감
    if (!approved) {
      warn(`${file} 커밋을 건너뜁니다.`);
      continue;
    }

    // 파일 add
    addFile(file);
    // 커밋
    commit(message, [file]);
    // 커밋 횟수 증가
    committedCount += 1;
    // 커밋 완료
    success(`${file} 커밋이 완료되었습니다.`);
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

  //
  if (fileDiffs.length < changedFiles.length) {
    warn(
      "일부 파일은 민감 파일이거나 diff가 없어 batch 커밋 대상에서 제외됩니다.",
    );
  }

  // 외부 AI 전송 승인 확인 (Batch는 파일이 하나로 합쳐지므로 sessionState가 큰 의미는 없지만 일관성을 위해 유지)
  const sessionState = {
    externalTransmissionApproved: false,
  };
  const batchDiff = joinDiffs(fileDiffs);
  const transmissionApproved = await shouldSendDiffToAI(
    config,
    { diff: batchDiff },
    sessionState,
  );
  // 외부 AI 전송이 승인되지 않으면 종료
  if (!transmissionApproved) {
    warn(
      "External AI transmission was canceled. No AI request, staging, or commit was performed.",
    );
    return;
  }

  // message 생성
  // AI 호출 실패가 429/사용량 소진이면 사용자 선택에 따라 key 교체 또는 provider/model 변경 후 재시도합니다.
  // stopped면 아직 staging 전이므로 batch commit 전체를 안전하게 중단합니다.
  const result = await createCommitMessageWithRecovery({
    diff: joinDiffs(fileDiffs),
    language: config.language,
    mode: "batch",
    config,
    sessionState,
    skipInitialTransmission: true,
  });

  if (result.stopped) {
    warn(
      "AI commit message generation was stopped. No staging or commit was performed.",
    );
    return;
  }

  // batch는 단일 커밋이지만, 429 복구 후 provider/model을 바꾼 경우 commit confirm 설정 등도 최신 config 기준으로 봅니다.
  config = result.config ?? config;

  const { message } = result;

  info(`커밋 메시지: ${message}`);

  // 커밋 승인 확인
  const approved = await shouldCommit(message, config);
  // 커밋이 승인되지 않으면 종료
  if (!approved) {
    warn("사용자가 batch 커밋을 취소했습니다.");
    return;
  }

  // 커밋할 파일 목록
  const filesToCommit = fileDiffs.map(({ file }) => file);
  // 파일 add
  for (const file of filesToCommit) {
    addFile(file);
  }
  // 커밋
  commit(message, filesToCommit);
  // batch 모드는 단일 커밋이 성공한 직후에만 push합니다. commit()이 실패하면 예외가 전파되어 여기까지 오지 않습니다.
  await pushAfterSuccessfulCommit(options);
  // 성공
  success("Batch 커밋이 완료되었습니다.");
}
