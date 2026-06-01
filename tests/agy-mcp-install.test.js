import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test, { afterEach } from "node:test";
import {
  AGY_MCP_SERVER_NAME,
  buildConventionMcpServerConfig,
  detectExistingTargets,
  getAntigravityMcpConfigCandidate,
  getAntigravityMcpConfigCandidates,
  mergeMcpServerConfig,
  readMcpConfig,
  removeMcpServerConfig,
} from "../src/core/agyMcpConfig.js";
import {
  runAgyMcpInstall,
  runAgyMcpUninstall,
} from "../src/commands/agyMcpInstall.js";

// 테스트가 실제 사용자 홈의 Antigravity 설정 파일을 건드리지 않도록,
// 모든 파일 시스템 테스트는 repository 내부 임시 폴더 아래에서만 수행합니다.
const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const tempRoot = tempRoots.pop();
    const resolvedRoot = path.resolve(tempRoot);
    const workspaceRoot = path.resolve(process.cwd());

    // 재귀 삭제 전에 테스트 임시 디렉터리가 현재 workspace 내부인지 다시 확인합니다.
    // 이 방어선은 실수로 사용자 홈이나 repository 상위 디렉터리를 지우는 일을 막습니다.
    if (resolvedRoot.startsWith(workspaceRoot + path.sep)) {
      fs.rmSync(resolvedRoot, { recursive: true, force: true });
    }
  }
});

/**
 * 테스트용 Antigravity home 디렉터리를 만듭니다.
 *
 * @returns {string} 실제 사용자 홈이 아닌 workspace 내부 임시 home 경로입니다.
 */
function createTempHome() {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), ".tmp-agy-mcp-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}

/**
 * JSON 파일을 만들고 parent directory도 함께 생성합니다.
 *
 * @param {string} filePath - 저장할 JSON 파일 경로입니다.
 * @param {object} value - JSON으로 직렬화할 객체입니다.
 * @returns {void}
 */
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * JSON 파일을 읽어 객체로 반환합니다.
 *
 * @param {string} filePath - 읽을 JSON 파일 경로입니다.
 * @returns {object} 파싱된 JSON 객체입니다.
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("Antigravity MCP config candidates are fixed and target-aware", () => {
  const homeDir = path.join("C:", "Users", "tester");
  const candidates = getAntigravityMcpConfigCandidates(homeDir);

  assert.deepEqual(
    candidates.map((candidate) => candidate.target),
    ["editor", "cli", "ide", "gemini"],
  );
  assert.equal(
    getAntigravityMcpConfigCandidate("cli", homeDir).configPath,
    path.join(homeDir, ".gemini", "antigravity-cli", "mcp_config.json"),
  );
  assert.throws(
    () => getAntigravityMcpConfigCandidate("unknown", homeDir),
    /지원하지 않는 Antigravity MCP target/,
  );
});

test("detectExistingTargets checks only supplied fixed candidates", () => {
  const homeDir = createTempHome();
  const cliDir = path.join(homeDir, ".gemini", "antigravity-cli");
  fs.mkdirSync(cliDir, { recursive: true });

  const existingTargets = detectExistingTargets(
    getAntigravityMcpConfigCandidates(homeDir),
  );

  assert.deepEqual(
    existingTargets.map((candidate) => candidate.target),
    ["cli"],
  );
});

test("buildConventionMcpServerConfig creates argv-array based safe server config", () => {
  const config = buildConventionMcpServerConfig({
    nodePath: "C:\\Program Files\\nodejs\\node.exe",
    cliPath: "C:\\repo\\bin\\convention.js",
    cwd: "C:\\repo",
  });

  assert.equal(config.command, "C:\\Program Files\\nodejs\\node.exe");
  assert.deepEqual(config.args, ["C:\\repo\\bin\\convention.js", "-am"]);
  assert.equal(config.cwd, "C:\\repo");
  assert.deepEqual(Object.keys(config.env), [
    "CONVENTION_EXPERIMENTAL_ANTIGRAVITY",
  ]);
});

