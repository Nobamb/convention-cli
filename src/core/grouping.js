import { generateWithProvider } from "../providers/index.js";
import { buildIntentPrompt } from "./prompt.js";
import { maskSensitiveDiff } from "./security.js";

// 유효한 의도
// convention에서 사용할 접두어
const VALID_INTENTS = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "style",
  "test",
  "chore",
];
// 의도 우선순위
const INTENT_PRIORITY = [
  "feat",
  "fix",
  "refactor",
  "test",
  "docs",
  "style",
  "chore",
];
// 단독 파일 유형
const STANDALONE_FILE_TYPES = new Set([
  "docs",
  "dependency",
  "config",
  "generated",
]);

// 민감 파일 패턴
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?:\..*)?$/u,
  /(?:^|\/)\.env(?:\..*)?$/u,
  /(?:^|\/)(?:credentials|secrets)\.json$/u,
  /(?:^|\/)id_(?:rsa|ed25519)$/u,
  /\.(?:pem|key)$/u,
];

/**
 * 파일명 정규화 함수
 *
 * @param {string} file - 파일명
 * @returns {string} - 정규화된 파일명
 */
function normalizePath(file) {
  return String(file ?? "")
    .replace(/\\/gu, "/")
    .replace(/\/+/gu, "/")
    .trim();
}

/**
 * 파일명에서 마지막 요소를 추출하는 함수
 *
 * @param {string} file - 파일명
 * @returns {string} - 파일명에서 마지막 요소
 */
function getBaseName(file) {
  // 파일명 정규화 후의 문자열
  const normalized = normalizePath(file);
  // 디렉터리 경로 분리
  const parts = normalized.split("/");
  // 마지막 요소 추출
  return parts[parts.length - 1] || normalized;
}
/**
 * 파일명에서 확장자를 제거하는 함수
 *
 * @param {string} file - 파일명
 * @returns {string} - 파일명에서 확장자 제거
 */
function withoutExtension(file) {
  // 확장자 제거
  return getBaseName(file)
    .replace(/\.(?:test|spec)$/iu, "")
    .replace(/\.[^.]+$/u, "");
}

/**
 * 파일의 영역을 반환하는 함수
 *
 * @param {string} file - 파일명
 * @returns {string} - 파일의 영역
 */
function getFileArea(file) {
  // 파일명 정규화
  const normalized = normalizePath(file);
  // 디렉터리 경로 분리
  const parts = normalized.split("/").filter(Boolean);

  // 경로가 없으면 기타
  if (parts.length === 0) return "misc";
  // 경로가 src, tests, test, __tests__, docs, bin, lib 중 하나이면
  // 두 번째 디렉터리가 있으면 "src-feature", "src-component", "test-unit", "test-integration"
  // 또는 첫 번째 디렉터리만 반환
  if (
    ["src", "tests", "test", "__tests__", "docs", "bin", "lib"].includes(
      parts[0],
    )
  ) {
    return parts[1] ? `${parts[0]}-${parts[1]}` : parts[0];
  }
  // 경로가 두 개 이상이면 첫 번째 디렉터리
  // 경로가 하나이면 확장자를 제거한 파일명
  return parts.length > 1 ? parts[0] : withoutExtension(normalized);
}

/**
 * 문자열을 슬러그로 변환하는 함수
 *
 * @param {string} value - 변환할 문자열
 * @param {string} fallback - fallback
 * @returns {string} - 슬러그
 */
function slugify(value, fallback = "misc") {
  // 문자열을 슬러그로 변환
  // 소문자로 변환 후 특수문자 치환
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  // 변환한 slug 또는 fallback을 반환
  return slug || fallback;
}

/**
 * 민감한 파일인지 확인하는 함수
 *
 * @param {string} file - 파일명
 * @returns {boolean} - 민감한 파일이면 true
 */
