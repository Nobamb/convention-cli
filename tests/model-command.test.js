import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import prompts from 'prompts';

import { DEFAULT_CONFIG, DEFAULT_LOCAL_LLM_BASE_URL } from '../src/config/defaults.js';
import { toSelectChoices } from '../src/utils/ui.js';

const originalFetch = globalThis.fetch;
let sharedTempHome;
let sharedStore;
let sharedModelCommand;

afterEach(() => {
  prompts.inject([]);
  globalThis.fetch = originalFetch;
});

async function importModelCommandWithTempHome() {
  if (!sharedTempHome) {
    sharedTempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-model-home-'));
    process.env.HOME = sharedTempHome;
    process.env.USERPROFILE = sharedTempHome;
    sharedStore = await import('../src/config/store.js');
    sharedModelCommand = await import('../src/commands/model.js');
  }

  fs.rmSync(sharedStore.CONFIG_DIR, { recursive: true, force: true });

  function cleanup() {
    fs.rmSync(sharedStore.CONFIG_DIR, { recursive: true, force: true });
  }

  return { store: sharedStore, modelCommand: sharedModelCommand, cleanup };
}

test('H-1 toSelectChoices converts local model names to prompts choices', () => {
  assert.deepEqual(toSelectChoices(['qwen2.5:7b', 'gemma2:9b']), [
    { title: 'qwen2.5:7b', value: 'qwen2.5:7b' },
    { title: 'gemma2:9b', value: 'gemma2:9b' },
  ]);
});

test('H-2 runModelSetup stores selected localLLM modelVersion without API key', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    store.saveConfig({
      ...DEFAULT_CONFIG,
      mode: 'batch',
      language: 'en',
    });

    const nextConfig = await modelCommand.runModelSetup('localLLM', 'none', 'qwen2.5:7b');

    assert.equal(nextConfig.provider, 'localLLM');
    assert.equal(nextConfig.authType, 'none');
    assert.equal(nextConfig.baseURL, DEFAULT_LOCAL_LLM_BASE_URL);
    assert.equal(nextConfig.modelVersion, 'qwen2.5:7b');
    assert.equal(nextConfig.modelDisplayName, 'qwen2.5:7b');
    assert.deepEqual(store.loadConfig(), {
      ...DEFAULT_CONFIG,
      mode: 'batch',
      language: 'en',
      provider: 'localLLM',
      authType: 'none',
      baseURL: DEFAULT_LOCAL_LLM_BASE_URL,
      modelVersion: 'qwen2.5:7b',
      modelDisplayName: 'qwen2.5:7b',
    });
  } finally {
    cleanup();
  }
});

test('H-3 openaiCompatible model list request requires confirmation before API key or fetch', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();
  let fetchCalled = false;

  try {
    store.saveConfig({
      ...DEFAULT_CONFIG,
      baseURL: 'https://example.test/v1',
    });

    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    };
    prompts.inject([false]);

    await assert.rejects(
      () => modelCommand.runModelSetup('openaiCompatible', 'api'),
      /External provider model list request was canceled/,
    );

    assert.equal(fetchCalled, false);
    assert.equal(store.loadCredentials().openaiCompatible, undefined);
    assert.equal(store.loadConfig().provider, null);
  } finally {
    cleanup();
  }
});

test('P-1 runModelSetup without args completes full interactive localLLM setup', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    store.saveConfig({
      ...DEFAULT_CONFIG,
      mode: 'batch',
      language: 'jp',
    });

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'qwen2.5:7b' }] }),
    });
    prompts.inject(['localLLM', 'qwen2.5:7b']);

    const nextConfig = await modelCommand.runModelSetup();

    assert.equal(nextConfig.provider, 'localLLM');
    assert.equal(nextConfig.authType, 'none');
    assert.equal(nextConfig.modelVersion, 'qwen2.5:7b');
    assert.equal(nextConfig.mode, 'batch');
    assert.equal(nextConfig.language, 'jp');
    assert.equal(nextConfig.confirmBeforeCommit, true);
  } finally {
    cleanup();
  }
});

test('Q-1 provider-only localLLM skips provider selection and stores selected model', async () => {
  const { modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'gemma2:9b' }] }),
    });
    prompts.inject(['gemma2:9b']);

    const nextConfig = await modelCommand.runModelSetup('localLLM');

    assert.equal(nextConfig.provider, 'localLLM');
    assert.equal(nextConfig.authType, 'none');
    assert.equal(nextConfig.modelVersion, 'gemma2:9b');
  } finally {
    cleanup();
  }
});

