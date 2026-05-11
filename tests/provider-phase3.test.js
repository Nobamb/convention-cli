import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { generateCommitMessage } from "../src/core/ai.js";
import { generateWithProvider, getProvider, listProviderModels } from "../src/providers/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("L Gemini provider sends prompt and extracts generated text", async () => {
  let requestedURL;
  let requestBody;

  globalThis.fetch = async (url, options) => {
    requestedURL = url;
    requestBody = JSON.parse(options.body);

    return {
      ok: true,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: "feat: add cloud provider" }],
              },
            },
          ],
        };
      },
    };
  };

  const message = await generateWithProvider({
    prompt: "Generate a commit message",
    config: {
      provider: "gemini",
      apiKey: "test-key",
      modelVersion: "gemini-test",
      timeoutMs: 10,
    },
  });

  assert.match(requestedURL, /models\/gemini-test:generateContent/);
  assert.match(requestedURL, /key=test-key/);
  assert.equal(requestBody.contents[0].parts[0].text, "Generate a commit message");
  assert.equal(message, "feat: add cloud provider");
});

test("L Gemini listModels extracts model names", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        models: [{ name: "models/gemini-1.5-flash" }, { name: "models/gemini-1.5-pro" }],
      };
    },
  });

  assert.deepEqual(
    await listProviderModels({ provider: "gemini", apiKey: "test-key", timeoutMs: 10 }),
    ["gemini-1.5-flash", "gemini-1.5-pro"],
  );
});

test("M OpenAI-compatible provider calls chat completions with bearer auth", async () => {
  let requestedURL;
  let requestHeaders;
  let requestBody;

  globalThis.fetch = async (url, options) => {
    requestedURL = url;
    requestHeaders = options.headers;
    requestBody = JSON.parse(options.body);

    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: "fix: handle provider response" } }],
        };
      },
    };
  };

  const message = await generateCommitMessage("Generate a commit message", {
    provider: "openaiCompatible",
    apiKey: "test-key",
    baseURL: "https://example.test/v1",
    modelVersion: "test-model",
    timeoutMs: 10,
  });

  assert.equal(requestedURL, "https://example.test/v1/chat/completions");
  assert.equal(requestHeaders.authorization, "Bearer test-key");
  assert.equal(requestBody.model, "test-model");
  assert.equal(requestBody.messages[0].content, "Generate a commit message");
  assert.equal(message, "fix: handle provider response");
});

test("M OpenAI-compatible listModels extracts ids", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        data: [{ id: "qwen2.5:7b" }, { id: "gpt-compatible" }],
      };
    },
  });

  assert.deepEqual(
    await listProviderModels({
      provider: "openaiCompatible",
      baseURL: "https://example.test/v1",
      modelVersion: "test-model",
      timeoutMs: 10,
    }),
    ["qwen2.5:7b", "gpt-compatible"],
  );
});

test("N provider routing includes gemini and OpenAI-compatible providers", () => {
  assert.equal(typeof getProvider("gemini").generateCommitMessage, "function");
  assert.equal(typeof getProvider("openaiCompatible").generateCommitMessage, "function");
});
