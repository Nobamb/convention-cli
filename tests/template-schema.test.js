import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultTemplate,
  DEFAULT_TEMPLATE,
  TEMPLATE_DEFAULT_TYPES,
  TEMPLATE_REQUIRED_FIELDS,
  TEMPLATE_RULE_REQUIRED_FIELDS,
  TEMPLATE_SCHEMA_VERSION,
  TEMPLATE_SUPPORTED_LANGUAGES,
} from '../src/templates/schema.js';

test('template schema exports documented default structure', () => {
  assert.equal(typeof TEMPLATE_SCHEMA_VERSION, 'number');
  assert.equal(typeof DEFAULT_TEMPLATE, 'object');
  assert.equal(DEFAULT_TEMPLATE.name, 'default');
  assert.equal(DEFAULT_TEMPLATE.language, 'ko');
  assert.equal(DEFAULT_TEMPLATE.format, '{type}: {message}');
  assert.ok(Array.isArray(DEFAULT_TEMPLATE.types));
  assert.equal(typeof DEFAULT_TEMPLATE.rules, 'object');
});

test('default template includes all required fields', () => {
  for (const field of TEMPLATE_REQUIRED_FIELDS) {
    assert.ok(Object.hasOwn(DEFAULT_TEMPLATE, field), `${field} 필드는 기본 템플릿에 반드시 필요합니다.`);
  }

  for (const field of TEMPLATE_RULE_REQUIRED_FIELDS) {
    assert.ok(Object.hasOwn(DEFAULT_TEMPLATE.rules, field), `rules.${field} 필드는 기본 템플릿에 반드시 필요합니다.`);
  }
});

test('default template uses documented rule defaults and conventional types', () => {
  assert.equal(DEFAULT_TEMPLATE.rules.maxLength, 72);
  assert.equal(DEFAULT_TEMPLATE.rules.requireScope, false);
  assert.equal(DEFAULT_TEMPLATE.rules.allowEmoji, false);
  assert.deepEqual(DEFAULT_TEMPLATE.types, TEMPLATE_DEFAULT_TYPES);

  for (const type of ['feat', 'fix', 'refactor', 'docs', 'style', 'test', 'chore']) {
    assert.ok(DEFAULT_TEMPLATE.types.includes(type), `${type} type은 기본 템플릿에 포함되어야 합니다.`);
  }
});

test('default template field types match schema contract', () => {
  assert.equal(typeof DEFAULT_TEMPLATE.name, 'string');
  assert.equal(typeof DEFAULT_TEMPLATE.language, 'string');
  assert.equal(typeof DEFAULT_TEMPLATE.format, 'string');
  assert.ok(DEFAULT_TEMPLATE.types.every((type) => typeof type === 'string'));
  assert.equal(Number.isInteger(DEFAULT_TEMPLATE.rules.maxLength), true);
  assert.equal(DEFAULT_TEMPLATE.rules.maxLength > 0, true);
  assert.equal(typeof DEFAULT_TEMPLATE.rules.requireScope, 'boolean');
  assert.equal(typeof DEFAULT_TEMPLATE.rules.allowEmoji, 'boolean');
});

test('default template values stay inside allowed template policy', () => {
  assert.ok(TEMPLATE_SUPPORTED_LANGUAGES.includes(DEFAULT_TEMPLATE.language));
  assert.ok(DEFAULT_TEMPLATE.types.length > 0);
  assert.ok(DEFAULT_TEMPLATE.types.every((type) => /^[a-z]+$/.test(type)));
  assert.ok(DEFAULT_TEMPLATE.format.includes('{type}'));
  assert.ok(DEFAULT_TEMPLATE.format.includes('{message}'));
});

test('createDefaultTemplate returns a mutable copy without mutating shared defaults', () => {
  const template = createDefaultTemplate();

  template.name = 'team';
  template.types.push('build');
  template.rules.maxLength = 50;

  assert.equal(DEFAULT_TEMPLATE.name, 'default');
  assert.deepEqual(DEFAULT_TEMPLATE.types, TEMPLATE_DEFAULT_TYPES);
  assert.equal(DEFAULT_TEMPLATE.rules.maxLength, 72);
  assert.equal(Object.isFrozen(DEFAULT_TEMPLATE), true);
  assert.equal(Object.isFrozen(DEFAULT_TEMPLATE.types), true);
  assert.equal(Object.isFrozen(DEFAULT_TEMPLATE.rules), true);
});
