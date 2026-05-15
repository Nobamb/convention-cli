import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import {
  CURRENT_CONFIG_VERSION,
  getConfigVersion,
  migrateConfig,
} from '../src/config/migration.js';

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

test('migrateConfig upgrades MVP config and preserves existing values', () => {
  const legacyConfig = {
    mode: 'batch',
    language: 'en',
    provider: 'localLLM',
    authType: 'none',
    modelVersion: 'qwen2.5:7b',
    baseURL: 'http://localhost:11434/v1',
  };

  const migrated = migrateConfig(legacyConfig);

  assert.equal(migrated.configVersion, CURRENT_CONFIG_VERSION);
  assert.equal(migrated.mode, legacyConfig.mode);
  assert.equal(migrated.language, legacyConfig.language);
  assert.equal(migrated.provider, legacyConfig.provider);
  assert.equal(migrated.authType, legacyConfig.authType);
  assert.equal(migrated.modelVersion, legacyConfig.modelVersion);
  assert.equal(migrated.baseURL, legacyConfig.baseURL);
  assert.equal(migrated.previewBeforeCommit, true);
  assert.equal(migrated.maxRegenerateCount, 3);
  assert.equal(migrated.template, null);
});

test('migrateConfig repairs missing fields and deep merges default objects', () => {
  const migrated = migrateConfig({
    configVersion: 2,
    language: 'jp',
    largeDiffThreshold: {
      maxFiles: 10,
    },
  });

  assert.equal(migrated.configVersion, CURRENT_CONFIG_VERSION);
  assert.equal(migrated.language, 'jp');
  assert.equal(migrated.mode, DEFAULT_CONFIG.mode);
  assert.deepEqual(migrated.largeDiffThreshold, {
    ...DEFAULT_CONFIG.largeDiffThreshold,
    maxFiles: 10,
  });
});

test('migrateConfig rejects future config versions without downgrading', () => {
  assert.throws(
    () => migrateConfig({ configVersion: CURRENT_CONFIG_VERSION + 1 }),
    /Unsupported config version/,
  );
});

test('getConfigVersion treats missing version as legacy config', () => {
  assert.equal(getConfigVersion({ mode: 'step' }), 0);
});

test('migrateConfig does not carry credential-like keys into config', () => {
  const migrated = migrateConfig({
    provider: 'gemini',
    apiKey: 'secret-api-key',
    nested: {
      token: 'secret-token',
      safeValue: 'kept',
    },
  });

  assert.equal(migrated.provider, 'gemini');
  assert.equal('apiKey' in migrated, false);
  assert.deepEqual(migrated.nested, {
    safeValue: 'kept',
  });
});

test('loadConfig migrates legacy config files to current schema', async () => {
  const { store, cleanup } = await importStoreWithTempHome();

  try {
    store.ensureConfigDir();
    fs.writeFileSync(
      store.CONFIG_FILE_PATH,
      JSON.stringify({
        mode: 'batch',
        language: 'cn',
        provider: 'mock',
      }),
      'utf8',
    );

    const loadedConfig = store.loadConfig();

    assert.equal(loadedConfig.configVersion, CURRENT_CONFIG_VERSION);
    assert.equal(loadedConfig.mode, 'batch');
    assert.equal(loadedConfig.language, 'cn');
    assert.equal(loadedConfig.provider, 'mock');
    assert.equal(loadedConfig.previewBeforeCommit, true);
    assert.equal(loadedConfig.maxRegenerateCount, 3);
  } finally {
    cleanup();
  }
});

test('loadConfig falls back safely for malformed JSON without printing contents', async () => {
  const { store, cleanup } = await importStoreWithTempHome();
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  let output = '';

  try {
    process.stdout.write = (chunk, ...args) => {
      output += String(chunk);
      return originalStdoutWrite.call(process.stdout, chunk, ...args);
    };
    process.stderr.write = (chunk, ...args) => {
      output += String(chunk);
      return originalStderrWrite.call(process.stderr, chunk, ...args);
    };

    store.ensureConfigDir();
    fs.writeFileSync(
      store.CONFIG_FILE_PATH,
      '{"apiKey":"secret-from-broken-json",',
      'utf8',
    );

    assert.deepEqual(store.loadConfig(), DEFAULT_CONFIG);
    assert.equal(output.includes('secret-from-broken-json'), false);
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    cleanup();
  }
});

