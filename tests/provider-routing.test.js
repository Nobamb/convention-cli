import assert from 'node:assert/strict';
import test from 'node:test';

import { generateCommitMessage } from '../src/core/ai.js';
import { getProvider, generateWithProvider, listProviderModels } from '../src/providers/index.js';
import { MOCK_COMMIT_MESSAGE } from '../src/providers/mock.js';

test('getProvider returns the mock provider by default', () => {
  const provider = getProvider(null);

  assert.equal(typeof provider.generateCommitMessage, 'function');
  assert.equal(typeof provider.listModels, 'function');
  assert.equal(typeof provider.validateConfig, 'function');
});

test('generateWithProvider calls providers through the common interface', async () => {
  const message = await generateWithProvider({
    prompt: 'Generate a commit message',
    config: { provider: 'mock' },
  });

  assert.equal(message, MOCK_COMMIT_MESSAGE);
});

test('core ai uses provider routing for null and mock providers', async () => {
  assert.equal(
    await generateCommitMessage('Generate a commit message', { provider: null }),
    MOCK_COMMIT_MESSAGE,
  );
  assert.equal(
    await generateCommitMessage('Generate a commit message', { provider: 'mock' }),
    MOCK_COMMIT_MESSAGE,
  );
});

test('listProviderModels uses provider listModels when available', async () => {
  assert.deepEqual(await listProviderModels({ provider: 'mock' }), ['mock']);
});

test('provider routing rejects unsupported providers without mock fallback', async () => {
  assert.throws(() => getProvider('unknown'), /Unsupported provider: unknown/);
  await assert.rejects(
    () =>
      generateCommitMessage('Generate a commit message', {
        provider: 'unknown',
      }),
    /Unsupported provider: unknown/,
  );
});
