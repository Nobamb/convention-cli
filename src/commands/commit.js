import {
  DEFAULT_CONFIG,
  DEFAULT_LOCAL_LLM_BASE_URL,
} from "../config/defaults.js";
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
import { error, info, success, warn } from "../utils/logger.js";
import {
  confirmAction,
  confirmCommit,
  confirmExternalAITransmission,
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
  // push는 원격 저장소에 Git 히스토리를 전파하므로 새 커밋이 실제로 만들어진 뒤에만 실행합니다.
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
  const config = loadRuntimeConfig();

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
    // 외부 AI Provider 인지 확인
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
    const message = await createCommitMessage({
      diff,
      language: config.language,
      mode: "step",
      config,
    });

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
  const config = loadRuntimeConfig();
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
  const message = await createCommitMessage({
    diff: joinDiffs(fileDiffs),
    language: config.language,
    mode: "batch",
    config,
  });

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
