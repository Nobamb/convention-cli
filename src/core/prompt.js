import { SUPPORTED_LANGUAGES, SUPPORTED_MODES } from '../config/defaults.js';

// Conventional Commits에서 허용하는 핵심 타입 목록입니다.
const ALLOWED_TYPES = ['feat', 'fix', 'refactor', 'docs', 'style', 'test', 'chore'];

// 설정된 언어에 따라 AI에게 출력 언어를 지시하는 문구입니다.
// AI 모델의 정확도를 위해 지시문 자체는 영어로 유지하되, 결과물(subject)의 언어만 지정합니다.
const LANGUAGE_INSTRUCTIONS = {
  ko: 'Write the commit subject in Korean.',
  en: 'Write the commit subject in English.',
  jp: 'Write the commit subject in Japanese.',
  cn: 'Write the commit subject in Chinese.',
};

// 실행 모드(step/batch)에 따라 diff를 어떻게 해석할지 지시하는 문구입니다.
const MODE_INSTRUCTIONS = {
  step: 'The diff represents a single file or one file-level change. Make the subject specific to that file-level change.',
  batch: 'The diff represents the whole working tree change. Summarize the complete change as one commit subject.',
};

/**
 * Git diff와 설정값을 바탕으로 AI에게 보낼 최종 프롬프트를 생성합니다.
 * @param {Object} params
 * @param {string} params.diff - 분석할 Git diff 원문
 * @param {string} params.language - 커밋 메시지 작성 언어 (ko, en, jp, cn)
 * @param {string} params.mode - 실행 모드 (step, batch)
 * @returns {string} AI Provider에 전달할 프롬프트 문자열
 */
export function buildCommitPrompt({ diff, language = 'ko', mode = 'step' } = {}) {
  // diff가 없으면 프롬프트를 생성할 수 없으므로 엄격하게 체크합니다.
  if (typeof diff !== 'string' || diff.trim().length === 0) {
    throw new TypeError('diff must be a non-empty string');
  }

  // 지원하지 않는 언어나 모드가 들어올 경우 기본값을 사용하도록 안전 장치를 둡니다.
  const safeLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'ko';
  const safeMode = SUPPORTED_MODES.includes(mode) ? mode : 'step';

  return [
    'You are generating a Git commit message from a Git diff.',
    '',
    'Return only one final commit message.',
    'Do not return explanations, alternatives, markdown, code fences, or surrounding quotes.',
    '',
    'Use the Conventional Commits format:',
    '<type>: <subject>',
    '',
    `Allowed types: ${ALLOWED_TYPES.join(', ')}`,
    'Choose the most accurate type from the allowed list only.',
    LANGUAGE_INSTRUCTIONS[safeLanguage],
    MODE_INSTRUCTIONS[safeMode],
    '',
    'Keep the message concise and suitable for git commit -m.',
    'Do not include sensitive values from the diff in the commit message.',
    '',
    'Git diff:',
    diff,
  ].join('\n');
}
