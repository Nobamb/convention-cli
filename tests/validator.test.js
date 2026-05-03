import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidLanguage, isValidMode } from '../src/utils/validator.js';

test('isValidMode accepts supported modes', () => {
  assert.equal(isValidMode('step'), true);
  assert.equal(isValidMode('batch'), true);
});

test('isValidMode rejects unsupported mode strings', () => {
  for (const mode of ['fast', 'auto', 'all']) {
    assert.equal(isValidMode(mode), false);
  }
});

test('isValidMode rejects case and whitespace variants', () => {
  for (const mode of ['Step', 'BATCH', ' batch', 'batch ']) {
    assert.equal(isValidMode(mode), false);
  }
});

test('isValidMode rejects empty and missing values', () => {
  assert.equal(isValidMode(''), false);
  assert.equal(isValidMode(null), false);
  assert.equal(isValidMode(undefined), false);
});

test('isValidMode rejects non-string values', () => {
  for (const mode of [1, {}, [], true]) {
    assert.equal(isValidMode(mode), false);
  }
});

test('isValidLanguage accepts supported languages', () => {
  for (const language of ['ko', 'en', 'jp', 'cn']) {
    assert.equal(isValidLanguage(language), true);
  }
});

test('isValidLanguage rejects unsupported language strings', () => {
  for (const language of ['kr', 'de', 'ja', 'zh']) {
    assert.equal(isValidLanguage(language), false);
  }
});

test('isValidLanguage rejects case and whitespace variants', () => {
  for (const language of ['KO', 'EN', ' ko', 'en ']) {
    assert.equal(isValidLanguage(language), false);
  }
});

test('isValidLanguage rejects empty and missing values', () => {
  assert.equal(isValidLanguage(''), false);
  assert.equal(isValidLanguage(null), false);
  assert.equal(isValidLanguage(undefined), false);
});

test('isValidLanguage rejects non-string values', () => {
  for (const language of [1, {}, [], true]) {
    assert.equal(isValidLanguage(language), false);
  }
});
