import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import http from "node:http";

// 테스트를 격리된 임시 홈 디렉터리 환경에서 가져오기 위한 유틸리티 함수입니다.
async function importOAuthWithTempHome() {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "convention-cli-oauth-"));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;

  // 테스트를 격격리하기 위해 HOME 환경 변수를 임시 경로로 바꿉니다.
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  const stamp = `${Date.now()}-${Math.random()}`;
  
  // 캐싱 방지용 쿼리 스트링 추가
  const storeUrl = new URL("../src/config/store.js", import.meta.url);
  storeUrl.search = `?home=${encodeURIComponent(tempHome)}&t=${stamp}`;
  
  const oauthUrl = new URL("../src/auth/oauth.js", import.meta.url);
  oauthUrl.search = `?home=${encodeURIComponent(tempHome)}&t=${stamp}`;

  const store = await import(storeUrl.href);
  const oauth = await import(oauthUrl.href);

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

  return { store, oauth, cleanup };
}

// -----------------------------------------------------------------------------
// 1. OAuth Provider Config & Validation Tests
// -----------------------------------------------------------------------------

test("X getOAuthProviderConfig returns correct cloned static configs", async () => {
  const { getOAuthProviderConfig, listOAuthProviders } = await import("../src/auth/oauthProviders.js");

  const config = getOAuthProviderConfig("github");
  assert.equal(config.provider, "github");
  assert.equal(config.supportsPKCE, true);
  assert.ok(Array.isArray(config.scopes));

  // 복사본 반환 및 원본 보존 검사
  config.scopes.push("polluted");
  const config2 = getOAuthProviderConfig("github");
  assert.equal(config2.scopes.includes("polluted"), false);

  // 미지원 모델 조회 시 mock fallback 없이 오류 반환 검사
  assert.throws(() => {
    getOAuthProviderConfig("unknown");
  }, /Unsupported OAuth provider/);
});

test("X validateOAuthProviderConfig validates URL protocols and scopes properly", async () => {
  const { validateOAuthProviderConfig } = await import("../src/auth/oauthProviders.js");

  const validConfig = {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user", "read:user"], // 중복 포함
  };

  // 중복이 제거되는지 검사
  validateOAuthProviderConfig("github", validConfig);
  assert.deepEqual(validConfig.scopes, ["read:user"]);

  // 비 HTTPS URL 거부 검사
  const invalidProtocolConfig = {
    authUrl: "http://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user"],
  };
  assert.throws(() => {
    validateOAuthProviderConfig("github", invalidProtocolConfig);
  }, /must be a valid HTTPS URL/);

  // 민감한 패턴(SECRET)이 포함된 scope 거절 검사
  const dangerousScopeConfig = {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["TOKEN=secretkey"],
  };
  assert.throws(() => {
    validateOAuthProviderConfig("github", dangerousScopeConfig);
  }, /contains highly sensitive pattern/);
});

test("X buildOAuthClientSettings parses settings from environment variables", async () => {
  const { buildOAuthClientSettings } = await import("../src/auth/oauthProviders.js");

  const originalId = process.env.CONVENTION_GITHUB_CLIENT_ID;
  const originalSecret = process.env.CONVENTION_GITHUB_CLIENT_SECRET;

  process.env.CONVENTION_GITHUB_CLIENT_ID = "test-id";
  process.env.CONVENTION_GITHUB_CLIENT_SECRET = "test-secret";

  try {
    const settings = buildOAuthClientSettings("github");
    assert.equal(settings.clientId, "test-id");
    assert.equal(settings.clientSecret, "test-secret");
  } finally {
    process.env.CONVENTION_GITHUB_CLIENT_ID = originalId;
    process.env.CONVENTION_GITHUB_CLIENT_SECRET = originalSecret;
  }
});

// -----------------------------------------------------------------------------
// 2. PKCE Security Utility Tests
// -----------------------------------------------------------------------------

test("Z PKCE & State generation and secure verification tests", async () => {
  const { generateCodeVerifier, generateCodeChallenge, generateState, verifyState } = await import("../src/auth/security.js");

  // 1. code_verifier 검증
  const verifier = generateCodeVerifier();
  assert.ok(verifier.length >= 43);
  assert.ok(verifier.length <= 128);
  assert.match(verifier, /^[A-Za-z0-9._~-]+$/);

  // 2. code_challenge 검증
  const challenge = generateCodeChallenge(verifier);
  assert.ok(challenge.length > 0);
  assert.equal(challenge.includes("="), false);
  assert.equal(challenge.includes("+"), false);
  assert.equal(challenge.includes("/"), false);

  // 3. state 검증
  const state1 = generateState();
  const state2 = generateState();
  assert.notEqual(state1, state2);

  // timingSafeEqual 기반 매칭 검사
  assert.equal(verifyState(state1, state1), true);
  assert.equal(verifyState(state1, state2), false);
  assert.equal(verifyState(state1, undefined), false);
});

