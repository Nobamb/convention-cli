import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { DEFAULT_CONFIG } from "../src/config/defaults.js";
import {
  buildLatestVersionUrl,
  checkLatestVersion,
  compareVersions,
  formatUpdateNotification,
  markUpdateChecked,
  notifyUpdate,
  runUpdateCheckIfNeeded,
  shouldCheckUpdate,
  UPDATE_CHECK_INTERVAL_MS,
} from "../src/core/update.js";

/**
 * fetch mock과 호출 기록 배열을 함께 만듭니다.
 *
 * @param {object} response fetch가 반환할 응답 mock입니다.
 * @returns {{fetchImpl: Function, calls: Array}} 테스트에서 사용할 fetch 구현과 호출 기록입니다.
 */
function createFetchMock(response) {
  const calls = [];

  return {
    calls,
    fetchImpl: async (url, options) => {
      // 실제 npm registry를 호출하지 않고 URL과 header만 기록합니다.
      calls.push({ url, options });
      return response;
    },
  };
}

/**
 * 성공하는 npm registry latest 응답 mock을 만듭니다.
 *
 * @param {string} version registry가 반환할 latest version입니다.
 * @returns {{ok: boolean, json: Function}} fetch response mock입니다.
 */
function createRegistryResponse(version) {
  return {
    ok: true,
    async json() {
      return { version };
    },
  };
}

test("AK buildLatestVersionUrl builds safe npm latest endpoints", () => {
  assert.equal(
    buildLatestVersionUrl({ packageName: "convention-cli" }),
    "https://registry.npmjs.org/convention-cli/latest",
  );
  assert.equal(
    buildLatestVersionUrl({
      packageName: "@scope/convention-cli",
      registryUrl: "https://registry.example.test/",
    }),
    "https://registry.example.test/%40scope%2Fconvention-cli/latest",
  );
});

