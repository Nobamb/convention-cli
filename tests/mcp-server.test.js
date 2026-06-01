import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { EventEmitter } from "node:events";
import { runMCPServer, deps } from "../src/commands/mcp.js";
import { DEFAULT_TEMPLATE } from "../src/templates/loader.js";

// 원래의 입출력 채널과 핵심 비즈니스 로직 함수들을 테스트 격리를 위해 보관합니다.
const originalStdinOn = process.stdin.on;
const originalStdinEmit = process.stdin.emit;
const processStdoutWrite = process.stdout.write;
const originalProcessExit = process.exit;

// mcp.js 내부에 묶여 있는 종속성들을 오버라이드하기 위해 원본 백업
const originalDepsAddFile = deps.addFile;
const originalDepsGetChangedFiles = deps.getChangedFiles;
const originalDepsGetFileDiffs = deps.getFileDiffs;
const originalDepsCommit = deps.commit;
const originalDepsLoadConfig = deps.loadConfig;
const originalDepsLoadValidatedTemplate = deps.loadValidatedTemplate;

let stdoutLines = [];
let lastExitCode = null;

// 각 테스트 케이스 실행 후, 스파이(Spy) 및 모킹(Mocking)된 전역 상태와 종속성들을 원상복구합니다.
afterEach(() => {
  process.stdin.on = originalStdinOn;
  process.stdin.emit = originalStdinEmit;
  process.stdout.write = processStdoutWrite;
  process.exit = originalProcessExit;
  
  // mcp.js 내부 종속성 복구
  deps.addFile = originalDepsAddFile;
  deps.getChangedFiles = originalDepsGetChangedFiles;
  deps.getFileDiffs = originalDepsGetFileDiffs;
  deps.commit = originalDepsCommit;
  deps.loadConfig = originalDepsLoadConfig;
  deps.loadValidatedTemplate = originalDepsLoadValidatedTemplate;

  stdoutLines = [];
  lastExitCode = null;
});

/**
 * 입출력 스트림과 Git 핵심 모듈을 모킹하여 통신 환경을 구축하는 테스트 조력자 헬퍼입니다.
 */
function setupMockEnv() {
  stdoutLines = [];
  
  // stdout.write를 모킹하여 송출되는 JSON-RPC 패킷을 가로채 어레이에 적재합니다.
  process.stdout.write = (chunk) => {
    stdoutLines.push(String(chunk));
    return true;
  };

  // process.exit를 가로채 좀비 프로세스가 되지 않고 상태를 기록하도록 조치합니다.
  process.exit = (code) => {
    lastExitCode = code;
  };

  const fakeStdin = new EventEmitter();
  fakeStdin.setEncoding = () => {};
  
  process.stdin.on = fakeStdin.on.bind(fakeStdin);
  process.stdin.emit = fakeStdin.emit.bind(fakeStdin);

  return { fakeStdin };
}

test("MCP Server - initialize 라이프사이클 통신이 정합 규격을 만족하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  // MCP 서버 구동
  await runMCPServer();

  // initialize 요청을 패킷 라인 단위로 모의 송신
  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-host", version: "1.0.0" }
    }
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());
  
  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 1);
  assert.equal(response.result.protocolVersion, "2025-06-18");
  assert.equal(response.result.serverInfo.name, "convention-cli-mcp");
});

test("MCP Server - tools/list 요청 시 3가지 안전한 도구 명세를 제공하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  await runMCPServer();

  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());
  const tools = response.result.tools;

  assert.equal(tools.length, 3);
  assert.equal(tools[0].name, "get_masked_git_diff");
  assert.equal(tools[1].name, "build_commit_prompt");
  assert.equal(tools[2].name, "execute_git_commit");
});

test("MCP Server - get_masked_git_diff 호출 시 변경 diff를 안전하게 마스킹 정화하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  // deps 맵을 오버라이딩하여 가짜 Git 함수들을 주입합니다. (ESM 호환 기법)
  deps.getChangedFiles = () => ["src/index.js", "secret.env"];
  deps.getFileDiffs = (files) => {
    return [
      { file: "src/index.js", diff: "+ const db = 'DATABASE_URL=postgres://user:password@localhost/db';" },
    ];
  };

  await runMCPServer();

  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_masked_git_diff",
      arguments: {}
    }
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());
  const textContent = response.result.content[0].text;

  // 마스킹되어 비밀번호 정보가 완벽히 [REDACTED] 처리되었는지 확인합니다.
  assert.match(textContent, /DATABASE_URL=\[REDACTED\]/);
  assert.doesNotMatch(textContent, /postgres:\/\/user/);
});

