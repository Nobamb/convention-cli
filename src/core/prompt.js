import { SUPPORTED_LANGUAGES, SUPPORTED_MODES } from "../config/defaults.js";

// Conventional Commits 타입
const ALLOWED_TYPES = ["feat", "fix", "refactor", "docs", "style", "test", "chore"];

// Conventional Commits 타입에 대한 언어별 지시사항
const LANGUAGE_INSTRUCTIONS = {
  ko: "Write the commit subject in Korean.",
  en: "Write the commit subject in English.",
  jp: "Write the commit subject in Japanese.",
  cn: "Write the commit subject in Chinese.",
};

// Conventional Commits 타입에 대한 모드별 지시사항
const MODE_INSTRUCTIONS = {
  step: "The diff represents a single file or one file-level change. Make the subject specific to that file-level change.",
  batch: "The diff represents the whole working tree change. Summarize the complete change as one commit subject.",
};

/**
 * @description 언어 안전 설정
 * @param {string} language 
 * @returns {string} 
 */
function getSafeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : "ko";
}
/**
 * @description 모드 안전 설정
 * @param {string} mode 
 * @returns {string} 
 */
function getSafeMode(mode) {
  return SUPPORTED_MODES.includes(mode) ? mode : "step";
}

/**
 * @description 재생성 지시사항 생성
 * @param {string} previousMessage 
 * @returns {string[]} 
 */
function buildRegenerationInstructions(previousMessage) {
  // 이전 메시지가 유효하지 않은 경우 빈 배열 반환
  if (typeof previousMessage !== "string" || previousMessage.trim().length === 0) {
    return [];
  }

  return [
    "",
    // 재생성에서는 기존 메시지와 다른 표현을 요구하되 변경 의미는 유지합니다.
    "Regenerate the commit message.",
    `Previous message: ${previousMessage.trim()}`,
    "Use a meaningfully different wording from the previous message while preserving the same change summary.",
    "Keep the same Conventional Commits format and configured output language.",
    "Return only the new commit message.",
  ];
}

/**
 * 일반 diff를 기반으로 Conventional Commits 메시지를 만들기 위한 prompt를 생성합니다.
 */
export function buildCommitPrompt({
  diff,
  language = "ko",
  mode = "step",
  previousMessage,
} = {}) {
  // diff 유효성 검증
  if (typeof diff !== "string" || diff.trim().length === 0) {
    throw new TypeError("diff must be a non-empty string");
  }

  // 언어 및 모드 안전 설정
  const safeLanguage = getSafeLanguage(language);
  // 모드 안전 설정
  const safeMode = getSafeMode(mode);
  // 재생성 지시사항 생성
  const regenerationInstructions = buildRegenerationInstructions(previousMessage);

  // 프롬프트 생성
  return [
    "You are generating a Git commit message from a Git diff.",
    "",
    "Return only one final commit message.",
    "Do not return explanations, alternatives, markdown, code fences, or surrounding quotes.",
    "",
    "Use the Conventional Commits format:",
    "<type>: <subject>",
    "",
    `Allowed types: ${ALLOWED_TYPES.join(", ")}`,
    "Choose the most accurate type from the allowed list only.",
    LANGUAGE_INSTRUCTIONS[safeLanguage],
    MODE_INSTRUCTIONS[safeMode],
    "",
    "Keep the message concise and suitable for git commit -m.",
    "Do not include sensitive values from the diff in the commit message.",
    ...regenerationInstructions,
    "",
    "Git diff:",
    diff,
  ].join("\n");
}

/**
 * 대용량 diff chunk를 최종 커밋 메시지가 아닌 짧은 변경 요약으로 바꾸기 위한 prompt를 생성합니다.
 */
export function buildChunkSummaryPrompt({ chunk, language = "ko" } = {}) {
  // chunk 유효성 검증
  if (!chunk || typeof chunk.diff !== "string" || chunk.diff.trim().length === 0) {
    throw new TypeError("chunk.diff must be a non-empty string");
  }

  // 언어 안전 설정
  const safeLanguage = getSafeLanguage(language);
  // 파일 목록 설정
  const files =
    Array.isArray(chunk.files) && chunk.files.length > 0
      ? chunk.files
      : [chunk.file || "unknown"];

  // 프롬프트 생성
  return [
    "You are summarizing one Git diff chunk.",
    "",
    "Summarize only the purpose and major changes in this chunk.",
    "Do not write a commit message.",
    "Do not write a PR title or PR body.",
    "Do not use Conventional Commits format.",
    "Do not quote or copy raw diff lines, long code snippets, or secrets.",
    "If a value looks sensitive, refer to it as [REDACTED].",
    "Return only a short summary in 1-3 sentences or concise bullets.",
    LANGUAGE_INSTRUCTIONS[safeLanguage],
    "",
    `Chunk index: ${chunk.index ?? "unknown"}`,
    `Chunk type: ${chunk.chunkType ?? "unknown"}`,
    `Files: ${files.join(", ")}`,
    `Part: ${chunk.part ?? 1}/${chunk.totalParts ?? 1}`,
    "",
    "Git diff chunk:",
    chunk.diff,
  ].join("\n");
}

/**
 * 대용량 diff 원문 대신 병합 요약만 사용해 최종 커밋 메시지 prompt를 생성합니다.
 */
export function buildSummaryCommitPrompt({
  summary,
  language = "ko",
  mode = "step",
  previousMessage,
} = {}) {
  // summary 유효성 검증
  if (typeof summary !== "string" || summary.trim().length === 0) {
    throw new TypeError("summary must be a non-empty string");
  }

  // 언어 안전 설정
  const safeLanguage = getSafeLanguage(language);
  // 모드 안전 설정
  const safeMode = getSafeMode(mode);
  // 재생성 지시사항 생성
  const regenerationInstructions = buildRegenerationInstructions(previousMessage);

  // 프롬프트 생성
  return [
    "You are generating a Git commit message from a summarized large Git diff.",
    "",
    "Return only one final commit message.",
    "Do not return explanations, alternatives, markdown, code fences, or surrounding quotes.",
    "",
    "Use the Conventional Commits format:",
    "<type>: <subject>",
    "",
    `Allowed types: ${ALLOWED_TYPES.join(", ")}`,
    "Choose the most accurate type from the allowed list only.",
    LANGUAGE_INSTRUCTIONS[safeLanguage],
    MODE_INSTRUCTIONS[safeMode],
    "",
    "Keep the message concise and suitable for git commit -m.",
    "Do not include sensitive values from the summary in the commit message.",
    "The original diff was large, so only the merged summary is provided.",
    ...regenerationInstructions,
    "",
    "Merged change summary:",
    summary,
  ].join("\n");
}
