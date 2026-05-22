# W. OAuth Architecture Agent 구현 계획

## 작업 범위

W 단계는 OAuth Architecture Agent로서 OAuth 인증의 공통 구조를 설계하는 작업만 담당한다.

구현 대상은 다음 파일을 기준으로 한다.

- `src/auth/oauth.js`
- `src/auth/oauthProviders.js`
- `src/config/store.js`

이번 문서 작업에서는 실제 구현 파일을 수정하지 않고, 이후 X, Y, Z, AA, AB, AC 단계가 공통 구조 위에서 확장할 수 있도록 아키텍처 계획만 정리한다.

## 핵심 원칙

OAuth 구조는 API Key 방식과 동일하게 secret을 일반 설정과 분리해야 한다.

- OAuth access token, refresh token, id token은 `config.json`에 저장하지 않는다.
- token 계열 값은 `credentials.json` 계층에만 저장한다.
- `config.json`에는 provider, authType, modelVersion, baseURL처럼 secret이 아닌 선택 정보만 저장한다.
- provider가 지원되지 않으면 mock provider로 fallback하지 않고 명확한 오류로 중단한다.
- token, authorization code, client secret, raw callback query, credentials 원문은 로그에 출력하지 않는다.
- OAuth 인증은 diff 전송 및 commit flow와 분리된 인증 설정 흐름으로 취급한다.

## 선행 조건

W 단계는 Phase 5 OAuth 인증의 첫 단계다. 이후 단계는 다음과 같이 W 단계의 공통 구조를 사용한다.

- X: provider별 OAuth client 설정 보강
- Y: localhost callback 수신 구현
- Z: PKCE/state 생성 및 검증 구현
- AA: OAuth token 저장소 구현
- AB: access token refresh 구현
- AC: provider 호출에 OAuth token 연결

W 단계에서는 provider별 세부 API를 완성하지 않고, 공통 인터페이스와 책임 경계를 먼저 정의한다.

## `src/auth/oauthProviders.js` 계획

`oauthProviders.js`는 provider별 OAuth metadata만 관리한다. token 저장, callback 처리, refresh 실행 같은 runtime 흐름은 이 파일에 넣지 않는다.

권장 export는 다음과 같다.

```js
export const OAUTH_PROVIDERS = {
  github: {
    provider: "github",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    scopes: ["read:user"],
    supportsPKCE: true,
    supportsRefresh: false,
    defaultRedirectPort: 8765
  }
};

export function getOAuthProvider(providerName)
export function isOAuthProviderSupported(providerName)
```

provider 설정은 다음 정보를 포함한다.

- `provider`: 내부 provider 이름
- `authorizationEndpoint`: authorization URL 생성 대상
- `tokenEndpoint`: authorization code 교환 대상
- `scopes`: 기본 scope 목록
- `supportsPKCE`: PKCE 적용 가능 여부
- `supportsRefresh`: refresh token 지원 여부
- `defaultRedirectPort`: localhost callback 기본 port
- `clientIdEnvKey`: 필요 시 client id를 읽을 환경 변수 이름
- `requiresClientSecret`: confidential client 여부

지원하지 않는 provider 요청은 `getOAuthProvider()`에서 명확한 오류를 던진다. 알 수 없는 provider를 `mock`, `localLLM` 또는 다른 provider로 대체하지 않는다.

## `src/auth/oauth.js` 계획

`oauth.js`는 OAuth flow의 orchestration만 담당한다. provider metadata는 `oauthProviders.js`에서 읽고, secret 저장은 `src/config/store.js`의 credentials 함수로 위임한다.

권장 함수는 다음과 같다.

```js
export async function startOAuthFlow({ provider, config })
export function buildAuthorizationUrl({ provider, redirectUri, state, codeChallenge, scopes })
export async function handleCallback({ provider, callbackUrl, expectedState, codeVerifier })
export async function exchangeCodeForToken({ provider, code, redirectUri, codeVerifier })
export async function saveOAuthTokens({ provider, tokenSet })
export async function loadOAuthTokens(provider)
export async function refreshAccessToken({ provider, config })
export function sanitizeOAuthError(error)
```

각 함수의 책임은 다음과 같다.

- `startOAuthFlow()`: provider 설정 조회, PKCE/state 준비, authorization URL 생성, callback 처리 흐름으로 연결한다.
- `buildAuthorizationUrl()`: provider metadata와 인증 파라미터를 기반으로 URL만 생성한다.
- `handleCallback()`: callback URL에서 code/state를 파싱하고 state 검증 실패 시 token 교환을 차단한다.
- `exchangeCodeForToken()`: authorization code를 token endpoint로 교환한다.
- `saveOAuthTokens()`: tokenSet을 credentials 계층에만 저장한다.
- `loadOAuthTokens()`: provider별 tokenSet을 credentials에서만 읽는다.
- `refreshAccessToken()`: refresh token 기반 갱신만 담당하고 일반 token 저장 로직과 분리한다.
- `sanitizeOAuthError()`: token, code, secret, callback query 원문을 제거한 오류 메시지를 만든다.

## Authorization URL 생성 구조

authorization URL 생성은 순수 함수에 가깝게 유지한다.

입력:

- provider 이름
- redirect URI
- state
- code challenge
- scope 목록
- 선택적 prompt/access_type 같은 provider별 추가 파라미터

출력:

- 브라우저로 열 수 있는 authorization URL 문자열

