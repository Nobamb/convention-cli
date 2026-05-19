import { SUPPORTED_LANGUAGES, SUPPORTED_MODES } from "../config/defaults.js";
import { TEMPLATE_DEFAULT_TYPES } from "../templates/schema.js";

// Conventional Commits 타입
const ALLOWED_TYPES = [...TEMPLATE_DEFAULT_TYPES];

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
  batch:
    "The diff represents the whole working tree change. Summarize the complete change as one commit subject.",
};

// template 글자 수 최대 72글자로 제한
const DEFAULT_TEMPLATE_MAX_LENGTH = 72;

/**
 * @description 템플릿 값이 실제로 전달되었는지 확인합니다.
 * @param {object | null | undefined} template
 * @returns {boolean}
 */
function hasTemplate(template) {
  return template !== null && typeof template === "object";
}

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
 * @description 템플릿 language가 유효한 경우 config language보다 우선 적용합니다.
 * @param {object | null | undefined} template
 * @param {string} configLanguage
 * @returns {string}
 */
function resolvePromptLanguage(template, configLanguage) {
  // 언어 우선순위는 팀 컨벤션 일관성을 위해 아래 순서를 고정합니다.
  // 1. 유효한 template.language
  // 2. 유효한 config language
  // 3. 기본값 ko
  if (
    hasTemplate(template) &&
    SUPPORTED_LANGUAGES.includes(template.language)
  ) {
    return template.language;
  }

  return getSafeLanguage(configLanguage);
}

/**
 * @description 템플릿의 허용 타입을 안전하게 정리합니다.
 * @param {object | null | undefined} template
 * @returns {string[]}
 */
function resolveAllowedTypes(template) {
  // 선행 validator가 템플릿을 검증하더라도 prompt 단계에서 한 번 더 방어적으로 걸러냅니다.
  // 지원하지 않는 type을 조용히 통과시키면 AI가 프로젝트 규칙 밖의 메시지를 만들 수 있습니다.
  if (!hasTemplate(template) || !Array.isArray(template.types)) {
    return ALLOWED_TYPES;
  }

  // 허용된 타입만 필터링합니다.
  const safeTypes = template.types.filter(
    (type) => typeof type === "string" && ALLOWED_TYPES.includes(type),
  );

  // 허용된 타입이 하나라도 있으면 반환합니다.
  return safeTypes.length > 0 ? safeTypes : ALLOWED_TYPES;
}

/**
 * @description 템플릿 format이 최소 placeholder를 갖췄는지 확인합니다.
 * @param {object | null | undefined} template
 * @returns {string | null}
 */
function resolveTemplateFormat(template) {
  //
  if (!hasTemplate(template) || typeof template.format !== "string") {
    return null;
  }

  // format의 공백을 제거합니다.
  const format = template.format.trim();
  // format에 {type}이 포함되어 있는지 확인합니다.
  const hasType = format.includes("{type}");
  // format에 {message} 또는 {subject}가 포함되어 있는지 확인합니다.
  const hasMessage =
    format.includes("{message}") || format.includes("{subject}");

  // format이 깨져 있으면 prompt 생성을 중단하지 않고 기본 Conventional Commits 지시를 유지합니다.
  return format.length > 0 && hasType && hasMessage ? format : null;
}

/**
 * @description 템플릿의 제목 길이 제한을 결정합니다.
 * @param {object | null | undefined} template
 * @returns {number | null}
 */
function resolveMaxLength(template) {
  // 템플릿이 유효하지 않으면 최대 길이를 반환하지 않습니다.
  if (!hasTemplate(template)) {
    return null;
  }

  // 템플릿의 규칙에서 최대 길이를 가져옵니다.
  const maxLength = template.rules?.maxLength;
  // maxLength가 유효한 정수이면 반환합니다.
  return Number.isInteger(maxLength) && maxLength > 0
    ? maxLength
    : DEFAULT_TEMPLATE_MAX_LENGTH;
}

/**
 * @description 템플릿 기반 prompt 지시문을 만듭니다.
 * @param {object | null | undefined} template
 * @returns {string[]}
 */
function buildTemplateInstructions(template) {
  // 템플릿이 유효하지 않으면 지시문을 반환하지 않습니다.
  if (!hasTemplate(template)) {
    return [];
  }

  // 지시문 배열을 초기화합니다.
  const instructions = ["", "Template rules:"];
  // format을 resolve합니다.
  const format = resolveTemplateFormat(template);
  // maxLength를 resolve합니다.
  const maxLength = resolveMaxLength(template);

  // format이 존재할 때 지시문을 추가합니다.
  if (format) {
    // 정확한 format을 출력하도록 지시합니다.
    instructions.push(`Follow this output format exactly: ${format}`);
    // {type}과 {message} 또는 {subject}를 넣도록 지시합니다.
    instructions.push(
      "Put one allowed type in {type} and a concise change message in {message} or {subject}.",
    );
  }

  // scope가 format에 포함되어 있고 scope가 요구사항인 경우 지시문을 추가합니다.
  if (format?.includes("{scope}") && template.rules?.requireScope === true) {
    // scope가 요구사항이라는 지시문을 추가합니다.
    instructions.push(
      "A scope is required because the template format includes {scope}.",
    );
  }

  // maxLength가 존재할 때 지시문을 추가합니다.
  if (maxLength) {
    // 제목 길이 제한 지시문을 추가합니다.
    instructions.push(
      `Keep the commit subject within ${maxLength} characters, including spaces.`,
    );
  }

  // 생성된 지시문을 반환합니다.
  return instructions;
}

/**
 * @description 재생성 지시사항 생성
 * @param {string} previousMessage
 * @returns {string[]}
 */