function isSensitiveFile(file) {
  // 민감한 파일 확인
  // 파일명 정규화 및 소문자 변환
  const normalized = normalizePath(file).toLowerCase();
  // 정규식으로 민감한 파일 패턴 확인
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * reasons 배열에 condition이 true이면 reason 추가하는 함수
 *
 * @param {string[]} reasons - reasons 배열
 * @param {boolean} condition - 조건
 * @param {string} reason - 추가할 reason
 */
function addReason(reasons, condition, reason) {
  if (condition) reasons.push(reason);
}

/**
 * 변경된 파일을 파일 유형 메타데이터로 분류하는 함수
 *
 * @param {string} file - 변경된 파일명
 * @returns {{ fileType: string, reasons: string[], requiresReview: boolean }} - 파일 유형, reasons 배열, requiresReview
 */
function classifyFile(file) {
  // 파일명 정규화
  const normalized = normalizePath(file);
  // 파일명 소문자 변환
  const lowerFile = normalized.toLowerCase();
  // 파일명 추출
  const baseName = getBaseName(lowerFile);
  // reasons 배열 초기화
  const reasons = [];

  // 패키지 매니저 관련 파일 확인
  // package.json, package-lock.json, npm-shrinkwrap.json, yarn.lock, pnpm-lock.yaml
  addReason(
    reasons,
    [
      "package.json",
      "package-lock.json",
      "npm-shrinkwrap.json",
      "yarn.lock",
      "pnpm-lock.yaml",
    ].includes(baseName),
    "dependency file",
  );
  // 의존성 파일이면 dependency 반환
  if (reasons.length > 0)
    return { fileType: "dependency", reasons, requiresReview: false };

  // 생성된 파일 패턴 추가
  // dist, build, coverage, .next, .turbo
  addReason(
    reasons,
    /(?:^|\/)(?:dist|build|coverage|\.next|\.turbo)\//u.test(lowerFile),
    "generated path",
  );
  // 축소된 파일 패턴 추가
  addReason(reasons, /\.min\.js$/u.test(lowerFile), "minified file");
  // generated 키워드가 포함된 파일 패턴 추가
  addReason(reasons, lowerFile.includes("generated"), "generated marker");

  // 생성된 파일이면 generated 반환
  if (reasons.length > 0)
    return { fileType: "generated", reasons, requiresReview: false };

  // test 경로 추가
  addReason(
    reasons,
    /(?:^|\/)(?:test|tests|__tests__)\//u.test(lowerFile),
    "test path",
  );
  // test 파일명 추가
  addReason(
    reasons,
    /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(lowerFile),
    "test filename",
  );

  // test 관련 파일이면 test 타입으로 반환
  if (reasons.length > 0)
    return { fileType: "test", reasons, requiresReview: false };

  // docs 경로 추가
  addReason(reasons, /(?:^|\/)docs\//u.test(lowerFile), "docs path");
  // docs 파일명 추가
  addReason(
    reasons,
    ["readme.md", "changelog.md"].includes(baseName),
    "docs filename",
  );
  // docs 확장자 추가
  addReason(reasons, /\.(?:md|mdx)$/u.test(lowerFile), "docs extension");
  // docs 관련 파일이면 docs 타입으로 반환
  if (reasons.length > 0)
    return { fileType: "docs", reasons, requiresReview: false };

  // 설정 파일 경로 추가
  addReason(
    reasons,
    /(?:^|\/)(?:\.github|\.vscode)\//u.test(lowerFile),
    "config path",
  );
  // 설정 파일명 추가
  addReason(
    reasons,
    /^\.(?:npmrc|gitignore)$/u.test(baseName),
    "config filename",
  );
  // 설정 파일 확장자 추가
  addReason(
    reasons,
    /(?:^|\/)(?:eslint|prettier)\.config\.[cm]?js$/u.test(lowerFile),
    "tool config",
  );
  // 설정 파일 확장자 추가
  addReason(reasons, /\.config\.[cm]?js$/u.test(lowerFile), "config extension");
  // 설정 파일 데이터 확장자 추가
  addReason(
    reasons,
    /\.(?:json|ya?ml)$/u.test(lowerFile),
    "config data extension",
  );
  // 타입스크립트 설정 파일 추가
  addReason(
    reasons,
    /(?:^|\/)tsconfig(?:\..*)?\.json$/u.test(lowerFile),
    "typescript config",
  );
  // 설정 파일 관련이면 config 타입으로 반환
  if (reasons.length > 0)
    return { fileType: "config", reasons, requiresReview: false };
  // 스타일 확장자 추가
  addReason(
    reasons,
    /\.(?:css|scss|sass|less)$/u.test(lowerFile),
    "style extension",
  );
  // 스타일 관련이면 style 타입으로 반환
  if (reasons.length > 0)
    return { fileType: "style", reasons, requiresReview: false };
  // 소스 경로 추가
  addReason(reasons, /^(?:src|bin|lib)\//u.test(lowerFile), "source path");
  // javascript 또는 typescript 확장자 추가
  addReason(
    reasons,
    /\.[cm]?[jt]sx?$/u.test(lowerFile),
    "javascript or typescript extension",
  );
  // 소스 관련이면 source 타입으로 반환
  if (reasons.length > 0)
    return { fileType: "source", reasons, requiresReview: false };
  // 그 외에는 unknown 타입으로 reasons 배열 안에는 unclassified와 함께 반환
  return {
    fileType: "unknown",
    reasons: ["unclassified"],
    requiresReview: true,
  };
}

/**
 * 변경 파일 경로를 Phase M의 fileType metadata로 분류합니다.
 * 이 함수는 diff나 파일 내용을 읽지 않으며 Git 상태도 변경하지 않습니다.
 * @param {string[]} files - 변경된 파일 경로 배열
 * @returns {{file: string, fileType: string, reasons: string[], requiresReview: boolean}[]} - 파일 유형 분류 결과
 */
export function classifyChangedFiles(files) {
  // 파일 배열이 유효한지 확인
  if (!Array.isArray(files)) {
    throw new TypeError("files must be an array");
  }

  // 각 파일을 파일 유형으로 분류
  return files.map((file) => {
    // 파일명 정규화
    const normalizedFile = normalizePath(file);
    // 파일 유형 분류
    const classification = classifyFile(normalizedFile);

    // 파일 유형과 reasons 배열을 반환
    return {
      file: normalizedFile,
      fileType: classification.fileType,
      reasons: classification.reasons,
      requiresReview: classification.requiresReview,
    };
  });
}
/**
 * 파일 분류 객체에서 파일 유형을 추출합니다.
 *
 * @param {*} classification - 파일 분류 객체
 * @returns {string} - 파일 유형
 */
function getFileType(classification = {}) {
  // 파일 유형을 반환, 또는 unknown 반환
  return classification.fileType || "unknown";
}

/**
 * 규칙을 기반으로 파일 유형을 요약합니다.
 *
 * @param {*} file - 파일 경로
 * @param {*} intent - 변경 의도
 * @param {*} fileType - 파일 유형
 * @returns {string} - 파일 유형 요약
 */
function summarizeByRules(file, intent, fileType) {
  // 파일명 정규화
  const normalizedFile = normalizePath(file);
  // 파일명 추출
  const target = getBaseName(normalizedFile) || "changed file";

  // 파일 유형에 따라 요약
  if (fileType === "docs") return "문서 변경";
  if (fileType === "test") return "테스트 변경";
  if (fileType === "style") return "스타일 변경";
  if (fileType === "dependency") return "의존성 변경";
  if (fileType === "config") return "설정 변경";
  if (fileType === "generated") return "생성 파일 변경";
  if (intent === "fix") return `${target} 수정`;
  if (intent === "feat") return `${target} 기능 변경`;
  if (intent === "refactor") return `${target} 구조 개선`;

  // 그 외의 경우는 변경
  return `${target} 변경`;
}

/**
 * AI 호출 없이 파일 유형과 diff 신호만으로 변경 의도를 추정합니다.
 * 외부 전송 비용과 위험을 줄이기 위한 기본 경로입니다.
 * @param {*} file - 파일 경로
 * @param {*} diff - diff 내용
 * @param {*} classification - 파일 분류 객체
 * @returns {{intent: string, confidence: string}} - 변경 의도
 */
export function inferIntentByRules({
  file,
  diff = "",
  classification = {},
} = {}) {
  // 파일명 정규화
  const normalizedFile = normalizePath(file);
  // 파일 유형 추출
  const fileType = getFileType(classification);
  // diff 내용 소문자 변환
  const lowerDiff = String(diff ?? "").toLowerCase();
  // 의도와 자신감 초기화
  let intent = "chore";
  let confidence = "low";

  // 파일 유형에 따라 의도와 자신감 설정
  if (fileType === "docs") {
    intent = "docs";
    confidence = "high";
  } else if (fileType === "test") {
    intent = "test";
    confidence = "high";
  } else if (fileType === "style") {
    intent = "style";
    confidence = "high";
  } else if (
    ["dependency", "config", "generated", "unknown"].includes(fileType)
  ) {
    intent = "chore";
    confidence = fileType === "unknown" ? "low" : "medium";
  } else if (
    /\b(?:fix|bug|error|exception|fail|failure|regression)\b/u.test(lowerDiff)
  ) {
    intent = "fix";
    confidence = "medium";
  } else if (
    /\b(?:export|new command|new option|add|added|create|created)\b/u.test(
      lowerDiff,
    )
  ) {
    intent = "feat";
    confidence = "medium";
  } else if (
    /\b(?:refactor|rename|move|split|extract|cleanup|restructure)\b/u.test(
      lowerDiff,
    )
  ) {
    intent = "refactor";
    confidence = "medium";
  }

  // 변경 의도, 요약, 자신감, 소스를 반환
  return {
    file: normalizedFile,
    intent,
    summary: summarizeByRules(normalizedFile, intent, fileType),
    confidence,
    source: "rule",
  };
}

/**
 * 파일 분류 객체에서 의도 분석을 위해 AI를 사용할지 여부를 결정합니다.
 * option, config에 관한 값들의 우선순위를 기반으로 AI 사용 여부를 결정합니다.
 *
 * @param {*} config
 * @param {*} options
 * @returns
 */
function shouldUseAIForIntent(config = {}, options = {}) {
  return Boolean(
    options.useAI || config.useAIForIntent || config.intentAnalysisProvider,
  );
}

/**
 * 외부 전송 승인 여부를 확인합니다.
 * @param {*} file - 파일 경로
 * @param {*} config - 설정 객체
 * @param {*} options - 옵션 객체
 * @param {*} masked - 마스킹 정보
 * @returns {Promise<boolean>} - 외부 전송 승인 여부
 */
async function hasExternalTransmissionApproval({
  file,
  config,
  options,
  masked,
}) {
  // 외부 전송 승인 여부를 확인
  if (
    options.externalTransmissionApproved === true ||
    config.externalTransmissionApproved === true
  ) {
    return true;
  }

  // 외부 전송 승인 여부를 확인 callback 함수 설정 확인
  const callback =
    options.confirmExternalTransmission ?? config.confirmExternalTransmission;
  // callback 함수가 유효하지 않으면 false 반환
  if (typeof callback !== "function") {
    return false;
  }

  // 확인 callback에는 diff 원문을 넘기지 않고 최소 metadata만 전달합니다.
  return Boolean(
    await callback({
      file,
      provider: config.provider ?? "mock",
      masked: masked.found,
      maskedSecretCount: masked.count,
      purpose: "diff-intent-analysis",
    }),
  );
}

/**
 * AI 응답에서 의도 정보를 파싱합니다.
 * JSON 형식 또는 기존 line 기반 응답 형식을 파싱할 수 있습니다.
 *
 * @param {*} response - AI 응답
 * @returns {{intent: string, summary: string, confidence: string} | null} - 파싱된 의도 정보
 */
function parseIntentResponse(response) {
  // 유효하지 않은 응답이면 null 반환
  if (typeof response !== "string" || response.trim().length === 0) {
    return null;
  }
  // 응답에서 ```json 또는 ```를 제거
  const trimmed = response
    .trim()
    .replace(/^```(?:json)?/iu, "")
    .replace(/```$/u, "")
    .trim();

  // JSON 형식 응답 처리
  try {
    // JSON 파싱
    return {
      intent: parsed.intent,
      summary: parsed.summary,
      confidence: parsed.confidence,
    };
  } catch {
    // JSON이 아니면 기존 line 기반 응답 형식만 조용히 파싱합니다.
  }

  // line 기반 응답 형식 처리
  const result = {};
  // trim된 응답을 줄바꿈으로 나눔
  for (const line of trimmed.split(/\r?\n/u)) {
    // line에서 ":"이 존재하는 줄만 파싱
    const separatorIndex = line.indexOf(":");
    // ":"이 존재하지 않으면 건너뜀
    if (separatorIndex === -1) continue;

    // ":" 앞부분을 key로 파싱
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    // ":" 뒷부분을 value로 파싱
    const value = line.slice(separatorIndex + 1).trim();
    // key가 intent, summary, confidence 중 하나이면 result에 추가
    if (["intent", "summary", "confidence"].includes(key)) {
      result[key] = value;
    }
  }

  // 결과가 존재하면 반환
  // 존재하지 않는다면 null 반환
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * AI 응답에서 유효한 intent인지 확인하고 정규화합니다.
 *
 * @param {*} intent - AI 응답
 * @returns {string} - 정규화된 intent
 */
function normalizeIntent(intent) {
  // 유효하지 않은 intent이면 chore로 반환
  return VALID_INTENTS.includes(intent) ? intent : "chore";
}

/**
 * AI 응답에서 유효한 intent인지 확인하고 정규화합니다.
 * JSON 형식 또는 기존 line 기반 응답 형식을 파싱할 수 있습니다.
 *
 * @param {*} result - AI 응답
 * @param {*} fallback - fallback 정보
 * @returns {{intent: string, summary: string, confidence: string} | null} - 파싱된 의도 정보
 */
function normalizeIntentResult(result, fallback) {
  // result가 유효하지 않으면 fallback으로 반환
  if (!result || typeof result !== "object") {
    return fallback;
  }

  // result.intent가 유효하지 않으면 "chore"로 설정
  const intent = normalizeIntent(
    String(result.intent ?? "")
      .trim()
      .toLowerCase(),
  );
  // result.summary가 유효하지 않으면 fallback.summary로 설정
  const summary =
    typeof result.summary === "string" && result.summary.trim().length > 0
      ? result.summary.trim()
      : fallback.summary;
  // confidence가 유효하지 않으면 "medium"으로 설정
  const confidence = ["high", "medium", "low"].includes(result.confidence)
    ? result.confidence
    : "medium";

  // 각 file, intent, summary, confidence, source 정보를 담은 객체 반환
  return {
    file: fallback.file,
    intent,
    summary,
    confidence,
    source: "ai",
  };
}

/**
 *
 * 분석 메서드의 인자를 정규화합니다.
 *
 * @param {*} fileOrParams - 파일 경로 또는 파일 정보 객체
 * @param {*} diff - diff 정보
 * @param {*} config - 설정 객체
 * @param {*} options - 옵션 객체
 * @returns {{file: string, diff: string, classification: string, config: Object, language: string, options: Object}}
 */
function normalizeAnalyzeArgs(fileOrParams, diff, config, options) {
  // 첫 번째 인자가 객체인지 확인합니다.
  if (
    fileOrParams &&
    typeof fileOrParams === "object" &&
    !Array.isArray(fileOrParams)
  ) {
    // 첫 번째 인자가 객체이면 객체에서 정보를 추출합니다.
    return {
      file: fileOrParams.file,
      diff: fileOrParams.diff,
      classification: fileOrParams.classification,
      config: fileOrParams.config ?? {},
      language: fileOrParams.language ?? "ko",
      options: fileOrParams.options ?? {},
    };
  }

  // 첫 번째 인자가 객체가 아니면 첫 번째 인자와 나머지를 분리합니다.
  return {
    file: fileOrParams,
    diff,
    classification: options?.classification,
    config: config ?? {},
    language: options?.language ?? "ko",
    options: options ?? {},
  };
}

/**
 * 파일별 diff의 변경 의도를 분석합니다.
 * 기본은 rule fallback이고, AI 사용은 명시 옵션과 외부 전송 확인을 모두 통과해야 합니다.
 *
 * @param {string|Object} fileOrParams - 파일 경로 또는 파일 정보 객체
 * @param {string} diff - diff 정보
 * @param {Object} config - 설정 객체
 * @param {Object} options - 옵션 객체
 * @returns {{file: string, intent: string, summary: string, confidence: string, source: string}}
 */
export async function analyzeDiffIntent(
  fileOrParams,
  diff,
  config = {},
  options = {},
) {
  // 분석 메서드의 인자를 정규화합니다.
  const params = normalizeAnalyzeArgs(fileOrParams, diff, config, options);
  // 파일 경로 정규화
  const file = normalizePath(params.file);

  // 파일 경로가 유효하지 않으면 에러 반환
  if (!file) {
    throw new TypeError("file must be a non-empty string");
  }

  // diff가 유효하지 않으면 에러 반환
  if (typeof params.diff !== "string" || params.diff.trim().length === 0) {
    throw new TypeError("diff must be a non-empty string");
  }

  // 파일 분류
  const classification =
    params.classification ?? classifyChangedFiles([file])[0];
  // rule 기반으로 의도 추론
  const fallback = inferIntentByRules({
    file,
    diff: params.diff,
    classification,
  });

  // AI 사용 여부 및 민감 파일 여부 확인
  // 민감 파일인 경우 fallback 반환
  if (
    !shouldUseAIForIntent(params.config, params.options) ||
    isSensitiveFile(file)
  ) {
    return fallback;
  }

  // 민감 정보 마스킹
  const masked = maskSensitiveDiff(params.diff);
  // 외부 전송 승인 확인
  const approved = await hasExternalTransmissionApproval({
    file,
    config: params.config,
    options: params.options,
    masked,
  });

  // 외부 전송 승인되지 않은 경우 fallback 반환
  if (!approved) {
    return fallback;
  }

  // 변경 의도 분석 프롬프트 생성
  const prompt = buildIntentPrompt({
    file,
    diff: masked.diff,
    language: params.language,
    classification,
  });

  // AI 응답 파싱
  try {
    // AI 호출
    const response = await generateWithProvider({
      prompt,
      config: params.config,
    });
    // AI 응답 파싱
    return normalizeIntentResult(parseIntentResponse(response), fallback);
  } catch (providerError) {
    // providerError가 Error의 instance이고 message에 "unsupported provider" 또는 "does not implement"가 포함된 경우
    if (
      providerError instanceof Error &&
      /unsupported provider|does not implement/iu.test(providerError.message)
    ) {
      // 에러 발생
      throw providerError;
    }
    // fallback 반환
    return {
      ...fallback,
      summary: `${fallback.summary} (분석 fallback)`,
      source: "fallback",
    };
  }
}

/**
 * 여러 파일 diff를 순차 분석합니다.
 * 각 파일 실패는 가능한 경우 rule fallback으로 격리하고, raw diff는 로그로 출력하지 않습니다.
 *
 * @param {
 *  fileDiffs: Array<{file: string, diff: string}>,  // 파일별 diff
 *  classifications?: Array<{file: string, classification: string}>, // 파일 분류
 *  config?: Object, // 설정 객체
 *  language?: string, // 언어
 *  options?: Object // 옵션 객체
 * }
 * @returns {
 *  Promise<Array<{
 *    file: string, // 파일 경로
 *    intent: string, // 변경 의도
 *    summary: string, // 변경 요약
 *    confidence: string, // 신뢰도
 *    source: string // 분석 소스
 *  }>>
 * }
 */
export async function analyzeDiffIntents({
  fileDiffs,
  classifications = [],
  config = {},
  language = "ko",
  options = {},
} = {}) {
  // 매개변수 유효성 검증
  if (!Array.isArray(fileDiffs)) {
    throw new TypeError("fileDiffs must be an array");
  }

  // 파일 분류 맵 생성
  const classificationMap = new Map(
    classifications.map((classification) => [
      normalizePath(classification.file),
      classification,
    ]),
  );
  // 결과 배열 생성 및 초기화
  const results = [];

  // 파일별 diff 분석
  for (const fileDiff of fileDiffs) {
    // 파일 경로 정규화
    const file = normalizePath(fileDiff.file);
    // 분석 결과 추가
    results.push(
      await analyzeDiffIntent({
        file,
        diff: fileDiff.diff,
        classification: classificationMap.get(file),
        config,
        language,
        options,
      }),
    );
  }

  // 결과 반환
  return results;
}

/**
 * 그룹화 아이템 정규화
 *
 * @param {Object} item - 그룹화 아이템
 * @returns {Object} - 정규화된 그룹화 아이템
 */
function normalizeGroupingItem(item) {
  // 파일 경로 정규화
  const file = normalizePath(item?.file);
  // 파일 경로가 없으면 null 반환
  if (!file) return null;

  // 파일 분류
  const inferredClassification = item.fileType
    ? { fileType: item.fileType, requiresReview: item.requiresReview }
    : classifyChangedFiles([file])[0];
  // 파일 타입
  const fileType = inferredClassification.fileType || "unknown";
  // 변경 의도
  const intent = normalizeIntent(
    String(
      item.intent ??
        inferIntentByRules({ file, classification: inferredClassification })
          .intent,
    ),
  );
  // 파일 영역
  const area = getFileArea(file);

  // 정규화된 그룹화 아이템 반환
  return {
    file,
    fileType,
    intent,
    summary: typeof item.summary === "string" ? item.summary.trim() : "",
    area,
    requiresReview: Boolean(
      item.requiresReview || inferredClassification.requiresReview,
    ),
  };
}

/**
 * 그룹 키 생성
 * @param {*} item - 그룹화 아이템
 * @returns {string} - 그룹 키
 */
function buildGroupKey(item) {
  // dependency, config, generated, unknown 파일의 경우
  if (
    ["dependency", "config", "generated", "unknown"].includes(item.fileType)
  ) // chore 타입으로 그룹화
  {
    return `chore:${item.fileType}:${item.area}`;
  }

  // 나머지 경우는 intent, fileType, area로 그룹화
  return `${item.intent}:${item.fileType}:${item.area}`;
}

/**
 * 그룹 타입 선택
 * @param {Object} items - 그룹화 아이템 배열
 * @returns {string} - 그룹 타입
 */
function selectGroupType(items) {
  // 파일 타입 배열 생성
  const fileTypes = new Set(items.map((item) => item.fileType));
  // docs 타입이 하나만 있는 경우
  if (fileTypes.size === 1 && fileTypes.has("docs")) return "docs";
  // test 타입이 하나만 있는 경우
  if (fileTypes.size === 1 && fileTypes.has("test")) return "test";
  // dependency, config, generated, unknown 파일만 있는 경우
  if (
    [...fileTypes].every((fileType) =>
      ["dependency", "config", "generated", "unknown"].includes(fileType),
    )
  ) // chore 리턴
  {
    return "chore";
  }

  // intent 별 count map 생성
  const counts = new Map();
  // 아이템 배열 순회
  for (const item of items) {
    // intent 정규화
    const intent = normalizeIntent(item.intent);
    // count 증가
    counts.set(intent, (counts.get(intent) ?? 0) + 1);
  }

  // 가장 많이 나온 intent 선택
  return (
    // intent 우선순위에 따라 가장 많이 나온 intent 선택
    INTENT_PRIORITY.reduce((selected, intent) => {
      // selected가 없으면 현재 intent 선택
      if (!selected) return intent;
      // 현재 intent의 count
      const currentCount = counts.get(intent) ?? 0;
      // selected의 count
      const selectedCount = counts.get(selected) ?? 0;
      // 현재 intent의 count가 selected의 count보다 많으면 현재 intent 선택
      return currentCount > selectedCount ? intent : selected;
    }, null) ?? "chore" // 기본값은 chore
  );
}

/**
 * 그룹 이름 선택
 * @param {Object} items - 그룹화 아이템 배열
 * @param {string} type - 그룹 타입
 * @returns {string} - 그룹 이름
 */
function selectGroupName(items, type) {
  // 파일 경로 기준으로 정렬
  const sortedItems = [...items].sort((a, b) => a.file.localeCompare(b.file));
  // 첫 번째 source 파일 찾기
  const primary =
    sortedItems.find((item) => item.fileType === "source") ?? sortedItems[0];
  // area slugify
  const area = slugify(primary?.area, "misc");

  // 그룹 이름 반환
  return `${type}-${area}`;
}

/**
 * 그룹 병합
 * @param {Object} target - 병합할 그룹
 * @param {Object} source - 병합할 그룹
 * @returns {void}
 */
function mergeGroup(target, source) {
  // 타겟 그룹에 소스 그룹의 아이템 추가
  target.items.push(...source.items);
}

/**
 * 관련 그룹 찾기
 * @param {Object} group - 그룹
 * @param {Array} groups - 그룹 배열
 * @returns {Object|null} - 관련 그룹
 */
function findRelatedGroup(group, groups) {
  // 그룹의 첫 번째 아이템
  const item = group.items[0];
  // 첫 번째 아이템이 없으면 null
  if (!item) return null;

  // 같은 그룹 제외
  // generated 파일이 포함된 그룹 제외
  // area가 같거나 파일 이름이 같은 그룹 찾기
  return (
    // 그룹 배열 순회
    groups.find((candidate) => {
      // 순회하면서 group과 동일할 경우 false 반환
      if (candidate === group) return false;
      // 순회하면서 generated 파일이 포함된 그룹일 경우 false 반환
      if (
        candidate.items.some(
          (candidateItem) => candidateItem.fileType === "generated",
        )
      )
        // 순회하면서 generated 파일이 포함된 그룹일 경우 false 반환
        return false;

      // 순회하면서 area가 같거나 파일 이름이 같은 그룹 찾기
      return candidate.items.some(
        // 순회하면서 area가 같거나 파일 이름이 같은 그룹 찾기
        (candidateItem) =>
          // area가 같은 경우
          candidateItem.area === item.area ||
          // 파일 이름이 같은 경우
          withoutExtension(candidateItem.file) === withoutExtension(item.file),
      );
    }) ??
    // 관련 그룹이 없으면 null 반환
    null
  );
}

/**
 * 파일 개수가 너무 적은 그룹 병합
 * @param {Array} groups - 그룹 배열
 * @param {number} minGroupFileCount - 최소 그룹 파일 개수
 * @returns {Array} - 병합된 그룹 배열
 */
function mergeTooSmallGroups(groups, minGroupFileCount) {
  // 그룹 배열 복사
  const workingGroups = groups.map((group) => ({
    ...group,
    items: [...group.items],
  }));
  // 기타 그룹 생성
  const miscGroup = { key: "chore:unknown:misc", items: [] };

  // workingGroups 순회
  for (const group of [...workingGroups]) {
    // workingGroups에 포함되지 않은 경우 continue
    if (!workingGroups.includes(group)) continue;
    // 그룹 파일 개수가 최소 그룹 파일 개수 이상이면 continue
    if (group.items.length >= minGroupFileCount) continue;
    // 파일 타입 배열 생성
    const fileTypes = new Set(group.items.map((item) => item.fileType));
    // 독립 실행 파일이 포함된 경우 continue
    if ([...fileTypes].some((fileType) => STANDALONE_FILE_TYPES.has(fileType)))
      continue;

    // 관련 그룹 찾기
    const relatedGroup = findRelatedGroup(group, workingGroups);
    // 관련 그룹이 있으면
    if (relatedGroup) {
      // 관련 그룹에 현재 그룹 병합
      mergeGroup(relatedGroup, group);
      // workingGroups에서 현재 그룹 제거
      workingGroups.splice(workingGroups.indexOf(group), 1);
      // 다음 그룹 순회
      continue;
    }

    // unknown 파일이 있거나 chore intent가 있으면
    if (
      // unknown 파일이 있거나
      [...fileTypes].some((fileType) => fileType === "unknown") ||
      // chore intent가 있으면
      group.items.some((item) => item.intent === "chore")
    ) {
      // 기타 그룹에 현재 그룹 병합
      mergeGroup(miscGroup, group);
      // workingGroups에서 현재 그룹 제거
      workingGroups.splice(workingGroups.indexOf(group), 1);
    }
  }

  // 기타 그룹이 있으면 workingGroups에 추가
  if (miscGroup.items.length > 0) {
    workingGroups.push(miscGroup);
  }

  // 최종 그룹 반환
  return workingGroups;
}

/**
 * 그룹 마무리
 * @param {Object} group - 그룹
 * @returns {Object} - 마무리된 그룹
 */
function finalizeGroup(group) {
  // 그룹 아이템 배열 정렬
  const items = [...group.items].sort((a, b) => a.file.localeCompare(b.file));
  // 타입 선택
  const type = selectGroupType(items);
  // 파일 타입 배열 생성
  const fileTypes = [...new Set(items.map((item) => item.fileType))].sort();
  // 요약 배열 생성
  const summaries = [
    ...new Set(items.map((item) => item.summary).filter(Boolean)),
  ];

  // 최종 그룹 반환
  return {
    groupName: selectGroupName(items, type),
    type,
    intent: type,
    files: items.map((item) => item.file),
    fileTypes,
    summaries,
    summary: summaries.join(", "),
    requiresReview: items.some((item) => item.requiresReview),
  };
}

/**
 * 그룹 정렬
 *
 * @param {Array} groups - 그룹 배열
 * @returns {Array} - 정렬된 그룹 배열
 */
function sortGroups(groups) {
  // 그룹 배열 정렬
  return groups.sort((a, b) => {
    // 타입 우선순위 비교
    const typeCompare =
      INTENT_PRIORITY.indexOf(a.type) - INTENT_PRIORITY.indexOf(b.type);
    // 타입이 다르면 타입 우선순위 비교 결과 반환
    if (typeCompare !== 0) return typeCompare;

    // 그룹 이름 비교
    const nameCompare = a.groupName.localeCompare(b.groupName);
    // 그룹 이름이 다르면 그룹 이름 비교 결과 반환
    if (nameCompare !== 0) return nameCompare;
    // 첫 번째 파일 비교
    return (a.files[0] ?? "").localeCompare(b.files[0] ?? "");
  });
}

/**
 * 파일 metadata를 변경 의도별 commit 후보 그룹으로 묶습니다.
 * provider 호출이나 Git 변경 없이 결정적 결과만 반환합니다.
 *
 * @param {Array} items - 파일 metadata 배열
 * @param {Object} options - 옵션
 * @param {number} options.minGroupFileCount - 최소 그룹 파일 개수
 * @returns {Array} - 그룹 배열
 */
export function groupFilesByIntent(items, options = {}) {
  // 만약 items 배열이 아니거나 비어있다면 빈 배열 반환
  if (!Array.isArray(items) || items.length === 0) return [];
  // 최소 그룹 파일 개수 설정
  const minGroupFileCount = Number.isInteger(options.minGroupFileCount)
    ? options.minGroupFileCount
    : 2;
  // 정규화된 아이템 배열
  const normalizedItems = [];
  // 중복 파일 확인
  const seenFiles = new Set();

  // 아이템 배열 순회
  for (const item of items) {
    // 아이템 정규화
    const normalized = normalizeGroupingItem(item);
    // 정규화 실패 또는 중복 파일 확인
    if (!normalized || seenFiles.has(normalized.file)) continue;
    // 중복 파일 추가
    seenFiles.add(normalized.file);
    // 정규화된 아이템 추가
    normalizedItems.push(normalized);
  }

  // 정규화된 아이템 배열 정렬
  normalizedItems.sort((a, b) => a.file.localeCompare(b.file));

  // 그룹 맵 생성
  const groupsMap = new Map();
  // 정규화된 아이템 배열 순회
  for (const item of normalizedItems) {
    // 그룹 키 생성
    const key = buildGroupKey(item);
    // 그룹 맵에 키가 없으면 그룹 생성
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { key, items: [] });
    }
    // 그룹 맵에 키가 있으면 그룹에 아이템 추가
    groupsMap.get(key).items.push(item);
  }

  // 파일 개수가 너무 적은 그룹 병합
  const mergedGroups = mergeTooSmallGroups(
    [...groupsMap.values()],
    minGroupFileCount,
  );
  // 그룹 마무리
  return sortGroups(mergedGroups.map(finalizeGroup));
}
