import { maskSensitiveDiff } from "./security.js";
import { redactSecrets } from "../utils/logger.js";

// PR 자동화 prompt에 원문 diff를 넣지 않기 위해 표시 가능한 기본 섹션 이름을 고정합니다.
// 후속 title/body 생성기가 이 구조를 기준으로 결과를 나누어 사용할 수 있습니다.
const DEFAULT_PR_SECTIONS = ["Summary", "Changes", "Tests"];

// PR prompt에 그대로 넣으면 안 되는 민감 파일명 후보입니다.
// git.js 내부 민감 파일 필터와 같은 정책을 PR 생성 단계에서도 한 번 더 적용해,
// prompt 생성 호출자가 실수로 민감 파일명을 넘겨도 내용 노출로 이어지지 않게 합니다.
const SENSITIVE_FILE_NAMES = new Set([
  ".env",
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "id_dsa",
  "credentials.json",
  "secrets.json",
]);

// 언어 설정별 PR 작성 지시문입니다.
// commit prompt와 동일한 ko/en/jp/cn 범위를 유지해 config.language와 자연스럽게 연결합니다.
const LANGUAGE_INSTRUCTIONS = {
  ko: "Write the PR title and body in Korean.",
  en: "Write the PR title and body in English.",
  jp: "Write the PR title and body in Japanese.",
  cn: "Write the PR title and body in Chinese.",
};

/**
 * PR prompt에 사용할 문자열 값을 민감정보 마스킹 후 안전한 한 줄 또는 여러 줄 문자열로 정리합니다.
 *
 * @param {unknown} value - 외부에서 전달된 branch, commit log, summary 등
 * @returns {string} 민감정보가 마스킹된 문자열
 */
function sanitizePromptText(value) {
  // maskSensitiveDiff는 diff 접두사가 없어도 API_KEY= 같은 값을 마스킹할 수 있으므로
  // PR summary, commit log, template처럼 diff가 아닌 텍스트에도 재사용합니다.
  const masked = maskSensitiveDiff(String(value ?? "")).diff;
  return redactSecrets(masked).trim();
}

/**
 * diffSummary에 실수로 raw diff 본문이 섞였을 때 prompt로 그대로 전달되지 않도록 제거합니다.
 *
 * PR 자동화는 외부 AI provider로 전달될 수 있으므로 `diff --git`, hunk header, 실제 추가/삭제 라인은
 * 문서 생성에 필요한 메타데이터가 아니라 민감한 코드 본문으로 취급합니다. 정상 경로에서는 caller가
 * `git diff --stat`과 파일별 line count만 넘기지만, 방어 계층을 하나 더 두어 잘못된 호출도 안전하게 만듭니다.
 *
 * @param {unknown} value - raw diff가 섞였을 수 있는 변경 요약
 * @returns {string} raw diff 라인을 제거하고 secret-like 값을 마스킹한 안전한 요약
 */
function sanitizeDiffSummaryText(value) {
  // string으로 변환 후 시크릿 마스킹
  const sanitized = sanitizePromptText(value);
  // 줄바꿈으로 분리
  const safeLines = sanitized
    .split(/\r?\n/u)
    // 각 줄 공백 제거
    .map((line) => line.trimEnd())
    // raw diff 라인과 secret-like 값 필터링
    .filter((line) => {
      const trimmed = line.trimStart();

      // Git patch 헤더와 hunk 헤더는 파일 내용 위치와 코드 본문을 노출할 수 있어 제거합니다.
      if (
        /^diff --git\b/u.test(trimmed) ||
        /^index\s+[0-9a-f]+\.\.[0-9a-f]+/iu.test(trimmed) ||
        /^@@\s+-\d+/u.test(trimmed) ||
        /^\+\+\+\s/u.test(trimmed) ||
        /^---\s/u.test(trimmed)
      ) {
        return false;
      }

      // raw diff의 실제 추가/삭제 라인은 코드 본문일 가능성이 높으므로 PR prompt에는 포함하지 않습니다.
      // `git diff --stat`의 "file | 3 ++-" 같은 요약 라인은 줄 시작이 +/-가 아니어서 유지됩니다.
      if (/^[+-]/u.test(trimmed)) {
        return false;
      }

      // 그 외의 경우 유지
      return true;
    });

  // 줄바꿈으로 다시 합치고 공백 제거
  const result = safeLines.join("\n").trim();
  // 빈 문자열일 경우 raw diff content가 제거되었다는 메시지 반환
  return result || "Raw diff content was omitted for PR prompt safety.";
}

