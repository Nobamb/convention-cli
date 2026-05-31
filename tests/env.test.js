import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRuntimeOptions,
  isCI,
  isGitHubActions,
  shouldDisableInteractive,
} from '../src/utils/env.js';

test('Phase 8 AN isCI detects explicit CI=true only', () => {
  assert.equal(isCI({ CI: 'true' }), true);
  assert.equal(isCI({ CI: 'TRUE' }), true);
  assert.equal(isCI({ CI: 'false' }), false);
  assert.equal(isCI({ CI: '1' }), false);
  assert.equal(isCI({}), false);
});

test('Phase 8 AN isGitHubActions detects explicit GITHUB_ACTIONS=true only', () => {
  assert.equal(isGitHubActions({ GITHUB_ACTIONS: 'true' }), true);
  assert.equal(isGitHubActions({ GITHUB_ACTIONS: 'TRUE' }), true);
  assert.equal(isGitHubActions({ GITHUB_ACTIONS: 'false' }), false);
  assert.equal(isGitHubActions({}), false);
});

test('Phase 8 AN shouldDisableInteractive follows CI, GitHub Actions, and --no-interactive', () => {
  assert.equal(shouldDisableInteractive({ CI: 'true' }, {}), true);
  assert.equal(shouldDisableInteractive({ GITHUB_ACTIONS: 'true' }, {}), true);
  assert.equal(shouldDisableInteractive({}, { noInteractive: true }), true);
  assert.equal(shouldDisableInteractive({}, {}), false);
});

test('Phase 8 AN buildRuntimeOptions returns command runtime policy', () => {
  assert.deepEqual(buildRuntimeOptions({ yes: true }, { CI: 'true' }), {
    yes: true,
    noInteractive: false,
    interactive: false,
    isCI: true,
    isGitHubActions: false,
  });

  assert.deepEqual(
    buildRuntimeOptions(
      { yes: false, noInteractive: true },
      { GITHUB_ACTIONS: 'true' },
    ),
    {
      yes: false,
      noInteractive: true,
      interactive: false,
      isCI: false,
      isGitHubActions: true,
    },
  );
});
