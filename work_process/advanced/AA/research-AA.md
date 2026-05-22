# AA. OAuth Token Store Agent 구현 계획

## 작업 범위

AA 단계는 OAuth 인증 결과로 받은 `access token`, `refresh token`, 만료 시간을 안전하게 저장하고 다시 불러오는 토큰 저장소 정책을 정의한다.

구현 대상은 OAuth flow 자체가 아니라 token persistence 계층이다. OAuth callback, PKCE/state 검증, refresh 요청은 각각 Y, Z, AB 단계의 책임이며, AA 단계는 검증이 끝난 token을 안전하게 보관하는 일만 담당한다.

## 선행 조건

이 단계는 Phase 5의 W, X, Y, Z 작업 결과를 전제로 한다.

- W: OAuth 공통 구조와 provider별 확장 지점
- X: OAuth provider 설정 구조
- Y: local callback으로 authorization code 수신
- Z: PKCE/state 생성 및 검증

AA 단계는 위 결과를 바탕으로 `credentials.json`에 provider별 OAuth token을 저장하고, `config.json`에는 secret이 들어가지 않도록 분리한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/config/store.js`
- `src/auth/oauth.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 구현 계획만 정리한다.

## 저장 위치와 분리 원칙

OAuth token은 설정 파일이 아니라 credentials 파일에만 저장한다.

- 설정 파일: `~/.config/convention/config.json`
- 인증 파일: `~/.config/convention/credentials.json`

`config.json`에는 다음과 같은 비밀이 아닌 metadata만 저장한다.

- `provider`
- `authType`
- `modelDisplayName`
- `modelVersion`
- `baseURL`

`config.json`에 저장하면 안 되는 값은 다음과 같다.

- `accessToken`
- `refreshToken`
- `expiresAt`
- OAuth token response 원문
- bearer token 형태의 Authorization header

## credentials.json 저장 구조

`credentials.json`은 인증 방식별 top-level namespace와 provider scope를 함께 사용해 token을 분리한다. API Key와 OAuth token이 같은 provider에 공존할 수 있으므로 `apiKeys`와 `oauth`를 분리하고, 각 namespace 아래에서 provider별 key를 둔다.

권장 schema는 다음과 같다.

```json
{
  "apiKeys": {
    "antigravity": "[REDACTED]"
  },
  "oauth": {
    "antigravity": {
      "accessToken": "[REDACTED]",
      "refreshToken": "[REDACTED]",
      "expiresAt": "2026-05-19T12:00:00.000Z",
      "scope": "https://api.antigravity.ai/auth/cli",
      "tokenType": "Bearer"
    },
    "github-copilot": {
      "accessToken": "[REDACTED]",
      "refreshToken": "[REDACTED]",
      "expiresAt": "2026-05-19T12:00:00.000Z",
      "tokenType": "Bearer"
    }
  }
}
```

저장 시 원본 token 값은 파일에는 기록하지만, 로그와 오류 메시지에는 절대 출력하지 않는다. 문서나 테스트 fixture에도 실제 token 값을 넣지 않는다.

## 권장 함수 계획

`src/config/store.js`에는 기존 credentials 계약을 유지하면서 OAuth token 전용 helper를 추가하는 방향이 안전하다.

권장 함수는 다음과 같다.

```js
export function loadCredentials()
export function saveCredentials(credentials)
export function saveOAuthTokens(provider, tokens)
export function getOAuthTokens(provider)
export function clearOAuthTokens(provider)
```

각 함수의 역할은 다음과 같다.

- `loadCredentials()`: `credentials.json`을 읽고 JSON parse 실패 시 빈 객체로 안전하게 fallback한다.
- `saveCredentials(credentials)`: credentials 디렉터리를 보장하고 파일 권한 제한을 best effort로 적용한다.
- `saveOAuthTokens(provider, tokens)`: `credentials.oauth.<provider>`에 token을 저장한다.
- `getOAuthTokens(provider)`: provider에 해당하는 OAuth token만 반환한다.
- `clearOAuthTokens(provider)`: 로그아웃 또는 재인증 시 `credentials.oauth.<provider>`만 제거하고 `credentials.apiKeys.<provider>`는 유지한다.

## token 필드 검증

`saveOAuthTokens(provider, tokens)`는 최소한 다음 필드를 처리한다.

- `accessToken`: 문자열, 필수
- `refreshToken`: 문자열, provider 정책에 따라 optional일 수 있으나 있으면 저장
- `expiresAt`: ISO 8601 문자열 또는 epoch milliseconds를 ISO 문자열로 정규화

