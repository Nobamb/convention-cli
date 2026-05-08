import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DEFAULT_CONFIG, DEFAULT_LOCAL_LLM_BASE_URL } from '../src/config/defaults.js';
import { toSelectChoices } from '../src/utils/ui.js';

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