test('loadConfig rejects future config versions with a generic error', async () => {
  const { store, cleanup } = await importStoreWithTempHome();

  try {
    store.ensureConfigDir();
    fs.writeFileSync(
      store.CONFIG_FILE_PATH,
      JSON.stringify({
        configVersion: CURRENT_CONFIG_VERSION + 1,
        mode: 'batch',
      }),
      'utf8',
    );

    assert.throws(() => store.loadConfig(), /Unsupported config version/);
  } finally {
    cleanup();
  }
});

test('saveCredentials writes only credentials.json and applies POSIX owner-only permissions when possible', async () => {
  const { store, cleanup } = await importStoreWithTempHome();

  try {
    store.saveCredentials({
      gemini: {
        apiKey: 'secret-gemini-key',
      },
    });

    assert.equal(fs.existsSync(store.CREDENTIALS_FILE_PATH), true);
    assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), false);

    const rawCredentials = fs.readFileSync(store.CREDENTIALS_FILE_PATH, 'utf8');
    assert.match(rawCredentials, /secret-gemini-key/);

    if (process.platform !== 'win32') {
      const mode = fs.statSync(store.CREDENTIALS_FILE_PATH).mode & 0o777;
      assert.equal(mode, 0o600);
    }
  } finally {
    cleanup();
  }
});

test('hardenCredentialsFilePermissions attempts chmod 0600 without logging credentials', async () => {
  const { store, cleanup } = await importStoreWithTempHome();
  const chmodCalls = [];
  const execCalls = [];

  try {
    store.hardenCredentialsFilePermissions('credentials.json', {
      platform: 'linux',
      chmodSync(filePath, mode) {
        chmodCalls.push([filePath, mode]);
      },
      execFileSync(command, args) {
        execCalls.push([command, args]);
      },
    });

    assert.deepEqual(chmodCalls, [['credentials.json', 0o600]]);
    assert.deepEqual(execCalls, []);
  } finally {
    cleanup();
  }
});

test('hardenCredentialsFilePermissions uses icacls best-effort on Windows', async () => {
  const { store, cleanup } = await importStoreWithTempHome();
  const execCalls = [];

  try {
    store.hardenCredentialsFilePermissions('credentials.json', {
      platform: 'win32',
      env: {
        USERDOMAIN: 'WORKSTATION',
        USERNAME: 'alice',
      },
      chmodSync() {
        throw new Error('chmod unsupported');
      },
      execFileSync(command, args, options) {
        if (command === 'whoami') {
          return 'WORKSTATION\\alice\n';
        }

        execCalls.push([command, args, options]);
      },
    });

    assert.deepEqual(
      execCalls.map(([command, args]) => [command, args]),
      [
        ['icacls', ['credentials.json', '/inheritance:r']],
        ['icacls', ['credentials.json', '/grant:r', 'WORKSTATION\\alice:F']],
        ['icacls', ['credentials.json', '/remove:g', 'Users']],
        ['icacls', ['credentials.json', '/remove:g', 'Authenticated Users']],
        ['icacls', ['credentials.json', '/remove:g', 'Everyone']],
        ['icacls', ['credentials.json', '/inheritance:d']],
        ['icacls', ['credentials.json', '/remove:g', 'Users']],
        ['icacls', ['credentials.json', '/remove:g', 'Authenticated Users']],
        ['icacls', ['credentials.json', '/remove:g', 'Everyone']],
      ],
    );

    for (const [, , options] of execCalls) {
      assert.deepEqual(options, { stdio: 'ignore' });
    }
  } finally {
    cleanup();
  }
});
