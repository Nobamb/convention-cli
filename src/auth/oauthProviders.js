/**
 * 3차 고도화 OAuth 인증을 지원하는 Provider 정보 레지스트리입니다.
 * 보안 유지를 위해 Client ID 및 Client Secret 원문은 코드에 기록하지 않고 환경 변수 키 정보만 둡니다.
 */
export const OAUTH_PROVIDERS = {
  github: {
    provider: "github",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user"],
    client: {
      idEnv: "CONVENTION_GITHUB_CLIENT_ID",
      secretEnv: "CONVENTION_GITHUB_CLIENT_SECRET",
      requiresSecret: true,
    },
    supportsPKCE: true,
    supportsRefresh: false,
    defaultRedirectPort: 8765,
  },
  "github-copilot": {
    provider: "github-copilot",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user"],
    client: {
      idEnv: "CONVENTION_GITHUB_CLIENT_ID",
      secretEnv: "CONVENTION_GITHUB_CLIENT_SECRET",
      requiresSecret: true,
    },
    supportsPKCE: true,
    supportsRefresh: false,
    defaultRedirectPort: 8765,
  },
  antigravity: {
    provider: "antigravity",
    authUrl: "https://accounts.antigravity.ai/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.antigravity.ai/token",
    scopes: ["https://api.antigravity.ai/auth/cli"],
    client: {
      idEnv: "CONVENTION_ANTIGRAVITY_CLIENT_ID",
      secretEnv: "CONVENTION_ANTIGRAVITY_CLIENT_SECRET",
      requiresSecret: true,
    },
    supportsPKCE: true,
    supportsRefresh: true,
    defaultRedirectPort: 8766,
  },
};

/**
 * 지정한 provider 이름에 따른 OAuth 설정을 복제하여 조회합니다.
 * 등록되지 않은 provider가 입력된 경우 절대 조용히 mock으로 fallback하지 않고 명확한 오류로 중단시킵니다.
 *
 * @param {string} provider - provider 식별 이름 (예: "github", "antigravity")
 * @returns {object} 복제된 provider OAuth 설정 객체
 * @throws {Error} provider가 제공되지 않거나 지원하지 않는 경우
 */
export function getOAuthProviderConfig(provider) {
  if (!provider || typeof provider !== "string" || provider.trim().length === 0) {
    throw new Error("OAuth provider is required");
  }

  // canonical name 비교를 위해 대소문자가 다르게 들어오는 경우를 정규화하지 않고 엄격하게 거부합니다.
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  // registry 내부 원본 객체가 오염되는 것을 막기 위해 딥카피 형태로 설정 복사본을 반환합니다.
  return JSON.parse(JSON.stringify(config));
}

/**
 * OAuth 인증이 등록된 모든 provider 목록을 조회합니다.
 *
 * @returns {string[]} 지원되는 OAuth provider 이름 배열
 */
export function listOAuthProviders() {
  return Object.keys(OAUTH_PROVIDERS);
}

/**
 * Provider의 정적 설정(URL, Scope 등)이 유효한지 검증합니다.
 *
 * @param {string} provider - provider 이름
 * @param {object} config - 검증할 provider 설정 객체
 * @returns {boolean} 유효한 설정인 경우 true 반환
 * @throws {Error} 설정이 유효하지 않을 경우
 */
export function validateOAuthProviderConfig(provider, config) {
  if (!config) {
    throw new Error(`[${provider}] Provider configuration is missing`);
  }

  // 1. URL 검증 (authUrl, tokenUrl)
  for (const field of ["authUrl", "tokenUrl"]) {
    const urlValue = config[field];
    if (typeof urlValue !== "string" || urlValue.trim().length === 0) {
      throw new Error(`[${provider}] ${field} is missing or empty`);
    }

    try {
      const parsedUrl = new URL(urlValue);
      // 운영 환경용 provider는 보안상 반드시 https 프로토콜을 사용해야 합니다.
      if (parsedUrl.protocol !== "https:") {
        throw new Error(`[${provider}] ${field} must use https: protocol`);
      }
    } catch (error) {
      // 에러 메시지에 민감 정보(query parameters 등)가 직접 노출되지 않도록 에러를 정화하여 던집니다.
      throw new Error(`[${provider}] ${field} is an invalid URL: ${field} must be a valid HTTPS URL`);
    }
  }

  // 2. Scopes 검증
  const scopes = config.scopes;
  if (!Array.isArray(scopes)) {
    throw new Error(`[${provider}] scopes must be an array`);
  }
  if (scopes.length === 0) {
    throw new Error(`[${provider}] scopes must contain at least one scope`);
  }

  const seenScopes = new Set();
  const normalizedScopes = [];

  for (const scope of scopes) {
    if (typeof scope !== "string" || scope.trim().length === 0) {
      throw new Error(`[${provider}] scope items must be non-empty strings`);
    }

    // 민감한 정보(TOKEN, KEY, PW 등)가 포함되어 의심스러운 형태의 scope 문자열은 거절합니다.
    if (scope.toUpperCase().includes("TOKEN=") || scope.toUpperCase().includes("SECRET=")) {
      throw new Error(`[${provider}] scope contains highly sensitive pattern`);
    }

    // 중복 scope 제거하면서 순서 유지 (unique array)
    if (!seenScopes.has(scope)) {
      seenScopes.add(scope);
      normalizedScopes.push(scope);
    }
  }

  // 중복이 제거된 정규화된 scope로 업데이트해 줍니다.
  config.scopes = normalizedScopes;

  return true;
}

/**
 * 환경 변수로부터 OAuth Client ID 및 Client Secret을 안전하게 읽어옵니다.
 *
 * @param {string} provider - provider 이름
 * @param {object} env - 환경변수 객체 (기본값: process.env)
 * @returns {object} { clientId, clientSecret }
 * @throws {Error} 필수 환경 변수가 정의되지 않았을 경우
 */
export function buildOAuthClientSettings(provider, env = process.env) {
  const config = getOAuthProviderConfig(provider);
  const clientConfig = config.client;

  if (!clientConfig) {
    throw new Error(`[${provider}] Client configuration metadata is missing`);
  }

  const clientId = env[clientConfig.idEnv];
  const clientSecret = env[clientConfig.secretEnv];

  // Client ID는 반드시 존재해야 합니다.
  if (typeof clientId !== "string" || clientId.trim().length === 0) {
    throw new Error(`[${provider}] OAuth Client ID environment variable (${clientConfig.idEnv}) is missing`);
  }

  // confidential client의 경우 Client Secret이 반드시 필요합니다.
  if (clientConfig.requiresSecret) {
    if (typeof clientSecret !== "string" || clientSecret.trim().length === 0) {
      throw new Error(`[${provider}] OAuth Client Secret environment variable (${clientConfig.secretEnv}) is missing`);
    }
  }

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret ? clientSecret.trim() : undefined,
  };
}
