import { generateWithProvider } from "../providers/index.js";
import { redactSecrets } from "../utils/logger.js";
import { maskSensitiveDiff } from "./security.js";

// PR 제목도 커밋 메시지와 같은 Conventional Commits 타입 범위를 사용합니다.
// PR 제목이 릴리스 노트나 squash commit 제목으로 재사용되어도 프로젝트 규칙과 충돌하지 않게 하기 위함입니다.
const ALLOWED_PR_TYPES = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "style",
  "test",
  "chore",
];

// Conventional Commits 제목 형식입니다.
// scope와 breaking marker(!)는 허용하지만, type은 위 허용 목록만 통과시킵니다.
const PR_TITLE_PATTERN =
  /^(feat|fix|refactor|docs|style|test|chore)(\([^)]+\))?!?:\s+\S/u;

// PR 제목 기본 최대 길이입니다.
// 너무 긴 제목은 GitHub UI와 release note에서 가독성이 떨어지므로 생성 직후 정리합니다.
const DEFAULT_TITLE_MAX_LENGTH = 72;

/**
 * 문자열을 secret 마스킹 규칙에 통과시킵니다.
 *
 * @param {unknown} value - AI 응답 또는 사용자 입력
 * @returns {{ value: string, found: boolean, count: number }} 마스킹 결과
 */
function sanitizePrText(value) {
  // value가 유효한 string이 아닐 경우 에러
  const masked = maskSensitiveDiff(String(value ?? ""));
  return {
    value: redactSecrets(masked.diff).trim(),
    found: masked.found,
    count: masked.count,
  };
}

/**
 * 전체 응답을 감싸는 markdown code fence를 제거합니다.
 *
 * @param {string} value - AI 원문 응답
 * @returns {string} fence 제거 후 문자열
 */
