import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "convention-cli-oauth-"));
const previousHome = process.env.HOME;
const previousUserProfile = process.env.USERPROFILE;
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

test.after(() => {
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
});

async function importOAuthWithTempHome() {
  const stamp = `${Date.now()}-${Math.random()}`;
  const oauthUrl = new URL("../src/auth/oauth.js", import.meta.url);
  oauthUrl.search = `?t=${stamp}`;
  const storeUrl = new URL("../src/config/store.js", import.meta.url);
  storeUrl.search = `?t=${stamp}`;

  const oauth = await import(oauthUrl.href);
  const store = await import(storeUrl.href);

  function cleanup() {
    // 파일 단위 임시 HOME을 공유하므로 개별 테스트에서는 환경을 되돌리지 않습니다.
  }

  return { oauth, store, cleanup };
}

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body });
        });
      })
      .on("error", reject);
  });
}

test("OAuth provider config keeps Antigravity OAuth disabled until official endpoints are verified", async () => {
  const { getOAuthProviderConfig, validateOAuthProviderConfig } = await import("../src/auth/oauthProviders.js");

  const antigravity = getOAuthProviderConfig("antigravity");
  assert.equal(antigravity.oauthAvailable, false);
  assert.equal(antigravity.authUrl, null);
  assert.equal(antigravity.tokenUrl, null);
  assert.equal(antigravity.supportsRefresh, false);
  assert.equal(validateOAuthProviderConfig("antigravity", antigravity), true);
});

test("startLocalCallbackServer resolves successful callback with redirectUri", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    const callbackServer = await oauth.startLocalCallbackServer({
      callbackPath: "/oauth/callback",
      timeoutMs: 1000,
    });

    const callbackPromise = callbackServer.waitForCallback();
    const response = await requestUrl(`${callbackServer.redirectUri}?code=abc&state=expected`);
    const callback = await callbackPromise;

    assert.equal(response.statusCode, 200);
    assert.equal(callback.code, "abc");
    assert.equal(callback.state, "expected");
    assert.equal(callback.redirectUri, callbackServer.redirectUri);
  } finally {
    cleanup();
  }
});

test("startLocalCallbackServer ignores wrong path before accepting valid callback", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    const callbackServer = await oauth.startLocalCallbackServer({
      callbackPath: "/oauth/callback",
      timeoutMs: 1000,
    });

    const callbackPromise = callbackServer.waitForCallback();
    const wrongPathUrl = new URL(callbackServer.redirectUri);
    wrongPathUrl.pathname = "/wrong/path";

    const wrongResponse = await requestUrl(wrongPathUrl.toString());
    const goodResponse = await requestUrl(`${callbackServer.redirectUri}?code=ok&state=safe`);
    const callback = await callbackPromise;

    assert.equal(wrongResponse.statusCode, 404);
    assert.equal(goodResponse.statusCode, 200);
    assert.equal(callback.code, "ok");
    assert.equal(callback.state, "safe");
  } finally {
    cleanup();
  }
});

test("OAuth callback provider error is sanitized in HTML and thrown error", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    const callbackServer = await oauth.startLocalCallbackServer({
      callbackPath: "/oauth/callback",
      timeoutMs: 1000,
    });

    const callbackPromise = callbackServer.waitForCallback();
    const rejectionAssertion = assert.rejects(
      callbackPromise,
      /OAuth provider returned an authorization error/,
    );
    const response = await requestUrl(
      `${callbackServer.redirectUri}?error=access_denied&error_description=SECRET%3Draw-token`,
    );

    await rejectionAssertion;
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /OAuth provider returned an authorization error/);
    assert.doesNotMatch(response.body, /SECRET/);
    assert.doesNotMatch(response.body, /raw-token/);
  } finally {
    cleanup();
  }
});

test("startOAuthFlow uses one redirectUri for authorization and token exchange", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();
  const previousFetch = global.fetch;
  const previousClientId = process.env.CONVENTION_GITHUB_CLIENT_ID;
  const previousClientSecret = process.env.CONVENTION_GITHUB_CLIENT_SECRET;

  process.env.CONVENTION_GITHUB_CLIENT_ID = "client-id";
  process.env.CONVENTION_GITHUB_CLIENT_SECRET = "client-secret";

  let launchedAuthUrl;
  let tokenRequestBody;

  global.fetch = async (_url, options) => {
    tokenRequestBody = options.body;
    return new Response(
      JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const redirectUri = "http://127.0.0.1:45555/oauth/callback";
    const tokenSet = await oauth.startOAuthFlow({
      provider: "github",
      config: {
        allowNonInteractive: true,
        shouldOpenBrowser: true,
        printAuthorizationUrl: false,
        browserLauncher: (url) => {
          launchedAuthUrl = url;
          return true;
        },
        startLocalCallbackServer: async () => ({
          redirectUri,
          waitForCallback: async () => {
            const authUrl = new URL(launchedAuthUrl);
            return {
              code: "auth-code",
              state: authUrl.searchParams.get("state"),
              redirectUri,
            };
          },
          close: () => {},
        }),
      },
    });

    const authUrl = new URL(launchedAuthUrl);
    const tokenParams = new URLSearchParams(tokenRequestBody);

    assert.equal(authUrl.searchParams.get("redirect_uri"), redirectUri);
    assert.equal(tokenParams.get("redirect_uri"), redirectUri);
    assert.equal(tokenSet.accessToken, "access-token");
  } finally {
    global.fetch = previousFetch;
    if (previousClientId === undefined) {
      delete process.env.CONVENTION_GITHUB_CLIENT_ID;
    } else {
      process.env.CONVENTION_GITHUB_CLIENT_ID = previousClientId;
    }
    if (previousClientSecret === undefined) {
      delete process.env.CONVENTION_GITHUB_CLIENT_SECRET;
    } else {
      process.env.CONVENTION_GITHUB_CLIENT_SECRET = previousClientSecret;
    }
    cleanup();
  }
});