/**
 * Git 경로의 마지막 파일명만 추출합니다.
 *
 * @param {string} file - Git이 반환한 파일 경로
 * @returns {string} basename
 */
function getBaseName(file) {
  // 경로 구분자를 슬래시로 정규화 (윈도우 경로 지원)
  const normalized = file.replaceAll("\\", "/");
  // 슬래시로 분리 후 마지막 파일명 추출
  return normalized.split("/").at(-1) ?? normalized;
}

/**
 * PR prompt에 포함하면 안 되는 민감 파일 경로인지 확인합니다.
 *
 * @param {unknown} file - 변경 파일 경로 후보
 * @returns {boolean} 민감 파일이면 true
 */
function isSensitivePrPath(file) {
  // 문자열이 아니거나 빈 문자열이면 false 반환
  if (typeof file !== "string" || file.length === 0) {
    return false;
  }

  // 파일명만 추출해서 소문자로 변환
  const baseName = getBaseName(file).toLowerCase();

  // 민감 파일명, .env.*, .pem, .key 파일인지 확인
  // 민감 파일이면 true 반환
  return (
    SENSITIVE_FILE_NAMES.has(baseName) ||
    baseName.startsWith(".env.") ||
    baseName.endsWith(".pem") ||
    baseName.endsWith(".key")
  );
}

/**
 * 변경 파일 목록을 PR prompt용으로 안전하게 나눕니다.
 *
 * @param {unknown[]} changedFiles - 변경 파일 후보 배열
 * @returns {{ safeFiles: string[], omittedFiles: string[] }}
 */
function partitionChangedFiles(changedFiles) {
  // 안전한 파일 목록 초기화
  const safeFiles = [];
  // 제외된 파일 목록 초기화
  const omittedFiles = [];

  // 변경 파일 배열 changedFiles 순회
  // changedFiles가 배열이 아니거나 비어있다면 빈 배열로 처리
  for (const file of Array.isArray(changedFiles) ? changedFiles : []) {
    // 문자열이 아니거나 빈 문자열이면 continue
    if (typeof file !== "string" || file.trim().length === 0) {
      continue;
    }

    // 민감정보 마스킹 및 정리
    const sanitized = sanitizePromptText(file);

    // 민감 파일이면 omittedFiles에 추가하고 continue
    if (isSensitivePrPath(sanitized)) {
      omittedFiles.push(sanitized);
      continue;
    }

    // 안전한 파일이면 safeFiles에 추가
    safeFiles.push(sanitized);
  }

  // 안전한 파일과 제외된 파일 반환
  return { safeFiles, omittedFiles };
}

/**
 * 배열 값을 markdown bullet 목록으로 변환합니다.
 *
 * @param {string[]} values - 출력할 값 목록
 * @param {string} emptyMessage - 값이 없을 때 사용할 메시지
 * @returns {string} bullet 목록 문자열
 */
function toBulletList(values, emptyMessage) {
  // 배열이 아니거나 빈 배열이면 emptyMessage 반환
  if (!Array.isArray(values) || values.length === 0) {
    return `- ${emptyMessage}`;
  }

  // 배열을 bullet 목록으로 변환
  // 예시: ["a", "b", "c"] → "- a\n- b\n- c"
  return values.map((value) => `- ${value}`).join("\n");
}

/**
 * PR template을 prompt에 넣기 전에 길이와 secret을 정리합니다.
 *
 * @param {unknown} template - PR template 원문
 * @returns {string|null} 안전하게 정리된 template 또는 null
 */
function sanitizeTemplate(template) {
  // template이 문자열이 아니거나 비어있으면 null 반환
  if (typeof template !== "string" || template.trim().length === 0) {
    return null;
  }

  // 민감정보 마스킹 및 정리
  const sanitized = sanitizePromptText(template);

  // 너무 긴 template은 PR prompt 자체를 과도하게 키우므로 앞부분만 참고 정보로 사용합니다.
  // 원문 전체를 보존하지 않아도 PR 본문 기본 섹션은 아래 지시문으로 보장됩니다.
  return sanitized.length > 4000
    ? `${sanitized.slice(0, 4000).trim()}\n- Template content was truncated for prompt safety.`
    : sanitized;
}