test("MCP Server - build_commit_prompt 호출 시 Conventional Commits 프롬프트를 정확히 빌드하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  deps.loadConfig = () => ({
    language: "en",
    mode: "batch"
  });
  deps.loadValidatedTemplate = () => null;

  await runMCPServer();

  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "build_commit_prompt",
      arguments: {
        diff: "some test diff metadata"
      }
    }
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());
  const prompt = response.result.content[0].text;

  // 다국어 설정(English)과 Conventional 규격 정보가 조립되었는지 확인합니다.
  assert.match(prompt, /Conventional Commits/);
  assert.match(prompt, /English/);
  assert.match(prompt, /some test diff metadata/);
});

test("MCP Server - execute_git_commit 호출 시 confirmBeforeCommit가 false이면 바로 커밋을 수행하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  let committedMsg = null;
  let committedFiles = null;
  const stagedFiles = [];

  deps.getChangedFiles = () => ["src/index.js", ".env"];
  deps.getFileDiffs = () => [
    { file: "src/index.js", diff: "+ console.log('safe');" },
  ];
  deps.addFile = (file) => {
    stagedFiles.push(file);
  };
  deps.commit = (msg, files) => {
    committedMsg = msg;
    committedFiles = files;
  };

  deps.loadConfig = () => ({
    confirmBeforeCommit: false // 로컬 확인 단계를 바로 통과 처리
  });

  await runMCPServer();

  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "execute_git_commit",
      arguments: {
        message: "feat: implement antigravity mcp integration"
      }
    }
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());
  assert.equal(response.result.content[0].text, "Commit completed successfully.");
  assert.equal(committedMsg, "feat: implement antigravity mcp integration");
  assert.deepEqual(stagedFiles, ["src/index.js"]);
  assert.deepEqual(committedFiles, ["src/index.js"]);
});

test("MCP Server - invalid method에 대해 규격에 정의된 Method Not Found 에러를 회신하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  await runMCPServer();

  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 99,
    method: "invalid/non-existent-method",
    params: {}
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());
  
  assert.equal(response.error.code, -32601);
  assert.match(response.error.message, /Method not found/);
});

test("MCP Server - execute_git_commit files 인자의 Git pathspec magic을 거부하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  let didCommit = false;
  const stagedFiles = [];

  // 실제 변경 파일 목록에 tracked .env가 있더라도, MCP 호스트가 넘긴 files 값은 먼저 안전한 상대 경로인지 검증해야 합니다.
  // `:(glob)**`는 Git에서 모든 파일을 매칭할 수 있는 pathspec magic이므로 일반 파일명처럼 취급하면 안 됩니다.
  deps.getChangedFiles = () => [".env", "src/index.js"];
  deps.getFileDiffs = () => {
    throw new Error("getFileDiffs must not receive unsafe pathspec input.");
  };
  deps.addFile = (file) => {
    stagedFiles.push(file);
  };
  deps.commit = () => {
    didCommit = true;
  };

  deps.loadConfig = () => ({
    confirmBeforeCommit: false,
  });

  await runMCPServer();

  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "execute_git_commit",
      arguments: {
        message: "fix: reject unsafe mcp pathspec",
        files: [":(glob)**"],
      },
    },
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());

  assert.match(
    response.result.content[0].text,
    /MCP files argument contains an unsafe file path/,
  );
  assert.deepEqual(stagedFiles, []);
  assert.equal(didCommit, false);
});

test("MCP Server - execute_git_commit files 인자는 실제 변경 파일과 교집합만 커밋하는가", async () => {
  const { fakeStdin } = setupMockEnv();

  let getFileDiffsInput = null;
  let committedFiles = null;
  const stagedFiles = [];

  // MCP 호스트가 안전한 파일명을 넘겨도, Git이 실제 변경 파일로 보고한 항목과 일치하는 값만 커밋 후보로 사용합니다.
  // 이 교집합 처리가 있어야 호스트가 임의 경로나 변경되지 않은 파일을 커밋 범위에 끼워 넣을 수 없습니다.
  deps.getChangedFiles = () => ["src/index.js", "README.md"];
  deps.getFileDiffs = (files) => {
    getFileDiffsInput = files;
    return [{ file: "src/index.js", diff: "+ console.log('safe');" }];
  };
  deps.addFile = (file) => {
    stagedFiles.push(file);
  };
  deps.commit = (msg, files) => {
    committedFiles = files;
  };

  deps.loadConfig = () => ({
    confirmBeforeCommit: false,
  });

  await runMCPServer();

  fakeStdin.emit("data", JSON.stringify({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "execute_git_commit",
      arguments: {
        message: "fix: commit requested changed file",
        files: ["src/index.js"],
      },
    },
  }) + "\n");

  assert.equal(stdoutLines.length, 1);
  const response = JSON.parse(stdoutLines[0].trim());

  assert.equal(response.result.content[0].text, "Commit completed successfully.");
  assert.deepEqual(getFileDiffsInput, ["src/index.js"]);
  assert.deepEqual(stagedFiles, ["src/index.js"]);
  assert.deepEqual(committedFiles, ["src/index.js"]);
});
