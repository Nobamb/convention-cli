import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  __test__,
  generateCommitMessage,
  listModels,
  validateConfig,
} from "../src/providers/codex-mcp.js";

function createFakeCodexProcess({
  tools = [{ name: "codex" }],
  toolResult = {
    structuredContent: {
      content: "feat: add codex mcp provider",
    },
  },
  hangMethod = null,
  stderrChunk = "",
  onRequest = () => {},
} = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  child.requests = [];
  child.spawnCalls = [];
  child.kill = () => {
    child.killed = true;
    child.exitCode = 1;
    child.emit("exit", 1);
    return true;
  };
  child.stdin = {
    write(data, _encoding, callback) {
      const message = JSON.parse(String(data).trim());
      child.requests.push(message);
      onRequest(message);

      if (message.id && message.method !== hangMethod) {
        const resultByMethod = {
          initialize: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            serverInfo: { name: "fake-codex" },
          },
          "tools/list": { tools },
          "tools/call": toolResult,
        };

        const response = {
          jsonrpc: "2.0",
          id: message.id,
          result: resultByMethod[message.method] ?? {},
        };

        process.nextTick(() => {
          child.stdout.emit("data", `${JSON.stringify(response)}\n`);
        });
      }

      if (typeof callback === "function") {
        callback();
      }
      return true;
    },
    end() {
      child.stdinEnded = true;
    },
  };

  if (stderrChunk) {
    process.nextTick(() => {
      child.stderr.emit("data", stderrChunk);
    });
  }

  return child;
}

function createFakeSpawn(fakeChild) {
  const calls = [];
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args, options });
    fakeChild.spawnCalls = calls;
    return fakeChild;
  };

  return { spawnImpl, calls };
}

test("codex-mcp provider completes MCP lifecycle and extracts structuredContent", async () => {
  const fakeChild = createFakeCodexProcess();
  const { spawnImpl, calls } = createFakeSpawn(fakeChild);

  const message = await generateCommitMessage({
    prompt: "Generate a commit message",
    config: { authType: "none", modelVersion: "gpt-5.3-codex" },
    spawnImpl,
  });

  assert.equal(message, "feat: add codex mcp provider");
  if (process.platform === "win32") {
    assert.equal(calls[0].command, "codex mcp-server");
    assert.deepEqual(calls[0].args, []);
  } else {
    assert.equal(calls[0].command, "codex");
    assert.deepEqual(calls[0].args, ["mcp-server"]);
  }
  const expectedShell = process.platform === "win32" ? true : false;
  assert.equal(calls[0].options.shell, expectedShell);
  assert.deepEqual(calls[0].options.stdio, ["pipe", "pipe", "pipe"]);
  assert.deepEqual(
    fakeChild.requests.map((request) => request.method),
    ["initialize", "notifications/initialized", "tools/list", "tools/call"],
  );
});

test("codex-mcp tool call uses only codex tool with read-only sandbox and never approval", async () => {
  const fakeChild = createFakeCodexProcess();
  const { spawnImpl } = createFakeSpawn(fakeChild);

  await generateCommitMessage({
    prompt: "Generate a commit message",
    config: {
      authType: "none",
      modelVersion: "gpt-5.3-codex",
      sandbox: "danger-full-access",
    },
    spawnImpl,
  });

  const toolCall = fakeChild.requests.find(
    (request) => request.method === "tools/call",
  );

  assert.equal(toolCall.params.name, "codex");
  assert.equal(toolCall.params.arguments["approval-policy"], "never");
  assert.equal(toolCall.params.arguments.sandbox, "read-only");
  assert.equal(toolCall.params.arguments.model, "gpt-5.3-codex");
  assert.equal(toolCall.params.arguments.prompt, "Generate a commit message");
});

test("codex-mcp provider extracts legacy text content when structuredContent is absent", async () => {
  const fakeChild = createFakeCodexProcess({
    toolResult: {
      content: [{ type: "text", text: "fix: handle codex mcp response" }],
    },
  });
  const { spawnImpl } = createFakeSpawn(fakeChild);

  const message = await generateCommitMessage({
    prompt: "Generate a commit message",
    config: { authType: "none" },
    spawnImpl,
  });

  assert.equal(message, "fix: handle codex mcp response");
});

