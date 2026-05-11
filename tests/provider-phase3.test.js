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
  assert.equal(new URL(requestedURL).searchParams.has("key"), false);
  assert.equal(requestHeaders["x-goog-api-key"], "test-key");
  assert.equal(requestBody.contents[0].parts[0].text, "Generate a commit message");
  assert.equal(message, "feat: add cloud provider");
});

test("L Gemini listModels extracts model names", async () => {
  let requestedURL;
  let requestHeaders;

  globalThis.fetch = async (url, options) => {
    requestedURL = url;
    requestHeaders = options.headers;

    return {
      ok: true,
      async json() {
        return {
          models: [{ name: "models/gemini-1.5-flash" }, { name: "models/gemini-1.5-pro" }],
        };
      },
    };
  };

  assert.deepEqual(
    await listProviderModels({ provider: "gemini", apiKey: "test-key", timeoutMs: 10 }),
    ["gemini-1.5-flash", "gemini-1.5-pro"],
  );
  assert.equal(new URL(requestedURL).searchParams.has("key"), false);
  assert.equal(requestHeaders["x-goog-api-key"], "test-key");
});

test("L Gemini provider errors omit request URL, API key, and raw response body", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    async text() {
      return "raw body contains test-key and https://generativelanguage.googleapis.com/v1beta/models";
    },
  });

  await assert.rejects(
    () =>
      generateWithProvider({
        prompt: "Generate a commit message",
        config: {
          provider: "gemini",
          apiKey: "test-key",
          modelVersion: "gemini-test",
          timeoutMs: 10,
        },
      }),
    (error) => {
      assert.match(error.message, /Gemini commit message request failed with status 403\./);
      assert.doesNotMatch(error.message, /test-key/);
      assert.doesNotMatch(error.message, /generativelanguage\.googleapis\.com/);
      assert.doesNotMatch(error.message, /raw body/);
      assert.doesNotMatch(error.message, /Authorization/i);
      return true;
    },
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

test("M OpenAI-compatible rejects baseURL secrets before fetch", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  };

  await assert.rejects(
    () =>
      listProviderModels({
        provider: "openaiCompatible",
        baseURL: "https://user:secret@example.test/v1?api_key=leaked#frag",
        modelVersion: "test-model",
        timeoutMs: 10,
      }),
    (error) => {
      assert.match(
        error.message,
        /must not include credentials, query parameters, or fragments/,
      );
      assert.doesNotMatch(error.message, /secret|leaked|user@example/);
      return true;
    },
  );
  assert.equal(fetchCalled, false);
});

test("N provider routing includes gemini and OpenAI-compatible providers", () => {
  assert.equal(typeof getProvider("gemini").generateCommitMessage, "function");
  assert.equal(typeof getProvider("openaiCompatible").generateCommitMessage, "function");
});
