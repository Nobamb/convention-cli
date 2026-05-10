import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before, beforeEach } from 'node:test';
import prompts from 'prompts';

import { DEFAULT_CONFIG } from '../src/config/defaults.js';

let commands;
let store;
let tempHome;
let previousHome;
let previousUserProfile;

before(async () => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-cli-home-'));
  previousHome = process.env.HOME;
  previousUserProfile = process.env.USERPROFILE;

  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  store = await import('../src/config/store.js');
  commands = await import('../src/commands/config.js');
});

beforeEach(() => {
  if (store && fs.existsSync(store.CONFIG_DIR)) {
    fs.rmSync(store.CONFIG_DIR, { recursive: true, force: true });
  }

  prompts.inject([]);
});

after(() => {
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

  if (tempHome) {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('T-1 setMode("step") stores step mode', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    mode: 'batch',
  });

  commands.setMode('step');

  assert.equal(store.loadConfig().mode, 'step');
});

test('T-2 setMode("batch") stores batch mode', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    mode: 'step',
  });

  commands.setMode('batch');

  assert.equal(store.loadConfig().mode, 'batch');
});

test('T-3 invalid fast mode does not overwrite existing mode', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    mode: 'step',
  });

  commands.setMode('fast');

  assert.equal(store.loadConfig().mode, 'step');
});

test('T-4 setMode only changes mode and preserves stored values', () => {
  const existingConfig = {
    ...DEFAULT_CONFIG,
    mode: 'step',
    language: 'en',
    provider: 'mock',
    confirmBeforeCommit: false,
  };
  store.saveConfig(existingConfig);

  commands.setMode('batch');

  assert.deepEqual(store.loadConfig(), {
    ...existingConfig,
    mode: 'batch',
  });
});

test('T-5 setMode creates config from DEFAULT_CONFIG when config file is missing', () => {
  assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), false);

  commands.setMode('batch');

  assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), true);
  assert.deepEqual(store.loadConfig(), {
    ...DEFAULT_CONFIG,
    mode: 'batch',
  });
});

test('T-6 saved mode is reflected by loadConfig immediately', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    mode: 'batch',
  });

  commands.setMode('step');

  const loadedConfig = store.loadConfig();
  assert.equal(loadedConfig.mode, 'step');
});

test('T-7 invalid mode values do not modify config file contents', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    mode: 'batch',
    language: 'jp',
  });
  const before = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');

  commands.setMode('fast');
  commands.setMode('');
  commands.setMode(undefined);

  const after = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');
  assert.equal(after, before);
});

test('T-8 setLanguage("ko") stores Korean language', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    language: 'en',
  });

  commands.setLanguage('ko');

  assert.equal(store.loadConfig().language, 'ko');
});

test('T-9 setLanguage("en") stores English language', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    language: 'ko',
  });

  commands.setLanguage('en');

  assert.equal(store.loadConfig().language, 'en');
});

test('T-10 setLanguage("jp") stores Japanese language', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    language: 'ko',
  });

  commands.setLanguage('jp');

  assert.equal(store.loadConfig().language, 'jp');
});

test('T-11 setLanguage("cn") stores Chinese language', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    language: 'ko',
  });

  commands.setLanguage('cn');

  assert.equal(store.loadConfig().language, 'cn');
});

test('T-12 invalid language values do not overwrite existing language', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    language: 'ko',
  });

  commands.setLanguage('de');
  commands.setLanguage('kr');
  commands.setLanguage('');
  commands.setLanguage(undefined);
  commands.setLanguage(null);

  assert.equal(store.loadConfig().language, 'ko');
});

test('T-13 setLanguage only changes language and preserves stored values', () => {
  const existingConfig = {
    ...DEFAULT_CONFIG,
    mode: 'batch',
    language: 'ko',
    provider: 'mock',
    confirmBeforeCommit: false,
  };
  store.saveConfig(existingConfig);

  commands.setLanguage('en');

  assert.deepEqual(store.loadConfig(), {
    ...existingConfig,
    language: 'en',
  });
});

test('T-14 setLanguage creates config from DEFAULT_CONFIG when config file is missing', () => {
  assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), false);

  commands.setLanguage('jp');

  assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), true);
  assert.deepEqual(store.loadConfig(), {
    ...DEFAULT_CONFIG,
    language: 'jp',
  });
});

test('T-15 saved language is reflected by loadConfig immediately', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    language: 'ko',
  });

  commands.setLanguage('cn');

  const loadedConfig = store.loadConfig();
  assert.equal(loadedConfig.language, 'cn');
});

test('T-16 invalid language values do not modify config file contents', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    mode: 'batch',
    language: 'jp',
  });
  const before = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');

  commands.setLanguage('de');
  commands.setLanguage('korean');
  commands.setLanguage(null);

  const after = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');
  assert.equal(after, before);
});

test('T-17 setQuestion(true) stores confirmBeforeCommit true', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    confirmBeforeCommit: false,
  });

  commands.setQuestion(true);

  assert.equal(store.loadConfig().confirmBeforeCommit, true);
});

test('T-18 setQuestion(false) stores confirmBeforeCommit false', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    confirmBeforeCommit: true,
  });

  commands.setQuestion(false);

  assert.equal(store.loadConfig().confirmBeforeCommit, false);
});

test('T-19 setQuestion preserves existing config values', () => {
  const existingConfig = {
    ...DEFAULT_CONFIG,
    mode: 'batch',
    language: 'en',
    provider: 'localLLM',
    authType: 'none',
    modelVersion: 'qwen2.5:7b',
    modelDisplayName: 'qwen2.5:7b',
    baseURL: 'http://localhost:11434/v1',
    confirmBeforeCommit: true,
  };
  store.saveConfig(existingConfig);

  commands.setQuestion(false);

  assert.deepEqual(store.loadConfig(), {
    ...existingConfig,
    confirmBeforeCommit: false,
  });
});

test('T-20 setQuestion creates config from DEFAULT_CONFIG when config file is missing', () => {
  assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), false);

  commands.setQuestion(false);

  assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), true);
  assert.deepEqual(store.loadConfig(), {
    ...DEFAULT_CONFIG,
    confirmBeforeCommit: false,
  });
});

test('T-21 invalid question values do not modify config file contents', () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    confirmBeforeCommit: true,
  });
  const before = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');

  commands.setQuestion('false');
  commands.setQuestion(null);
  commands.setQuestion(undefined);

  const after = fs.readFileSync(store.CONFIG_FILE_PATH, 'utf8');
  assert.equal(after, before);
});

test('T-22 runQuestionSetup stores selected prompt value', async () => {
  store.saveConfig({
    ...DEFAULT_CONFIG,
    confirmBeforeCommit: true,
  });
  prompts.inject([false]);

  const nextConfig = await commands.runQuestionSetup();

  assert.equal(nextConfig.confirmBeforeCommit, false);
  assert.equal(store.loadConfig().confirmBeforeCommit, false);
});