필수 규칙:

- `state`는 항상 포함한다.
- provider가 PKCE를 지원하면 `code_challenge`와 `code_challenge_method=S256`을 포함한다.
- scope는 provider 설정의 기본값과 명령 흐름에서 추가된 값을 병합하되 중복을 제거한다.
- URL 전체를 debug 로그에 출력하지 않는다. 출력이 필요하면 host와 provider 이름만 표시한다.

## Callback 처리 구조

callback 처리는 Y, Z 단계에서 실제 local server와 security 모듈이 붙을 수 있도록 경계를 분리한다.

처리 순서:

1. callback URL 수신
2. query에서 `code`, `state`, `error` 추출
3. provider가 반환한 `error`가 있으면 secret 없는 오류로 중단
4. expected state와 callback state 비교
5. state 불일치 시 token endpoint 호출 없이 중단
6. authorization code를 token 교환 함수로 전달
7. token 응답을 credentials 저장 함수로 전달

주의 사항:

- callback URL 전체를 로그에 출력하지 않는다.
- authorization code를 logger에 전달하지 않는다.
- state 검증 실패는 보안 오류로 취급한다.
- callback timeout은 token 저장 없이 안전하게 종료한다.

## Token 저장 구조

OAuth token 저장은 `config.json`과 분리한다.

권장 credentials 구조:

```json
{
  "oauth": {
    "github": {
      "accessToken": "[SECRET]",
      "refreshToken": "[SECRET]",
      "expiresAt": "2026-05-19T12:00:00.000Z",
      "scope": "read:user",
      "tokenType": "Bearer"
    }
  }
}
```

저장 규칙:

- `saveCredentials()` 또는 OAuth 전용 wrapper를 통해 `credentials.json`에만 저장한다.
- `config.json`에는 token, refresh token, authorization code, client secret을 저장하지 않는다.
- provider별 token은 서로 덮어쓰지 않도록 provider 이름 아래에 분리한다.
- credentials 저장 성공 메시지에도 token 값은 포함하지 않는다.
- credentials 파일 권한 제한은 AA 단계에서 구현하되, W 단계 구조에서 이를 전제로 둔다.

## Refresh 분리 구조

refresh는 일반 token 교환과 분리한다.

권장 흐름:

1. provider별 tokenSet 로드
2. `expiresAt` 또는 provider 응답 기준으로 만료 여부 판단
3. refresh token 존재 여부 확인
4. provider가 `supportsRefresh`인지 확인
5. refresh endpoint 요청
6. 새 tokenSet을 credentials 계층에 저장
7. refresh 실패 시 재로그인 안내 오류 반환

분리 이유:

- provider 호출 중 자동 refresh가 필요해도 callback 처리 로직에 의존하지 않게 한다.
- refresh token이 없는 provider를 명확히 처리한다.
- refresh 실패가 mock fallback이나 API Key fallback으로 숨겨지지 않게 한다.

## Config와 Credentials 경계

`config.json` 허용 정보:

- `provider`
- `authType: "oauth"`
- `modelDisplayName`
- `modelVersion`
- `baseURL`
- OAuth 사용 여부를 나타내는 비밀이 아닌 플래그

`credentials.json` 전용 정보:

- `accessToken`
- `refreshToken`
- `idToken`
- `clientSecret`
- authorization code 임시 저장값
- token 만료 시각과 scope 등 tokenSet metadata

임시 PKCE verifier와 state는 가능하면 메모리에서만 유지한다. 파일 저장이 필요해지는 경우에도 credentials 또는 별도 임시 저장소에 제한하고 `config.json`에는 저장하지 않는다.

## 오류 처리 계획

OAuth 오류는 보안을 우선한다.

- 지원하지 않는 OAuth provider: 명확한 오류로 중단
- provider metadata 누락: mock fallback 없이 중단
- state 검증 실패: token 교환 없이 중단
- token endpoint 실패: 응답 원문 전체를 출력하지 않고 상태와 요약만 표시
- refresh 실패: 기존 token 원문을 출력하지 않고 재로그인 필요 메시지 표시
- credentials 저장 실패: 경로와 권한 문제를 요약하되 credentials 내용은 출력하지 않음

## 보안 기준

W 단계 구조는 다음 기준을 반드시 만족해야 한다.

- OAuth token은 credentials 계층에만 저장한다.
- `config.json`에 token, refresh token, authorization code, client secret이 들어가지 않는다.
- 로그에 token, raw secret, callback URL 전체, credentials 원문이 출력되지 않는다.
- 지원하지 않는 provider를 mock으로 fallback하지 않는다.
- 외부 요청 실패가 commit flow 또는 Git 히스토리 변경으로 이어지지 않는다.
- Git 명령이 필요한 경우에는 `execFileSync` 또는 `spawnSync`의 argv 배열 방식을 사용한다.

## 완료 기준

- provider별 OAuth 설정이 `oauthProviders.js`에서 확장 가능한 구조로 정의된다.
- authorization URL 생성 책임이 `oauth.js`에 명확히 분리된다.
- callback 처리와 state 검증 경계가 token 교환보다 앞에 위치한다.
- token 저장은 credentials 계층으로만 위임된다.
- refresh 흐름은 최초 token 교환 흐름과 분리된다.
- unsupported OAuth provider는 명확한 오류로 중단하고 mock fallback하지 않는다.
