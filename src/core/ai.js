import { generateWithProvider } from '../providers/index.js';
import { error as logError } from '../utils/logger.js';
import {
  chunkDiff,
  detectLargeDiff,
  mergeChunkSummaries,
  summarizeDiffChunks,
} from './diff.js';
import { buildCommitPrompt, buildSummaryCommitPrompt } from './prompt.js';

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
 * 대용량 diff 여부에 따라 일반 prompt 또는 summary 기반 prompt로 commit message를 생성합니다.
 * diff 크기가 설정된 임계치를 초과하면 'large-diff' 흐름을 타며, 전체 diff를 청크 단위로 나누어 요약한 뒤
 * 요약본들을 병합하여 최종 커밋 메시지를 생성합니다.
 * 
 * @param {Object} params
 * @param {string} params.diff - AI에게 전달할 전체 diff 문자열
 * @param {Array} params.fileDiffs - 파일별 diff 정보 배열 (청크 분할 및 요약에 사용)
 * @param {Array} params.files - 커밋 대상 파일 경로 배열 (크기 판정에 사용)
 * @param {Object} params.config - AI 설정 (임계치, 청크 설정 포함)
 * @param {string} params.mode - 실행 모드 ('step' 또는 'batch')
 * @param {string} params.language - 결과 메시지 언어 ('ko', 'en' 등)
 * @param {string} params.previousMessage - 이전 메시지 (재생성 시 지침 추가에 사용)
 * @returns {Promise<string>} 생성된 커밋 메시지 원문
 */
export async function generateLargeDiffCommitMessage({
  diff,
  fileDiffs = [],
  files = [],
  config = {},
  mode = 'step',
  language = 'ko',
  previousMessage,
} = {}) {
  // 필수 값 체크
  assertNonEmptyString(diff, 'diff');

  // 배열 체크
  if (!Array.isArray(fileDiffs)) {
    throw new TypeError('fileDiffs must be an array');
  }

  // 배열 체크
  if (!Array.isArray(files)) {
    throw new TypeError('files must be an array');
  }

  // 1. diff 크기를 판정하여 대용량 여부 확인
  const largeDiff = detectLargeDiff({ diff, files, config });

  // 2. 대용량이 아니면 기존 방식(전체 diff를 프롬프트에 포함)으로 메시지 생성
  if (!largeDiff.isLarge) {
    const prompt = buildCommitPrompt({
      diff,
      language,
      mode,
      previousMessage,
    });
    return generateCommitMessage(prompt, config);
  }

  // 3. 대용량인 경우 청크 단위 처리 시작
  // 3-1. 파일별 diff를 처리 가능한 크기의 청크(Chunk)로 나눔
  const chunks = chunkDiff(fileDiffs, config.largeDiffChunk || {});
  if (chunks.length === 0) {
    throw new Error('Large diff chunking produced no chunks.');
  }

  // 3-2. 각 청크별로 변경 사항 요약 요청 (병렬 처리가 가능한 구조)
  const chunkSummaries = await summarizeDiffChunks({
    chunks,
    config,
    language,
  });
  
  // 3-3. 각 청크 요약본을 하나의 병합된 요약 문자열로 합침
  const mergedSummary = mergeChunkSummaries(chunkSummaries);

  if (!mergedSummary || mergedSummary === '변경 요약 없음') {
    throw new Error('Large diff summary was empty.');
  }

  // 3-4. 요약된 내용을 기반으로 최종 커밋 메시지 생성을 위한 전용 프롬프트 빌드
  const prompt = buildSummaryCommitPrompt({
    summary: mergedSummary,
    language,
    mode,
    previousMessage,
  });

  // 3-5. 요약 기반 프롬프트를 사용하여 최종 커밋 메시지 생성
  return generateCommitMessage(prompt, config);
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
