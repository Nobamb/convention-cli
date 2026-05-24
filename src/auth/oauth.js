import http from "http";
import childProcess from "child_process";
import { getOAuthProviderConfig, buildOAuthClientSettings } from "./oauthProviders.js";
import { generateCodeChallenge, generateCodeVerifier, generateState, verifyState } from "./security.js";
import { loadCredentials, saveCredentials } from "../config/store.js";
import { success, info } from "../utils/logger.js";
import { confirmAction } from "../utils/ui.js";

const DEFAULT_CALLBACK_PATH = "/oauth/callback";
const DEFAULT_CALLBACK_TIMEOUT_MS = 120000;
const GENERIC_PROVIDER_AUTH_ERROR =
  "OAuth provider returned an authorization error. Please retry login.";
const RELOGIN_REQUIRED_MESSAGE =
  "OAuth session cannot be refreshed for this provider. Please login again with `convention --model <provider> oauth`.";

/**
 * 시스템 기본 브라우저로 OAuth 인증 URL을 엽니다.
 * URL은 shell 문자열로 합치지 않고 argv 배열로만 전달해서 명령 주입 위험을 줄입니다.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function launchBrowser(url) {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      childProcess.execFileSync("cmd.exe", ["/c", "start", "", url]);
    } else if (platform === "darwin") {
      childProcess.execFileSync("open", [url]);
    } else {
      childProcess.execFileSync("xdg-open", [url]);
    }
    return true;
  } catch {
    return false;
  }
}

function normalizeCallbackPath(callbackPath) {
  if (typeof callbackPath !== "string" || callbackPath.trim().length === 0) {
    return DEFAULT_CALLBACK_PATH;
  }
  return callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
}

function closeServer(server) {
  if (!server || !server.listening) {
    return;
  }

  try {
    server.close();
  } catch {
    // 이미 닫힌 서버는 정리 완료 상태로 취급합니다.
  }
}

function writeHtml(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

function successHtml() {
  return `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"><title>OAuth Login Complete</title></head>
  <body>
    <h1>OAuth login complete</h1>
    <p>You may return to the terminal and close this browser window.</p>
  </body>
</html>`;
}

function errorHtml() {
  return `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"><title>OAuth Login Failed</title></head>
  <body>
    <h1>OAuth login failed</h1>
    <p>${GENERIC_PROVIDER_AUTH_ERROR}</p>
  </body>
</html>`;
}

/**
 * 하나의 로컬 콜백 서버 인스턴스가 redirectUri와 callback 결과를 모두 제공합니다.
 * 이전 구조처럼 임시 포트를 잡았다가 놓지 않으므로, 인증 URL과 실제 리스너 포트가 어긋나지 않습니다.
 *
 * @param {object} options
 * @param {string} options.callbackPath
 * @param {number} options.timeoutMs
 * @returns {Promise<{redirectUri: string, waitForCallback: Function, close: Function}>}
 */