function removeWrappingCodeFence(value) {
  return value
    .trim()
    .replace(/^```[a-zA-Z0-9_-]*\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

/**
 * 제목 앞에 붙은 bullet, 번호, quote 같은 장식 문자를 제거합니다.
 *
 * @param {string} value - 제목 후보
 * @returns {string} 장식 제거 후 제목 후보
 */
function removeTitlePrefix(value) {
  return value
    .replace(/^\s*[-*•]\s+/u, "")
    .replace(/^\s*\d+[.)]\s+/u, "")
    .replace(/^\s*>\s*/u, "")
    .trim();
}

/**
 * 제목 전체를 감싼 따옴표를 제거합니다.
 *
 * @param {string} value - 제목 후보
 * @returns {string} 따옴표 제거 후 제목 후보
 */
function removeWrappingQuote(value) {
  const trimmed = value.trim();
  const pairs = [
    ['"', '"'],
    ["'", "'"],
    ["`", "`"],
  ];

  for (const [open, close] of pairs) {
    if (
      trimmed.startsWith(open) &&
      trimmed.endsWith(close) &&
      trimmed.length >= 2
    ) {
      return trimmed.slice(1, -1).trim();
    }
  }

  return trimmed;
}

/**
 * 여러 줄 응답에서 첫 번째 유효한 제목 후보를 선택합니다.
 *
 * @param {string} value - AI 응답
 * @returns {string} 제목 후보
 */
function selectTitleLine(value) {
  const lines = value
    .split(/\r?\n/u)
    .map((line) => removeWrappingQuote(removeTitlePrefix(line)))
    .filter(Boolean);

  // AI가 설명을 함께 반환한 경우에도 Conventional Commits 형식의 줄을 우선 사용합니다.
  return lines.find((line) => PR_TITLE_PATTERN.test(line)) ?? lines[0] ?? "";
}

/**
 * 제목 길이를 제한합니다.
 *
 * @param {string} title - 제목 후보
 * @param {number} maxLength - 최대 길이
 * @returns {string} 길이 제한 후 제목
 */
function limitTitleLength(title, maxLength = DEFAULT_TITLE_MAX_LENGTH) {
  if (title.length <= maxLength) {
    return title;
  }

  // 너무 긴 제목은 단어 경계에서 잘라 의미가 크게 깨지지 않도록 합니다.
  const sliced = title.slice(0, Math.max(1, maxLength - 1)).trimEnd();
  return sliced.replace(/\s+\S*$/u, "").trimEnd() || sliced;
}

/**
 * AI 응답을 PR 제목 한 줄로 정리하고 검증합니다.
 *
 * @param {unknown} response - AI 원문 응답
 * @param {object} [options]
 * @param {number} [options.maxLength=72] - 제목 최대 길이
 * @returns {string} 정리된 PR 제목
 */
export function cleanPrTitle(
  response,
  { maxLength = DEFAULT_TITLE_MAX_LENGTH } = {},
) {
  const { value: safeResponse, found } = sanitizePrText(response);

  if (found) {
    throw new Error("PR title contains sensitive-looking values.");
  }

  const title = limitTitleLength(
    selectTitleLine(removeWrappingCodeFence(safeResponse)),
    maxLength,
  );

  if (!title) {
    throw new Error("PR title response was empty.");
  }

  if (!PR_TITLE_PATTERN.test(title)) {
    throw new Error(
      `PR title must use Conventional Commits type: ${ALLOWED_PR_TYPES.join(", ")}.`,
    );
  }

  return title;
}

/**
 * PR 제목 전용 provider prompt를 구성합니다.
 *
 * @param {object} params
 * @returns {string} provider prompt
 */
function buildTitlePrompt({
  prompt,
  summary,
  commitLog,
  language = "ko",
} = {}) {
  const safeSummary = sanitizePrText(summary).value;
  const safeCommitLog = sanitizePrText(commitLog).value;
  const safePrompt = sanitizePrText(prompt).value;

  return [
    "Generate exactly one GitHub Pull Request title.",
    "Use Conventional Commits format: <type>: <subject>.",
    `Allowed types: ${ALLOWED_PR_TYPES.join(", ")}`,
    "Return only the title. Do not return markdown, quotes, bullets, numbering, or explanations.",
    "Do not include secrets, tokens, API keys, passwords, private keys, raw diff lines, or credentials.",
    language === "en"
      ? "Write the subject in English."
      : language === "jp"
        ? "Write the subject in Japanese."
        : language === "cn"
          ? "Write the subject in Chinese."
          : "Write the subject in Korean.",
    "",
    "Safe PR context:",
    safePrompt || "No full PR prompt was provided.",
    "",
    "Safe change summary:",
    safeSummary || "No summary was provided.",
    "",
    "Commit log:",
    safeCommitLog || "No commit log was provided.",
  ].join("\n");
}

/**
 * provider를 통해 PR 제목을 생성하고 Conventional Commits 제목으로 정리합니다.
 *
 * @param {object} params
 * @param {string} [params.prompt] - AD 단계 PR prompt
 * @param {string} [params.summary] - 변경 요약
 * @param {string} [params.commitLog] - commit log
 * @param {object} [params.config] - provider 설정
 * @returns {Promise<string>} PR 제목
 */
export async function generatePrTitle({
  prompt,
  summary,
  commitLog,
  config = {},
} = {}) {
  const titlePrompt = buildTitlePrompt({
    prompt,
    summary,
    commitLog,
    language: config.language || "ko",
  });
  const response = await generateWithProvider({ prompt: titlePrompt, config });

  return cleanPrTitle(response);
}

/**
 * 테스트 결과 배열을 PR 본문에 넣기 좋은 bullet 목록으로 변환합니다.
 *
 * @param {Array|undefined} tests - 테스트 실행 결과 목록
 * @returns {string} markdown bullet 목록
 */
function formatTests(tests) {
  if (!Array.isArray(tests) || tests.length === 0) {
    return "- Not run (reason: no test results were provided).";
  }

  return tests
    .map((testResult) => {
      if (typeof testResult === "string") {
        return `- ${sanitizePrText(testResult).value}`;
      }

      const command = sanitizePrText(testResult?.command || "unknown").value;
      const status = sanitizePrText(testResult?.status || "unknown").value;
      return `- ${command}: ${status}`;
    })
    .join("\n");
}

/**
 * markdown 본문에 필수 섹션이 모두 있는지 확인합니다.
 *
 * @param {string} body - PR 본문 후보
 * @returns {boolean} 필수 섹션이 있으면 true
 */
function hasRequiredBodySections(body) {
  return ["Summary", "Changes", "Tests"].every((section) =>
    // Markdown heading은 앞에 최대 3칸의 공백이 있어도 heading으로 해석됩니다.
    // AI 응답이나 수동 편집 결과가 살짝 들여쓰기되어도 필수 섹션 검증이 불필요하게 fallback되지 않도록 허용합니다.
    new RegExp(`^\\s{0,3}##\\s+${section}\\b`, "imu").test(body),
  );
}

