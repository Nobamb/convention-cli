import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Antigravity MCP 설정에서 convention-cli 서버를 식별하는 고정 이름입니다.
// 설치/갱신/제거는 반드시 이 서버 엔트리 하나만 대상으로 삼아 다른 MCP 서버 설정을 보존합니다.
export const AGY_MCP_SERVER_NAME = "convention-cli-mcp";

// Antigravity 계열 도구들이 현재 확인된 범위에서 사용하는 mcp_config.json 후보 경로 목록입니다.
// 홈 전체 스캔을 하지 않기 위해 target key와 홈 기준 상대 경로를 명시적으로 고정합니다.
const AGY_MCP_TARGETS = Object.freeze([
  {
    target: "editor",
    label: "Antigravity Editor",
    segments: [".gemini", "antigravity", "mcp_config.json"],
  },
  {
    target: "cli",
    label: "Antigravity CLI",
    segments: [".gemini", "antigravity-cli", "mcp_config.json"],
  },
  {
    target: "ide",
    label: "Antigravity IDE",
    segments: [".gemini", "antigravity-ide", "mcp_config.json"],
  },
  {
    target: "gemini",
    label: "Shared Gemini config",
    segments: [".gemini", "config", "mcp_config.json"],
  },
]);

/**
 * 값이 JSON object로 안전하게 병합 가능한 plain object인지 확인합니다.
 *
 * @param {unknown} value - 확인할 값입니다.
 * @returns {boolean} 배열/null이 아닌 object이면 true를 반환합니다.
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * JSON 비교를 위해 객체 키 순서를 안정적으로 정렬한 값을 만듭니다.
 *
 * 기존 `mcp_config.json`이 같은 설정을 다른 key 순서로 가지고 있어도 불필요한 update로
 * 판정하지 않기 위해 사용합니다. 함수 입력은 JSON에서 파싱 가능한 값만 대상으로 합니다.
 *
 * @param {unknown} value - 정렬할 JSON 값입니다.
 * @returns {unknown} object key가 사전순으로 정렬된 JSON 값입니다.
 */
function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortJsonValue(value[key]);
      return sorted;
    }, {});
}

/**
 * 두 JSON 값을 key 순서와 무관하게 비교합니다.
 *
 * @param {unknown} left - 비교할 첫 번째 JSON 값입니다.
 * @param {unknown} right - 비교할 두 번째 JSON 값입니다.
 * @returns {boolean} JSON 의미가 같으면 true를 반환합니다.
 */
function isSameJson(left, right) {
  return JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right));
}

/**
 * Antigravity MCP config 후보 경로를 반환합니다.
 *
 * 홈 디렉터리 아래의 알려진 4개 후보만 조합하며, 사용자 홈 전체를 탐색하지 않습니다.
 * 테스트에서는 `homeDir`를 임시 디렉터리로 주입해 실제 사용자 설정을 건드리지 않게 합니다.
 *
 * @param {string} [homeDir=os.homedir()] - 사용자 홈 디렉터리 또는 테스트용 임시 홈입니다.
 * @returns {Array<{target: string, label: string, dirPath: string, configPath: string}>} target별 MCP 설정 후보 목록입니다.
 */
export function getAntigravityMcpConfigCandidates(homeDir = os.homedir()) {
  if (typeof homeDir !== "string" || homeDir.trim().length === 0) {
    throw new TypeError("homeDir must be a non-empty string.");
  }

  return AGY_MCP_TARGETS.map(({ target, label, segments }) => {
    const configPath = path.join(homeDir, ...segments);

    return {
      target,
      label,
      dirPath: path.dirname(configPath),
      configPath,
    };
  });
}

/**
 * target 이름에 해당하는 Antigravity MCP config 후보를 찾습니다.
 *
 * @param {string} target - `editor`, `cli`, `ide`, `gemini` 중 하나입니다.
 * @param {string} [homeDir=os.homedir()] - 사용자 홈 디렉터리 또는 테스트용 임시 홈입니다.
 * @returns {{target: string, label: string, dirPath: string, configPath: string}} 선택된 후보입니다.
 */