export async function startLocalCallbackServer({
  callbackPath = DEFAULT_CALLBACK_PATH,
  timeoutMs = DEFAULT_CALLBACK_TIMEOUT_MS,
} = {}) {
  const normalizedPath = normalizeCallbackPath(callbackPath);
  let timeoutId;
  let settled = false;
  let resolveCallback;
  let rejectCallback;

  const callbackPromise = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = http.createServer((req, res) => {
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;

    try {
      const reqUrl = new URL(req.url, origin);

      // 잘못된 path 요청은 OAuth callback으로 처리하지 않고 서버도 닫지 않습니다.
      // 브라우저나 보안 제품의 사전 요청 때문에 정상 callback이 뒤따라올 수 있습니다.
      if (reqUrl.pathname !== normalizedPath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const errorParam = reqUrl.searchParams.get("error");
      if (errorParam) {
        settled = true;
        writeHtml(res, 400, errorHtml());
        clearTimeout(timeoutId);
        closeServer(server);
        rejectCallback(new Error(GENERIC_PROVIDER_AUTH_ERROR));
        return;
      }

      const code = reqUrl.searchParams.get("code");
      if (!code) {
        settled = true;
        writeHtml(res, 400, errorHtml());
        clearTimeout(timeoutId);
        closeServer(server);
        rejectCallback(new Error("OAuth callback did not include an authorization code."));
        return;
      }

      const state = reqUrl.searchParams.get("state");
      settled = true;
      writeHtml(res, 200, successHtml());
      clearTimeout(timeoutId);
      closeServer(server);
      resolveCallback({
        code,
        state,
        redirectUri: `${origin}${normalizedPath}`,
      });
    } catch {
      settled = true;
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
      clearTimeout(timeoutId);
      closeServer(server);
      rejectCallback(new Error("OAuth callback handling failed."));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const redirectUri = `http://127.0.0.1:${address.port}${normalizedPath}`;

  timeoutId = setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    closeServer(server);
    rejectCallback(new Error("OAuth callback wait timed out."));
  }, timeoutMs);

  return {
    redirectUri,
    waitForCallback: () => callbackPromise,
    close: () => {
      clearTimeout(timeoutId);
      closeServer(server);
    },
  };
}

/**
 * 기존 테스트와 호출부 호환을 위해 callback 결과만 기다리는 래퍼를 유지합니다.
 *
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function waitForOAuthCallback(options = {}) {
  const callbackServer = await startLocalCallbackServer(options);
  try {
    return await callbackServer.waitForCallback();
  } finally {
    callbackServer.close();
  }
}

/**
 * Provider 설정으로 Authorization URL을 구성합니다.
 * 공식 검증이 끝나지 않은 provider는 oauthProviders.js에서 endpoint를 제공하지 않으므로 여기서 중단됩니다.
 *
 * @param {object} params
 * @returns {string}
 */
export function buildAuthorizationUrl({ provider, redirectUri, state, codeChallenge, scopes }) {
  const providerConfig = getOAuthProviderConfig(provider);
  if (!providerConfig.authUrl) {
    throw new Error(`${provider} OAuth is not available until official endpoints are verified.`);
  }

  const clientSettings = buildOAuthClientSettings(provider);
  const authUrl = new URL(providerConfig.authUrl);

  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientSettings.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  const finalScopes = Array.from(new Set([...providerConfig.scopes, ...(scopes || [])]));
  authUrl.searchParams.set("scope", finalScopes.join(" "));

  if (providerConfig.supportsPKCE && codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  return authUrl.toString();
}

/**
 * OAuth 전체 흐름을 실행합니다.
 * 동일한 callbackServer.redirectUri를 authorization 단계와 token exchange 단계에 모두 사용합니다.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function startOAuthFlow({ provider, config = {} }) {
  const providerConfig = getOAuthProviderConfig(provider);
  if (providerConfig.oauthAvailable === false || !providerConfig.authUrl || !providerConfig.tokenUrl) {
    throw new Error(`${provider} OAuth is experimental and disabled until official endpoints are verified.`);
  }

  const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const isNonInteractive = !process.stdout.isTTY;
  if (!config.allowNonInteractive && (isCI || isNonInteractive)) {
    throw new Error("Interactive OAuth login cannot run in CI or a non-interactive terminal.");
  }

  const codeVerifier = providerConfig.supportsPKCE ? generateCodeVerifier() : null;
  const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : null;
  const state = generateState();
  const callbackServerFactory = config.startLocalCallbackServer || startLocalCallbackServer;
  const callbackServer = await callbackServerFactory({
    callbackPath: providerConfig.callbackPath || DEFAULT_CALLBACK_PATH,
    timeoutMs: config.timeoutMs || DEFAULT_CALLBACK_TIMEOUT_MS,
  });

  try {
    const authorizationUrl = buildAuthorizationUrl({
      provider,
      redirectUri: callbackServer.redirectUri,
      state,
      codeChallenge,
      scopes: providerConfig.scopes,
    });

    info("OAuth browser login is ready.");
    // 테스트와 자동화된 검증에서는 shouldOpenBrowser로 브라우저 실행 여부를 주입할 수 있습니다.
    // 기본 CLI에서는 기존처럼 사용자에게 먼저 물어봅니다.
    const shouldOpen =
      typeof config.shouldOpenBrowser === "boolean"
        ? config.shouldOpenBrowser
        : config.confirmOpenBrowser === false
          ? false
          : await confirmAction("Open a browser to continue OAuth login?");
    const browserLauncher = config.browserLauncher || launchBrowser;
    const launchSuccess = shouldOpen ? browserLauncher(authorizationUrl) : false;

    if (!launchSuccess && config.printAuthorizationUrl !== false) {
      info("\nOpen this URL in your browser to continue OAuth login:\n");
      console.log(authorizationUrl);
      info("\nReturn to the terminal after login completes.\n");
    }

    const receivedData = await callbackServer.waitForCallback();
    if (!verifyState(state, receivedData.state)) {
      throw new Error("OAuth state verification failed.");
    }

    info("Exchanging OAuth authorization code for tokens...");
    const tokenSet = await exchangeCodeForToken({
      provider,
      code: receivedData.code,
      redirectUri: callbackServer.redirectUri,
      codeVerifier,
    });

    saveOAuthTokens(provider, tokenSet);
    success(`${provider} OAuth login and token storage completed.`);

    return tokenSet;
  } finally {
    callbackServer.close();
  }
}

/**
 * Authorization code를 token endpoint로 교환합니다.
 * 실패 응답 본문은 읽거나 출력하지 않아 provider가 준 민감 상세 정보가 노출되지 않게 합니다.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function exchangeCodeForToken({ provider, code, redirectUri, codeVerifier }) {
  const providerConfig = getOAuthProviderConfig(provider);
  if (!providerConfig.tokenUrl) {
    throw new Error(`${provider} OAuth token endpoint is not configured.`);
  }

  const clientSettings = buildOAuthClientSettings(provider);
  const params = new URLSearchParams();

  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("redirect_uri", redirectUri);
  params.set("client_id", clientSettings.clientId);

  if (clientSettings.clientSecret) {
    params.set("client_secret", clientSettings.clientSecret);
  }
  if (codeVerifier) {
    params.set("code_verifier", codeVerifier);
  }

  try {
    const response = await fetch(providerConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.access_token) {
      throw new Error("Response payload does not contain an access_token.");
    }

    const expiresInSeconds = payload.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || null,
      expiresAt,
      tokenType: payload.token_type || "Bearer",
      scope: payload.scope || null,
    };
  } catch (error) {
    throw sanitizeOAuthError(error);
  }
}

/**
 * 만료된 access token을 refresh token으로 갱신합니다.
 * provider가 refresh를 지원하지 않는다고 선언하면 token endpoint 호출 없이 재로그인을 요구합니다.
 *
 * @param {string} provider
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function refreshAccessToken(provider, config = {}) {
  const providerConfig = getOAuthProviderConfig(provider);
  if (providerConfig.supportsRefresh === false) {
    throw new Error(RELOGIN_REQUIRED_MESSAGE);
  }
  if (!providerConfig.tokenUrl) {
    throw new Error(`${provider} OAuth token endpoint is not configured.`);
  }

  const clientSettings = buildOAuthClientSettings(provider);
  const tokens = loadOAuthTokens(provider);

  if (!tokens || !tokens.refreshToken) {
    throw new Error("OAuth session cannot be refreshed. Please login again.");
  }

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", tokens.refreshToken);
  params.set("client_id", clientSettings.clientId);

  if (clientSettings.clientSecret) {
    params.set("client_secret", clientSettings.clientSecret);
  }

  try {
    const response = await fetch(providerConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
      signal: config.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 400) {
        throw new Error("OAuth refresh failed. Please login again.");
      }
      throw new Error(`Token refresh failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.access_token) {
      throw new Error("Refresh response did not return an access_token.");
    }

    const expiresInSeconds = payload.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const updatedTokens = {
      ...tokens,
      accessToken: payload.access_token,
      expiresAt,
      refreshToken: payload.refresh_token || tokens.refreshToken,
    };

    saveOAuthTokens(provider, updatedTokens);
    return updatedTokens;
  } catch (error) {
    throw sanitizeOAuthError(error);
  }
}

/**
 * 저장된 access token을 반환하고, 만료되었으면 안전 조건을 확인한 뒤 refresh를 시도합니다.
 *
 * @param {string} provider
 * @param {object} config
 * @returns {Promise<string>}
 */
export async function getValidAccessToken(provider, config = {}) {
  const providerConfig = getOAuthProviderConfig(provider);
  const tokens = loadOAuthTokens(provider);

  if (!tokens || !tokens.accessToken) {
    throw new Error("Stored OAuth token is missing. Please complete OAuth login first.");
  }

  if (isAccessTokenExpired(tokens)) {
    if (providerConfig.supportsRefresh === false) {
      throw new Error(RELOGIN_REQUIRED_MESSAGE);
    }
    if (!tokens.refreshToken) {
      throw new Error("OAuth access token expired and no refresh token is available. Please login again.");
    }
    const refreshed = await refreshAccessToken(provider, config);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

function normalizeTokenSaveArgs(provider, tokens) {
  if (provider && typeof provider === "object" && !tokens) {
    return {
      provider: provider.provider,
      tokens: provider.tokenSet || provider.tokens,
    };
  }

  return { provider, tokens };
}

/**
 * OAuth token을 credentials.json의 provider별 namespace에 저장합니다.
 * 저장 전 provider registry를 확인해서 임의 provider 이름으로 token이 쓰이지 않게 합니다.
 *
 * @param {string|object} provider
 * @param {object} tokens
 */
export function saveOAuthTokens(provider, tokens) {
  const { provider: finalProvider, tokens: finalTokens } = normalizeTokenSaveArgs(provider, tokens);

  if (!finalProvider) {
    throw new Error("OAuth provider name is required to save tokens");
  }
  getOAuthProviderConfig(finalProvider);

  if (!finalTokens || !finalTokens.accessToken) {
    throw new Error("accessToken is required to save OAuth tokens");
  }

  const credentials = loadCredentials();
  const oauthSpace = credentials.oauth || {};

  oauthSpace[finalProvider] = {
    accessToken: finalTokens.accessToken,
    refreshToken: finalTokens.refreshToken || null,
    expiresAt: finalTokens.expiresAt || null,
    tokenType: finalTokens.tokenType || "Bearer",
    scope: finalTokens.scope || null,
  };

  saveCredentials({
    ...credentials,
    oauth: oauthSpace,
  });
}

/**
 * provider별 OAuth token을 불러옵니다.
 * 등록되지 않은 OAuth provider는 조용히 null로 fallback하지 않고 명확히 거부합니다.
 *
 * @param {string} provider
 * @returns {object|null}
 */
export function loadOAuthTokens(provider) {
  if (!provider) {
    throw new Error("OAuth provider name is required to load tokens");
  }
  getOAuthProviderConfig(provider);

  const credentials = loadCredentials();
  return credentials?.oauth?.[provider] || null;
}

/**
 * provider별 OAuth token을 삭제합니다.
 * 삭제도 provider registry 검증을 거쳐 오타나 미지원 provider 조작을 막습니다.
 *
 * @param {string} provider
 */
export function clearOAuthTokens(provider) {
  if (!provider) {
    throw new Error("OAuth provider name is required to clear tokens");
  }
  getOAuthProviderConfig(provider);

  const credentials = loadCredentials();
  if (credentials.oauth && credentials.oauth[provider]) {
    delete credentials.oauth[provider];
    saveCredentials(credentials);
  }
}

/**
 * access token 만료 여부를 판정합니다.
 * 60초 clock skew를 둬서 만료 직전 token을 외부 API에 보내지 않게 합니다.
 *
 * @param {object} tokenRecord
 * @param {number} now
 * @returns {boolean}
 */
export function isAccessTokenExpired(tokenRecord, now = Date.now()) {
  if (!tokenRecord || !tokenRecord.accessToken || !tokenRecord.expiresAt) {
    return true;
  }

  const expireTime = new Date(tokenRecord.expiresAt).getTime();
  return expireTime - 60000 <= now;
}

/**
 * OAuth 오류 메시지에서 token, code, client secret 같은 값을 제거합니다.
 * provider callback의 error/error_description은 원문이 공격자 입력일 수 있으므로 generic message로 대체합니다.
 *
 * @param {Error|string} error
 * @returns {Error}
 */
export function sanitizeOAuthError(error) {
  const rawMessage = typeof error === "string" ? error : error?.message || "";

  if (
    rawMessage === GENERIC_PROVIDER_AUTH_ERROR ||
    rawMessage.toLowerCase().includes("error_description")
  ) {
    return new Error(GENERIC_PROVIDER_AUTH_ERROR);
  }

  const cleanMessage = rawMessage
    .replace(/access_token=[^&\s]+/giu, "access_token=[REDACTED]")
    .replace(/refresh_token=[^&\s]+/giu, "refresh_token=[REDACTED]")
    .replace(/client_secret=[^&\s]+/giu, "client_secret=[REDACTED]")
    .replace(/code=[^&\s]+/giu, "code=[REDACTED]")
    .replace(/Bearer\s+[-._~+/=A-Za-z0-9]+/gu, "Bearer [REDACTED]");

  return new Error(cleanMessage || "OAuth processing failed.");
}