/**
 * raw diff 원문이 PR 본문에 들어왔는지 방어적으로 확인합니다.
 *
 * @param {string} body - PR 본문 후보
 */
function assertNoRawDiff(body) {
  // raw diff 라인은 앞 공백이 붙어도 코드 본문 또는 patch metadata로 보아 PR body에서 차단합니다.
  // 출력 직전의 최종 방어선이므로 heading 검증보다 넓게 탐지합니다.
  if (/^\s*diff --git\b/mu.test(body) || /^\s*@@\s+-\d+/mu.test(body)) {
    throw new Error("PR body must not include raw diff content.");
  }
}

/**
 * AI 응답을 그대로 쓰기 어려울 때 안전한 기본 PR 본문을 구성합니다.
 *
 * @param {object} params
 * @returns {string} markdown PR body
 */
function buildFallbackBody({
  summary,
  changedFiles = [],
  commitLog,
  tests,
} = {}) {
  const safeSummary = sanitizePrText(
    summary || "변경 요약이 제공되지 않았습니다.",
  ).value;
  const safeCommitLog = sanitizePrText(commitLog).value;
  const safeFiles = Array.isArray(changedFiles)
    ? changedFiles
        .filter((file) => typeof file === "string" && file.trim().length > 0)
        .map((file) => sanitizePrText(file).value)
    : [];

  return [
    "## Summary",
    "",
    `- ${safeSummary}`,
    "",
    "## Changes",
    "",
    ...(safeFiles.length > 0
      ? safeFiles.map((file) => `- ${file}`)
      : ["- 변경 파일 목록이 제공되지 않았습니다."]),
    ...(safeCommitLog ? ["", "Commit log:", safeCommitLog] : []),
    "",
    "## Tests",
    "",
    formatTests(tests),
  ].join("\n");
}

/**
 * AI 응답 PR 본문을 정리하고, 섹션이 부족하면 안전한 fallback 본문으로 보정합니다.
 *
 * @param {unknown} response - AI 원문 응답
 * @param {object} fallbackContext - fallback 생성에 필요한 안전 컨텍스트
 * @returns {string} 정리된 markdown PR body
 */
export function cleanPrBody(response, fallbackContext = {}) {
  const { value: safeResponse } = sanitizePrText(response);
  let body = removeWrappingCodeFence(safeResponse);

  if (!body) {
    throw new Error("PR body response was empty.");
  }

  // Mock provider처럼 제목 한 줄만 반환하는 provider 응답은 PR body로 부적합합니다.
  // 이 경우 raw diff 없이 caller가 넘긴 summary/files/tests만으로 기본 구조를 보정합니다.
  if (!hasRequiredBodySections(body)) {
    body = buildFallbackBody(fallbackContext);
  }

  const { value: safeBody } = sanitizePrText(body);
  assertNoRawDiff(safeBody);

  if (!hasRequiredBodySections(safeBody)) {
    throw new Error(
      "PR body must include Summary, Changes, and Tests sections.",
    );
  }

  return safeBody;
}

