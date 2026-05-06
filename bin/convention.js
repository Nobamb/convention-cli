#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { runBatchCommit, runDefaultCommit, runStepCommit } from '../src/commands/commit.js';
import { setLanguage, setMode } from '../src/commands/config.js';

/**
 * convention CLI의 단일 진입점입니다.
 *
 * 이 파일은 옵션 파싱과 command 함수 라우팅만 담당합니다. Git diff 추출, AI 메시지 생성,
 * 사용자 confirm, staging, commit 같은 실제 작업은 `src/commands/` 아래 command 함수에 위임합니다.
 * 이렇게 분리하면 CLI 옵션 우선순위와 실제 commit workflow를 각각 테스트하기 쉬워집니다.
 */
const program = new Command();

program
  .name('convention')
  .description('AI-powered CLI tool to automate the Git commit workflow using Conventional Commits')
  .version('1.0.0');

program.addHelpText(
  'before',
  `
${chalk.bold.cyan('AI 에이전트를 사용하는 지능형 Git 커밋 워크플로 자동화 도구')}
`,
);

/**
 * 1차 MVP에서 지원하는 CLI 옵션입니다.
 *
 * `--step`과 `--batch`는 즉시 실행 모드이고, `--set-mode`와 `--language`는 설정 저장 명령입니다.
 * 옵션이 아무것도 없으면 저장된 기본 mode를 읽어 실행하는 `runDefaultCommit()`으로 넘어갑니다.
 */
program
  .option('--step', '변경된 파일들을 하나씩 확인하며 커밋을 진행합니다.')
  .option('--batch', '모든 변경사항을 하나의 통합 커밋으로 생성합니다.')
  .option('--set-mode <mode>', '기본 실행 모드를 설정합니다. 사용 가능 값: step, batch')
  .option('--language <lang>', '커밋 메시지 생성 언어를 설정합니다. 사용 가능 값: ko, en, jp, cn');

program.parse(process.argv);

const options = program.opts();

/**
 * 옵션 우선순위에 따라 command 함수를 실행합니다.
 *
 * 설정 명령은 Git commit flow를 실행하지 않고 즉시 종료합니다. 명시 실행 옵션인 `--step`과 `--batch`는
 * 저장된 기본 mode보다 우선합니다. 옵션 없는 기본 실행은 Phase X 요구사항에 따라 config.mode를 읽는
 * `runDefaultCommit()`에 맡깁니다.
 */
async function main() {
  if (options.setMode) {
    setMode(options.setMode);
    return;
  }

  if (options.language) {
    setLanguage(options.language);
    return;
  }

  if (options.step) {
    await runStepCommit();
    return;
  }

  if (options.batch) {
    await runBatchCommit();
    return;
  }

  await runDefaultCommit();
}

/**
 * 비동기 command에서 발생한 오류를 CLI 프로세스 실패로 명확하게 변환합니다.
 *
 * Git commit 실패, AI 응답 정리 실패, 사용자 입력 오류 등이 Promise rejection으로 올라올 수 있으므로
 * top-level에서 반드시 잡아야 합니다. 오류 메시지는 일반화된 Error message만 출력하고 diff 원문은
 * command/core 계층에서도 출력하지 않도록 유지합니다.
 */
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
