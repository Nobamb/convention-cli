import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import prompts from 'prompts';

import {
  COMMIT_DECISIONS,
  previewCommitMessage,
  promptCommitMessageEdit,
  selectCommitDecision,
} from '../src/utils/ui.js';

let originalLog;
let originalWarn;
let logCalls;
let warnCalls;

beforeEach(() => {
  originalLog = console.log;
  originalWarn = console.warn;
  logCalls = [];
  warnCalls = [];

  console.log = (message) => {
    logCalls.push(message);
  };
  console.warn = (message) => {
    warnCalls.push(message);
  };
});

afterEach(() => {
  prompts.inject([]);
  console.log = originalLog;
  console.warn = originalWarn;
});

test('previewCommitMessage prints message and metadata without diff contents', () => {
  previewCommitMessage({
    message: 'feat: add preview flow',
    files: ['src/utils/ui.js', 'docs/API_KEY=secret.md'],
    mode: 'batch',
    provider: 'mock',
    modelVersion: 'mock-default',
  });

  const output = logCalls.join('\n');

  assert.match(output, /Commit preview/);
  assert.match(output, /feat: add preview flow/);
  assert.match(output, /src\/utils\/ui\.js/);
  assert.match(output, /docs\/API_KEY=\[REDACTED\]/);
  assert.match(output, /Mode: batch/);
  assert.match(output, /AI: mock \/ mock-default/);
  assert.doesNotMatch(output, /diff --git|TOKEN=sample|secret\.md/);
});

test('selectCommitDecision returns stable enum values', async () => {
  prompts.inject([
    COMMIT_DECISIONS.COMMIT,
    COMMIT_DECISIONS.REGENERATE,
    COMMIT_DECISIONS.EDIT,
    COMMIT_DECISIONS.CANCEL,
  ]);

  assert.equal(await selectCommitDecision(), COMMIT_DECISIONS.COMMIT);
  assert.equal(await selectCommitDecision(), COMMIT_DECISIONS.REGENERATE);
  assert.equal(await selectCommitDecision(), COMMIT_DECISIONS.EDIT);
  assert.equal(await selectCommitDecision(), COMMIT_DECISIONS.CANCEL);
});

test('selectCommitDecision treats canceled or invalid prompt response as cancel', async () => {
  prompts.inject([undefined, 'not-a-decision']);

  assert.equal(await selectCommitDecision(), COMMIT_DECISIONS.CANCEL);
  assert.equal(await selectCommitDecision(), COMMIT_DECISIONS.CANCEL);
});

test('promptCommitMessageEdit returns trimmed manual message', async () => {
  prompts.inject(['  feat: add decision flow  ']);

  const message = await promptCommitMessageEdit('chore: update project files');

  assert.equal(message, 'feat: add decision flow');
});

test('promptCommitMessageEdit returns null for blank input', async () => {
  prompts.inject(['   ']);

  assert.equal(await promptCommitMessageEdit(''), null);
  assert.equal(warnCalls.length, 1);
  assert.match(warnCalls[0], /Commit message edit was empty/);
});
