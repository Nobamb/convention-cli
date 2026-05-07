import { generateWithProvider } from '../providers/index.js';
import { error as logError } from '../utils/logger.js';

// Conventional Commits 형식을 판별하기 위한 정규식입니다.
// <type>(scope)?: <subject> 형태를 확인합니다.
const CONVENTIONAL_COMMIT_PATTERN = /^(feat|fix|refactor|docs|style|test|chore)(\([^)]+\))?!?:\s+\S/;

/**
 * 입력값이 비어 있지 않은 문자열인지 확인합니다.
 */
function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

/**
 * 설정된 AI Provider를 통해 커밋 메시지를 생성합니다. (Phase T)
 * 1차 MVP에서는 Mock Provider를 기본으로 사용합니다.
 * @param {string} prompt - AI에게 보낼 프롬프트
 * @param {Object} config - 사용자 설정 객체
 * @returns {Promise<string>} 생성된 커밋 메시지 원문
 */
export async function generateCommitMessage(prompt, config = {}) {
  assertNonEmptyString(prompt, 'prompt');
  return generateWithProvider({ prompt, config });
}

/**
 * AI 응답에 포함될 수 있는 마크다운 코드 블록(fence)을 제거합니다.
 */
function removeCodeFence(value) {
  return value
    .replace(/^```[a-zA-Z0-9_-]*\s*/u, '')
    .replace(/\s*```$/u, '')
    .trim();
}

/**
 * AI 응답 전체를 감싸고 있는 따옴표나 백틱을 제거합니다.
 */
function removeWrappingQuote(value) {
  const quotePairs = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
  ];

  for (const [open, close] of quotePairs) {
    if (value.startsWith(open) && value.endsWith(close) && value.length >= 2) {
      return value.slice(1, -1).trim();
    }
  }

  return value;
}

/**
 * 여러 줄의 AI 응답 중 가장 적절한 커밋 메시지 한 줄을 선택합니다.
 * Conventional Commits 형식을 우선적으로 찾습니다.
 */
function selectCommitLine(value) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => removeWrappingQuote(line.trim()))
    .filter(Boolean);

  // 컨벤션을 준수하는 첫 번째 라인을 찾습니다.
  const conventionalLine = lines.find((line) => CONVENTIONAL_COMMIT_PATTERN.test(line));

  // 컨벤션 라인이 없으면 첫 번째 유효한 라인을 반환합니다.
  return conventionalLine ?? lines[0] ?? '';
}

/**
 * AI Provider의 응답을 git commit에 바로 사용할 수 있도록 정제합니다. (Phase U)
 * @param {string} response - AI의 원문 응답
 * @returns {string} 정제된 커밋 메시지
 */
export function cleanAIResponse(response) {
  assertNonEmptyString(response, 'response');

  try {
    // 1. 코드 블록 제거
    const withoutFence = removeCodeFence(response.trim());
    // 2. 유효 라인 선택 (여러 줄 대응)
    const selectedLine = selectCommitLine(withoutFence);
    // 3. 감싸고 있는 따옴표 최종 제거
    const cleaned = removeWrappingQuote(selectedLine).trim();

    if (!cleaned) {
      throw new Error('AI response did not contain a commit message');
    }

    return cleaned;
  } catch (error) {
    // 정제 과정에서의 에러는 로깅 후 상위로 전파합니다.
    logError('Failed to clean AI response.');
    throw error;
  }
}