test("mergeMcpServerConfig preserves other servers and top-level keys", () => {
  const serverConfig = buildConventionMcpServerConfig({
    nodePath: "node",
    cliPath: "bin/convention.js",
    cwd: "repo",
  });
  const existingConfig = {
    customKey: { enabled: true },
    mcpServers: {
      "other-server": {
        command: "other",
      },
    },
  };
  const { config, action } = mergeMcpServerConfig(existingConfig, serverConfig);

  assert.equal(action, "create");
  assert.deepEqual(config.customKey, { enabled: true });
  assert.deepEqual(config.mcpServers["other-server"], { command: "other" });
  assert.deepEqual(config.mcpServers[AGY_MCP_SERVER_NAME], serverConfig);
});

test("mergeMcpServerConfig returns noop when convention-cli config is already current", () => {
  const serverConfig = buildConventionMcpServerConfig({
    nodePath: "node",
    cliPath: "bin/convention.js",
    cwd: "repo",
  });
  const { action } = mergeMcpServerConfig(
    {
      mcpServers: {
        [AGY_MCP_SERVER_NAME]: {
          cwd: "repo",
          env: { CONVENTION_EXPERIMENTAL_ANTIGRAVITY: "true" },
          args: ["bin/convention.js", "-am"],
          command: "node",
        },
      },
    },
    serverConfig,
  );

  assert.equal(action, "noop");
});

test("removeMcpServerConfig removes only convention-cli server", () => {
  const { config, action } = removeMcpServerConfig({
    mcpServers: {
      [AGY_MCP_SERVER_NAME]: {
        command: "node",
      },
      "other-server": {
        command: "other",
      },
    },
  });

  assert.equal(action, "delete");
  assert.equal(config.mcpServers[AGY_MCP_SERVER_NAME], undefined);
  assert.deepEqual(config.mcpServers["other-server"], { command: "other" });
});

test("readMcpConfig rejects broken JSON without exposing file contents", () => {
  const homeDir = createTempHome();
  const configPath = getAntigravityMcpConfigCandidate("cli", homeDir).configPath;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, '{ "token": "secret-token",', "utf8");

  assert.throws(
    () => readMcpConfig(configPath),
    (error) =>
      error instanceof Error &&
      error.message.includes(configPath) &&
      !error.message.includes("secret-token"),
  );
});

test("runAgyMcpInstall creates mcp_config.json with explicit target and yes", async () => {
  const homeDir = createTempHome();
  const result = await runAgyMcpInstall({
    target: "cli",
    homeDir,
    cwd: process.cwd(),
    yes: true,
    interactive: false,
  });
  const configPath = getAntigravityMcpConfigCandidate("cli", homeDir).configPath;
  const savedConfig = readJson(configPath);

  assert.equal(result.action, "create");
  assert.equal(result.configPath, configPath);
  assert.equal(savedConfig.mcpServers[AGY_MCP_SERVER_NAME].command, process.execPath);
  assert.deepEqual(Object.keys(savedConfig.mcpServers[AGY_MCP_SERVER_NAME].env), [
    "CONVENTION_EXPERIMENTAL_ANTIGRAVITY",
  ]);
});

test("runAgyMcpInstall preview does not create directories or files", async () => {
  const homeDir = createTempHome();
  const candidate = getAntigravityMcpConfigCandidate("cli", homeDir);
  const result = await runAgyMcpInstall({
    target: "cli",
    homeDir,
    cwd: process.cwd(),
    preview: true,
    yes: true,
    interactive: false,
  });

  assert.equal(result.preview, true);
  assert.equal(result.action, "create");
  assert.equal(fs.existsSync(candidate.dirPath), false);
  assert.equal(fs.existsSync(candidate.configPath), false);
});

test("runAgyMcpInstall in non-interactive mode requires yes before writing", async () => {
  const homeDir = createTempHome();

  await assert.rejects(
    runAgyMcpInstall({
      target: "editor",
      homeDir,
      cwd: process.cwd(),
      interactive: false,
    }),
    /--yes/,
  );

  assert.equal(
    fs.existsSync(getAntigravityMcpConfigCandidate("editor", homeDir).configPath),
    false,
  );
});