/**
 * PR 본문 생성을 위한 provider prompt를 구성합니다.
 *
 * @param {object} params
 * @returns {string} provider prompt
 */
function buildBodyPrompt({
  prompt,
  summary,
  changedFiles = [],
  commitLog,
  tests,
  securitySummary,
  language = "ko",
} = {}) {
  const safePrompt = sanitizePrText(prompt).value;
  const safeSummary = sanitizePrText(summary).value;
  const safeCommitLog = sanitizePrText(commitLog).value;
  const safeSecuritySummary = sanitizePrText(securitySummary).value;
  const safeFiles = Array.isArray(changedFiles)
    ? changedFiles.map((file) => sanitizePrText(file).value).filter(Boolean)
    : [];

  return [
    "Generate a GitHub Pull Request body in markdown.",
    "Include exactly these top-level sections: ## Summary, ## Changes, ## Tests.",
    "Do not include raw diff lines, long code snippets, provider metadata, secrets, tokens, API keys, passwords, private keys, or credentials.",
    "Do not claim tests were run unless they are listed in the provided test results.",
    language === "en"
      ? "Write the body in English."
      : language === "jp"
        ? "Write the body in Japanese."
        : language === "cn"
          ? "Write the body in Chinese."
          : "Write the body in Korean.",
    "",
    "Safe PR context:",
    safePrompt || "No full PR prompt was provided.",
    "",
    "Safe change summary:",
    safeSummary || "No summary was provided.",
    "",
    "Changed files:",
    safeFiles.length > 0
      ? safeFiles.map((file) => `- ${file}`).join("\n")
      : "- none",
    "",
    "Commit log:",
    safeCommitLog || "No commit log was provided.",
    "",
    "Security summary:",
    safeSecuritySummary || "No security summary was provided.",
    "",
    "Test results:",
    formatTests(tests),
  ].join("\n");
}

/**
 * provider를 통해 markdown PR 본문을 생성합니다.
 *
 * @param {object} params
 * @param {string} [params.prompt] - AD 단계 PR prompt
 * @param {string} [params.summary] - 변경 요약
 * @param {string[]} [params.changedFiles] - 변경 파일 목록
 * @param {string} [params.commitLog] - commit log
 * @param {Array} [params.tests] - 테스트 실행 결과
 * @param {string} [params.securitySummary] - 보안 scan 요약
 * @param {object} [params.config] - provider 설정
 * @returns {Promise<string>} markdown PR body
 */
export async function generatePrBody({
  prompt,
  summary,
  changedFiles = [],
  commitLog,
  tests,
  securitySummary,
  config = {},
} = {}) {
  const bodyPrompt = buildBodyPrompt({
    prompt,
    summary,
    changedFiles,
    commitLog,
    tests,
    securitySummary,
    language: config.language || "ko",
  });
  const response = await generateWithProvider({ prompt: bodyPrompt, config });

  return cleanPrBody(response, {
    summary,
    changedFiles,
    commitLog,
    tests,
  });
}

/**
 * PR title/body를 생성 또는 출력하기 전에 공통 보안 검사를 수행합니다.
 *
 * @param {object} params
 * @param {string} params.title - PR 제목
 * @param {string} params.body - PR 본문
 */
export function assertSafePrContent({ title, body } = {}) {
  const safeTitle = sanitizePrText(title);
  const safeBody = sanitizePrText(body);

  if (!safeTitle.value || !safeBody.value) {
    throw new Error("PR title and body must be non-empty.");
  }

  if (safeTitle.found || safeBody.found) {
    throw new Error("PR content contains sensitive-looking values.");
  }

  assertNoRawDiff(safeBody.value);
}
