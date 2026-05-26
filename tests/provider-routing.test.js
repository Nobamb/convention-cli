import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "convention-cli-routing-"));
const previousHome = process.env.HOME;
const previousUserProfile = process.env.USERPROFILE;
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

test.after(() => {
  if (previousHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHome;
  }

  if (previousUserProfile === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = previousUserProfile;
  }

  fs.rmSync(tempHome, { recursive: true, force: true });
});

async function importWithTempHome() {
  const stamp = `${Date.now()}-${Math.random()}`;
  const providersUrl = new URL("../src/providers/index.js", import.meta.url);
  providersUrl.search = `?t=${stamp}`;
  const aiUrl = new URL("../src/core/ai.js", import.meta.url);
  aiUrl.search = `?t=${stamp}`;
  const oauthUrl = new URL("../src/auth/oauth.js", import.meta.url);
  oauthUrl.search = `?t=${stamp}`;
  const mockUrl = new URL("../src/providers/mock.js", import.meta.url);
  mockUrl.search = `?t=${stamp}`;
  const githubCopilotUrl = new URL(
    "../src/providers/github-copilot.js",
    import.meta.url,
  );
  githubCopilotUrl.search = `?t=${stamp}`;

  const providers = await import(providersUrl.href);
  const ai = await import(aiUrl.href);
  const oauth = await import(oauthUrl.href);
  const mock = await import(mockUrl.href);
  const githubCopilot = await import(githubCopilotUrl.href);

  function cleanup() {
    // 파일 단위 임시 HOME을 공유하므로 개별 테스트에서는 환경을 되돌리지 않습니다.
  }

  return { providers, ai, oauth, mock, githubCopilot, cleanup };
}

test("getProvider returns the mock provider by default", async () => {
  const { providers, cleanup } = await importWithTempHome();

  try {
    const provider = providers.getProvider(null);

    assert.equal(typeof provider.generateCommitMessage, "function");
    assert.equal(typeof provider.listModels, "function");
    assert.equal(typeof provider.validateConfig, "function");
  } finally {
    cleanup();
  }
});

test("generateWithProvider calls providers through the common interface", async () => {
  const { providers, mock, cleanup } = await importWithTempHome();

  try {
    const message = await providers.generateWithProvider({
      prompt: "Generate a commit message",
      config: { provider: "mock" },
    });

    assert.equal(message, mock.MOCK_COMMIT_MESSAGE);
  } finally {
    cleanup();
  }
});

test("core ai uses provider routing for null and mock providers", async () => {
  const { ai, mock, cleanup } = await importWithTempHome();

  try {
    assert.equal(
      await ai.generateCommitMessage("Generate a commit message", { provider: null }),
      mock.MOCK_COMMIT_MESSAGE,
    );
    assert.equal(
      await ai.generateCommitMessage("Generate a commit message", { provider: "mock" }),
      mock.MOCK_COMMIT_MESSAGE,
    );
  } finally {
    cleanup();
  }
});

test("listProviderModels uses provider listModels when available", async () => {
  const { providers, cleanup } = await importWithTempHome();

  try {
    assert.deepEqual(await providers.listProviderModels({ provider: "mock" }), ["mock"]);
  } finally {
    cleanup();
  }
});

test("provider routing rejects unsupported providers without mock fallback", async () => {
  const { providers, ai, cleanup } = await importWithTempHome();

  try {
    assert.throws(() => providers.getProvider("unknown"), /Unsupported provider: unknown/);
    await assert.rejects(
      () =>
        ai.generateCommitMessage("Generate a commit message", {
          provider: "unknown",
        }),
      /Unsupported provider: unknown/,
    );
  } finally {
    cleanup();
  }
});

test("OAuth routing rejects unregistered OAuth providers", async () => {
  const { providers, cleanup } = await importWithTempHome();

  try {
    await assert.rejects(
      () =>
        providers.generateWithProvider({
          prompt: "Generate a commit message",
          config: { provider: "mock", authType: "oauth" },
        }),
      /Unsupported OAuth provider/,
    );
  } finally {
    cleanup();
  }
});

test("Antigravity requires explicit experimental opt-in and baseURL before requests", async () => {
  const { providers, oauth, cleanup } = await importWithTempHome();
  const previousFetch = global.fetch;
  let fetchCalled = false;

  global.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch must not be called without explicit Antigravity config");
  };

  try {
    oauth.saveOAuthTokens("antigravity", {
      accessToken: "antigravity-token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    await assert.rejects(
      () =>
        providers.generateWithProvider({
          prompt: "Generate a commit message",
          config: {
            provider: "antigravity",
            authType: "oauth",
            modelVersion: "model",
          },
        }),
      /experimental and not confirmed to be OpenAI-compatible/,
    );
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = previousFetch;
    cleanup();
  }
});

test("Antigravity experimental request injects OAuth Bearer header when baseURL is explicit", async () => {
  const { providers, oauth, cleanup } = await importWithTempHome();
  const previousFetch = global.fetch;
  let capturedUrl;
  let capturedAuthorization;

  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedAuthorization = options.headers.Authorization;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "chore: update project files" } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    oauth.saveOAuthTokens("antigravity", {
      accessToken: "antigravity-token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    const message = await providers.generateWithProvider({
      prompt: "Generate a commit message",
      config: {
        provider: "antigravity",
        authType: "oauth",
        experimentalAntigravity: true,
        baseURL: "https://example.test/v1",
        modelVersion: "manual-model",
      },
    });

    assert.equal(message, "chore: update project files");
    assert.equal(capturedUrl, "https://example.test/v1/chat/completions");
    assert.equal(capturedAuthorization, "Bearer antigravity-token");
  } finally {
    global.fetch = previousFetch;
    cleanup();
  }
});

test("GitHub Copilot commit generation times out and still cleans up SDK resources", async () => {
  const { githubCopilot, cleanup } = await importWithTempHome();
  let disconnected = false;
  let stopped = false;

  class CopilotClient {
    async createSession() {
      return {
        sendAndWait: async () => new Promise(() => {}),
        disconnect: async () => {
          disconnected = true;
        },
      };
    }

    async stop() {
      stopped = true;
    }
  }

  try {
    await assert.rejects(
      () =>
        githubCopilot.generateCommitMessage({
          prompt: "Generate a commit message",
          config: {
            experimentalGitHubCopilot: true,
            timeoutMs: 5,
          },
          oauthAccessToken: "github-copilot-token",
          sdkModule: { CopilotClient },
        }),
      /GitHub Copilot SDK commit message generation timed out after 5ms/,
    );

    assert.equal(disconnected, true);
    assert.equal(stopped, true);
  } finally {
    cleanup();
  }
});

test("GitHub Copilot model list request times out and still stops SDK client", async () => {
  const { githubCopilot, cleanup } = await importWithTempHome();
  let stopped = false;

  class CopilotClient {
    async start() {}

    async listModels() {
      return new Promise(() => {});
    }

    async stop() {
      stopped = true;
    }
  }

  try {
    await assert.rejects(
      () =>
        githubCopilot.listModels(
          {
            experimentalGitHubCopilot: true,
            timeoutMs: 5,
          },
          {
            oauthAccessToken: "github-copilot-token",
            sdkModule: { CopilotClient },
          },
        ),
      /GitHub Copilot SDK model list request timed out after 5ms/,
    );

    assert.equal(stopped, true);
  } finally {
    cleanup();
  }
});