test('Q-2 unsupported provider is rejected without mock fallback', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    await assert.rejects(
      () => modelCommand.runModelSetup('unknownProvider'),
      /provider/,
    );

    assert.equal(store.loadConfig().provider, null);
  } finally {
    cleanup();
  }
});

test('R-1 provider and authType mismatch is rejected before saving config', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    await assert.rejects(
      () => modelCommand.runModelSetup('localLLM', 'api'),
      /authType/,
    );

    assert.equal(store.loadConfig().provider, null);
    assert.deepEqual(store.loadCredentials(), {});
  } finally {
    cleanup();
  }
});

test('R-2 oauth is rejected in phase 4 model setup', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    await assert.rejects(
      () => modelCommand.runModelSetup('gemini', 'oauth'),
      /authType/,
    );

    assert.equal(store.loadConfig().provider, null);
  } finally {
    cleanup();
  }
});

test('S-1 direct gemini setup stores config without API key leakage', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    prompts.inject(['test-secret-key']);

    const nextConfig = await modelCommand.runModelSetup(
      'gemini',
      'api',
      'gemini-2.5-pro',
    );

    assert.equal(nextConfig.provider, 'gemini');
    assert.equal(nextConfig.authType, 'api');
    assert.equal(nextConfig.modelVersion, 'gemini-2.5-pro');
    assert.equal(nextConfig.apiKey, undefined);
    assert.equal(store.loadCredentials().gemini.apiKey, 'test-secret-key');

    const savedConfig = store.loadConfig();
    assert.equal(savedConfig.apiKey, undefined);
    assert.equal(savedConfig.token, undefined);
    assert.equal(savedConfig.secret, undefined);
    assert.equal(savedConfig.password, undefined);
  } finally {
    cleanup();
  }
});

test('S-3 direct gemini setup keeps existing API key when replacement is rejected', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    store.saveCredentials({
      gemini: {
        authType: 'api',
        apiKey: 'existing-secret-key',
      },
    });
    prompts.inject([false]);

    const nextConfig = await modelCommand.runModelSetup(
      'gemini',
      'api',
      'gemini-3-flash-preview',
    );

    assert.equal(nextConfig.provider, 'gemini');
    assert.equal(store.loadCredentials().gemini.apiKey, 'existing-secret-key');
  } finally {
    cleanup();
  }
});

test('S-4 direct gemini setup replaces existing API key only after confirmation', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    store.saveCredentials({
      gemini: {
        authType: 'api',
        apiKey: 'old-secret-key',
      },
    });
    prompts.inject([true, 'new-secret-key']);

    await modelCommand.runModelSetup('gemini', 'api', 'gemini-3-flash-preview');

    assert.equal(store.loadCredentials().gemini.apiKey, 'new-secret-key');
    assert.equal(store.loadConfig().apiKey, undefined);
  } finally {
    cleanup();
  }
});

test('S-2 empty direct modelVersion is rejected without config mutation', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    await assert.rejects(
      () => modelCommand.runModelSetup('localLLM', 'none', ''),
      /modelVersion/,
    );

    assert.deepEqual(store.loadConfig(), DEFAULT_CONFIG);
  } finally {
    cleanup();
  }
});

test('T-1 direct localLLM setup preserves existing config fields and pretty saves JSON', async () => {
  const { store, modelCommand, cleanup } = await importModelCommandWithTempHome();

  try {
    store.saveConfig({
      ...DEFAULT_CONFIG,
      mode: 'batch',
      language: 'en',
      confirmBeforeCommit: false,
      apiKey: 'must-not-be-saved',
    });

    const nextConfig = await modelCommand.runModelSetup('localLLM', 'none', 'llama3:8b');

    assert.equal(nextConfig.mode, 'batch');
    assert.equal(nextConfig.language, 'en');
    assert.equal(nextConfig.confirmBeforeCommit, false);
    assert.equal(nextConfig.provider, 'localLLM');
    assert.equal(nextConfig.authType, 'none');
    assert.equal(nextConfig.modelVersion, 'llama3:8b');
    assert.equal(nextConfig.baseURL, DEFAULT_LOCAL_LLM_BASE_URL);
    assert.equal(nextConfig.apiKey, undefined);

    const rawConfig = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');
    assert.match(rawConfig, /\n  "mode": "batch"/);
    assert.doesNotMatch(rawConfig, /must-not-be-saved/);
  } finally {
    cleanup();
  }
});
