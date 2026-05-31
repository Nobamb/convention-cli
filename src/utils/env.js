/**
 * 환경 변수 문자열이 명시적인 true 값인지 판정합니다.
 *
 * CI 관련 환경변수는 일반적으로 문자열 `"true"`로 전달됩니다. 이 함수는 `"TRUE"`처럼
 * 대소문자가 섞인 값도 같은 의미로 처리하지만, `"1"`이나 `"yes"`처럼 도구마다 의미가
 * 달라질 수 있는 값은 자동으로 true로 보지 않습니다. 이렇게 해야 사용자가 명시하지 않은
 * 자동화 모드가 실수로 켜지는 것을 막을 수 있습니다.
 *
 * @param {unknown} value - `process.env`에서 읽은 환경변수 값입니다.
 * @returns {boolean} 값이 문자열 `"true"`이면 true, 그 외에는 false를 반환합니다.
 */
function isExplicitTrue(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

/**
 * 현재 실행 환경이 일반 CI 환경인지 확인합니다.
 *
 * `CI=true`는 GitHub Actions뿐 아니라 여러 CI 서비스가 공통으로 사용하는 신호입니다.
 * 이 함수는 테스트에서 안전하게 주입할 수 있도록 기본값으로만 `process.env`를 사용하고,
 * 호출자가 별도 env 객체를 넘기면 그 객체만 기준으로 판단합니다.
 *
 * @param {NodeJS.ProcessEnv|Record<string, unknown>} [env=process.env] - 확인할 환경변수 객체입니다.
 * @returns {boolean} `CI=true`이면 true를 반환합니다.
 */
export function isCI(env = process.env) {
  return isExplicitTrue(env?.CI);
}

/**
 * 현재 실행 환경이 GitHub Actions인지 확인합니다.
 *
 * GitHub Actions는 `GITHUB_ACTIONS=true`를 제공합니다. 이 값은 GitHub Actions 전용 output
 * 파일(`GITHUB_OUTPUT`) 처리, fork PR secret 제한 안내, workflow용 비대화형 정책을 적용할 때
 * 공통 기준으로 사용합니다.
 *
 * @param {NodeJS.ProcessEnv|Record<string, unknown>} [env=process.env] - 확인할 환경변수 객체입니다.
 * @returns {boolean} `GITHUB_ACTIONS=true`이면 true를 반환합니다.
 */
export function isGitHubActions(env = process.env) {
  return isExplicitTrue(env?.GITHUB_ACTIONS);
}

/**
 * prompt를 띄워도 되는 실행인지 판단합니다.
 *
 * `--no-interactive`가 명시되었거나, CI/GitHub Actions 환경이면 사용자 입력을 기다리는 prompt를
 * 비활성화해야 합니다. 이 함수는 "prompt 비활성화 여부"만 결정하고, 위험 작업 승인 여부는
 * `--yes` 같은 별도 플래그와 각 command의 보안 gate가 판단합니다.
 *
 * @param {NodeJS.ProcessEnv|Record<string, unknown>} [env=process.env] - 확인할 환경변수 객체입니다.
 * @param {object} [options={}] - CLI에서 파싱한 옵션 객체입니다.
 * @param {boolean} [options.noInteractive] - 사용자가 `--no-interactive`를 지정했는지 여부입니다.
 * @returns {boolean} prompt를 비활성화해야 하면 true를 반환합니다.
 */
export function shouldDisableInteractive(env = process.env, options = {}) {
  return options?.noInteractive === true || isCI(env) || isGitHubActions(env);
}

/**
 * command 계층으로 전달할 런타임 실행 정책을 구성합니다.
 *
 * CLI 진입점에서 한 번만 이 객체를 만들고 commit/pr command에 전달하면, 하위 함수들은
 * `process.env`를 직접 다시 읽지 않아도 됩니다. 덕분에 테스트에서는 env와 option을 명확히
 * 주입할 수 있고, 실제 실행에서는 CI 감지 결과와 사용자 승인 옵션이 한곳에서 정리됩니다.
 *
 * @param {object} [options={}] - commander가 반환한 CLI 옵션 객체입니다.
 * @param {NodeJS.ProcessEnv|Record<string, unknown>} [env=process.env] - 확인할 환경변수 객체입니다.
 * @returns {{yes: boolean, noInteractive: boolean, interactive: boolean, isCI: boolean, isGitHubActions: boolean}} commit/pr command가 공유할 런타임 정책 객체입니다.
 */
export function buildRuntimeOptions(options = {}, env = process.env) {
  const ci = isCI(env);
  const githubActions = isGitHubActions(env);
  const noInteractive = shouldDisableInteractive(env, options);

  return {
    // --yes는 위험 작업의 "명시 승인"으로만 사용하며, 외부 AI 전송 보안 gate를 대신하지 않습니다.
    yes: options?.yes === true,
    // 사용자가 명시한 --no-interactive 여부입니다. CI 때문에 꺼진 경우와 구분할 수 있게 별도 보존합니다.
    noInteractive: options?.noInteractive === true,
    // 실제 prompt 호출 가능 여부입니다. false이면 UI prompt를 호출하지 않고 성공 또는 명확한 실패로 끝나야 합니다.
    interactive: !noInteractive,
    // 일반 CI 감지 결과입니다.
    isCI: ci,
    // GitHub Actions 감지 결과입니다.
    isGitHubActions: githubActions,
  };
}