test("codex-mcp provider rejects MCP servers without the codex tool", async () => {
  const fakeChild = createFakeCodexProcess({
    tools: [{ name: "codex-reply" }],
  });
  const { spawnImpl } = createFakeSpawn(fakeChild);

  await assert.rejects(
    () =>
      generateCommitMessage({
        prompt: "Generate a commit message",
        config: { authType: "none" },
        spawnImpl,
      }),
    /required codex tool/,
  );
});

test("codex-mcp provider times out safely and cleans up the subprocess", async () => {
  const fakeChild = createFakeCodexProcess({
    hangMethod: "tools/call",
    stderrChunk: "OPENAI_API_KEY=sk-secret\nAuthorization: Bearer token-secret",
  });
  const { spawnImpl } = createFakeSpawn(fakeChild);

  await assert.rejects(
    () =>
      generateCommitMessage({
        prompt: "Generate a commit message with API_KEY=raw-secret",
        config: {
          authType: "none",
          toolTimeoutMs: 5,
          cleanupTimeoutMs: 5,
        },
        spawnImpl,
      }),
    (error) => {
      assert.match(error.message, /Codex MCP commit message request timed out/);
      assert.doesNotMatch(error.message, /raw-secret/);
      assert.doesNotMatch(error.message, /sk-secret/);
      assert.doesNotMatch(error.message, /token-secret/);
      return true;
    },
  );

  assert.equal(fakeChild.stdinEnded, true);
  assert.equal(fakeChild.killed, true);
});

test("codex-mcp provider does not start MCP server for unsupported authType", async () => {
  let spawnCalled = false;

  await assert.rejects(
    () =>
      generateCommitMessage({
        prompt: "Generate a commit message",
        config: { authType: "oauth" },
        spawnImpl: () => {
          spawnCalled = true;
          throw new Error("spawn should not be called");
        },
      }),
    /only supports authType "none"/,
  );

  assert.equal(spawnCalled, false);
});

test("codex-mcp listModels avoids MCP subprocess and returns configured or default model list", async () => {
  const modelsWithConfig = await listModels({ modelVersion: "gpt-5.4" });
  assert.equal(modelsWithConfig[0], "gpt-5.4");
  assert.equal(modelsWithConfig.includes("gpt-5.3-codex"), true);

  const defaultModels = await listModels({});
  assert.equal(defaultModels[0], "gpt-5.3-codex");
  assert.equal(defaultModels.length, 5);
});

test("codex-mcp validateConfig only accepts none authType", () => {
  assert.equal(validateConfig({ authType: "none" }), true);
  assert.throws(() => validateConfig({ authType: "api" }), /only supports/);
});

test("codex-mcp test helpers expose safe tool argument policy", () => {
  const args = __test__.buildCodexToolArguments({
    prompt: "Generate a commit message",
    config: { modelVersion: "gpt-5.3-codex", sandbox: "workspace-write" },
  });

  assert.equal(args["approval-policy"], "never");
  assert.equal(args.sandbox, "read-only");
  assert.equal(args.model, "gpt-5.3-codex");
});

test("codex-mcp provider detects inner JSON error from MCP response", async () => {
  const fakeChild = createFakeCodexProcess({
    toolResult: {
      structuredContent: {
        content: JSON.stringify({
          type: "error",
          status: 400,
          error: {
            type: "invalid_request_error",
            message: "The 'gpt-5-mini' model is not supported when using Codex with a ChatGPT account."
          }
        })
      }
    }
  });
  const { spawnImpl } = createFakeSpawn(fakeChild);

  await assert.rejects(
    () =>
      generateCommitMessage({
        prompt: "Generate a commit message",
        config: { authType: "none" },
        spawnImpl,
      }),
    /The 'gpt-5-mini' model is not supported/
  );
});
