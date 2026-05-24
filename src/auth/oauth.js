import http from "http";
import childProcess from "child_process";
import {
  getOAuthProviderConfig,
  buildOAuthClientSettings,
} from "./oauthProviders.js";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  verifyState,
} from "./security.js";
import { loadCredentials, saveCredentials } from "../config/store.js";
import { success, info } from "../utils/logger.js";
import { confirmAction } from "../utils/ui.js";

/**
 * OAuth 콜백 기본 경로
 */
const DEFAULT_CALLBACK_PATH = "/oauth/callback";

/**
 * OAuth 콜백 타임아웃(밀리초)
 */
const DEFAULT_CALLBACK_TIMEOUT_MS = 120000;

/**
 * OAuth Provider 공통 인증 에러
 */
const GENERIC_PROVIDER_AUTH_ERROR =
  "OAuth provider returned an authorization error. Please retry login.";

/**
 * OAuth Provider 공통 인증 에러
 */
const RELOGIN_REQUIRED_MESSAGE =
  "OAuth session cannot be refreshed for this provider. Please login again with `convention --model <provider> oauth`.";

/**
 * 시스템 기본 브라우저로 OAuth 인증 URL을 엽니다.
 * URL은 shell 문자열로 합치지 않고 argv 배열로만 전달해서 명령 주입 위험을 줄입니다.
 *
 * @param {string} url - OAuth 인증 URL
 * @returns {boolean} - 브라우저를 성공적으로 띄웠을 경우 true, 실패했을 경우 false
 */
export function launchBrowser(url) {
  // 운영체제 확인
  const platform = process.platform;

  // 시스템 기본 브라우저로 인증 url을 엽니다.
  try {
    // 윈도우 운영체제일 경우
    if (platform === "win32") {
      // cmd 명령어로 브라우저를 엽니다.
      childProcess.execFileSync("cmd.exe", ["/c", "start", "", url]);
    }
    // 맥 운영체제일 경우
    else if (platform === "darwin") {
      // open 명령어로 브라우저를 엽니다.
      childProcess.execFileSync("open", [url]);
    }
    // 그 외 운영체제일 경우
    else {
      // xdg-open 명령어로 브라우저를 엽니다.
      childProcess.execFileSync("xdg-open", [url]);
    }
    // 성공적으로 브라우저를 띄웠을 경우
    return true;
  } catch {
    // 브라우저를 띄우지 못했을 경우
    return false;
  }
}

/**
 * 콜백 경로를 정규화합니다.
 * @param {string} callbackPath - 콜백 경로
 * @returns {string} - 정규화된 콜백 경로
 */
function normalizeCallbackPath(callbackPath) {
  // 콜백 경로가 문자열이 아니거나 비어있으면 기본 콜백 경로를 반환합니다.
  if (typeof callbackPath !== "string" || callbackPath.trim().length === 0) {
    return DEFAULT_CALLBACK_PATH;
  }
  // 콜백 경로가 /로 시작하지 않으면 /를 추가합니다.
  return callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
}

/**
 * 서버를 닫습니다.
 * @param {http.Server} server - HTTP 서버
 * @returns
 */
function closeServer(server) {
  // 서버가 없거나 이미 닫혀있으면 반환합니다.
  if (!server || !server.listening) {
    return;
  }

  // 서버를 닫습니다.
  try {
    server.close();
  } catch {
    // 이미 닫힌 서버는 정리 완료 상태로 취급합니다.
  }
}

/**
 * HTTP 응답에 HTML을 작성합니다.
 * @param {http.ServerResponse} res - HTTP 응답
 * @param {number} statusCode - HTTP 상태 코드
 * @param {string} body - HTML 본문
 */
function writeHtml(res, statusCode, body) {
  // HTTP 헤더를 작성합니다.
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  // HTTP 응답을 전송합니다.
  res.end(body);
}

/**
 * OAuth 완료 페이지 HTML을 반환합니다.
 * @returns {string} - OAuth 완료 페이지 HTML
 */
function successHtml() {
  // OAuth 완료 페이지 HTML을 반환합니다.
  return `<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8"><title>OAuth Login Complete</title></head>
  <body>
    <h1>OAuth login complete</h1>
    <p>You may return to the terminal and close this browser window.</p>
  </body>
</html>`;
}

