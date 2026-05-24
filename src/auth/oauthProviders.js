/**
 * 3차 고도화 OAuth 인증을 지원하는 Provider 정보 레지스트리입니다.
 * 보안 유지를 위해 Client ID 및 Client Secret 원문은 코드에 기록하지 않고 환경 변수 키 정보만 둡니다.
 */
export const OAUTH_PROVIDERS = {
  // 깃허브에 관한 설정들을 모아둔 곳입니다.
  // 추후에 깃허브와 관련된 기능이 추가된다면 이곳에 추가하면 됩니다.
  github: {
    // 깃허브에 대한 설정
    provider: "github",
    // 깃허브 로그인 페이지로 보내는 url입니다.
    authUrl: "https://github.com/login/oauth/authorize",
    // 깃허브 액세스 토큰을 발급받는 url입니다.
    tokenUrl: "https://github.com/login/oauth/access_token",
    // 깃허브 액세스 토큰 발급 시 필요한 스코프입니다.
    scopes: ["read:user"],
    // 깃허브 클라이언트 아이디와 클라이언트 시크릿을 저장하는 객체입니다.
    client: {
      idEnv: "CONVENTION_GITHUB_CLIENT_ID",
      secretEnv: "CONVENTION_GITHUB_CLIENT_SECRET",
      requiresSecret: true,
    },
    // PKCE 사용 여부
    supportsPKCE: true,
    // 토큰 갱신 여부
    supportsRefresh: false,
    // 기본 리다이렉트 포트
    defaultRedirectPort: 8765,
  },
  // 깃허브 코파일럿에 관한 설정들을 모아둔 곳입니다.
  // 추후에 깃허브 코파일럿과 관련된 기능이 추가된다면 이곳에 추가하면 됩니다.
  "github-copilot": {
    // 깃허브 코파일럿에 대한 설정
    provider: "github-copilot",
    // 깃허브 코파일럿 로그인 페이지로 보내는 url입니다.
    authUrl: "https://github.com/login/oauth/authorize",
    // 깃허브 코파일럿 액세스 토큰을 발급받는 url입니다.
    tokenUrl: "https://github.com/login/oauth/access_token",
    // 깃허브 코파일럿 액세스 토큰 발급 시 필요한 스코프입니다.
    scopes: ["read:user"],
    // 깃허브 코파일럿 클라이언트 아이디와 클라이언트 시크릿을 저장하는 객체입니다.
    client: {
      idEnv: "CONVENTION_GITHUB_CLIENT_ID",
      secretEnv: "CONVENTION_GITHUB_CLIENT_SECRET",
      requiresSecret: true,
    },
    // PKCE 사용 여부
    supportsPKCE: true,
    // 토큰 갱신 여부
    supportsRefresh: false,
    // 기본 리다이렉트 포트
    defaultRedirectPort: 8765,
  },
  // 구글 antigravity에 관한 설정들을 모아둔 곳입니다.
  // 추후에 구글과 관련된 기능이 추가된다면 이곳에 추가하면 됩니다.
  antigravity: {
    // 구글 antigravity에 대한 설정
    provider: "antigravity",
    // Antigravity OAuth endpoint는 공식 문서로 검증되기 전까지 추정 URL을 넣지 않습니다.
    // registry에는 남겨 token store namespace를 통제하되, 실제 OAuth flow는 oauthAvailable=false로 차단합니다.
    // 구글 antigravity 로그인 페이지로 보내는 url입니다.
    authUrl: null,
    // 구글 antigravity 액세스 토큰을 발급받는 url입니다.
    tokenUrl: null,
    // 구글 antigravity 액세스 토큰 발급 시 필요한 스코프입니다.
    scopes: [],
    // 구글 antigravity 클라이언트 아이디와 클라이언트 시크릿을 저장하는 객체입니다.
    client: {
      idEnv: "CONVENTION_ANTIGRAVITY_CLIENT_ID",
      secretEnv: "CONVENTION_ANTIGRAVITY_CLIENT_SECRET",
      requiresSecret: true,
    },
    // PKCE 사용 여부
    supportsPKCE: true,
    // 토큰 갱신 여부
    supportsRefresh: false,
    // OAuth 사용 가능 여부
    oauthAvailable: false,
    // 실험적 기능 사용 여부
    requiresExperimentalOptIn: true,
    // 기본 리다이렉트 포트
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
  // provider가 없거나 문자열이 아니거나 공백으로 구성되어 있으면 에러를 던집니다.
  if (
    !provider ||
    typeof provider !== "string" ||
    provider.trim().length === 0
  ) {
    throw new Error("OAuth provider is required");
  }

  // canonical name 비교를 위해 대소문자가 다르게 들어오는 경우를 정규화하지 않고 엄격하게 거부합니다.
  const config = OAUTH_PROVIDERS[provider];
  // provider가 존재하지 않으면 에러를 던집니다.
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
  // provider가 없으면 에러를 던집니다.
  if (!config) {
    throw new Error(`[${provider}] Provider configuration is missing`);
  }

  // Antigravity처럼 registry에는 있지만 공식 endpoint가 검증되지 않은 provider는
  // 안정 OAuth 설정 검증 대상에서 제외하고, 실제 flow는 호출부에서 명확히 차단합니다.
  if (config.oauthAvailable === false) {
    return true;
  }

  // 1. URL 검증 (authUrl, tokenUrl)
  for (const field of ["authUrl", "tokenUrl"]) {
    // authUrl과 tokenUrl을 가져옵니다.
    const urlValue = config[field];
    // urlValue가 문자열이 아니거나 공백이면 에러를 던집니다.
    if (typeof urlValue !== "string" || urlValue.trim().length === 0) {
      throw new Error(`[${provider}] ${field} is missing or empty`);
    }

    try {
      // authUrl과 tokenUrl을 파싱합니다.
      const parsedUrl = new URL(urlValue);
      // 운영 환경용 provider는 보안상 반드시 https 프로토콜을 사용해야 합니다.
      if (parsedUrl.protocol !== "https:") {
        throw new Error(`[${provider}] ${field} must use https: protocol`);
      }
    } catch (error) {
      // 에러 메시지에 민감 정보(query parameters 등)가 직접 노출되지 않도록 에러를 정화하여 던집니다.
      throw new Error(
        `[${provider}] ${field} is an invalid URL: ${field} must be a valid HTTPS URL`,
      );
    }
  }

  // 2. Scopes 검증
  const scopes = config.scopes;
  // scopes가 배열이 아니면 에러를 던집니다.
  if (!Array.isArray(scopes)) {
    throw new Error(`[${provider}] scopes must be an array`);
  }
  // scopes에 내용이 없으면 에러를 던집니다.
  if (scopes.length === 0) {
    throw new Error(`[${provider}] scopes must contain at least one scope`);
  }

  // 스코프 중복 방지를 위해 Set을 생성합니다.
  const seenScopes = new Set();
  // 중복이 제거된 정규화된 스코프를 저장할 배열을 생성합니다.
  const normalizedScopes = [];

  // 각 스코프를 순회합니다.
  for (const scope of scopes) {
    // 스코프가 문자열이 아니거나 공백이면 에러를 던집니다.
    if (typeof scope !== "string" || scope.trim().length === 0) {
      throw new Error(`[${provider}] scope items must be non-empty strings`);
    }

    // 민감한 정보(TOKEN, KEY, PW 등)가 포함되어 의심스러운 형태의 scope 문자열은 거절합니다.
    if (
      scope.toUpperCase().includes("TOKEN=") ||
      scope.toUpperCase().includes("SECRET=")
    ) {
      throw new Error(`[${provider}] scope contains highly sensitive pattern`);
    }

    // 중복 scope 제거하면서 순서 유지 (unique array)
    if (!seenScopes.has(scope)) {
      // 스코프를 Set에 추가합니다.
      seenScopes.add(scope);
      // 정규화된 스코프에 추가합니다.
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
  // provider에 해당하는 설정을 가져옵니다.
  const config = getOAuthProviderConfig(provider);
  // client 설정을 가져옵니다.
  const clientConfig = config.client;

  // clientConfig가 존재하지 않으면 에러를 던집니다.
  if (!clientConfig) {
    throw new Error(`[${provider}] Client configuration metadata is missing`);
  }

  // Client ID를 환경 변수에서 가져옵니다.
  const clientId = env[clientConfig.idEnv];
  // Client Secret을 환경 변수에서 가져옵니다.
  const clientSecret = env[clientConfig.secretEnv];

  // Client ID는 반드시 존재해야 합니다.
  if (typeof clientId !== "string" || clientId.trim().length === 0) {
    throw new Error(
      `[${provider}] OAuth Client ID environment variable (${clientConfig.idEnv}) is missing`,
    );
  }

  // confidential client의 경우 Client Secret이 반드시 필요합니다.
  if (clientConfig.requiresSecret) {
    // clientSecret이 문자열이 아니거나 공백이면 에러를 던집니다.
    if (typeof clientSecret !== "string" || clientSecret.trim().length === 0) {
      throw new Error(
        `[${provider}] OAuth Client Secret environment variable (${clientConfig.secretEnv}) is missing`,
      );
    }
  }

  // Client ID와 Client Secret을 반환합니다.
  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret ? clientSecret.trim() : undefined,
  };
}