test("runAgyMcpInstall updates only convention-cli server and preserves secret server", async () => {
  const homeDir = createTempHome();
  const configPath = getAntigravityMcpConfigCandidate("cli", homeDir).configPath;
  writeJson(configPath, {
    mcpServers: {
      [AGY_MCP_SERVER_NAME]: {
        command: "node",
        args: ["old.js", "-am"],
        cwd: "old",
      },
      "secret-server": {
        command: "secret",
        env: {
          TOKEN: "secret-token",
        },
      },
    },
  });

  const result = await runAgyMcpInstall({
    target: "cli",
    homeDir,
    cwd: process.cwd(),
    yes: true,
    interactive: false,
  });
  const savedConfig = readJson(configPath);

  assert.equal(result.action, "update");
  assert.equal(savedConfig.mcpServers[AGY_MCP_SERVER_NAME].command, process.execPath);
  assert.deepEqual(savedConfig.mcpServers["secret-server"], {
    command: "secret",
    env: {
      TOKEN: "secret-token",
    },
  });
});

test("runAgyMcpUninstall removes only convention-cli server", async () => {
  const homeDir = createTempHome();
  const configPath = getAntigravityMcpConfigCandidate("cli", homeDir).configPath;
  writeJson(configPath, {
    mcpServers: {
      [AGY_MCP_SERVER_NAME]: {
        command: "node",
      },
      "other-server": {
        command: "other",
      },
    },
  });

  const result = await runAgyMcpUninstall({
    target: "cli",
    homeDir,
    yes: true,
    interactive: false,
  });
  const savedConfig = readJson(configPath);

  assert.equal(result.action, "delete");
  assert.equal(savedConfig.mcpServers[AGY_MCP_SERVER_NAME], undefined);
  assert.deepEqual(savedConfig.mcpServers["other-server"], { command: "other" });
});

test("runAgyMcpUninstall preview does not modify existing file", async () => {
  const homeDir = createTempHome();
  const configPath = getAntigravityMcpConfigCandidate("cli", homeDir).configPath;
  const originalConfig = {
    mcpServers: {
      [AGY_MCP_SERVER_NAME]: {
        command: "node",
      },
    },
  };
  writeJson(configPath, originalConfig);

  const result = await runAgyMcpUninstall({
    target: "cli",
    homeDir,
    preview: true,
    yes: true,
    interactive: false,
  });

  assert.equal(result.preview, true);
  assert.deepEqual(readJson(configPath), originalConfig);
});

test("preview output does not include existing secret server values", async () => {
  const homeDir = createTempHome();
  const configPath = getAntigravityMcpConfigCandidate("cli", homeDir).configPath;
  const capturedOutput = [];
  const originalConsoleLog = console.log;
  writeJson(configPath, {
    mcpServers: {
      "secret-server": {
        command: "secret",
        env: {
          TOKEN: "secret-token",
        },
      },
    },
  });

  try {
    console.log = (message) => {
      capturedOutput.push(String(message));
    };

    await runAgyMcpInstall({
      target: "cli",
      homeDir,
      cwd: process.cwd(),
      preview: true,
      interactive: false,
    });
  } finally {
    console.log = originalConsoleLog;
  }

  const output = capturedOutput.join("\n");
  assert.doesNotMatch(output, /secret-token/);
  assert.doesNotMatch(output, /secret-server/);
  assert.match(output, /convention-cli-mcp/);
});

test("CLI help includes Antigravity MCP install options", () => {
  const result = spawnSync(process.execPath, ["bin/convention.js", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /-iam, --install-agy-mcp/);
  assert.match(result.stdout, /-uam, --uninstall-agy-mcp/);
  assert.match(result.stdout, /-tg, --target <target>/);
  assert.match(result.stdout, /-pv, --preview/);
});

test("CLI rejects Antigravity MCP setup modifiers without setup command", () => {
  const result = spawnSync(process.execPath, ["bin/convention.js", "-tg", "cli"], {
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--target\/-tg, --preview\/-pv/);
});

test("CLI rejects install and uninstall together", () => {
  const result = spawnSync(process.execPath, ["bin/convention.js", "-iam", "-uam"], {
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /install-agy-mcp/);
  assert.match(result.stderr, /uninstall-agy-mcp/);
});

test("CLI rejects install command mixed with MCP server mode", () => {
  const result = spawnSync(process.execPath, ["bin/convention.js", "-iam", "-am"], {
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Antigravity MCP 설치\/제거/);
});

