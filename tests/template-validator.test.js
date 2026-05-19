import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_TEMPLATE, validateTemplate } from "../src/templates/validator.js";

function validTemplate(overrides = {}) {
  return {
    name: "team-default",
    language: "ko",
    format: "{type}: {message}",
    types: ["feat", "fix", "refactor", "docs", "style", "test", "chore"],
    rules: {
      maxLength: 72,
      requireScope: false,
      allowEmoji: false,
    },
    ...overrides,
    rules: {
      maxLength: 72,
      requireScope: false,
      allowEmoji: false,
      ...(overrides.rules ?? {}),
    },
  };
}

function assertFallback(result) {
  assert.equal(result.valid, false);
  assert.deepEqual(result.template, DEFAULT_TEMPLATE);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length > 0);
}

test("validateTemplate accepts a complete template", () => {
  const template = validTemplate();
  const result = validateTemplate(template);

  assert.equal(result.valid, true);
  assert.deepEqual(result.template, template);
  assert.deepEqual(result.errors, []);
});

test("validateTemplate accepts supported languages", () => {
  for (const language of ["ko", "en", "jp", "cn"]) {
    const result = validateTemplate(validTemplate({ language }));

    assert.equal(result.valid, true);
    assert.equal(result.template.language, language);
  }
});

test("validateTemplate rejects missing top-level required fields with fallback", () => {
  for (const fieldName of ["name", "language", "format", "types", "rules"]) {
    const template = validTemplate();
    delete template[fieldName];

    const result = validateTemplate(template);

    assertFallback(result);
    assert.ok(result.errors.some((error) => error.includes(fieldName)));
  }
});

test("validateTemplate rejects missing rules fields with fallback", () => {
  for (const fieldName of ["maxLength", "requireScope", "allowEmoji"]) {
    const template = validTemplate();
    delete template.rules[fieldName];

    const result = validateTemplate(template);

    assertFallback(result);
    assert.ok(result.errors.some((error) => error.includes(`rules.${fieldName}`)));
  }
});

test("validateTemplate validates types array and removes duplicates", () => {
  const result = validateTemplate(validTemplate({ types: ["feat", "feat", "fix"] }));

  assert.equal(result.valid, true);
  assert.deepEqual(result.template.types, ["feat", "fix"]);
});

test("validateTemplate rejects invalid types with fallback", () => {
  for (const types of ["feat", [], [1, "fix"], ["feature"], [null]]) {
    const result = validateTemplate(validTemplate({ types }));

    assertFallback(result);
  }
});

test("validateTemplate validates format placeholders", () => {
  for (const format of ["{type}: {message}", "{type}({scope}): {message}"]) {
    const result = validateTemplate(validTemplate({ format }));

    assert.equal(result.valid, true);
    assert.equal(result.template.format, format);
  }
});

test("validateTemplate rejects invalid format values with fallback", () => {
  for (const format of ["", "   ", 1, [], {}, null, "{message}", "{type}: "]) {
    const result = validateTemplate(validTemplate({ format }));

    assertFallback(result);
  }
});

test("validateTemplate rejects unsupported languages with fallback", () => {
  for (const language of ["kr", "ja", "zh", "", null, 1]) {
    const result = validateTemplate(validTemplate({ language }));

    assertFallback(result);
  }
});

test("validateTemplate validates maxLength range", () => {
  for (const maxLength of [20, 72, 200]) {
    const result = validateTemplate(validTemplate({ rules: { maxLength } }));

    assert.equal(result.valid, true);
    assert.equal(result.template.rules.maxLength, maxLength);
  }
});

test("validateTemplate rejects invalid maxLength values with fallback", () => {
  for (const maxLength of [19, 201, 0, -1, 72.5, "72", Number.NaN, Infinity, null]) {
    const result = validateTemplate(validTemplate({ rules: { maxLength } }));

    assertFallback(result);
  }
});

test("validateTemplate validates boolean rules fields", () => {
  const result = validateTemplate(
    validTemplate({
      rules: {
        requireScope: true,
        allowEmoji: true,
      },
    }),
  );

  assert.equal(result.valid, true);
  assert.equal(result.template.rules.requireScope, true);
  assert.equal(result.template.rules.allowEmoji, true);
});

test("validateTemplate rejects non-boolean rules fields with fallback", () => {
  for (const rules of [{ requireScope: "true" }, { allowEmoji: 1 }]) {
    const result = validateTemplate(validTemplate({ rules }));

    assertFallback(result);
  }
});

test("validateTemplate falls back without throwing for invalid object shapes", () => {
  for (const template of [null, "template", [], 1]) {
    assert.doesNotThrow(() => validateTemplate(template));
    assertFallback(validateTemplate(template));
  }
});

test("validateTemplate does not expose raw template or secret values in errors", () => {
  const result = validateTemplate({
    name: "API_KEY=secret",
    language: "ko",
    format: "TOKEN=secret",
    types: ["PASSWORD=secret"],
    rules: {
      maxLength: "DATABASE_URL=secret",
      requireScope: "PRIVATE_KEY",
      allowEmoji: "AWS_ACCESS_KEY_ID",
    },
  });

  assertFallback(result);

  const serializedErrors = result.errors.join("\n");
  for (const secretPattern of [
    "API_KEY=",
    "SECRET=",
    "TOKEN=",
    "PASSWORD=",
    "PRIVATE_KEY",
    "DATABASE_URL",
    "AWS_ACCESS_KEY_ID",
    "-----BEGIN PRIVATE KEY-----",
  ]) {
    assert.equal(serializedErrors.includes(secretPattern), false);
  }
});
