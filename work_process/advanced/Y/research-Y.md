# Y. OAuth Local Callback Agent 구현 계획

## 작업 범위

Y 단계는 OAuth 인증 중 브라우저가 리다이렉트하는 `localhost` callback을 CLI가 안전하게 수신하는 흐름만 담당한다.

구현 대상은 `src/auth/oauth.js`이며, 이번 문서 작업에서는 구현 파일을 수정하지 않고 구현 계획만 정리한다.

Y 단계의 책임은 다음과 같다.

- 임시 localhost callback 서버 실행
- 랜덤 port 사용
- callback path 처리
- authorization code 수신
- timeout 처리
- 성공, 실패, timeout 시 서버 종료
- 브라우저 실행 승인 및 환경 제약 고려
- mock server 기반 테스트 우선 설계

OAuth provider 설정, authorization URL 구성은 W/X 단계의 결과를 사용하고, PKCE와 state 생성/검증은 Z 단계에서 담당한다. Y 단계는 callback 요청에서 `code`, `state`, `error` 값을 수신해 다음 단계로 넘길 수 있는 구조를 만든다.

## 선행 조건

Y 단계는 Phase 5의 W, X 작업 결과를 전제로 한다.

- W: OAuth 공통 구조와 `startOAuthFlow()`, callback 처리 구조 정의
- X: provider별 OAuth endpoint, client id, redirect URI 정책 정의

Y 단계는 Z 단계와 맞물리지만, state 검증 자체를 이 단계에서 완성하지 않는다. 다만 callback으로 받은 `state` 값을 손실 없이 반환해야 한다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `src/auth/oauth.js`

권장 함수는 다음과 같다.

```js
export async function waitForOAuthCallback(options)
export async function startLocalCallbackServer(options)
export function buildRedirectUri({ port, callbackPath })
```

필요 시 내부 helper로 다음 함수를 둘 수 있다.

```js
function normalizeCallbackPath(callbackPath)
function parseCallbackRequest(req, callbackPath)
function closeServer(server)
```

## Localhost Callback 서버 계획

callback 서버는 Node.js 기본 `http` 모듈을 사용한다. 외부 의존성을 추가하지 않고, 테스트에서도 쉽게 mock할 수 있도록 작은 단위 함수로 분리한다.

서버 실행 규칙은 다음과 같다.

- host는 기본적으로 `127.0.0.1`을 사용한다.
- port는 `0`으로 listen해서 OS가 사용 가능한 랜덤 port를 배정하게 한다.
- 실제 port는 `server.address().port`에서 읽는다.
- callback path 기본값은 `/oauth/callback`으로 둔다.
- callback path는 반드시 `/`로 시작하도록 정규화한다.
- redirect URI는 `http://127.0.0.1:{port}{callbackPath}` 형식으로 생성한다.

`localhost` 대신 `127.0.0.1`을 기본값으로 쓰는 이유는 DNS, IPv6 해석 차이, 회사 네트워크 정책에 따른 예측 불가능성을 줄이기 위해서다. provider가 `localhost`만 허용하는 경우에는 X 단계 provider config에서 host override를 명시적으로 제공한다.

## Authorization Code 수신 흐름

callback 요청 처리 순서는 다음과 같다.

1. 요청 URL을 `new URL(req.url, redirectUri)`로 파싱한다.
2. pathname이 callback path와 일치하는지 확인한다.
3. 일치하지 않으면 `404`를 응답하고 인증 결과로 처리하지 않는다.
4. query에서 `code`, `state`, `error`, `error_description`을 읽는다.
5. `error`가 있으면 OAuth 실패 결과로 반환한다.
6. `code`가 없으면 `400`을 응답하고 실패 결과로 반환한다.
7. `code`와 `state`가 있으면 성공 HTML 또는 짧은 텍스트 응답을 반환한다.
8. Promise를 resolve하고 서버를 닫는다.

반환값 예시는 다음과 같다.

```js
{
  code: "received-code",
  state: "received-state",
  redirectUri: "http://127.0.0.1:49152/oauth/callback"
}
```

`code`, `state`, provider error 원문은 로그에 출력하지 않는다. 사용자에게는 인증 성공, 실패, timeout 여부만 요약해서 알린다.

## Timeout 처리

callback 대기는 무기한 지속되면 안 된다.

- 기본 timeout 후보는 120초로 둔다.
- timeout 값은 테스트에서 짧게 주입할 수 있어야 한다.
- timeout이 발생하면 Promise를 reject하거나 `{ timedOut: true }` 형태로 실패 결과를 반환한다.
- timeout 발생 시 서버를 반드시 닫는다.
- timeout 메시지에는 authorization code, state, token, provider redirect URL 전체를 포함하지 않는다.