잘못된 provider 이름, 빈 access token, 잘못된 만료 시간은 저장하지 않고 명확한 오류로 중단한다. 지원하지 않는 provider를 조용히 mock으로 fallback하지 않는다. 저장 실패 시에도 API Key namespace를 OAuth namespace로 옮기거나 OAuth token을 API Key 위치에 저장하지 않는다.

## 파일 권한 제한 계획

`credentials.json`은 가능한 경우 사용자만 읽고 쓸 수 있도록 제한한다.

- POSIX 계열: 저장 후 `chmod 600` 적용
- Windows: 동일 권한 모델을 강제하기 어렵기 때문에 파일을 사용자 config 디렉터리 아래에 저장하고, 권한 제한은 best effort로 처리
- 권한 제한 실패: token 저장 자체를 무조건 실패시키기보다 경고를 출력하되 token 원문은 출력하지 않는다

권한 처리 실패 메시지에는 파일 경로와 실패 사실만 포함하고, credentials 내용이나 token 값은 포함하지 않는다.

## token 출력 금지 규칙

AA 단계의 가장 중요한 보안 기준은 token 원문을 어떤 경로로도 출력하지 않는 것이다.

다음 출력은 금지한다.

- `accessToken` 원문
- `refreshToken` 원문
- token response 원문 JSON dump
- Authorization header 값
- `credentials.json` 파일 내용 전체 출력
- 오류 객체에 포함된 token 값을 그대로 출력

출력이 필요한 경우 다음처럼 마스킹한다.

- `[REDACTED]`
- provider 이름과 저장 성공 여부만 출력
- 만료 시간은 token 자체가 아니므로 필요 시 표시 가능

## OAuth flow 연결 계획

`src/auth/oauth.js`는 callback 이후 token exchange에 성공하면 `saveOAuthTokens(provider, tokens)`만 호출한다.

흐름은 다음 순서를 따른다.

1. authorization code 수신
2. state 검증
3. PKCE 검증에 필요한 token exchange 수행
4. token response에서 필요한 필드만 추출
5. `accessToken`, `refreshToken`, `expiresAt` 정규화
6. `saveOAuthTokens(provider, tokens)` 호출
7. 사용자에게 저장 성공 사실만 안내

token 저장 실패 시 OAuth flow는 인증 성공으로 간주하지 않는다. 사용자는 재시도하거나 credentials 저장 권한 문제를 해결해야 한다.

## 오류 처리 계획

오류 처리는 안전한 fallback과 명확한 중단을 구분한다.

- `credentials.json`이 없음: 빈 credentials로 시작한다.
- `credentials.json` JSON parse 실패: 읽기 동작은 경고 후 빈 credentials처럼 처리하되, 저장 동작은 기존 파일을 원문 출력 없이 `.bak` 같은 백업으로 보존한 뒤 새 파일을 쓴다.
- provider token이 없음: 재로그인이 필요하다는 메시지를 출력한다.
- 파일 저장 실패: token 원문 없이 권한 또는 경로 문제를 안내한다.
- 권한 제한 실패: best effort 실패 경고를 출력하고 저장은 유지한다. 경고에는 token 원문이나 credentials 내용이 포함되지 않는다.
- token schema 불일치: 저장하지 않고 오류로 중단한다.

깨진 credentials 파일을 읽을 때도 원문 파일 내용을 출력하지 않는다.

## 보안 기준

AA 단계는 다음 규칙을 반드시 지킨다.

- OAuth token은 `credentials.json`에만 저장한다.
- `config.json`에는 token, refresh token, 만료 시간, token response를 저장하지 않는다.
- provider별 token을 서로 덮어쓰지 않는다.
- API key 저장 구조와 OAuth token 저장 구조를 분리한다.
- `credentials.apiKeys.<provider>`와 `credentials.oauth.<provider>`를 서로 변환하거나 덮어쓰지 않는다.
- credentials 파일 내용 전체를 출력하지 않는다.
- token 값은 로그, 에러, 테스트 출력에 나타나지 않아야 한다.
- Git 명령이 필요하지 않은 단계이며, commit/reset/push를 수행하지 않는다.

## 완료 기준

- OAuth token이 provider별로 `credentials.json`에 저장된다.
- `accessToken`, `refreshToken`, `expiresAt`을 저장하고 다시 불러올 수 있다.
- 서로 다른 provider의 token이 분리되어 유지된다.
- `config.json`에는 OAuth token 관련 secret이 저장되지 않는다.
- 가능한 환경에서 `credentials.json` 권한이 사용자 읽기/쓰기 수준으로 제한된다.
- token 원문이 로그와 오류 메시지에 노출되지 않는다.
- 깨진 credentials 파일이 있어도 CLI가 token 원문 출력 없이 안전하게 fallback한다.
