import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';
import prompts from 'prompts';

import { DEFAULT_CONFIG, DEFAULT_LOCAL_LLM_BASE_URL } from '../src/config/defaults.js';
import { toSelectChoices } from '../src/utils/ui.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  prompts.inject([]);
  globalThis.fetch = originalFetch;
});

async function importModelCommandWithTempHome() {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-model-home-'));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;

  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  const stamp = `${Date.now()}-${Math.random()}`;
  const storeUrl = new URL('../src/config/store.js', import.meta.url);
  storeUrl.search = `?home=${encodeURIComponent(tempHome)}&t=${stamp}`;
  const modelUrl = new URL('../src/commands/model.js', import.meta.url);
  modelUrl.search = `?home=${encodeURIComponent(tempHome)}&t=${stamp}`;

  const store = await import(storeUrl.href);
  const modelCommand = await import(modelUrl.href);

  function cleanup() {
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
  }

  return { store, modelCommand, cleanup };
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