export function getAntigravityMcpConfigCandidate(target, homeDir = os.homedir()) {
  const normalizedTarget = typeof target === "string" ? target.trim() : "";
  const candidate = getAntigravityMcpConfigCandidates(homeDir).find(
    (item) => item.target === normalizedTarget,
  );

  if (!candidate) {
    throw new Error(
      "지원하지 않는 Antigravity MCP target입니다. 사용 가능 값: editor, cli, ide, gemini",
    );
  }

  return candidate;
}

/**
 * 이미 존재하는 Antigravity MCP 후보를 감지합니다.
 *
 * `mcp_config.json` 파일 또는 부모 디렉터리가 존재하는 후보만 반환합니다. 이 함수는 고정된 후보
 * 배열만 검사하므로 홈 전체 스캔 금지 규칙을 지킵니다.
 *
 * @param {Array<{target: string, label: string, dirPath: string, configPath: string}>} candidates - 검사할 후보 목록입니다.
 * @param {object} [options={}] - 테스트 주입용 옵션입니다.
 * @param {typeof fs} [options.fsImpl=fs] - 파일 시스템 구현체입니다.
 * @returns {Array<{target: string, label: string, dirPath: string, configPath: string}>} 존재하는 후보 목록입니다.
 */
export function detectExistingTargets(candidates, { fsImpl = fs } = {}) {
  if (!Array.isArray(candidates)) {
    throw new TypeError("candidates must be an array.");
  }

  return candidates.filter((candidate) => {
    return (
      typeof candidate?.configPath === "string" &&
      typeof candidate?.dirPath === "string" &&
      (fsImpl.existsSync(candidate.configPath) || fsImpl.existsSync(candidate.dirPath))
    );
  });
}

/**
 * convention-cli를 Antigravity가 stdio MCP 서버로 실행하기 위한 server config를 만듭니다.
 *
 * @param {object} params - MCP server config 생성 인자입니다.
 * @param {string} params.nodePath - Node 실행 파일의 절대 경로입니다. 기본 구현에서는 `process.execPath`를 사용합니다.
 * @param {string} params.cliPath - `bin/convention.js`의 절대 경로입니다.
 * @param {string} params.cwd - MCP 서버가 실행될 작업 디렉터리입니다. 가능하면 현재 Git 저장소 루트입니다.
 * @returns {{command: string, args: string[], cwd: string, env: {CONVENTION_EXPERIMENTAL_ANTIGRAVITY: string}}} Antigravity `mcpServers`에 들어갈 서버 설정입니다.
 */
export function buildConventionMcpServerConfig({ nodePath, cliPath, cwd } = {}) {
  if (typeof nodePath !== "string" || nodePath.trim().length === 0) {
    throw new TypeError("nodePath must be a non-empty string.");
  }

  if (typeof cliPath !== "string" || cliPath.trim().length === 0) {
    throw new TypeError("cliPath must be a non-empty string.");
  }

  if (typeof cwd !== "string" || cwd.trim().length === 0) {
    throw new TypeError("cwd must be a non-empty string.");
  }

  return {
    command: nodePath.trim(),
    args: [cliPath.trim(), "-am"],
    cwd: cwd.trim(),
    env: {
      CONVENTION_EXPERIMENTAL_ANTIGRAVITY: "true",
    },
  };
}

/**
 * 기존 `mcp_config.json` 객체에 convention-cli MCP server 설정을 병합합니다.
 *
 * 기존 최상위 key와 다른 MCP server 엔트리는 유지하고, `convention-cli-mcp` 엔트리만
 * 생성 또는 갱신합니다. `mcpServers`가 object가 아닌 경우에는 사용자 설정을 추정해서
 * 고치지 않고 명확한 오류로 중단합니다.
 *
 * @param {object} existingConfig - 기존 `mcp_config.json`에서 읽은 설정 객체입니다.
 * @param {object} serverConfig - `buildConventionMcpServerConfig()`가 만든 서버 설정입니다.
 * @returns {{config: object, action: "create" | "update" | "noop"}} 병합된 설정과 수행해야 할 작업 종류입니다.
 */
