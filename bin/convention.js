#!/usr/bin/env node

/**
 * convention-cli의 CLI 진입점입니다.
 * Commander로 옵션을 정의하고, 입력 옵션에 따라 commands 계층으로 라우팅합니다.
 */

// Commander CLI 생성자를 가져옵니다.
import { Command } from 'commander';
import chalk from 'chalk';
// 명령어 로직 함수들을 import합니다.
import { runDefaultCommit, runStepCommit, runBatchCommit } from '../src/commands/commit.js';
import { setMode, setLanguage } from '../src/commands/config.js';

// CLI 프로그램 인스턴스를 생성합니다.
const program = new Command();

// CLI 이름, 설명, 버전을 정의합니다.
program
  .name('convention')
  .description('AI-powered CLI tool to automate the Git commit workflow using Conventional Commits')
  .version('1.0.0');

// 커스텀 도움말 문구를 설정합니다.
program.addHelpText('before', `
${chalk.bold.cyan('AI 에이전트를 활용한 지능형 Git 커밋 & 워크플로우 자동화 툴 🚀')}
`);

// 1차 MVP에서 사용할 커밋 모드와 설정 옵션을 정의합니다.
program
  .option('--step', '변경된 파일들을 하나씩 확인하며 커밋을 진행합니다.')
  .option('--batch', '모든 변경 사항을 분석하여 하나의 통합 커밋을 생성합니다.')
  .option('--set-mode <mode>', '기본 실행 모드를 설정합니다. (사용 가능 값: step, batch)')
  .option('--language <lang>', '커밋 메시지 생성 언어를 설정합니다. (사용 가능 값: ko, en, jp, cn)');

// 프로세스 인자를 Commander로 파싱합니다.
program.parse(process.argv);

// 파싱된 옵션 객체를 추출합니다.
const options = program.opts();

/**
 * 옵션 우선순위에 따라 command 함수를 호출합니다.
 */
if (options.setMode) {
  // 기본 모드를 설정합니다.
  setMode(options.setMode);
} else if (options.language) {
  // 기본 커밋 메시지 언어를 설정합니다.
  setLanguage(options.language);
} else if (options.step) {
  // step 커밋 흐름을 실행합니다.
  runStepCommit();
} else if (options.batch) {
  // batch 커밋 흐름을 실행합니다.
  runBatchCommit();
} else {
  // 설정된 기본 모드로 커밋 흐름을 실행합니다.
  runDefaultCommit();
}