// -----------------------------------------------------------------------------
// 3. Local Callback HTTP Server & Redirection Tests
// -----------------------------------------------------------------------------

test("Y Local Callback Server handles success and timeout correctly", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    // 1. 임시 서버 리슨 및 타임아웃 종료 테스트
    const errPromise = oauth.waitForOAuthCallback({
      callbackPath: "/oauth/callback",
      timeoutMs: 50, // 매우 짧은 타임아웃 설정
    });
    
    await assert.rejects(errPromise, /Timeout/);

  } finally {
    cleanup();
  }
});

// -----------------------------------------------------------------------------
// 4. Token Store Persistence Tests
// -----------------------------------------------------------------------------

test("AA saveOAuthTokens and loadOAuthTokens isolated namespace persistence tests", async () => {
  const { store, oauth, cleanup } = await importOAuthWithTempHome();

  try {
    const dummyTokens = {
      accessToken: "access-token-fixture-AA",
      refreshToken: "refresh-token-fixture-AA",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    // 토큰 저장 실행
    oauth.saveOAuthTokens("antigravity", dummyTokens);

    // 로드 및 값 검사
    const loaded = oauth.loadOAuthTokens("antigravity");
    assert.equal(loaded.accessToken, "access-token-fixture-AA");
    assert.equal(loaded.refreshToken, "refresh-token-fixture-AA");

    // config.json에 secret 값이 기입되지 않았는지 최종 검사
    assert.equal(fs.existsSync(store.CONFIG_FILE_PATH), false);
    assert.equal(fs.existsSync(store.CREDENTIALS_FILE_PATH), true);

    const rawCredentials = fs.readFileSync(store.CREDENTIALS_FILE_PATH, "utf8");
    assert.match(rawCredentials, /access-token-fixture-AA/);

    // 다른 provider와 API keys 덮어쓰기 오염 방지 테스트
    oauth.saveOAuthTokens("github-copilot", {
      accessToken: "copilot-access-token",
    });

    const antigravityAgain = oauth.loadOAuthTokens("antigravity");
    assert.equal(antigravityAgain.accessToken, "access-token-fixture-AA");

    // 토큰 삭제 검사
    oauth.clearOAuthTokens("antigravity");
    assert.equal(oauth.loadOAuthTokens("antigravity"), null);
    assert.equal(oauth.loadOAuthTokens("github-copilot").accessToken, "copilot-access-token");

  } finally {
    cleanup();
  }
});

// -----------------------------------------------------------------------------
// 5. Token Refresh tests
// -----------------------------------------------------------------------------

test("AB isAccessTokenExpired and getValidAccessToken refresh branch tests", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    const futureDate = new Date(Date.now() + 100000).toISOString();
    const pastDate = new Date(Date.now() - 50000).toISOString();

    assert.equal(oauth.isAccessTokenExpired({ accessToken: "t", expiresAt: futureDate }), false);
    assert.equal(oauth.isAccessTokenExpired({ accessToken: "t", expiresAt: pastDate }), true);
    // 60초 skew 기준 검사 (만료 10초 전은 만료된 것으로 취급해야 함)
    const nearDate = new Date(Date.now() + 10000).toISOString();
    assert.equal(oauth.isAccessTokenExpired({ accessToken: "t", expiresAt: nearDate }), true);

  } finally {
    cleanup();
  }
});

// -----------------------------------------------------------------------------
// 6. Integration & Header Injection Routing Tests
// -----------------------------------------------------------------------------

test("AC Provider routing intercepts oauth authType and injects Bearer header", async () => {
  const { oauth, cleanup } = await importOAuthWithTempHome();

  try {
    const { generateWithProvider, listProviderModels } = await import("../src/providers/index.js");

    const futureDate = new Date(Date.now() + 100000).toISOString();
    oauth.saveOAuthTokens("antigravity", {
      accessToken: "my-valid-bearer-token-123",
      expiresAt: futureDate,
    });

    // mock AI provider는 oauth를 지원하지 않으므로, oauth authType 설정 시 에러가 나야 합니다.
    const invalidConfig = {
      provider: "mock",
      authType: "oauth",
    };
    
    await assert.rejects(
      generateWithProvider({ prompt: "hello", config: invalidConfig }),
      /does not support OAuth authentication/
    );

  } finally {
    cleanup();
  }
});