export function mergeMcpServerConfig(existingConfig = {}, serverConfig) {
  if (!isPlainObject(existingConfig)) {
    throw new Error("Antigravity MCP config root must be a JSON object.");
  }

  if (!isPlainObject(serverConfig)) {
    throw new TypeError("serverConfig must be a JSON object.");
  }

  if (
    existingConfig.mcpServers !== undefined &&
    !isPlainObject(existingConfig.mcpServers)
  ) {
    throw new Error("Antigravity MCP config mcpServers must be a JSON object.");
  }

  const currentServers = existingConfig.mcpServers ?? {};
  const currentServer = currentServers[AGY_MCP_SERVER_NAME];
  const action =
    currentServer === undefined
      ? "create"
      : isSameJson(currentServer, serverConfig)
        ? "noop"
        : "update";

  if (action === "noop") {
    return {
      config: existingConfig,
      action,
    };
  }

  return {
    config: {
      ...existingConfig,
      mcpServers: {
        ...currentServers,
        [AGY_MCP_SERVER_NAME]: serverConfig,
      },
    },
    action,
  };
}

/**
 * 기존 `mcp_config.json` 객체에서 convention-cli MCP server 설정만 제거합니다.
 *
 * 다른 MCP server와 최상위 key는 그대로 보존합니다. 제거 대상이 없으면 noop으로 반환해
 * 불필요한 파일 쓰기를 피합니다.
 *
 * @param {object} existingConfig - 기존 `mcp_config.json`에서 읽은 설정 객체입니다.
 * @returns {{config: object, action: "delete" | "noop"}} 제거 결과 설정과 작업 종류입니다.
 */
export function removeMcpServerConfig(existingConfig = {}) {
  if (!isPlainObject(existingConfig)) {
    throw new Error("Antigravity MCP config root must be a JSON object.");
  }

  if (existingConfig.mcpServers === undefined) {
    return {
      config: existingConfig,
      action: "noop",
    };
  }

  if (!isPlainObject(existingConfig.mcpServers)) {
    throw new Error("Antigravity MCP config mcpServers must be a JSON object.");
  }

  if (existingConfig.mcpServers[AGY_MCP_SERVER_NAME] === undefined) {
    return {
      config: existingConfig,
      action: "noop",
    };
  }

  const nextServers = { ...existingConfig.mcpServers };
  delete nextServers[AGY_MCP_SERVER_NAME];

  return {
    config: {
      ...existingConfig,
      mcpServers: nextServers,
    },
    action: "delete",
  };
}

/**
 * Antigravity MCP config 파일을 안전하게 읽습니다.
 *
 * 파일이 없으면 빈 객체를 반환합니다. JSON이 깨져 있으면 원문 내용을 출력하지 않는 오류를
 * 던져, secret이 섞인 config 파일이 로그에 노출되지 않게 합니다.
 *
 * @param {string} filePath - 읽을 `mcp_config.json` 경로입니다.
 * @param {object} [options={}] - 테스트 주입용 옵션입니다.
 * @param {typeof fs} [options.fsImpl=fs] - 파일 시스템 구현체입니다.
 * @returns {object} 파싱된 config 객체 또는 파일이 없을 때 빈 객체입니다.
 */
export function readMcpConfig(filePath, { fsImpl = fs } = {}) {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new TypeError("filePath must be a non-empty string.");
  }

  if (!fsImpl.existsSync(filePath)) {
    return {};
  }

  try {
    const rawConfig = fsImpl.readFileSync(filePath, "utf8");
    const parsedConfig = JSON.parse(rawConfig);

    if (!isPlainObject(parsedConfig)) {
      throw new Error("root is not object");
    }

    return parsedConfig;
  } catch {
    throw new Error(
      `Antigravity MCP config JSON을 읽을 수 없습니다. 파일을 직접 확인해 주세요: ${filePath}`,
    );
  }
}

/**
 * Antigravity MCP config 파일을 BOM 없는 UTF-8 JSON으로 저장합니다.
 *
 * @param {string} filePath - 저장할 `mcp_config.json` 경로입니다.
 * @param {object} config - 저장할 JSON config 객체입니다.
 * @param {object} [options={}] - 테스트 주입용 옵션입니다.
 * @param {typeof fs} [options.fsImpl=fs] - 파일 시스템 구현체입니다.
 * @returns {void}
 */
export function writeMcpConfig(filePath, config, { fsImpl = fs } = {}) {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new TypeError("filePath must be a non-empty string.");
  }

  if (!isPlainObject(config)) {
    throw new TypeError("config must be a JSON object.");
  }

  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  fsImpl.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