function buildRegenerationInstructions(previousMessage) {
  // 이전 메시지가 유효하지 않은 경우 빈 배열 반환
  if (
    typeof previousMessage !== "string" ||
    previousMessage.trim().length === 0
  ) {
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
  template,
} = {}) {
  // diff 유효성 검증
  if (typeof diff !== "string" || diff.trim().length === 0) {
    throw new TypeError("diff must be a non-empty string");
  }

  // 언어 및 모드 안전 설정
  // 템플릿 언어가 유효하면 config language보다 우선합니다. 없거나 잘못된 값이면 기존 config 흐름을 유지합니다.
  const safeLanguage = resolvePromptLanguage(template, language);
  // 모드 안전 설정
  const safeMode = getSafeMode(mode);
  // 템플릿이 없으면 기존 ALLOWED_TYPES와 동일한 지시만 사용해 기존 prompt 동작을 보존합니다.
  const allowedTypes = resolveAllowedTypes(template);
  // 템플릿이 있을 때만 format/maxLength/scope 규칙을 추가합니다.
  const templateInstructions = buildTemplateInstructions(template);
  // 재생성 지시사항 생성
  const regenerationInstructions =
    buildRegenerationInstructions(previousMessage);

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
    `Allowed types: ${allowedTypes.join(", ")}`,
    "Choose the most accurate type from the allowed list only.",
    ...templateInstructions,
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
  if (
    !chunk ||
    typeof chunk.diff !== "string" ||
    chunk.diff.trim().length === 0
  ) {
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
  template,
} = {}) {
  // summary 유효성 검증
  if (typeof summary !== "string" || summary.trim().length === 0) {
    throw new TypeError("summary must be a non-empty string");
  }

  // 언어 안전 설정
  const safeLanguage = resolvePromptLanguage(template, language);
  // 모드 안전 설정
  const safeMode = getSafeMode(mode);
  // 템플릿에서 안전하게 정리 된 값들을 받아옵니다.
  const allowedTypes = resolveAllowedTypes(template);
  // 템플릿 지시사항을 resolve합니다.
  const templateInstructions = buildTemplateInstructions(template);
  // 재생성 지시사항 생성
  const regenerationInstructions =
    buildRegenerationInstructions(previousMessage);

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
    `Allowed types: ${allowedTypes.join(", ")}`,
    "Choose the most accurate type from the allowed list only.",
    ...templateInstructions,
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

/**
 * 파일의 변경 의도를 분석하기 위한 프롬프트를 생성합니다.
 * @param {*} file - 파일 경로
 * @param {*} diff - diff 데이터
 * @param {*} language - 언어
 * @param {*} classification - classification 데이터
 * @returns {string[]} - 프롬프트 데이터
 */
export function buildIntentPrompt({
  file,
  diff,
  language = "ko",
  classification,
} = {}) {
  // AI 의도 분석을 명시적으로 켠 경우에만 이 prompt가 사용됩니다.
  const safeLanguage = getSafeLanguage(language);
  // 파일 타입 안전 설정
  const fileType =
    // classification.fileType이 string이고 길이가 0보다 크면 해당 값을 사용,
    // 아니면 unknown 사용
    typeof classification?.fileType === "string" &&
    classification.fileType.trim().length > 0
      ? classification.fileType.trim()
      : "unknown";
  // 프롬프트 생성
  return [
    "You are analyzing a Git diff to determine the intent of the change.",
    "",
    "Based on the diff below, determine the conventional commit type (intent) and a short summary.",
    "Return the result EXACTLY in the following format:",
    "intent: <feat|fix|refactor|docs|test|chore|style>",
    "summary: <short summary in the configured language>",
    LANGUAGE_INSTRUCTIONS[safeLanguage],
    "",
    `File: ${file}`,
    `File type: ${fileType}`,
    "",
    "Git diff:",
    diff,
  ].join("\n");
}

/**
 * 그룹별 커밋 메시지 프롬프트를 생성합니다.
 *
 * @param {*} groupName - 그룹 이름
 * @param {*} type - 커밋 타입
 * @param {*} files - 파일 목록
 * @param {*} summary - 변경 요약
 * @param {*} diff - diff 데이터
 * @param {*} language - 언어
 * @param {*} previousMessage - 이전 메시지
 * @returns {string} - 프롬프트 데이터
 */
export function buildGroupCommitPrompt({
  groupName,
  type,
  files,
  summary,
  diff,
  language = "ko",
  previousMessage,
  template,
} = {}) {
  // 언어 안전 설정
  const safeLanguage = resolvePromptLanguage(template, language);
  // 허용된 타입
  const allowedTypes = resolveAllowedTypes(template);
  // 템플릿 지시사항
  const templateInstructions = buildTemplateInstructions(template);
  // 재생성 지시사항
  const regenerationInstructions =
    buildRegenerationInstructions(previousMessage);
  // 프롬프트 생성
  return [
    "You are generating a Git commit message for a specific group of changed files.",
    "",
    "Return only one final commit message.",
    "Do not return explanations, alternatives, markdown, code fences, or surrounding quotes.",
    "",
    "Use the Conventional Commits format:",
    "<type>: <subject>",
    "",
    `The determined type for this group is: ${type}`,
    "Use this type or a more accurate one from the allowed list if strictly necessary.",
    `Allowed types: ${allowedTypes.join(", ")}`,
    ...templateInstructions,
    LANGUAGE_INSTRUCTIONS[safeLanguage],
    "",
    `Group Name: ${groupName}`,
    `Files in this group: ${files.join(", ")}`,
    "Keep the message concise and suitable for git commit -m.",
    "Do not include sensitive values from the diff or summary in the commit message.",
    ...regenerationInstructions,
    "",
    "Change summary for this group:",
    summary,
    "",
    "Git diff:",
    diff || "No diff provided.",
  ].join("\n");
}
