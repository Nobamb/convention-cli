import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { DEFAULT_LOCAL_LLM_BASE_URL } from '../src/config/defaults.js';
import {
  checkConnection,
  listModels,
  normalizeLocalLLMConfig,
  parseModelIds,
  validateConfig,
} from '../src/providers/localLLM.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('E-1 localLLM config applies default authType and baseURL', () => {
  const config = normalizeLocalLLMConfig({});

  assert.equal(config.provider, 'localLLM');
  assert.equal(config.authType, 'none');
  assert.equal(config.baseURL, DEFAULT_LOCAL_LLM_BASE_URL);
  assert.equal(validateConfig(config), true);
});

test('E-2 localLLM rejects non-none authType and invalid baseURL', () => {
  assert.throws(() => validateConfig({ authType: 'api' }), /authType "none"/);
  assert.throws(() => validateConfig({ baseURL: 'not-a-url' }), /valid http\(s\) URL/);
});

test('F-1 checkConnection succeeds when the local model endpoint responds', async () => {
  let requestedURL;

  globalThis.fetch = async (url) => {
    requestedURL = url;
    return {
      ok: true,
      async json() {
        return { data: [] };
      },
    };
  };

  assert.equal(await checkConnection({}), true);
  assert.equal(requestedURL, `${DEFAULT_LOCAL_LLM_BASE_URL}/models`);
});

test('F-2 checkConnection safely returns false when the local server is unavailable', async () => {
  globalThis.fetch = async () => {
    throw new Error('connection refused');
  };

  assert.equal(await checkConnection({ timeoutMs: 10 }), false);
});

test('G-1 parseModelIds extracts model identifiers from OpenAI-compatible responses', () => {
  assert.deepEqual(
    parseModelIds({
      data: [{ id: 'qwen2.5:7b' }, { id: 'gemma2:9b' }],
    }),
    ['qwen2.5:7b', 'gemma2:9b'],
  );
});

test('G-2 listModels returns local model names from /v1/models', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        data: [{ id: 'llama3:8b' }, { id: 'qwen2.5:7b' }],
      };
    },
  });

  assert.deepEqual(await listModels({}), ['llama3:8b', 'qwen2.5:7b']);
});

test('G-3 listModels fails clearly for empty or invalid model lists', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { data: [] };
    },
  });

  await assert.rejects(() => listModels({}), /사용할 수 있는 모델을 찾지 못했습니다/);
});

test('G-4 listModels preserves HTTP 429 status without reading raw response body', async () => {
  let rawBodyRead = false;

  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    async text() {
      rawBodyRead = true;
      return 'raw body with secret';
    },
  });

  await assert.rejects(
    () => listModels({}),
    (error) => {
      assert.equal(error.status, 429);
      assert.match(error.message, /localLLM model list request failed with status 429\./);
      assert.doesNotMatch(error.message, /secret/);
      return true;
    },
  );

  assert.equal(rawBodyRead, false);
});