test("startOAuthFlow does not print authorization URL unless explicitly allowed", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();
  const previousClientId = process.env.CONVENTION_GITHUB_CLIENT_ID;
  const previousClientSecret = process.env.CONVENTION_GITHUB_CLIENT_SECRET;
  const previousConsoleLog = console.log;

  process.env.CONVENTION_GITHUB_CLIENT_ID = "client-id";
  process.env.CONVENTION_GITHUB_CLIENT_SECRET = "client-secret";

  const loggedLines = [];
  let closeCalled = false;
  console.log = (...args) => {
    loggedLines.push(args.join(" "));
  };

  try {
    await assert.rejects(
      () =>
        oauth.startOAuthFlow({
          provider: "github",
          config: {
            allowNonInteractive: true,
            shouldOpenBrowser: true,
            browserLauncher: () => false,
            startLocalCallbackServer: async () => ({
              redirectUri: "http://127.0.0.1:45555/oauth/callback",
              waitForCallback: async () => {
                throw new Error("callback wait should not start after browser launch failure");
              },
              close: () => {
                closeCalled = true;
              },
            }),
          },
        }),
      /No authorization URL was printed/,
    );

    // authorization URL 전체에는 state/code_challenge가 포함되므로 기본 경로에서는 URL 형태의 민감 인증 파라미터를 stdout에 남기지 않습니다.
    const combinedLogs = loggedLines.join("\n");
    assert.doesNotMatch(combinedLogs, /redirect_uri=/);
    assert.doesNotMatch(combinedLogs, /state=/);
    assert.doesNotMatch(combinedLogs, /code_challenge=/);
    assert.equal(closeCalled, true);
  } finally {
    console.log = previousConsoleLog;
    if (previousClientId === undefined) {
      delete process.env.CONVENTION_GITHUB_CLIENT_ID;
    } else {
      process.env.CONVENTION_GITHUB_CLIENT_ID = previousClientId;
    }
    if (previousClientSecret === undefined) {
      delete process.env.CONVENTION_GITHUB_CLIENT_SECRET;
    } else {
      process.env.CONVENTION_GITHUB_CLIENT_SECRET = previousClientSecret;
    }
    cleanup();
  }
});

test("OAuth token store rejects unsupported providers", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    assert.throws(
      () => oauth.saveOAuthTokens("not-registered", { accessToken: "token" }),
      /Unsupported OAuth provider/,
    );
    assert.throws(() => oauth.loadOAuthTokens("not-registered"), /Unsupported OAuth provider/);
    assert.throws(() => oauth.clearOAuthTokens("not-registered"), /Unsupported OAuth provider/);
  } finally {
    cleanup();
  }
});

test("OAuth token store keeps tokens in credentials namespace only", async () => {
  const { oauth, store, cleanup } = await importOAuthWithTempHome();

  try {
    oauth.saveOAuthTokens("github-copilot", {
      accessToken: "copilot-access-token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    const loaded = oauth.loadOAuthTokens("github-copilot");
    assert.equal(loaded.accessToken, "copilot-access-token");
    assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), false);
    assert.equal(fs.existsSync(store.CREDENTIALS_FILE_PATH), true);

    oauth.clearOAuthTokens("github-copilot");
    assert.equal(oauth.loadOAuthTokens("github-copilot"), null);
  } finally {
    cleanup();
  }
});

test("supportsRefresh=false blocks refresh endpoint calls", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();
  const previousFetch = global.fetch;
  const previousClientId = process.env.CONVENTION_GITHUB_CLIENT_ID;
  const previousClientSecret = process.env.CONVENTION_GITHUB_CLIENT_SECRET;
  let fetchCalled = false;

  process.env.CONVENTION_GITHUB_CLIENT_ID = "client-id";
  process.env.CONVENTION_GITHUB_CLIENT_SECRET = "client-secret";
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch must not be called");
  };

  try {
    oauth.saveOAuthTokens("github", {
      accessToken: "expired-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() - 3600000).toISOString(),
    });

    await assert.rejects(
      () => oauth.getValidAccessToken("github"),
      /cannot be refreshed for this provider/,
    );
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = previousFetch;
    if (previousClientId === undefined) {
      delete process.env.CONVENTION_GITHUB_CLIENT_ID;
    } else {
      process.env.CONVENTION_GITHUB_CLIENT_ID = previousClientId;
    }
    if (previousClientSecret === undefined) {
      delete process.env.CONVENTION_GITHUB_CLIENT_SECRET;
    } else {
      process.env.CONVENTION_GITHUB_CLIENT_SECRET = previousClientSecret;
    }
    cleanup();
  }
});

test("isAccessTokenExpired applies clock skew", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    const futureDate = new Date(Date.now() + 100000).toISOString();
    const nearDate = new Date(Date.now() + 10000).toISOString();

    assert.equal(oauth.isAccessTokenExpired({ accessToken: "t", expiresAt: futureDate }), false);
    assert.equal(oauth.isAccessTokenExpired({ accessToken: "t", expiresAt: nearDate }), true);
    assert.equal(oauth.isAccessTokenExpired({ accessToken: "t" }), true);
  } finally {
    cleanup();
  }
});
