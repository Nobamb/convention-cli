#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import {
  runBatchCommit,
  runDefaultCommit,
  runStepCommit,
} from "../src/commands/commit.js";
import { setLanguage, setMode } from "../src/commands/config.js";
import { runModelSetup } from "../src/commands/model.js";

/**
 * convention CLI의 단일 진입점입니다.
 *
 * 이 파일은 옵션 파싱과 command 함수 라우팅만 담당합니다. Git diff 추출, AI 메시지 생성,
 * 사용자 confirm, staging, commit 같은 실제 작업은 `src/commands/` 아래 command 함수에 위임합니다.
 */
const program = new Command();

// program 기본 설정
program
  .name("convention")
  .description(
    "AI-powered CLI tool to automate the Git commit workflow using Conventional Commits",
  )
  .version("1.0.0");

program.addHelpText(
  "before",
  `
${chalk.bold.cyan("AI 에이전트를 사용하는 지능형 Git 커밋 워크플로 자동화 도구")}
`,
);

/**
 * --model 옵션이 추가되어 AI Provider와 모델을 설정할 수 있습니다.
 * 가변 인자([values...])를 사용하여 대화형 UI 실행(--model)과 직접 설정(--model localLLM none ...)을 모두 지원합니다.
 */
program
  .option("--step", "변경된 파일들을 하나씩 확인하며 커밋을 진행합니다.")
  .option("--batch", "모든 변경사항을 하나의 통합 커밋으로 생성합니다.")
  .option(
    "--set-mode <mode>",
    "기본 실행 모드를 설정합니다. 사용 가능 값: step, batch",
  )
  .option(
    "--language <lang>",
    "커밋 메시지 생성 언어를 설정합니다. 사용 가능 값: ko, en, jp, cn",
  )
  .option(
    "--model [values...]",
    "AI Provider/model 설정을 저장합니다. [provider] [authType] [modelVersion] 순으로 입력하거나, 인자 없이 실행 시 대화형 설정을 시작합니다.",
  );

// 옵션 파싱
program.parse(process.argv);

// 옵션 가져오기
const options = program.opts();

/**
 * 옵션 우선순위에 따라 command 함수를 실행합니다.
 *
 * 1. --model 옵션 처리: 최우선순위로 처리하며, 설정을 마친 후 commit flow를 타지 않고 종료합니다.
 * 2. runDefaultCommit: 옵션이 없을 경우 config.mode에 따라 동작하도록 마지막에 호출합니다.
 */
async function main() {
  if (options.model) {
    // 가변 인자 배열을 분해하여 runModelSetup에 전달합니다.
    // options.model이 배열이 아닐 경우 빈 배열을 반환합니다.
    const [provider, authType, modelVersion] = Array.isArray(options.model)
      ? options.model
      : [];
    // 모델 설정을 저장합니다. 설정을 저장한 후 커밋 flow로 가지 않고 종료합니다.
    await runModelSetup(provider, authType, modelVersion);
    return;
  }

  // 기본 실행 모드 변경
  if (options.setMode) {
    // 기본 실행 모드를 설정합니다.
    setMode(options.setMode);
    return;
  }

  // 기본 커밋 메시지 생성 언어 변경
  if (options.language) {
    // 커밋 메시지 생성 언어를 설정합니다.
    setLanguage(options.language);
    return;
  }

  // step 모드로 커밋
  if (options.step) {
    // step 모드로 커밋을 진행합니다.
    await runStepCommit();
    return;
  }

  // batch 모드로 커밋
  if (options.batch) {
    // batch 모드로 커밋을 진행합니다.
    await runBatchCommit();
    return;
  }

  // 저장된 설정(config.mode)에 따라 commit flow를 시작합니다.
  await runDefaultCommit();
}

/**
 * 비동기 command에서 발생한 오류를 잡아 사용자에게 안내합니다.
 */
main().catch((error) => {
  // 에러를 잡아 사용자에게 안내
  console.error(error instanceof Error ? error.message : String(error));
  // 프로세스 종료 코드 1을 설정
  process.exitCode = 1;
});
