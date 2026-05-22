# X. OAuth Provider Config Agent 구현 계획

## 작업 범위

X 단계는 OAuth Provider Config Agent로서 provider별 OAuth 설정을 `src/auth/oauthProviders.js`에서 분리 관리하도록 설계하는 작업만 담당한다.

구현 대상은 다음 설정이다.

- `authUrl`
- `tokenUrl`
- `scopes`
- OAuth client 설정
- provider 설정 조회 함수
- provider 설정 검증 함수

이 단계는 OAuth callback 서버, PKCE/state 생성, token 저장, refresh, 실제 provider API 호출을 구현하지 않는다. 해당 기능은 Y, Z, AA, AB, AC 단계에서 이어서 구현한다.

## 선행 조건

X 단계는 W 단계 OAuth Architecture Agent의 공통 구조를 전제로 한다.

- `src/auth/oauth.js`는 OAuth 흐름을 조율한다.
- `src/auth/oauthProviders.js`는 provider별 정적 설정과 검증 로직을 제공한다.
- OAuth token은 `config.json`이 아니라 credentials 계층에 저장한다.
- provider 설정 오류는 mock provider로 fallback하지 않고 명확한 오류로 중단한다.

## 생성 또는 수정 대상 파일

실제 구현 시 예상 수정 파일은 다음 하나로 제한한다.

