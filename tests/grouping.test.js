import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeDiffIntent,
  classifyChangedFiles,
  groupFilesByIntent,
  inferIntentByRules,
} from '../src/core/grouping.js';
import { buildIntentPrompt } from '../src/core/prompt.js';

test('Phase 3 M classifies changed files with fileType metadata', () => {
  const classifications = classifyChangedFiles([
    'src/core/grouping.js',
    'tests/grouping.test.js',
    'README.md',
    'package.json',
    'dist/bundle.js',
  ]);

  assert.deepEqual(
    classifications.map(({ fileType }) => fileType),
    ['source', 'test', 'docs', 'dependency', 'generated'],
  );
  assert.equal(classifications[0].file, 'src/core/grouping.js');
});

test('Phase 3 N infers intent by fileType and diff keywords without AI', () => {
  assert.equal(
    inferIntentByRules({
      file: 'tests/grouping.test.js',
      classification: { fileType: 'test' },
    }).intent,
    'test',
  );

  assert.equal(
    inferIntentByRules({
      file: 'src/core/grouping.js',
      diff: '+ fix missing grouping validation',
      classification: { fileType: 'source' },
    }).intent,
    'fix',
  );
});

test('Phase 3 N does not call external AI intent analysis without approval', async () => {
  const result = await analyzeDiffIntent({
    file: 'src/core/grouping.js',
    diff: '+ add grouped commit flow',
    config: { provider: 'gemini', useAIForIntent: true },
    options: {
      useAI: true,
      confirmExternalTransmission: async () => false,
    },
  });

  assert.equal(result.source, 'rule');
  assert.equal(result.intent, 'feat');
});

test('Phase 3 O groups files by intent and preserves fileTypes metadata', () => {
  const groups = groupFilesByIntent(
    [
      {
        file: 'src/commands/commit.js',
        fileType: 'source',
        intent: 'feat',
        summary: 'group command flow',
      },
      {
        file: 'src/core/grouping.js',
        fileType: 'source',
        intent: 'feat',
        summary: 'grouping core',
      },
      {
        file: 'tests/grouping.test.js',
        fileType: 'test',
        intent: 'test',
        summary: 'grouping coverage',
      },
      {
        file: 'unknown.raw',
        fileType: 'unknown',
        intent: 'feat',
        summary: 'unknown file',
      },
    ],
    { minGroupFileCount: 1 },
  );

  const featureGroups = groups.filter((group) => group.type === 'feat');
  const testGroup = groups.find((group) => group.type === 'test');
  const choreGroup = groups.find((group) => group.files.includes('unknown.raw'));
  const featureFiles = featureGroups.flatMap((group) => group.files).sort();

  assert.equal(featureGroups.length > 0, true);
  assert.deepEqual(featureFiles, ['src/commands/commit.js', 'src/core/grouping.js']);
  assert.equal(featureGroups.every((group) => group.fileTypes.includes('source')), true);
  assert.equal(testGroup.fileTypes.includes('test'), true);
  assert.equal(choreGroup.type, 'chore');
  assert.equal(choreGroup.fileTypes.includes('unknown'), true);
});

test('buildIntentPrompt includes language and fileType context', () => {
  const prompt = buildIntentPrompt({
    file: 'src/core/grouping.js',
    diff: '+ fix grouping',
    language: 'en',
    classification: { fileType: 'source' },
  });

  assert.match(prompt, /Write the commit subject in English/);
  assert.match(prompt, /File type: source/);
  assert.doesNotMatch(prompt, /short summary in Korean/);
});
