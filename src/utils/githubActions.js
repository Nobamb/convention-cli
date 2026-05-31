import fs from "node:fs";
import crypto from "node:crypto";
import { maskSensitiveDiff } from "../core/security.js";
import { redactSecrets, warn } from "./logger.js";

// GitHub Actions output 이름은 shell 구문이 아니라 파일 기반 key로 쓰이지만,
// 잘못된 이름을 허용하면 multiline delimiter 문법과 충돌할 수 있으므로 안전한 식별자만 허용합니다.
const OUTPUT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/**
 * GitHub Actions output 파일을 사용할 수 있는지 확인합니다.
 *
 * GitHub Actions는 step output을 기록할 파일 경로를 `GITHUB_OUTPUT` 환경변수로 제공합니다.
 * 로컬 실행이나 다른 CI에서는 이 값이 없을 수 있으므로, 값이 없으면 output 기록을 조용히 건너뜁니다.
 *
 * @param {NodeJS.ProcessEnv|Record<string, unknown>} [env=process.env] - 확인할 환경변수 객체입니다.
 * @returns {boolean} `GITHUB_OUTPUT`이 비어 있지 않은 문자열이면 true를 반환합니다.
 */
export function isGitHubOutputAvailable(env = process.env) {
  return (
    typeof env?.GITHUB_OUTPUT === "string" &&
    env.GITHUB_OUTPUT.trim().length > 0
  );
}

/**
 * GitHub Actions output 이름이 안전한지 검증합니다.
 *
 * 이름에는 영문자, 숫자, 밑줄만 허용하고 첫 글자는 숫자가 될 수 없습니다. 이렇게 제한하면
 * `name<<EOF` 같은 delimiter 조작 형태가 output 파일에 들어가는 것을 방지할 수 있습니다.
 *
 * @param {string} name - 기록할 output 이름입니다.
 * @returns {void} 유효하면 아무 값도 반환하지 않습니다.
 * @throws {TypeError} 이름이 비어 있거나 안전한 식별자 형식이 아니면 예외를 던집니다.
 */
function assertSafeOutputName(name) {
  if (typeof name !== "string" || !OUTPUT_NAME_PATTERN.test(name)) {
    throw new TypeError(
      "GitHub Actions output name must be a safe identifier.",
    );
  }
}

/**
 * GitHub Actions output에 기록하기 전 값을 문자열로 정리하고 secret 의심 값을 마스킹합니다.
 *
 * commit message와 PR 본문은 사용자가 직접 편집했거나 AI가 생성한 문자열일 수 있으므로,
 * output에 쓰기 직전에 diff 보안 마스킹과 logger 마스킹을 모두 통과시킵니다. 이 함수는
 * diff 원문을 output으로 쓰기 위한 것이 아니라, 최종 산출물에 우연히 섞인 secret 패턴을 제거하는
 * 마지막 방어선입니다.
 *
 * @param {unknown} value - output으로 기록할 값입니다.
 * @returns {string} secret 의심 값이 `[REDACTED]`로 치환된 문자열입니다.
 */
export function sanitizeOutputValue(value) {
  const stringValue = String(value ?? "");
  const masked = maskSensitiveDiff(stringValue);
  return redactSecrets(masked.diff);
}

/**
 * output value에 포함되지 않는 multiline delimiter를 생성합니다.
 *
 * GitHub Actions multiline output은 `name<<DELIMITER` 형식을 사용합니다. value 내부에 delimiter가
 * 그대로 포함되면 output 경계가 깨질 수 있으므로, 난수 기반 후보를 만들고 value에 포함되지 않는지
 * 확인한 뒤 사용합니다.
 *
 * @param {string} value - output으로 기록할 문자열입니다.
 * @returns {string} value 내부에 등장하지 않는 delimiter 문자열입니다.
 */
function createOutputDelimiter(value) {
  let delimiter = "";

  do {
    delimiter = `CONVENTION_OUTPUT_${crypto.randomBytes(8).toString("hex")}`;
  } while (value.includes(delimiter));

  return delimiter;
}

/**
 * GitHub Actions output 파일에 기록할 payload 문자열을 만듭니다.
 *
 * 한 줄 값은 `name=value` 형식으로 쓰고, 줄바꿈이 포함된 값은 GitHub Actions 권장 방식인
 * delimiter 형식으로 씁니다. 모든 payload는 줄바꿈으로 끝나게 만들어 여러 output을 append해도
 * 서로 붙지 않도록 합니다.
 *
 * @param {string} name - 기록할 output 이름입니다.
 * @param {string} value - 이미 sanitize가 끝난 output 값입니다.
 * @returns {string} `$GITHUB_OUTPUT` 파일에 append할 payload입니다.
 */
function buildOutputPayload(name, value) {
  if (/\r|\n/u.test(value)) {
    const delimiter = createOutputDelimiter(value);
    return `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  }

  return `${name}=${value}\n`;
}

/**
 * GitHub Actions step output을 하나 기록합니다.
 *
 * 이 함수는 `GITHUB_OUTPUT`이 없으면 아무 작업도 하지 않고 false를 반환합니다. 파일 append 실패는
 * 본래 commit/PR 흐름을 깨지 않도록 경고만 출력하고 false를 반환합니다. output 경로 자체는 로그로
 * 출력하지 않아 CI 내부 파일 경로나 runner 정보를 불필요하게 노출하지 않습니다.
 *
 * @param {string} name - 기록할 output 이름입니다. 예: `commit_message`, `pr_title`, `pr_body`.
 * @param {unknown} value - 기록할 output 값입니다.
 * @param {object} [options={}] - 테스트와 호출부 제어를 위한 옵션입니다.
 * @param {NodeJS.ProcessEnv|Record<string, unknown>} [options.env=process.env] - 사용할 환경변수 객체입니다.
 * @returns {boolean} output 파일에 기록했으면 true, 사용할 수 없거나 기록 실패 시 false를 반환합니다.
 */
export function setOutput(name, value, { env = process.env } = {}) {
  assertSafeOutputName(name);

  if (!isGitHubOutputAvailable(env)) {
    return false;
  }

  try {
    const safeValue = sanitizeOutputValue(value);
    fs.appendFileSync(env.GITHUB_OUTPUT, buildOutputPayload(name, safeValue), {
      encoding: "utf8",
    });
    return true;
  } catch {
    warn(
      "GitHub Actions output을 기록하지 못했습니다. 기본 작업은 계속 진행합니다.",
    );
    return false;
  }
}

/**
 * 여러 GitHub Actions output을 순서대로 기록합니다.
 *
 * 값이 `null` 또는 `undefined`인 output은 기록하지 않습니다. 이렇게 하면 아직 생성되지 않은
 * PR 본문이나 빈 commit message가 다음 workflow step에 빈 값으로 전달되는 것을 줄일 수 있습니다.
 *
 * @param {Record<string, unknown>} outputs - output 이름과 값의 객체입니다.
 * @param {object} [options={}] - `setOutput()`에 전달할 옵션입니다.
 * @returns {Record<string, boolean>} 각 output 이름별 기록 성공 여부입니다.
 */
export function setOutputs(outputs, options = {}) {
  const result = {};

  for (const [name, value] of Object.entries(outputs || {})) {
    if (value === null || value === undefined) {
      continue;
    }

    result[name] = setOutput(name, value, options);
  }

  return result;
}