권장 방식은 `setTimeout()` handle을 저장하고, 성공/실패/서버 오류/timeout 어느 경로에서도 `clearTimeout()`과 `server.close()`를 한 번만 호출하는 것이다.

## 서버 종료 규칙

서버는 다음 상황에서 반드시 닫혀야 한다.

- 정상 callback 수신
- provider error callback 수신
- callback path는 맞지만 code가 없는 invalid callback
- timeout
- listen 실패
- 요청 처리 중 예외 발생

`server.close()`는 중복 호출되어도 안전하도록 idempotent helper로 감싼다. 테스트에서는 server close spy 또는 같은 port 재사용 가능 여부로 종료를 검증한다.

## Browser Launch 계획

브라우저 자동 실행은 편의 기능이지만 환경 의존성이 크다. Y 단계에서는 브라우저 실행을 OAuth callback 수신과 분리한다.

브라우저 실행 규칙은 다음과 같다.

- 기본 interactive 환경에서만 브라우저 실행을 시도한다.
- CI, `--no-interactive`, headless 환경에서는 자동 실행하지 않는다.
- 자동 실행 전에 사용자 승인 또는 명시 설정을 확인한다.
- 실행이 실패해도 OAuth flow 전체를 즉시 실패시키지 않고 authorization URL을 사용자가 직접 열 수 있게 안내한다.
- authorization URL 수동 안내는 interactive 사용자에게 보여주는 화면 출력으로만 제한하고, debug log, 파일, 테스트 snapshot에는 남기지 않는다.
- authorization URL에는 state와 PKCE challenge가 포함될 수 있으므로, 자동 브라우저 실행 성공 경로에서는 전체 URL을 출력하지 않는다.
- 기본 출력에는 `code`, access token, refresh token, client secret, raw callback query가 없어야 한다.

브라우저 실행 구현은 OS별 명령을 shell 문자열로 조합하지 않는다. 필요 시 `spawnSync` 또는 `execFileSync`를 argv 배열 방식으로 사용한다. 테스트에서는 실제 브라우저를 실행하지 않고 launcher 함수를 mock한다.

## 환경 제약

다음 환경에서는 자동 브라우저 실행을 제한한다.

- `CI=true`
- `GITHUB_ACTIONS=true`
- TTY가 없는 환경
- `--no-interactive` 또는 동일 의미 옵션이 활성화된 환경
- 사용자가 브라우저 실행을 거부한 경우

이 경우 CLI는 callback 서버를 열 수 있는지 먼저 확인하고, interactive 사용자에게만 URL을 수동으로 열도록 안내한다. 단, URL 출력 시 provider 정책상 필요한 query만 포함하고 token, authorization code, refresh token, client secret은 절대 출력하지 않는다. CI, TTY 없음, `--no-interactive` 환경에서는 수동 URL도 출력하지 않고 명확한 오류로 중단한다.

## Mock Server 테스트 우선 원칙

Y 단계 테스트는 외부 OAuth provider와 실제 브라우저를 사용하지 않는다.

- 테스트는 임시 localhost 서버를 실제로 띄우되 외부 네트워크 요청은 하지 않는다.
- callback 요청은 Node.js `http` 또는 `fetch`로 직접 보낸다.
- OAuth provider 응답은 query string으로 mock한다.
- browser launcher는 mock 함수로 대체한다.
- timeout은 짧은 값으로 주입한다.

이 방식으로 성공 callback, timeout, invalid path, server close, no token/code logging을 모두 검증한다.

## 보안 기준

Y 단계는 OAuth code와 state를 다루므로 다음 규칙을 지킨다.

- authorization code를 로그에 출력하지 않는다.
- state 값을 로그에 출력하지 않는다.
- access token, refresh token은 이 단계에서 생성하지도 출력하지도 않는다.
- provider error description은 원문 전체를 그대로 출력하지 않고 요약한다.
- callback 요청 URL 전체를 로그에 출력하지 않는다.
- callback 서버는 loopback address에만 bind한다.
- 외부 AI API로 diff나 OAuth 정보를 전송하지 않는다.

## 완료 기준

- 임시 localhost callback 서버가 랜덤 port로 실행된다.
- redirect URI가 실제 port와 callback path를 반영한다.
- 올바른 callback path에서 authorization code와 state를 수신한다.
- 잘못된 path는 인증 결과로 처리하지 않는다.
- timeout 시 서버가 닫히고 명확한 실패 결과를 반환한다.
- 성공, 실패, timeout 모든 경로에서 서버가 닫힌다.
- 브라우저 실행은 사용자 승인과 환경 제약을 따른다.
- 테스트는 mock server와 mock launcher를 우선 사용한다.
- code, state, token류 값이 로그에 노출되지 않는다.
