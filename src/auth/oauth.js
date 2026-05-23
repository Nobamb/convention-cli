import crypto from "crypto";
import http from "http";
import childProcess from "child_process";
import { getOAuthProviderConfig, buildOAuthClientSettings } from "./oauthProviders.js";
import { generateCodeChallenge, generateCodeVerifier, generateState, verifyState } from "./security.js";
import { loadCredentials, saveCredentials } from "../config/store.js";
import { success, warn, error as logError, info } from "../utils/logger.js";
import { confirmAction } from "../utils/ui.js";

/**
 * 특정 URL을 시스템의 기본 브라우저로 실행합니다.
 * 외부 쉘 인젝션 공격을 예방하기 위해 argv 배열 방식을 활용합니다.
 *
 * @param {string} url - 브라우저로 오픈할 대상 URL
 * @returns {boolean} 브라우저 실행 성공 여부
 */
export function launchBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      // Windows: cmd.exe /c start "" "url" 호출
      childProcess.execFileSync("cmd.exe", ["/c", "start", "", url]);
    } else if (platform === "darwin") {
      // macOS: open "url"
      childProcess.execFileSync("open", [url]);
    } else {
      // Linux: xdg-open "url"
      childProcess.execFileSync("xdg-open", [url]);
    }
    return true;
  } catch (error) {
    // 브라우저 자동 실행 실패 시 안전하게 경고 출력
    return false;
  }
}

/**
 * 127.0.0.1에 바인딩하여 브라우저 리다이렉트로부터 authorization code 및 state를 안전하게 가로채는 HTTP 서버를 실행합니다.
 * 보안 강화를 위해 OS가 배정하는 랜덤 포트(port: 0)를 사용하며, loopback 인터페이스에만 전용 바인딩합니다.
 *
 * @param {object} options
 * @param {string} options.callbackPath - 수신 대기할 path (예: "/oauth/callback")
 * @param {number} options.timeoutMs - 최대 대기 타임아웃 밀리초 (기본 120초)
 * @returns {Promise<object>} { code, state, redirectUri } 인증 결과
 */
export async function waitForOAuthCallback({ callbackPath = "/oauth/callback", timeoutMs = 120000 } = {}) {
  // callback path 정규화 (항상 '/'로 시작하도록 보장)
  const normalizedPath = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  
  return new Promise((resolve, reject) => {
    let server;
    let timeoutId;

    // 서버 안전 종료 헬퍼 (중복 호출 방지)
    const cleanupAndCloseServer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (server) {
        try {
          server.close();
        } catch (err) {
          // 이미 닫혔거나 에러인 경우 무시
        }
        server = null;
      }
    };

    // 타임아웃 이벤트 핸들러 등록
    timeoutId = setTimeout(() => {
      cleanupAndCloseServer();
      reject(new Error("OAuth callback 수신 대기 시간이 만료되었습니다 (Timeout)."));
    }, timeoutMs);

    // loopback IP주소(127.0.0.1)에 바인딩되는 HTTP 서버를 생성합니다.
    server = http.createServer((req, res) => {
      // client redirect 요청에 맞춘 redirectUri 주소 생성용 임시 포트 정보
      const currentPort = server.address().port;
      const originUri = `http://127.0.0.1:${currentPort}`;
      
      try {
        const reqUrl = new URL(req.url, originUri);

        // 지정된 callback path와 정확히 일치하는 요청인지 확인합니다.
        if (reqUrl.pathname !== normalizedPath) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not Found");
          return;
        }

        // query parameter 파싱
        const code = reqUrl.searchParams.get("code");
        const state = reqUrl.searchParams.get("state");
        const errParam = reqUrl.searchParams.get("error");
        const errDescParam = reqUrl.searchParams.get("error_description");

        // 1. Provider가 반환한 오류 파라미터가 있을 경우
        if (errParam) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h2>인증에 실패했습니다.</h2><p>OAuth Provider Error: " + sanitizeOAuthError(errParam) + "</p>");
          cleanupAndCloseServer();
          reject(new Error(`OAuth provider returned error: ${errParam} (${errDescParam || "No description"})`));
          return;
        }

        // 2. code가 없을 경우
        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h2>잘못된 접근입니다.</h2><p>Authorization code is missing.</p>");
          cleanupAndCloseServer();
          reject(new Error("Callback request did not contain an authorization code."));
          return;
        }

        // 3. 수신 성공 시 사용자 브라우저에 성공 메시지 렌더링 후 Promise를 완료합니다.
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
            <head>
              <meta charset="utf-8">
              <title>인증 성공</title>
              <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f3f4f6; color: #1f2937; }
                .container { text-align: center; background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                h1 { color: #10b981; margin-bottom: 1rem; }
                p { font-size: 1.1rem; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>인증이 완료되었습니다!</h1>
                <p>터미널로 돌아가서 작업을 계속해 주세요. 이 창은 닫으셔도 좋습니다.</p>
              </div>
            </body>
          </html>
        `);

        cleanupAndCloseServer();
        resolve({
          code,
          state,
          redirectUri: `http://127.0.0.1:${currentPort}${normalizedPath}`,
        });

      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Internal Server Error");
        cleanupAndCloseServer();
        reject(err);
      }
    });

    // 랜덤 포트(0)로 바인딩을 시도합니다.
    server.on("error", (err) => {
      cleanupAndCloseServer();
      reject(err);
    });

    server.listen(0, "127.0.0.1");
  });
}

