/**
 * 커밋 관련 명령의 사용자 흐름을 담당합니다.
 * 실제 Git 커밋 흐름은 이후 단계에서 구현하고, 현재 단계에서는 출력 방식을 logger로 통일합니다.
 */

import { info } from '../utils/logger.js';

export const runDefaultCommit = async () => {
  info('기본 커밋 흐름을 준비합니다.');
};

export const runStepCommit = async () => {
  info('파일별 커밋 흐름을 준비합니다.');
};

export const runBatchCommit = async () => {
  info('통합 커밋 흐름을 준비합니다.');
};