/**
 * OAuth 실패 페이지 HTML을 반환합니다.
 * @returns {string} - OAuth 실패 페이지 HTML
 */
function errorHtml() {
  // OAuth 실패 페이지 HTML을 반환합니다.
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
  // 콜백 경로를 정규화합니다.
  const normalizedPath = normalizeCallbackPath(callbackPath);
  // 타임아웃을 설정합니다.
  let timeoutId;
  // 콜백이 정착되었는지 확인합니다.
  let settled = false;
  // 콜백을 해결할 함수를 저장합니다.
  let resolveCallback;
  // 콜백을 거부할 함수를 저장합니다.

  // 콜백을 기다립니다.
  const callbackPromise = new Promise((resolve, reject) => {
    // 콜백을 해결할 함수를 저장합니다.
    // 콜백을 해결할 함수를 저장합니다.
    resolveCallback = resolve;
    // 콜백을 거부할 함수를 저장합니다.
    rejectCallback = reject;
  });

  // HTTP 서버를 생성합니다.
  const server = http.createServer((req, res) => {
    // 서버 주소를 가져옵니다.
    const address = server.address();
    // origin을 설정합니다.
    const origin = `http://127.0.0.1:${address.port}`;

    // HTTP 요청을 처리합니다.
    try {
      // 요청 URL을 origin을 기반으로 파싱합니다.
      const reqUrl = new URL(req.url, origin);

      // 잘못된 path 요청은 OAuth callback으로 처리하지 않고 서버도 닫지 않습니다.
      // 브라우저나 보안 제품의 사전 요청 때문에 정상 callback이 뒤따라올 수 있습니다.
      if (reqUrl.pathname !== normalizedPath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      // 에러 파라미터를 가져옵니다.
      const errorParam = reqUrl.searchParams.get("error");
      // 에러가 있으면
      if (errorParam) {
        // 정착 상태를 true로 변경합니다.
        settled = true;
        // 에러 페이지를 응답으로 보냅니다.
        writeHtml(res, 400, errorHtml());
        // 타임아웃을 클리어합니다.
        clearTimeout(timeoutId);
        // 서버를 닫습니다.
        rejectCallback(new Error(GENERIC_PROVIDER_AUTH_ERROR));
        return;
      }

      // 인증 코드를 가져옵니다.
      const code = reqUrl.searchParams.get("code");
      // 인증 코드가 없으면
      if (!code) {
        // 정착 상태를 true로 변경합니다.
        settled = true;
        // 에러 페이지를 응답으로 보냅니다.
        writeHtml(res, 400, errorHtml());
        // 타임아웃을 클리어합니다.
        clearTimeout(timeoutId);
        // 서버를 닫습니다.
        closeServer(server);
        // 인증 코드가 없음을 알립니다.
        rejectCallback(
          new Error("OAuth callback did not include an authorization code."),
        );
        return;
      }

      // State 파라미터를 가져옵니다.
      const state = reqUrl.searchParams.get("state");
      // 정착 상태를 true로 변경합니다.
      settled = true;
      // 성공 페이지를 응답으로 보냅니다.
      writeHtml(res, 200, successHtml());
      // 타임아웃을 클리어합니다.
      clearTimeout(timeoutId);
      // 서버를 닫습니다.
      closeServer(server);
      // 인증 정보(code, state, redirectUri)를 반환합니다.
      resolveCallback({
        code,
        state,
        redirectUri: `${origin}${normalizedPath}`,
      });
    } catch {
      // 예외 발생 시 서버 관련 에러 처리를 하게 됩니다.
      // 정착 상태를 true로 변경합니다.
      settled = true;
      // 500 에러를 응답으로 보냅니다.
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      // Internal Server Error를 응답으로 보냅니다.
      res.end("Internal Server Error");
      // 타임아웃을 클리어합니다.
      clearTimeout(timeoutId);
      // 서버를 닫습니다.
      closeServer(server);
      // 콜백을 거부합니다.
      rejectCallback(new Error("OAuth callback handling failed."));
    }
  });

  // 콜백 서버를 실행하고 리스닝을 시작합니다.
  await new Promise((resolve, reject) => {
    // 에러를 잡습니다.
    server.once("error", reject);
    // 0번 포트를 잡고 리스닝을 시작합니다.
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      // 콜백 서버를 성공적으로 실행했으므로 resolve 합니다.
      resolve();
    });
  });

  // 서버 주소를 가져옵니다.
  const address = server.address();
  // 리다이렉트 URI를 설정합니다.
  const redirectUri = `http://127.0.0.1:${address.port}${normalizedPath}`;

  // 타임아웃을 설정합니다.
  timeoutId = setTimeout(() => {
    // 정착 상태를 확인합니다.
    // 정착 상태가 이미 true이면 콜백 요청이 오지 않은 것이므로 리스너를 닫습니다.
    if (settled) {
      return;
    }
    // 정착 상태를 true로 변경합니다.
    settled = true;
    // 서버를 닫습니다.
    closeServer(server);
    // 콜백을 거부합니다.
    rejectCallback(new Error("OAuth callback wait timed out."));
  }, timeoutMs);

  // 콜백 서버와 타임아웃을 반환합니다.
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
 * @param {object} options - 콜백 서버 설정
 * @returns {Promise<object>} - 콜백 결과
 */