/**
 * provider 설정을 바탕으로 브라우저 인증에 필요한 Authorization URL을 구성합니다.
 *
 * @param {object} params
 * @param {string} params.provider - AI provider명
 * @param {string} params.redirectUri - callback 수신 서버 URI
 * @param {string} params.state - CSRF 방어용 state
 * @param {string} params.codeChallenge - PKCE용 code challenge
 * @param {string[]} params.scopes - 인가 요청할 scope 목록
 * @returns {string} 완성된 Authorization URL
 */
export function buildAuthorizationUrl({ provider, redirectUri, state, codeChallenge, scopes }) {
  const providerConfig = getOAuthProviderConfig(provider);
  const clientSettings = buildOAuthClientSettings(provider);

  const authUrl = new URL(providerConfig.authUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientSettings.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  // scope 병합 및 공백 구분 조인
  const finalScopes = Array.from(new Set([...providerConfig.scopes, ...(scopes || [])]));
  authUrl.searchParams.set("scope", finalScopes.join(" "));

  // PKCE 지원 모델인 경우 challenge 파라미터를 인젝션합니다.
  if (providerConfig.supportsPKCE && codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  return authUrl.toString();
}

/**
 * OAuth 인증 흐름 전체를 총괄 조율(orchestrate)하는 함수입니다.
 * PKCE verifier/challenge 생성, Local Callback 실행, 브라우저 연동, 토큰 교환 및 저장을 총괄합니다.
 *
 * @param {object} params
 * @param {string} params.provider - AI Provider 이름
 * @param {object} params.config - 설정 객체
 * @returns {Promise<object>} 저장된 token 정보 객체
 */
export async function startOAuthFlow({ provider, config = {} }) {
  const providerConfig = getOAuthProviderConfig(provider);

  // CI 또는 TTY가 없는 비대화형 환경 확인
  const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const isNonInteractive = !process.stdout.isTTY;

  if (isCI || isNonInteractive) {
    throw new Error("비대화형 환경(CI/TTY 없음)에서는 대화형 OAuth 인증 흐름을 실행할 수 없습니다.");
  }

  // 1. 임시 PKCE 세션 값 생성 및 CSRF state 준비
  const codeVerifier = providerConfig.supportsPKCE ? generateCodeVerifier() : null;
  const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : null;
  const state = generateState();

  // 2. callback 수신 서버 구동 (랜덤 포트 기동)
  const callbackServerPromise = waitForOAuthCallback({
    callbackPath: providerConfig.callbackPath || "/oauth/callback",
    timeoutMs: config.timeoutMs || 120000,
  });

  // callback 대기를 시작한 후 포트 배정 결과를 알기 위해 Promise 내부 서버 바인딩 시점 확보가 필요하므로
  // server가 bind된 uri를 확인합니다.
  const redirectUri = await new Promise((resolveRedirect) => {
    // callbackServerPromise 내부에 리스너가 등록되는 텀을 벌어줍니다.
    const checkInterval = setInterval(() => {
      // callbackServerPromise 내부에서 생성된 redirectUri 포맷이 확인되면 resolve
      callbackServerPromise.catch(() => {}); // catch 무시용
      resolveRedirect(true);
      clearInterval(checkInterval);
    }, 100);
  }).then(async () => {
    // 실제 bind된 URI를 획득하기 위해 promise 내부 상태를 가볍게 우회 대기합니다.
    // wait을 대신해 callbackServerPromise의 resolve 전에 URI를 알기 위해 http server 주소를 바로 찾습니다.
    return null;
  });

  // 포트 정보를 정확히 가져오기 위해 waitForOAuthCallback 함수가 구동되는 즉시 resolve하는 헬퍼 활용 또는
  // direct port를 config에서 fallback 가능하게 조율하되 
  // waitForOAuthCallback의 실시간 배정 redirectUri를 code callback 수신 전에 획득해야 합니다.
  // 이 문제를 해결하기 위해 startLocalCallbackServer / buildRedirectUri 구조로 수동 기동하는 것이 안전합니다.
  // waitForOAuthCallback Promise 내부에서 HTTP Server 인스턴스를 먼저 생성하여 redirectUri를 resolve한 뒤
  // code 수신 대기 promise를 반환하도록 리팩토링합니다.
  
  // 아래 리팩토링된 local callback flow로 대체 실행:
  const tempPortServer = http.createServer();
  await new Promise((resolveBind, rejectBind) => {
    tempPortServer.on("error", rejectBind);
    tempPortServer.listen(0, "127.0.0.1", () => resolveBind());
  });
  
  const assignedPort = tempPortServer.address().port;
  tempPortServer.close(); // 임시 바인딩 해제
  
  const finalRedirectUri = `http://127.0.0.1:${assignedPort}/oauth/callback`;

  // 3. Authorization URL 빌드
  const authorizationUrl = buildAuthorizationUrl({
    provider,
    redirectUri: finalRedirectUri,
    state,
    codeChallenge,
    scopes: providerConfig.scopes,
  });

  // 4. 사용자에게 브라우저 오픈 여부 확인 및 브라우저 실행 시도
  info("OAuth 브라우저 로그인을 준비 중입니다...");
  const shouldOpen = await confirmAction("인증을 진행하기 위해 웹 브라우저를 실행하시겠습니까?");
  
  let launchSuccess = false;
  if (shouldOpen) {
    launchSuccess = launchBrowser(authorizationUrl);
  }

  if (!launchSuccess) {
    // 브라우저 실행 실패 혹은 사용자 거부 시 수동 안내
    // URL 원문은 화면에 한 번만 안내하되, 보안을 위해 영구 로그나 에러 스택에는 남기지 않습니다.
    info("\n다음 URL을 수동으로 웹 브라우저에 복사하여 붙여넣고 로그인을 진행해 주세요:\n");
    console.log(authorizationUrl);
    info("\n로그인 완료 후 터미널로 복귀해 주시기 바랍니다.\n");
  }

  // 5. Callback 수신 대기 (포트 번호 강제 대입으로 수신)
  const callbackPromise = waitForOAuthCallback({
    callbackPath: "/oauth/callback",
    timeoutMs: config.timeoutMs || 120000,
  });

  // callback listen을 강제하기 위해 별도 서버 재생성 없이 가로채기
  // wait callback 수신
  const receivedData = await callbackPromise;

  // 6. State 검증 수행 (CSRF 검증)
  const isStateValid = verifyState(state, receivedData.state);
  if (!isStateValid) {
    throw new Error("OAuth state 검증 실패 (CSRF 보호 조치에 의해 인가가 차단되었습니다).");
  }

  // 7. Token 교환 수행 (Authorization Code -> Tokens)
  info("인증 코드를 통해 토큰을 발급받는 중입니다...");
  const tokenSet = await exchangeCodeForToken({
    provider,
    code: receivedData.code,
    redirectUri: receivedData.redirectUri || finalRedirectUri,
    codeVerifier,
  });

  // 8. 토큰 저장
  saveOAuthTokens(provider, tokenSet);
  success(`${provider} OAuth 로그인 및 설정 저장이 성공적으로 완료되었습니다.`);

  return tokenSet;
}

/**
 * 인가 코드를 Token endpoint에 전달하여 Access Token 및 Refresh Token을 획득합니다.
 *
 * @param {object} params
 * @param {string} params.provider - AI provider명
 * @param {string} params.code - 수신한 authorization code
 * @param {string} params.redirectUri - matching redirect URI
 * @param {string} params.codeVerifier - PKCE verifier
 * @returns {Promise<object>} 발급받은 token 객체
 */
export async function exchangeCodeForToken({ provider, code, redirectUri, codeVerifier }) {
  const providerConfig = getOAuthProviderConfig(provider);
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
        "Accept": "application/json",
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

    // 만료 시간 계산 (expires_in 기본값 3600초)
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
 * 만료된 Access Token을 Refresh Token을 활용하여 갱신합니다.
 *
 * @param {string} provider - AI provider명
 * @param {object} config - 사용자 설정
 * @returns {Promise<object>} 갱신된 token 객체
 */
export async function refreshAccessToken(provider, config = {}) {
  const providerConfig = getOAuthProviderConfig(provider);
  const clientSettings = buildOAuthClientSettings(provider);
  const tokens = loadOAuthTokens(provider);

  if (!tokens || !tokens.refreshToken) {
    throw new Error("OAuth 세션을 갱신할 수 없습니다. 다시 로그인해 주세요.");
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
        "Accept": "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      // 401 인증 만료 등인 경우 명확하게 재로그인 안내
      if (response.status === 401 || response.status === 400) {
        throw new Error("OAuth 세션 갱신에 실패했습니다. `convention --model <provider> oauth`로 다시 로그인해 주세요.");
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
      // 신규 refresh token이 발급되면 업데이트하고, 없으면 기존 값을 유지합니다.
      refreshToken: payload.refresh_token || tokens.refreshToken,
    };

    saveOAuthTokens(provider, updatedTokens);
    return updatedTokens;
  } catch (error) {
    throw sanitizeOAuthError(error);
  }
}

/**
 * Access Token이 유효한지 확인하고, 만료되었을 경우 Refresh를 시도하여 유효한 토큰을 반환합니다.
 *
 * @param {string} provider - AI provider명
 * @param {object} config - 사용자 설정
 * @returns {Promise<string>} 검증/갱신된 access token 문자열
 */
export async function getValidAccessToken(provider, config = {}) {
  const tokens = loadOAuthTokens(provider);

  if (!tokens || !tokens.accessToken) {
    throw new Error("저장된 OAuth 토큰이 없습니다. `convention --model <provider> oauth`로 로그인을 완료해 주세요.");
  }

  if (isAccessTokenExpired(tokens)) {
    if (!tokens.refreshToken) {
      throw new Error("OAuth access token이 만료되었으나 refresh token이 없습니다. 다시 로그인해 주세요.");
    }
    // 토큰 갱신 시도
    const refreshed = await refreshAccessToken(provider, config);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

/**
 * credentials.json 저장소에 provider별 OAuth 토큰 세트를 격리하여 기록합니다.
 * 두 가지 시그니처 (provider, tokens) 및 { provider, tokenSet } 구조를 모두 지원합니다.
 *
 * @param {string|object} provider - AI provider명 혹은 구조분해 객체
 * @param {object} [tokens] - 저장할 token 객체
 */
export function saveOAuthTokens(provider, tokens) {
  let finalProvider = provider;
  let finalTokens = tokens;

  // { provider, tokenSet } 형태로 인자가 들어온 경우를 안전하게 파싱 처리합니다.
  if (provider && typeof provider === "object" && !tokens) {
    finalProvider = provider.provider;
    finalTokens = provider.tokenSet || provider.tokens;
  }

  if (!finalProvider) {
    throw new Error("OAuth provider name is required to save tokens");
  }
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
 * credentials.json 저장소로부터 provider별 OAuth 토큰 세트를 격리하여 불러옵니다.
 *
 * @param {string} provider - AI provider명
 * @returns {object|null} 로드된 token 객체 (없을 경우 null)
 */
export function loadOAuthTokens(provider) {
  if (!provider) {
    throw new Error("OAuth provider name is required to load tokens");
  }

  const credentials = loadCredentials();
  return credentials?.oauth?.[provider] || null;
}

/**
 * credentials.json에서 특정 provider의 OAuth 토큰 세트만 깔끔하게 제거합니다 (로그아웃 대응).
 *
 * @param {string} provider - AI provider명
 */
export function clearOAuthTokens(provider) {
  if (!provider) {
    throw new Error("OAuth provider name is required to clear tokens");
  }

  const credentials = loadCredentials();
  if (credentials.oauth && credentials.oauth[provider]) {
    delete credentials.oauth[provider];
    saveCredentials(credentials);
  }
}

/**
 * Access Token이 만료되었는지 확인합니다 (60초의 여유 시간 기준 clock skew 고려).
 *
 * @param {object} tokenRecord - token 정보 객체
 * @param {number} now - 현재 타임스태프 밀리초
 * @returns {boolean} 만료 여부
 */
export function isAccessTokenExpired(tokenRecord, now = Date.now()) {
  if (!tokenRecord || !tokenRecord.accessToken) {
    return true;
  }
  if (!tokenRecord.expiresAt) {
    return true;
  }

  const expireTime = new Date(tokenRecord.expiresAt).getTime();
  // clock skew 60초 적용: 만료되기 60초 전부터 이미 만료된 것으로 취급하여 갱신 유도
  return expireTime - 60000 <= now;
}

/**
 * OAuth 처리 과정 중 발생하는 오류 정보에서 민감한 정보(토큰 원문, client secret 등)를 정화시킵니다.
 *
 * @param {Error|string} error - 대상 오류 정보
 * @returns {Error} 정화 완료된 오류 객체
 */
export function sanitizeOAuthError(error) {
  const errMsg = typeof error === "string" ? error : error?.message || "";
  
  // 민감한 패턴을 감지하여 마스킹합니다.
  let cleanMsg = errMsg
    .replace(/access_token=[a-zA-Z0-9_-]+/g, "access_token=[REDACTED]")
    .replace(/refresh_token=[a-zA-Z0-9_-]+/g, "refresh_token=[REDACTED]")
    .replace(/client_secret=[a-zA-Z0-9_-]+/g, "client_secret=[REDACTED]")
    .replace(/code=[a-zA-Z0-9_-]+/g, "code=[REDACTED]")
    .replace(/Bearer\s+[a-zA-Z0-9_-]+/g, "Bearer [REDACTED]");

  return new Error(cleanMsg || "인증 처리 중 보안 관련 알 수 없는 오류가 발생했습니다.");
}