- `src/auth/oauthProviders.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, X 단계 구현 계획과 테스트 계획만 정리한다.

## Provider 설정 구조 계획

`src/auth/oauthProviders.js`는 provider별 OAuth 설정을 하나의 registry로 관리한다.

권장 구조는 다음과 같다.

```js
export const OAUTH_PROVIDERS = {
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user"],
    client: {
      idEnv: "CONVENTION_GITHUB_CLIENT_ID",
      secretEnv: "CONVENTION_GITHUB_CLIENT_SECRET",
      requiresSecret: true
    }
  },
  gemini: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/generative-language"],
    client: {
      idEnv: "CONVENTION_GEMINI_CLIENT_ID",
      secretEnv: "CONVENTION_GEMINI_CLIENT_SECRET",
      requiresSecret: true
    }
  }
};
```

실제 provider 이름은 기존 `PROVIDERS`와 고도화 문서의 지원 범위를 기준으로 확정한다. 최소한 OAuth를 지원할 provider만 등록하고, OAuth 미지원 provider는 registry에 넣지 않는다.

## 권장 함수

`src/auth/oauthProviders.js`에는 다음 함수를 둔다.

```js
export function getOAuthProviderConfig(provider)
export function listOAuthProviders()
export function validateOAuthProviderConfig(provider, config)
export function buildOAuthClientSettings(provider, env = process.env)
```

각 함수의 역할은 다음과 같다.

- `getOAuthProviderConfig(provider)`: provider 이름으로 OAuth 설정을 조회한다.
- `listOAuthProviders()`: OAuth 설정이 등록된 provider 이름 목록을 반환한다.
- `validateOAuthProviderConfig(provider, config)`: URL, scopes, client 설정이 유효한지 검증한다.
- `buildOAuthClientSettings(provider, env)`: 환경 변수에서 client id와 필요한 경우 client secret 존재 여부를 확인한다.

## Unsupported Provider 처리

지원하지 않는 provider는 절대 `mock`으로 fallback하지 않는다.

처리 규칙은 다음과 같다.

- provider 값이 없으면 `OAuth provider is required`와 같이 명확한 오류로 중단한다.
- registry에 없는 provider면 `Unsupported OAuth provider: <provider>` 형태의 오류로 중단한다.
- `mock`, `localLLM`처럼 OAuth 대상이 아닌 provider가 들어와도 fallback 없이 실패한다.
- 오류 메시지에는 API Key, OAuth token, client secret, credentials 파일 내용이 포함되지 않아야 한다.

이 정책은 외부 전송 정책 누락이나 잘못된 provider 설정을 숨기지 않기 위한 보안 규칙이다.

## URL 검증 계획

`authUrl`과 `tokenUrl`은 다음 조건을 만족해야 한다.

- 문자열이어야 한다.
- `new URL(value)`로 파싱 가능해야 한다.
- 운영 provider 설정은 `https:`를 기본으로 한다.
- localhost 개발용 provider를 허용할 경우 명시적으로 예외 처리한다.
- 빈 문자열, 상대 경로, `javascript:` 같은 scheme은 실패한다.

검증 실패 시 provider 이름과 실패 필드만 출력하고 URL에 포함된 민감 query 값은 그대로 출력하지 않는다.

## Scope 검증 계획

`scopes`는 다음 조건을 만족해야 한다.

- 배열이어야 한다.
- 최소 1개 이상이어야 한다.
- 모든 항목은 비어 있지 않은 문자열이어야 한다.
- 중복 scope는 순서를 유지한 채 제거한 normalized scope 배열로 처리한다.
- token, secret, password처럼 민감값으로 보이는 문자열은 scope로 허용하지 않는다.

scope는 authorization URL 생성 시 공백 구분 문자열로 join할 수 있도록 안정적인 배열 형태를 유지한다.

provider 이름은 registry key와 동일한 소문자 canonical name만 허용한다. 예를 들어 `github`는 허용하지만 `GitHub`는 정규화하지 않고 오류로 처리한다. 사용자가 입력한 provider 이름을 임의로 보정하면 잘못된 설정을 숨길 수 있으므로, CLI 입력 검증 단계에서 명확한 안내를 제공한다.

## Client 설정 계획

client 설정은 `config.json`에 secret을 저장하지 않는다는 원칙을 따른다.

권장 필드는 다음과 같다.

- `idEnv`: client id를 읽을 환경 변수 이름
- `secretEnv`: client secret을 읽을 환경 변수 이름
- `requiresSecret`: token 교환에 client secret이 필요한지 여부
- `redirectUri`: provider별 고정 redirect URI가 필요한 경우에만 사용

`clientId`와 `clientSecret` 원문을 `OAUTH_PROVIDERS`에 하드코딩하지 않는다. 공개 client id를 번들에 포함해야 하는 provider가 생기더라도 secret과 구분하고, 문서에 이유를 남긴다.

## OAuth Architecture와의 연결

W 단계에서 만든 `src/auth/oauth.js`는 provider별 상세 URL을 직접 알지 않고 다음 방식으로만 설정을 사용한다.

1. `getOAuthProviderConfig(provider)` 호출
2. `validateOAuthProviderConfig(provider, config)` 호출
3. authorization URL 생성 시 `authUrl`, `scopes`, client id 사용
4. token 요청 시 `tokenUrl`, client 설정 사용

이렇게 하면 OAuth provider 추가 시 `oauth.js`의 흐름을 바꾸지 않고 `oauthProviders.js`의 registry만 확장할 수 있다.

## 보안 기준

X 단계 구현은 다음 보안 기준을 지켜야 한다.

- client secret, access token, refresh token을 로그에 출력하지 않는다.
- credentials 파일 내용을 읽거나 출력하지 않는다.
- provider 설정 오류가 발생해도 mock provider로 fallback하지 않는다.
- OAuth 설정 조회 과정에서 Git commit, reset, push를 실행하지 않는다.
- 테스트는 격리된 환경 변수와 mock logger를 사용한다.
- 실제 외부 OAuth URL로 네트워크 요청을 보내지 않는다.

## 완료 기준

- `src/auth/oauthProviders.js`에서 provider별 `authUrl`, `tokenUrl`, `scopes`, client 설정을 분리 관리할 수 있다.
- 지원 provider 설정은 조회와 검증을 통과한다.
- 없는 provider, 빈 provider, OAuth 미지원 provider는 명확한 오류로 실패한다.
- 실패 시 mock fallback이 발생하지 않는다.
- URL과 scope 검증 실패가 구체적인 오류로 드러난다.
- secret 또는 token 원문이 로그와 오류 메시지에 포함되지 않는다.
