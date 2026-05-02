import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DEFAULT_CONFIG } from '../src/config/defaults.js';

async function importStoreWithTempHome() {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-home-'));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;

  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  const storeUrl = new URL('../src/config/store.js', import.meta.url);
  storeUrl.search = `?home=${encodeURIComponent(tempHome)}&t=${Date.now()}`;
  const store = await import(storeUrl.href);

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

  return { store, cleanup };
}

test('ensureConfigDir creates the config directory', async () => {
  const { store, cleanup } = await importStoreWithTempHome();

  try {
    assert.equal(fs.existsSync(store.CONFIG_DIR), false);

    store.ensureConfigDir();

    assert.equal(fs.existsSync(store.CONFIG_DIR), true);
    assert.equal(fs.statSync(store.CONFIG_DIR).isDirectory(), true);
  } finally {
    cleanup();
  }
});

test('saveConfig writes pretty JSON and loadConfig reloads saved values', async () => {
  const { store, cleanup } = await importStoreWithTempHome();

  try {
    const config = {
      ...DEFAULT_CONFIG,
      mode: 'batch',
      language: 'en',
    };

    store.saveConfig(config);

    assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), true);
    const rawConfig = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');
    assert.match(rawConfig, /\n  "mode": "batch"/);
    assert.match(rawConfig, /\n  "language": "en"/);

    const loadedConfig = store.loadConfig();
    assert.deepEqual(loadedConfig, config);
  } finally {
    cleanup();
  }
});

test('saveConfig overwrites existing config values', async () => {
  const { store, cleanup } = await importStoreWithTempHome();

  try {
    store.saveConfig({
      ...DEFAULT_CONFIG,
      mode: 'step',
      language: 'ko',
    });

    store.saveConfig({
      ...DEFAULT_CONFIG,
      mode: 'batch',
      language: 'jp',
    });

    const loadedConfig = store.loadConfig();
    assert.equal(loadedConfig.mode, 'batch');
    assert.equal(loadedConfig.language, 'jp');
  } finally {
    cleanup();
  }
});

test('loadConfig keeps DEFAULT_CONFIG fields after saving partial config', async () => {
  const { store, cleanup } = await importStoreWithTempHome();

  try {
    store.saveConfig({ language: 'cn' });

    const loadedConfig = store.loadConfig();
    assert.equal(loadedConfig.language, 'cn');
    assert.equal(loadedConfig.mode, DEFAULT_CONFIG.mode);
    assert.equal(loadedConfig.provider, DEFAULT_CONFIG.provider);
    assert.equal(loadedConfig.authType, DEFAULT_CONFIG.authType);
    assert.equal(loadedConfig.modelDisplayName, DEFAULT_CONFIG.modelDisplayName);
    assert.equal(loadedConfig.modelVersion, DEFAULT_CONFIG.modelVersion);
    assert.equal(loadedConfig.baseURL, DEFAULT_CONFIG.baseURL);
    assert.equal(loadedConfig.confirmBeforeCommit, DEFAULT_CONFIG.confirmBeforeCommit);
  } finally {
    cleanup();
  }
});