export async function waitForOAuthCallback(options = {}) {
  // 콜백 서버를 시작하고 콜백을 기다립니다.
  const callbackServer = await startLocalCallbackServer(options);
  try {
    // 콜백 결과를 반환합니다.
    return await callbackServer.waitForCallback();
  } finally {
    // 콜백 서버를 닫습니다.
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
export function buildAuthorizationUrl({
  provider,
  redirectUri,
  state,
  codeChallenge,
  scopes,
}) {
  // Oauth Provider 설정을 가져옵니다.
  const providerConfig = getOAuthProviderConfig(provider);
  // AuthUrl을 확인합니다.
  // AuthUrl이 없으면 오류를 발생시킵니다.
  if (!providerConfig.authUrl) {
    throw new Error(
      `${provider} OAuth is not available until official endpoints are verified.`,
    );
  }

  // Oauth Client 설정을 가져옵니다.
  const clientSettings = buildOAuthClientSettings(provider);
  // AuthUrl을 설정합니다.
  const authUrl = new URL(providerConfig.authUrl);

  // AuthUrl에 파라미터를 설정합니다.
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientSettings.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  // 스코프를 설정합니다.
  const finalScopes = Array.from(
    // 중복을 제거하고 스코프를 설정합니다.
    new Set([...providerConfig.scopes, ...(scopes || [])]),
  );
  // 스코프를 설정합니다.
  authUrl.searchParams.set("scope", finalScopes.join(" "));

  // PKCE를 지원하고 codeChallenge가 있으면 설정합니다.
  if (providerConfig.supportsPKCE && codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  // Authorization URL을 문자열 형태로 반환합니다.
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
  // Provider 설정을 가져옵니다.
  const providerConfig = getOAuthProviderConfig(provider);
  // Oauth 설정이 유효한지 확인합니다.
  // oauthAvailable, authUrl, tokenUrl 모두 존재하는지 확인합니다.
  if (
    providerConfig.oauthAvailable === false ||
    !providerConfig.authUrl ||
    !providerConfig.tokenUrl
  ) {
    // Oauth 설정들이 모두 존재하지 않다면 error를 반환합니다
    throw new Error(
      `${provider} OAuth is experimental and disabled until official endpoints are verified.`,
    );
  }

  // CI 환경인지 확인합니다.
  const isCI =
    process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  // 비대화형 환경인지 확인합니다.
  const isNonInteractive = !process.stdout.isTTY;
  // 비대화형 환경에서 allowNonInteractive가 false이면 error를 반환합니다.
  if (!config.allowNonInteractive && (isCI || isNonInteractive)) {
    throw new Error(
      "Interactive OAuth login cannot run in CI or a non-interactive terminal.",
    );
  }

  // PKCE를 지원하면 codeVerifier를 생성합니다.
  const codeVerifier = providerConfig.supportsPKCE
    ? generateCodeVerifier()
    : null;
  // codeVerifier가 있으면 codeChallenge를 생성합니다.
  const codeChallenge = codeVerifier
    ? generateCodeChallenge(codeVerifier)
    : null;
  // state를 생성합니다.
  const state = generateState();
  // 콜백 서버를 설정합니다.
  const callbackServerFactory =
    config.startLocalCallbackServer || startLocalCallbackServer;
  // 콜백 서버를 시작합니다.
  const callbackServer = await callbackServerFactory({
    callbackPath: providerConfig.callbackPath || DEFAULT_CALLBACK_PATH,
    timeoutMs: config.timeoutMs || DEFAULT_CALLBACK_TIMEOUT_MS,
  });

  // Authorization URL을 빌드합니다.
  try {
    const authorizationUrl = buildAuthorizationUrl({
      provider,
      redirectUri: callbackServer.redirectUri,
      state,
      codeChallenge,
      scopes: providerConfig.scopes,
    });

    // OAuth 브라우저 로그인이 준비되었음을 알립니다.
    info("OAuth browser login is ready.");
    // 테스트와 자동화된 검증에서는 shouldOpenBrowser로 브라우저 실행 여부를 주입할 수 있습니다.
    // 기본 CLI에서는 기존처럼 사용자에게 먼저 물어봅니다.
    const shouldOpen =
      typeof config.shouldOpenBrowser === "boolean"
        ? config.shouldOpenBrowser
        : config.confirmOpenBrowser === false
          ? false
          : await confirmAction("Open a browser to continue OAuth login?");
    // 브라우저 실행 함수를 설정합니다.
    const browserLauncher = config.browserLauncher || launchBrowser;
    // 브라우저를 실행하고 성공 여부를 확인합니다.
    const launchSuccess = shouldOpen
      ? browserLauncher(authorizationUrl)
      : false;

    // 브라우저가 성공적으로 실행되었는지 확인합니다.
    if (!launchSuccess && config.printAuthorizationUrl === true) {
      // 브라우저가 성공적으로 실행되지 않았고, printAuthorizationUrl이 true이면 Authorization URL을 출력합니다.
      info("\nOpen this URL in your browser to continue OAuth login:\n");
      console.log(authorizationUrl);
      info("\nReturn to the terminal after login completes.\n");
    }
    // 브라우저가 성공적으로 실행되지 않았고, printAuthorizationUrl이 false이면 에러를 발생시킵니다.
    else if (!launchSuccess) {
      // OAuth authorization URL에는 access token은 없지만 CSRF 방어용 state와 PKCE challenge가 들어갑니다.
      // 터미널 출력이 CI 로그나 쉘 히스토리 수집 대상으로 남을 수 있으므로, 명시적으로 허용한 경우가 아니면 URL을 출력하지 않습니다.
      // 브라우저 실행이 실패한 상태에서 계속 대기하면 사용자가 callback을 완료할 수 없으므로 안전하게 중단합니다.
      throw new Error(
        "OAuth browser launch was not completed. No authorization URL was printed.",
      );
    }

    // 콜백 서버에서 데이터를 기다립니다.
    const receivedData = await callbackServer.waitForCallback();
    // state를 검증합니다.
    if (!verifyState(state, receivedData.state)) {
      throw new Error("OAuth state verification failed.");
    }

    // Authorization code를 token endpoint로 교환합니다.
    info("Exchanging OAuth authorization code for tokens...");
    // Authorization code를 token endpoint로 교환합니다.
    const tokenSet = await exchangeCodeForToken({
      provider,
      code: receivedData.code,
      redirectUri: callbackServer.redirectUri,
      codeVerifier,
    });

    // OAuth tokens를 저장합니다.
    saveOAuthTokens(provider, tokenSet);
    // OAuth login과 token storage가 완료되었음을 알립니다.
    success(`${provider} OAuth login and token storage completed.`);

    // 토큰 세트를 반환합니다.
    return tokenSet;
  } finally {
    // 콜백 서버를 닫습니다.
    callbackServer.close();
  }
}

/**
 * Authorization code를 token endpoint로 교환합니다.
 * 실패 응답 본문은 읽거나 출력하지 않아 provider가 준 민감 상세 정보가 노출되지 않게 합니다.
 *
 * @param {object} params -토큰 교환 요청에 필요한 파라미터
 * @returns {Promise<object>} - tokenSet
 */
export async function exchangeCodeForToken({
  provider,
  code,
  redirectUri,
  codeVerifier,
}) {
  // OAuth 제공자 설정을 가져옵니다.
  const providerConfig = getOAuthProviderConfig(provider);
  // tokenUrl이 없으면 에러를 발생시킵니다.
  if (!providerConfig.tokenUrl) {
    throw new Error(`${provider} OAuth token endpoint is not configured.`);
  }

  // Client 설정을 가져옵니다.
  const clientSettings = buildOAuthClientSettings(provider);
  // URLSearchParams를 생성합니다.
  const params = new URLSearchParams();

  // grant_type, code, redirect_uri, client_id를 설정합니다.
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("redirect_uri", redirectUri);
  params.set("client_id", clientSettings.clientId);

  // clientSecret이 있으면 파라미터에 추가합니다.
  if (clientSettings.clientSecret) {
    params.set("client_secret", clientSettings.clientSecret);
  }
  // codeVerifier가 있으면 파라미터에 추가합니다.
  if (codeVerifier) {
    params.set("code_verifier", codeVerifier);
  }

  try {
    // token endpoint로 POST 요청을 보냅니다.
    const response = await fetch(providerConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    // 응답이 성공적이지 않으면 에러를 발생시킵니다.
    if (!response.ok) {
      throw new Error(`Token exchange failed with status ${response.status}`);
    }

    // 응답 본문을 JSON으로 파싱합니다.
    const payload = await response.json();
    if (!payload.access_token) {
      throw new Error("Response payload does not contain an access_token.");
    }

    // expires_in이 없으면 1시간을 기본값으로 설정합니다.
    const expiresInSeconds = payload.expires_in || 3600;
    // expiresAt을 설정합니다.
    const expiresAt = new Date(
      Date.now() + expiresInSeconds * 1000,
    ).toISOString();

    // AccessToken, refreshToken, expiresAt, tokenType, scope를 반환합니다.
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || null,
      expiresAt,
      tokenType: payload.token_type || "Bearer",
      scope: payload.scope || null,
    };
  } catch (error) {
    // 에러 발생 시 OAuth 에러를 발생시킵니다.
    throw sanitizeOAuthError(error);
  }
}

/**
 * 만료된 access token을 refresh token으로 갱신합니다.
 * provider가 refresh를 지원하지 않는다고 선언하면 token endpoint 호출 없이 재로그인을 요구합니다.
 *
 * @param {string} provider - OAuth 제공자 이름
 * @param {object} config - 설정 객체
 * @returns {Promise<object>} - 갱신된 토큰
 */
export async function refreshAccessToken(provider, config = {}) {
  // OAuth 제공자 설정을 가져옵니다.
  const providerConfig = getOAuthProviderConfig(provider);
  // refresh가 지원되지 않으면 재로그인을 요구합니다.
  if (providerConfig.supportsRefresh === false) {
    throw new Error(RELOGIN_REQUIRED_MESSAGE);
  }
  // tokenUrl이 없으면 에러를 발생시킵니다.
  if (!providerConfig.tokenUrl) {
    throw new Error(`${provider} OAuth token endpoint is not configured.`);
  }

  // Client 설정을 가져옵니다.
  const clientSettings = buildOAuthClientSettings(provider);
  // OAuth tokens를 가져옵니다.
  const tokens = loadOAuthTokens(provider);

  // refreshToken이 없으면 재로그인을 요구합니다.
  if (!tokens || !tokens.refreshToken) {
    throw new Error("OAuth session cannot be refreshed. Please login again.");
  }

  // refresh token을 request params에 추가합니다.
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", tokens.refreshToken);
  params.set("client_id", clientSettings.clientId);

  // clientSecret이 있으면 params에 추가합니다.
  if (clientSettings.clientSecret) {
    params.set("client_secret", clientSettings.clientSecret);
  }

  try {
    // token endpoint로 POST 요청을 보냅니다.
    const response = await fetch(providerConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
      signal: config.signal,
    });

    // 응답이 성공적이지 않으면 에러를 발생시킵니다.
    if (!response.ok) {
      // 401 또는 400 응답은 재로그인이 필요함을 의미합니다.
      if (response.status === 401 || response.status === 400) {
        throw new Error("OAuth refresh failed. Please login again.");
      }
      // 그 외의 응답은 에러 메시지를 포함합니다.
      throw new Error(`Token refresh failed with status ${response.status}`);
    }

    // 응답 본문을 JSON으로 파싱합니다.
    const payload = await response.json();
    // access_token이 없으면 에러를 발생시킵니다.
    if (!payload.access_token) {
      throw new Error("Refresh response did not return an access_token.");
    }

    // expires_in이 없으면 1시간을 기본값으로 설정합니다.
    const expiresInSeconds = payload.expires_in || 3600;
    // expiresAt을 설정합니다.
    const expiresAt = new Date(
      Date.now() + expiresInSeconds * 1000,
    ).toISOString();
    // 토큰을 갱신합니다.
    const updatedTokens = {
      ...tokens,
      accessToken: payload.access_token,
      expiresAt,
      refreshToken: payload.refresh_token || tokens.refreshToken,
    };
    // 토큰을 저장합니다.
    saveOAuthTokens(provider, updatedTokens);
    // 갱신된 토큰을 반환합니다.
    return updatedTokens;
  } catch (error) {
    // OAuth 에러를 발생시킵니다.
    throw sanitizeOAuthError(error);
  }
}

/**
 * 저장된 access token을 반환하고, 만료되었으면 안전 조건을 확인한 뒤 refresh를 시도합니다.
 *
 * @param {string} provider - OAuth 제공자 이름
 * @param {object} config - fetch 요청 옵션
 * @returns {Promise<string>} - 유효한 access token
 */
export async function getValidAccessToken(provider, config = {}) {
  // OAuth 제공자 설정을 가져옵니다.
  const providerConfig = getOAuthProviderConfig(provider);
  // OAuth tokens를 가져옵니다.
  const tokens = loadOAuthTokens(provider);

  // 토큰이 없으면 에러를 발생시킵니다.
  if (!tokens || !tokens.accessToken) {
    throw new Error(
      "Stored OAuth token is missing. Please complete OAuth login first.",
    );
  }

  // AccessToken이 만료되었는지 확인합니다.
  if (isAccessTokenExpired(tokens)) {
    // refresh가 지원되지 않으면 에러를 발생시킵니다.
    if (providerConfig.supportsRefresh === false) {
      throw new Error(RELOGIN_REQUIRED_MESSAGE);
    }
    // refreshToken이 없으면 에러를 발생시킵니다.
    if (!tokens.refreshToken) {
      throw new Error(
        "OAuth access token expired and no refresh token is available. Please login again.",
      );
    }
    // access token을 갱신합니다.
    const refreshed = await refreshAccessToken(provider, config);
    // 갱신된 access token을 반환합니다.
    return refreshed.accessToken;
  }

  // 유효한 access token을 반환합니다.
  return tokens.accessToken;
}

/**
 * 토큰 저장 인자를 정규화합니다.
 *
 * @param {string|object} provider - OAuth 제공자 이름 또는 객체
 * @param {object} tokens - 토큰 객체
 * @returns {object} - 정규화된 토큰 저장 인자
 */
function normalizeTokenSaveArgs(provider, tokens) {
  // provider가 객체이고 tokens가 없으면 객체에서 provider와 tokens를 추출합니다.
  if (provider && typeof provider === "object" && !tokens) {
    return {
      provider: provider.provider,
      tokens: provider.tokenSet || provider.tokens,
    };
  }

  // provider와 tokens가 있으면 그대로 반환합니다.
  return { provider, tokens };
}

/**
 * OAuth token을 credentials.json의 provider별 namespace에 저장합니다.
 * 저장 전 provider registry를 확인해서 임의 provider 이름으로 token이 쓰이지 않게 합니다.
 *
 * @param {string|object} provider - OAuth 제공자 이름 또는 객체
 * @param {object} tokens - 토큰 객체
 */
export function saveOAuthTokens(provider, tokens) {
  // 토큰 저장 인자를 정규화합니다.
  const { provider: finalProvider, tokens: finalTokens } =
    normalizeTokenSaveArgs(provider, tokens);

  // finalProvider가 없으면 에러를 발생시킵니다.
  if (!finalProvider) {
    throw new Error("OAuth provider name is required to save tokens");
  }
  // finalProvider가 유효한지 확인합니다.
  getOAuthProviderConfig(finalProvider);

  // finalTokens가 없거나 finalTokens.accessToken이 없으면 에러를 발생시킵니다.
  if (!finalTokens || !finalTokens.accessToken) {
    throw new Error("accessToken is required to save OAuth tokens");
  }

  // credentials.json을 불러옵니다.
  const credentials = loadCredentials();
  // oauth space를 불러옵니다.
  const oauthSpace = credentials.oauth || {};

  // oauth space에 finalProvider를 추가합니다.
  oauthSpace[finalProvider] = {
    accessToken: finalTokens.accessToken,
    refreshToken: finalTokens.refreshToken || null,
    expiresAt: finalTokens.expiresAt || null,
    tokenType: finalTokens.tokenType || "Bearer",
    scope: finalTokens.scope || null,
  };

  // credentials.json을 저장합니다.
  saveCredentials({
    ...credentials,
    oauth: oauthSpace,
  });
}

/**
 * provider별 OAuth token을 불러옵니다.
 * 등록되지 않은 OAuth provider는 조용히 null로 fallback하지 않고 명확히 거부합니다.
 *
 * @param {string} provider - OAuth 제공자 이름
 * @returns {object|null} - OAuth 토큰 객체
 */
export function loadOAuthTokens(provider) {
  // provider가 없으면 에러를 발생시킵니다.
  if (!provider) {
    throw new Error("OAuth provider name is required to load tokens");
  }
  // provider가 유효한지 확인합니다.
  getOAuthProviderConfig(provider);

  // credentials.json을 불러옵니다.
  const credentials = loadCredentials();
  // oauth space를 불러옵니다.
  return credentials?.oauth?.[provider] || null;
}

/**
 * provider별 OAuth token을 삭제합니다.
 * 삭제도 provider registry 검증을 거쳐 오타나 미지원 provider 조작을 막습니다.
 *
 * @param {string} provider - OAuth 제공자 이름
 */
export function clearOAuthTokens(provider) {
  // provider가 없으면 에러를 발생시킵니다.
  if (!provider) {
    throw new Error("OAuth provider name is required to clear tokens");
  }
  // provider가 유효한지 확인합니다.
  getOAuthProviderConfig(provider);

  // credentials.json을 불러옵니다.
  const credentials = loadCredentials();
  // oauth space에 provider가 있으면 삭제합니다.
  if (credentials.oauth && credentials.oauth[provider]) {
    delete credentials.oauth[provider];
    // credentials.json을 저장합니다.
    saveCredentials(credentials);
  }
}

/**
 * access token 만료 여부를 판정합니다.
 * 60초 clock skew를 둬서 만료 직전 token을 외부 API에 보내지 않게 합니다.
 *
 * @param {object} tokenRecord - OAuth 토큰 객체
 * @param {number} now - 현재 시간
 * @returns {boolean} - access token 만료 여부
 */
export function isAccessTokenExpired(tokenRecord, now = Date.now()) {
  // 토큰이 없으면 만료되었다고 판단합니다.
  if (!tokenRecord || !tokenRecord.accessToken || !tokenRecord.expiresAt) {
    return true;
  }

  // 만료 시간을 milliseconds로 변환합니다.
  const expireTime = new Date(tokenRecord.expiresAt).getTime();
  // 60초를 뺀 시간보다 현재 시간이 크거나 같으면 만료되었다고 판단합니다.
  return expireTime - 60000 <= now;
}

/**
 * OAuth 오류 메시지에서 token, code, client secret 같은 값을 제거합니다.
 * provider callback의 error/error_description은 원문이 공격자 입력일 수 있으므로 generic message로 대체합니다.
 *
 * @param {Error|string} error - OAuth 오류 메시지
 * @returns {Error} - 정제된 OAuth 오류 메시지
 */
export function sanitizeOAuthError(error) {
  // 문자열이 아니면 메시지를 추출합니다.
  const rawMessage = typeof error === "string" ? error : error?.message || "";

  // OAuth 콜백의 error 또는 error_description이 포함된 메시지에서 token, code, client secret 같은 값을 제거합니다.
  if (
    rawMessage === GENERIC_PROVIDER_AUTH_ERROR ||
    rawMessage.toLowerCase().includes("error_description")
  ) {
    return new Error(GENERIC_PROVIDER_AUTH_ERROR);
  }

  // OAuth 인증 오류 메시지에서 민감한 정보를 제거합니다.
  const cleanMessage = rawMessage
    .replace(/access_token=[^&\s]+/giu, "access_token=[REDACTED]")
    .replace(/refresh_token=[^&\s]+/giu, "refresh_token=[REDACTED]")
    .replace(/client_secret=[^&\s]+/giu, "client_secret=[REDACTED]")
    .replace(/code=[^&\s]+/giu, "code=[REDACTED]")
    .replace(/Bearer\s+[-._~+/=A-Za-z0-9]+/gu, "Bearer [REDACTED]");

  // OAuth 인증 실패 메시지를 반환합니다.
  return new Error(cleanMessage || "OAuth processing failed.");
}
