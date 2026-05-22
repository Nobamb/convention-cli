# AB. OAuth Refresh Agent 구현 계획

## 작업 범위

AB 단계는 OAuth access token이 만료되었을 때 refresh token으로 새 token을 발급받고 저장하는 흐름을 정의한다. 구현 대상은 OAuth refresh 로직이며, 로그인 시작, callback 수신, PKCE/state 생성은 이전 W-Z 단계의 결과를 사용한다.

주요 대상 파일은 다음과 같다.

- `src/auth/oauth.js`
- `src/core/ai.js`
- `src/config/store.js`
- `src/utils/logger.js`

이 문서는 구현 계획만 정리하며 실제 소스 파일은 수정하지 않는다.

## 선행 조건

AB 단계는 Phase 5의 이전 작업 결과가 존재한다고 가정한다.

- W: OAuth 전체 구조와 provider별 공통 흐름
- X: OAuth provider 설정
- Y: local callback 수신
- Z: PKCE/state 검증
- AA: access token, refresh token, 만료 시각을 `credentials.json`에 provider별로 저장

AB 단계는 AA 단계의 token 저장 구조를 그대로 사용해야 하며, OAuth token은 `config.json`에 저장하지 않는다.

## 구현 목표

1. access token 만료 여부를 확인한다.
2. refresh token 존재 여부를 확인한다.
3. token endpoint로 refresh 요청을 보낸다.
4. 성공 시 새 access token과 만료 시각을 저장한다.
5. provider가 새 refresh token을 내려주면 refresh token도 교체 저장한다.
6. refresh 실패 시 재로그인 안내를 출력한다.
7. 실패 메시지, 로그, 예외에 token 원문과 raw response body를 포함하지 않는다.

## 권장 함수 구조

`src/auth/oauth.js`에 다음 함수를 추가하거나 기존 함수와 연결한다.

```js
export function isAccessTokenExpired(tokenRecord, now = Date.now())
export function hasRefreshToken(tokenRecord)
export async function refreshAccessToken(provider, config)
export async function getValidAccessToken(provider, config)
```

각 함수의 역할은 다음과 같다.

- `isAccessTokenExpired(tokenRecord, now)`: 저장된 `expiresAt` 또는 `expiresIn` 기반 만료 여부를 반환한다.
- `hasRefreshToken(tokenRecord)`: provider token record에 refresh token이 있는지 boolean으로 반환한다.
- `refreshAccessToken(provider, config)`: refresh token으로 token endpoint를 호출하고 새 token을 저장한다.
- `getValidAccessToken(provider, config)`: provider 호출 전 access token을 로드하고, 필요하면 refresh 후 유효한 token을 반환한다.

## Token 만료 확인 계획

저장 구조는 AA 단계의 provider별 credentials 구조를 따른다.

예상 형태:

```json
{
  "oauth": {
    "antigravity": {
      "accessToken": "[REDACTED]",
      "refreshToken": "[REDACTED]",
      "expiresAt": "2026-05-19T09:00:00.000Z"
    }
  }
}
```

만료 판단 기준은 다음과 같다.

- `expiresAt`이 없으면 만료된 것으로 간주한다.
- 현재 시각이 `expiresAt`보다 늦으면 만료된 것으로 간주한다.
- clock skew를 고려해 만료 60초 전부터 만료로 간주하는 여유 시간을 둔다.
- 이미 유효한 token이면 refresh 요청을 보내지 않고 기존 access token을 반환한다.

## Refresh Token 존재 확인 계획

refresh 요청 전 반드시 refresh token 존재 여부를 확인한다.

- refresh token이 없으면 token endpoint를 호출하지 않는다.
- 사용자에게 OAuth 재로그인이 필요하다고 안내한다.
- 출력 메시지에는 provider 이름과 조치 방법만 포함한다.
- access token, refresh token, credentials 원문은 출력하지 않는다.

권장 메시지:

```text
OAuth 세션을 갱신할 수 없습니다. 다시 로그인해 주세요.
```

## Token Refresh 요청 계획

provider별 OAuth 설정에서 token endpoint, client id, scope, grant type 정책을 가져온다. refresh 요청은 provider 구현 세부사항이므로 `oauthProviders.js` 또는 provider config에서 필요한 값을 읽는다.

요청 조건:

- `grant_type=refresh_token`을 사용한다.
- refresh token은 request body 또는 provider가 요구하는 방식으로만 전송한다.
- 네트워크 요청 실패, 4xx/5xx 응답, JSON parse 실패를 명확히 구분하되 사용자 메시지는 안전하게 요약한다.
- raw request body와 raw response body는 로그로 남기지 않는다.
- 오류 객체에 token 문자열이 포함될 가능성이 있으면 logger redaction을 적용하거나 안전한 새 Error로 감싼다.

## 새 Token 저장 계획

refresh 성공 시 `saveCredentials()` 계층을 통해 credentials를 갱신한다.

저장 규칙:

- 새 `accessToken`을 저장한다.
- 새 `expiresAt`을 저장한다.
- 응답에 `refresh_token`이 포함되면 기존 refresh token을 새 값으로 교체한다.
- 응답에 `refresh_token`이 없으면 기존 refresh token을 유지한다.
- provider별 저장 영역만 갱신하고 다른 provider token은 보존한다.
- 저장 후 token 값을 출력하지 않는다.

## 실패 처리 및 재로그인 안내

refresh 실패 시에는 자동 fallback으로 mock provider를 사용하지 않는다. 인증 실패를 숨기면 외부 전송 정책과 보안 판단이 흐려질 수 있기 때문이다.

실패 처리 기준:

- refresh token 없음: 재로그인 안내 후 실패 처리
- token endpoint 네트워크 실패: 네트워크 또는 provider 연결 문제로 요약
- provider 인증 실패: OAuth 세션 재로그인 필요 안내
- 응답 파싱 실패: provider 응답 처리 실패로 요약
- 저장 실패: credentials 저장 실패로 요약

모든 실패 메시지는 token 원문과 raw body를 포함하지 않는다.

권장 사용자 안내:

```text
OAuth 세션 갱신에 실패했습니다. `convention --model <provider> oauth`로 다시 로그인해 주세요.
```

## `src/core/ai.js` 연결 계획

OAuth 인증 provider 호출 전 `authType === "oauth"`이면 유효한 access token을 확보한다.

권장 흐름:

1. config에서 provider와 authType 확인
2. authType이 oauth가 아니면 기존 API key 또는 none 흐름 유지
3. OAuth이면 `getValidAccessToken(provider, config)` 호출
4. 반환된 access token을 provider 요청 context에 전달
5. refresh 실패 시 provider 호출을 중단하고 안전한 오류 메시지 출력

## 보안 기준

- access token과 refresh token을 `config.json`에 저장하지 않는다.
- token, raw credentials, raw HTTP body를 출력하지 않는다.
- 실패 메시지에 token 일부를 포함하지 않는다.
- logger 계층의 redaction 규칙을 적용한다.
- refresh 실패 시 provider 응답 원문 전체를 출력하지 않는다.
- 외부 요청은 refresh token 갱신 목적에 한정한다.
- unit test에서는 네트워크를 mock 처리한다.

## 완료 기준

- 만료되지 않은 access token은 refresh 요청 없이 재사용된다.
- 만료된 access token은 refresh token으로 갱신된다.
- refresh token이 없으면 안전하게 재로그인을 안내한다.
- refresh 성공 시 새 token과 만료 시각이 credentials에 저장된다.
- refresh 실패 메시지와 로그에 token 원문이 포함되지 않는다.
- OAuth provider 호출 전 refresh 흐름이 연결된다.
