#!/usr/bin/env node

/**
 * convention-cli의 CLI 진입점입니다.
 * Commander로 옵션을 정의하고, 입력 옵션에 따라 commands 계층으로 라우팅합니다.
 * 현재는 MVP 기능 연결 전 단계의 placeholder 라우팅을 포함합니다.
 */

// Commander CLI 생성자를 가져옵니다.
import { Command } from 'commander';

// CLI 프로그램 인스턴스를 생성합니다.
const program = new Command();

// CLI 이름, 설명, 버전을 정의합니다.
program
  .name('convention')
  .description('AI-powered CLI tool to automate the Git commit workflow using Conventional Commits')
  .version('1.0.0');

// 1차 MVP에서 사용할 커밋 모드와 설정 옵션을 정의합니다.
program
  .option('--step', 'Iterate through changed files for individual commits')
  .option('--batch', 'Analyze all changes for a single consolidated commit')
  .option('--set-mode <mode>', 'Set the default mode (step or batch)')
  .option('--language <lang>', 'Set the default language (ko, en, jp, cn)');

// 프로세스 인자를 Commander로 파싱합니다.
program.parse(process.argv);

// 파싱된 옵션 객체를 추출합니다.
const options = program.opts();

/**
 * 옵션 우선순위에 따라 command 함수를 호출합니다.
 * 실제 함수 연결 전까지는 주석 처리된 placeholder 호출을 유지합니다.
 */
if (options.setMode) {
  // 기본 모드를 설정합니다.
  // setMode(options.setMode);
} else if (options.language) {
  // 기본 커밋 메시지 언어를 설정합니다.
  // setLanguage(options.language);
} else if (options.step) {
  // step 커밋 흐름을 실행합니다.
  // runStepCommit();
} else if (options.batch) {
  // batch 커밋 흐름을 실행합니다.
  // runBatchCommit();
} else {
  // 설정된 기본 모드로 커밋 흐름을 실행합니다.
  // runDefaultCommit();
}
