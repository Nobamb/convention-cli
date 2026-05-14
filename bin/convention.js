#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import {
  runBatchCommit,
  runDefaultCommit,
  runStepCommit,
} from "../src/commands/commit.js";
import { runQuestionSetup, setLanguage, setMode } from "../src/commands/config.js";
import { runModelSetup } from "../src/commands/model.js";
import { runReset } from "../src/commands/reset.js";
import { error as logError } from "../src/utils/logger.js";

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
    "-q, --question",
    "커밋 메시지 생성 후 커밋 여부를 물어볼지 설정합니다. true 또는 false를 선택합니다.",
  )
  .option(
    "--model [values...]",
    "AI Provider/model 설정을 저장합니다. [provider] [authType] [modelVersion] 순으로 입력하거나, 인자 없이 실행 시 대화형 설정을 시작합니다.",
  );

// 옵션 파싱
program.option(
  "--push",
  "커밋이 성공적으로 완료된 경우에만 현재 브랜치를 원격 저장소로 push합니다.",
);

program.option(
  "--reset",
  "최근 커밋 1개를 취소하고 변경사항은 working tree에 남깁니다.",
);

program.parse(process.argv);

// 옵션 가져오기
const options = program.opts();

/**
 * 옵션 우선순위에 따라 command 함수를 실행합니다.
 *
 * 1. 설정 옵션(--model, --question, --set-mode, --language)과 실행 옵션(--step, --batch, --reset, --push) 분류
 * 2. 혼합 사용 및 배타적 옵션 중복 시 에러 처리
 * 3. 설정 옵션이 있을 경우 모두 순차적으로 적용 후 종료
 * 4. 실행 옵션에 따라 commit flow 시작
 */
async function main() {
  // 설정 옵션 명시 여부
  const hasConfigOption =
    options.model !== undefined ||
    options.question !== undefined ||
    options.setMode !== undefined ||
    options.language !== undefined;

  // 실행 옵션 명시 여부
  const hasExecutionOption =
    options.step !== undefined ||
    options.batch !== undefined ||
    options.reset !== undefined ||
    options.push !== undefined;

  // 1. 설정 옵션과 실행 옵션 혼합 사용 시 에러 발생
  if (hasConfigOption && hasExecutionOption) {
    throw new Error(
      "설정 옵션(--set-mode, --language, --question, --model)과 커밋 실행 옵션(--step, --batch, --reset, --push)은 함께 사용할 수 없습니다. 의도를 명확히 하여 한 종류의 명령어만 입력해 주세요."
    );
  }

  // 2. 상호 배타적 실행 옵션 중복 입력 시 에러 발생
  if (options.step && options.batch) {
    throw new Error(
      "상호 배타적인 옵션 조합입니다: --step과 --batch는 함께 사용할 수 없습니다."
    );
  }

  if (options.reset && (options.step || options.batch || options.push)) {
    throw new Error(
      "상호 배타적인 옵션 조합입니다: --reset은 커밋 생성 옵션(--step, --batch, --push)과 함께 사용할 수 없습니다."
    );
  }

  // 3. 다중 설정 옵션 처리
  if (hasConfigOption) {
    // 설정 옵션이 주어졌다면 모든 설정 옵션을 순차적으로 적용합니다.
    if (options.model) {
      // 가변 인자 배열을 분해하여 runModelSetup에 전달합니다.
      const [provider, authType, modelVersion] = Array.isArray(options.model)
        ? options.model
        : [];
      // 모델 설정을 대화형 또는 직접 지정 방식으로 저장합니다.
      await runModelSetup(provider, authType, modelVersion);
    }

    if (options.question) {
      // 커밋 메시지 생성 후 커밋 여부를 물어볼지 대화형으로 설정합니다.
      await runQuestionSetup();
    }

    if (options.setMode) {
      // 기본 실행 모드(step, batch)를 설정합니다.
      setMode(options.setMode);
    }

    if (options.language) {
      // 커밋 메시지 생성 언어(ko, en, jp, cn)를 설정합니다.
      setLanguage(options.language);
    }

    // 설정을 마친 후 commit flow를 타지 않고 프로그램을 종료합니다.
    return;
  }

  // 4. 실행 로직 처리
  // --reset은 커밋 취소 작업이므로, commit/push 흐름과 완전히 분리되어 먼저 처리됩니다.
  if (options.reset) {
    await runReset();
    return;
  }

  // step 모드로 커밋 실행
  if (options.step) {
    // 변경 파일을 하나씩 개별 커밋합니다.
    await runStepCommit({ push: options.push });
    return;
  }

  // batch 모드로 커밋 실행
  if (options.batch) {
    // 전체 변경 파일을 하나의 통합 커밋으로 만듭니다.
    await runBatchCommit({ push: options.push });
    return;
  }

  // 지정된 옵션이 없으면 저장된 설정(config.mode)에 따라 기본 commit flow를 시작합니다.
  await runDefaultCommit({ push: options.push });
}

/**
 * 비동기 command에서 발생한 오류를 잡아 사용자에게 안내합니다.
 */
main().catch((error) => {
  // 에러를 잡아 사용자에게 안내
  logError(error instanceof Error ? error.message : String(error));
  // 프로세스 종료 코드 1을 설정
  process.exitCode = 1;
});
