import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function importApiKeyWithTempHome() {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "convention-cli-api-key-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;

  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  const stamp = `${Date.now()}-${Math.random()}`;
  const storeUrl = new URL("../src/config/store.js", import.meta.url);
  storeUrl.search = `?home=${encodeURIComponent(tempHome)}&t=${stamp}`;
  const apiKeyUrl = new URL("../src/auth/apiKey.js", import.meta.url);
  apiKeyUrl.search = `?home=${encodeURIComponent(tempHome)}&t=${stamp}`;

  const store = await import(storeUrl.href);
  const apiKey = await import(apiKeyUrl.href);

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

  return { store, apiKey, cleanup };
}

test("I/J saveApiKey stores secrets in credentials.json, not config.json", async () => {
  const { store, apiKey, cleanup } = await importApiKeyWithTempHome();

  try {
    apiKey.saveApiKey("gemini", "secret-gemini-key");

    assert.equal(apiKey.getApiKey("gemini"), "secret-gemini-key");
    assert.equal(fs.existsSync(store.CREDENTIALS_FILE_PATH), true);
    assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), false);

    const rawCredentials = fs.readFileSync(store.CREDENTIALS_FILE_PATH, "utf8");
    assert.match(rawCredentials, /secret-gemini-key/);
  } finally {
    cleanup();
  }
});

test("J loadCredentials safely handles missing or broken credentials files", async () => {
  const { store, cleanup } = await importApiKeyWithTempHome();

  try {
    assert.deepEqual(store.loadCredentials(), {});

    store.ensureConfigDir();
    fs.writeFileSync(store.CREDENTIALS_FILE_PATH, "{broken", "utf8");

    assert.deepEqual(store.loadCredentials(), {});
  } finally {
    cleanup();
  }
});

test("K logger redacts common secret-shaped messages", async () => {
  const { redactSecrets } = await import("../src/utils/logger.js");

  assert.equal(redactSecrets("apiKey=abc123"), "apiKey=[REDACTED]");
  assert.equal(redactSecrets("Authorization: Bearer abc123"), "Authorization: Bearer [REDACTED]");
  assert.equal(redactSecrets("TOKEN: abc123"), "TOKEN: [REDACTED]");
});