test("AK compareVersions follows basic semver ordering", () => {
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.0.0", "1.1.0"), -1);
  assert.equal(compareVersions("1.0.0", "2.0.0"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("1.0.0-beta.1", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.0-beta.1"), 1);
  assert.equal(compareVersions("invalid", "1.0.0"), null);
});

test("AK checkLatestVersion returns update info without real network access", async () => {
  const { fetchImpl, calls } = createFetchMock(createRegistryResponse("1.1.0"));
  const now = new Date("2026-05-31T00:00:00.000Z");

  const result = await checkLatestVersion({
    packageName: "convention-cli",
    currentVersion: "1.0.0",
    fetchImpl,
    now,
  });

  assert.deepEqual(result, {
    packageName: "convention-cli",
    currentVersion: "1.0.0",
    latestVersion: "1.1.0",
    hasUpdate: true,
    checkedAt: now.toISOString(),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://registry.npmjs.org/convention-cli/latest");
  assert.deepEqual(calls[0].options.headers, { accept: "application/json" });
  assert.equal(calls[0].options.signal instanceof AbortSignal, true);
});

test("AK checkLatestVersion skips registry failures and malformed responses", async () => {
  assert.equal(
    await checkLatestVersion({
      packageName: "convention-cli",
      currentVersion: "1.0.0",
      fetchImpl: async () => ({ ok: false, status: 500 }),
    }),
    null,
  );
  assert.equal(
    await checkLatestVersion({
      packageName: "convention-cli",
      currentVersion: "1.0.0",
      fetchImpl: async () => ({ ok: true, async json() { return {}; } }),
    }),
    null,
  );
  assert.equal(
    await checkLatestVersion({
      packageName: "convention-cli",
      currentVersion: "1.0.0",
      fetchImpl: async () => {
        throw new Error("TOKEN=secret network failure");
      },
    }),
    null,
  );
});

test("AK checkLatestVersion aborts slow registry calls without failing the CLI task", async () => {
  const result = await checkLatestVersion({
    packageName: "convention-cli",
    currentVersion: "1.0.0",
    timeoutMs: 1,
    fetchImpl: async (_url, options) =>
      new Promise((resolve, reject) => {
        // AbortSignal이 timeout으로 중단되면 fetch reject와 같은 형태로 update check가 skip되어야 합니다.
        options.signal.addEventListener("abort", () => {
          reject(new Error("registry timeout"));
        });
        setTimeout(() => {
          resolve(createRegistryResponse("1.1.0"));
        }, 20);
      }),
  });

  assert.equal(result, null);
});

test("AL formatUpdateNotification and notifyUpdate print only manual update guidance", () => {
  const infoCalls = [];
  const message = formatUpdateNotification({
    packageName: "convention-cli",
    currentVersion: "1.0.0",
    latestVersion: "1.1.0",
  });

  assert.match(message, /convention-cli 새 버전/);
  assert.match(message, /현재 버전: 1\.0\.0/);
  assert.match(message, /최신 버전: 1\.1\.0/);
  assert.match(message, /npm install -g convention-cli@latest/);

  const notified = notifyUpdate(
    {
      packageName: "convention-cli",
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      hasUpdate: true,
    },
    {
      info(messageToLog) {
        infoCalls.push(messageToLog);
      },
    },
  );

  assert.equal(notified, true);
  assert.equal(infoCalls.length, 1);
  assert.match(infoCalls[0], /npm install -g convention-cli@latest/);
});

test("AL notifyUpdate stays silent when there is no update or no logger", () => {
  assert.equal(notifyUpdate(null, { info() {} }), false);
  assert.equal(notifyUpdate({ hasUpdate: false }, { info() {} }), false);
  assert.equal(
    notifyUpdate(
      {
        packageName: "convention-cli",
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        hasUpdate: true,
      },
      {},
    ),
    false,
  );
});

test("AM DEFAULT_CONFIG includes update policy fields", () => {
  assert.equal(DEFAULT_CONFIG.updateCheck, true);
  assert.equal(DEFAULT_CONFIG.lastUpdateCheckAt, null);
});

test("AM shouldCheckUpdate applies the once-per-day policy", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");

  assert.equal(shouldCheckUpdate({ updateCheck: false }, now), false);
  assert.equal(shouldCheckUpdate({ updateCheck: true, lastUpdateCheckAt: null }, now), true);
  assert.equal(
    shouldCheckUpdate({
      updateCheck: true,
      lastUpdateCheckAt: new Date(now.getTime() - UPDATE_CHECK_INTERVAL_MS + 1).toISOString(),
    }, now),
    false,
  );
  assert.equal(
    shouldCheckUpdate({
      updateCheck: true,
      lastUpdateCheckAt: new Date(now.getTime() - UPDATE_CHECK_INTERVAL_MS).toISOString(),
    }, now),
    true,
  );
  assert.equal(
    shouldCheckUpdate({ updateCheck: true, lastUpdateCheckAt: "bad-date" }, now),
    true,
  );
});

test("AM markUpdateChecked preserves existing config values", () => {
  const checkedAt = new Date("2026-05-31T00:00:00.000Z");
  const marked = markUpdateChecked(
    {
      mode: "batch",
      language: "en",
      provider: "mock",
    },
    checkedAt,
  );

  assert.deepEqual(marked, {
    mode: "batch",
    language: "en",
    provider: "mock",
    lastUpdateCheckAt: checkedAt.toISOString(),
  });
});

test("AM runUpdateCheckIfNeeded skips network when updateCheck is false or policy says no", async () => {
  const { fetchImpl, calls } = createFetchMock(createRegistryResponse("1.1.0"));

  assert.deepEqual(
    await runUpdateCheckIfNeeded({
      config: { updateCheck: false },
      saveConfig() {
        throw new Error("saveConfig should not be called");
      },
      logger: { info() {} },
      packageName: "convention-cli",
      currentVersion: "1.0.0",
      fetchImpl,
      isCI: false,
    }),
    { checked: false, skipped: true, reason: "policy" },
  );

  assert.deepEqual(
    await runUpdateCheckIfNeeded({
      config: {
        updateCheck: true,
        lastUpdateCheckAt: new Date().toISOString(),
      },
      saveConfig() {
        throw new Error("saveConfig should not be called");
      },
      logger: { info() {} },
      packageName: "convention-cli",
      currentVersion: "1.0.0",
      fetchImpl,
      isCI: false,
    }),
    { checked: false, skipped: true, reason: "policy" },
  );

  assert.equal(calls.length, 0);
});

test("AM runUpdateCheckIfNeeded checks, notifies, and stores lastUpdateCheckAt", async () => {
  const now = new Date("2026-05-31T00:00:00.000Z");
  const { fetchImpl, calls } = createFetchMock(createRegistryResponse("1.1.0"));
  const savedConfigs = [];
  const infoCalls = [];

  const result = await runUpdateCheckIfNeeded({
    config: {
      updateCheck: true,
      lastUpdateCheckAt: null,
      mode: "step",
    },
    saveConfig(config) {
      savedConfigs.push(config);
    },
    logger: {
      info(message) {
        infoCalls.push(message);
      },
    },
    packageName: "convention-cli",
    currentVersion: "1.0.0",
    fetchImpl,
    now,
    isCI: false,
  });

  assert.equal(result.checked, true);
  assert.equal(result.skipped, false);
  assert.equal(result.updateInfo.hasUpdate, true);
  assert.equal(calls.length, 1);
  assert.equal(savedConfigs.length, 1);
  assert.equal(savedConfigs[0].mode, "step");
  assert.equal(savedConfigs[0].lastUpdateCheckAt, now.toISOString());
  assert.equal(infoCalls.length, 1);
  assert.match(infoCalls[0], /npm install -g convention-cli@latest/);
});

test("AM runUpdateCheckIfNeeded skips CI and does not call fetch", async () => {
  const { fetchImpl, calls } = createFetchMock(createRegistryResponse("1.1.0"));

  const result = await runUpdateCheckIfNeeded({
    config: {
      updateCheck: true,
      lastUpdateCheckAt: null,
    },
    saveConfig() {
      throw new Error("saveConfig should not be called");
    },
    logger: { info() {} },
    packageName: "convention-cli",
    currentVersion: "1.0.0",
    fetchImpl,
    isCI: true,
  });

  assert.deepEqual(result, { checked: false, skipped: true, reason: "ci" });
  assert.equal(calls.length, 0);
});

test("AM CLI wires background update check only into PR and commit execution flows", () => {
  const source = fs.readFileSync("bin/convention.js", "utf8");
  const configBlockIndex = source.indexOf("if (hasConfigOption)");
  const agyMcpIndex = source.indexOf("if (options.agyMcp)");
  const resetIndex = source.indexOf("if (options.reset)");
  const prIndex = source.indexOf("if (options.pr)");
  const defaultCommitIndex = source.indexOf("runDefaultCommit({ push: options.push })");
  const updateFunctionIndex = source.indexOf("async function runBackgroundUpdateCheck()");

  // update check helper가 존재하고, 설정 명령과 reset 분기가 끝난 뒤 실행 명령 흐름에서만 호출되는지 확인합니다.
  assert.notEqual(updateFunctionIndex, -1);
  assert.equal(configBlockIndex < prIndex, true);
  assert.equal(agyMcpIndex < prIndex, true);
  assert.equal(resetIndex < prIndex, true);
  assert.equal(prIndex < defaultCommitIndex, true);
  assert.match(source, /if \(options\.pr\) \{\s+await runBackgroundUpdateCheck\(\);/);
  assert.match(source, /if \(options\.step\) \{\s+await runBackgroundUpdateCheck\(\);/);
  assert.match(source, /if \(options\.batch\) \{\s+await runBackgroundUpdateCheck\(\);/);
  assert.match(source, /if \(options\.group\) \{\s+await runBackgroundUpdateCheck\(\);/);
});