/**
 * PR 제목과 본문 생성을 위한 안전한 prompt를 구성합니다.
 *
 * raw diff 원문은 입력으로 받지 않고, 이미 요약된 diffSummary와 변경 파일 metadata만 사용합니다.
 * 외부 AI Provider로 전달될 수 있는 문자열이므로 branch, commit log, summary, template 모두 secret 마스킹을 거칩니다.
 *
 * @param {object} params
 * @param {string} params.currentBranch - 현재 head branch
 * @param {string} params.baseBranch - PR target branch
 * @param {string} [params.commitLog] - base 이후 commit log 요약
 * @param {string} params.diffSummary - raw diff가 아닌 변경 요약
 * @param {string[]} params.changedFiles - 변경 파일 목록
 * @param {string} [params.language="ko"] - 출력 언어
 * @param {string} [params.template] - PR template 원문
 * @returns {string} provider에 전달할 PR 생성 prompt
 */
export function buildPrPrompt({
  currentBranch,
  baseBranch,
  commitLog = "",
  diffSummary,
  changedFiles = [],
  language = "ko",
  template,
} = {}) {
  // PR prompt에 포함될 현재 head 브랜치에 대한 문자열 값에 대한 민감정보 마스킹처리
  const safeCurrentBranch = sanitizePromptText(currentBranch);
  // PR prompt에 포함될 PR target 브랜치에 대한 문자열 값에 대한 민감정보 마스킹처리
  const safeBaseBranch = sanitizePromptText(baseBranch);
  // PR prompt에 포함될 diffSummary에 대한 민감정보 마스킹처리
  const safeDiffSummary = sanitizeDiffSummaryText(diffSummary);

  // currentBranch가 없으면 에러
  if (!safeCurrentBranch) {
    throw new TypeError("currentBranch must be a non-empty string");
  }

  // baseBranch가 없으면 에러
  if (!safeBaseBranch) {
    throw new TypeError("baseBranch must be a non-empty string");
  }

  // diffSummary가 없으면 에러
  if (!safeDiffSummary) {
    throw new TypeError("diffSummary must be a non-empty string");
  }

  // 변경 파일 목록들에 대한 민감정보 마스킹처리 및 분할
  const { safeFiles, omittedFiles } = partitionChangedFiles(changedFiles);

  // 안전한 변경 파일 목록과 제외된 파일 목록이 둘다 비어있으면 에러
  if (safeFiles.length === 0 && omittedFiles.length === 0) {
    throw new Error("PR prompt requires at least one changed file.");
  }

  // 사용할 언어에 대한 설정
  const safeLanguage = LANGUAGE_INSTRUCTIONS[language] ? language : "ko";
  // commit log에 대한 민감정보 마스킹처리
  const safeCommitLog =
    sanitizePromptText(commitLog) || "No commit log was provided.";
  // template에 대한 민감정보 마스킹처리
  const safeTemplate = sanitizeTemplate(template);

  // PR prompt에 포함될 문구들에 대한 민감정보 마스킹처리
  return [
    "You are generating a GitHub Pull Request title and body from safe Git metadata.",
    "",
    "Return a concise PR title and a markdown PR body.",
    "Do not wrap the result in a markdown code block.",
    "Do not include raw diff lines, long code snippets, secrets, tokens, API keys, passwords, private keys, or credentials.",
    "If a value looks sensitive, refer to it only as [REDACTED].",
    "",
    "Required output:",
    "Title: <one-line Conventional Commits style title>",
    "Body:",
    ...DEFAULT_PR_SECTIONS.map((section) => `## ${section}`),
    "",
    LANGUAGE_INSTRUCTIONS[safeLanguage],
    "",
    `Head branch: ${safeCurrentBranch}`,
    `Base branch: ${safeBaseBranch}`,
    "",
    "Commit log since base:",
    safeCommitLog,
    "",
    "Changed files:",
    toBulletList(safeFiles, "No non-sensitive changed files were provided."),
    "",
    "Omitted sensitive files:",
    toBulletList(omittedFiles, "None"),
    "",
    "Safe diff summary:",
    safeDiffSummary,
    "",
    "Testing guidance:",
    "- Mention only tests that were actually provided by the caller.",
    "- If no tests were provided, say they were not run.",
    ...(safeTemplate
      ? ["", "Project PR template to respect when possible:", safeTemplate]
      : []),
  ].join("\n");
}
