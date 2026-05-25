# GitHub Copilot OAuth Integration Prompt

이번 작업의 목표는 GitHub Copilot 연동을 안정 기능으로 완성하는 것이 아니라, 향후 구현자가 안전하게 작업할 수 있도록 아래 범위로 제한합니다.

1. `github-copilot` provider를 무조건 기본 provider 목록에 노출하지 않습니다.
2. Copilot 연동은 `experimentalGitHubCopilot === true` 같은 명시적 opt-in이 있을 때만 활성화합니다.
3. OAuth Client ID/Secret은 일반 사용자에게 즉석 입력받아 저장하지 않습니다.
4. OAuth App을 사용하는 경우, 해당 Client ID/Secret은 사용자가 직접 소유한 GitHub OAuth App의 값이어야 하며, 환경 변수 또는 명시 설정으로만 받습니다.
5. 가능하면 GitHub Copilot SDK를 사용합니다. 직접 `api.githubcopilot.com` endpoint를 호출하는 구현은 공식 API 계약 확인 전까지 금지하거나 실험 기능으로 격리합니다.
6. 저장된 OAuth token은 `credentials.json`의 `oauth.github-copilot` namespace에만 저장합니다.
7. 기존 token 재사용, 로그아웃, 재로그인은 token 원문을 출력하지 않고 명확한 사용자 confirm 뒤에 수행합니다.
8. 외부 AI로 diff를 보내기 전 기존 security gate와 external transmission confirm을 유지합니다.

## 구현 전 필수 확인 사항

작업자는 코드를 수정하기 전에 아래를 먼저 확인해야 합니다.

- 현재 GitHub Copilot SDK가 Node.js에서 `convention-cli`의 commit message generation 용도에 맞게 사용할 수 있는지
- SDK가 일반 npm dependency로 추가 가능한지
- SDK가 제공하는 모델 선택 방식과 응답 형식이 안정적인지
- SDK가 `gitHubToken` 또는 GitHub App user token을 받을 때 필요한 token type이 무엇인지
- fine-grained PAT의 `Copilot Requests` permission을 지원하는지
- 조직/엔터프라이즈 정책 때문에 Copilot CLI 또는 SDK 사용이 차단될 수 있는지
- unit test에서 실제 GitHub 또는 Copilot 네트워크를 호출하지 않고 mock 가능한지

위 항목을 확인하지 못하면 provider 구현까지 진행하지 말고 문서와 테스트 계획만 작성합니다.

## 금지 사항

아래 구현은 하지 않습니다.

- Codex/Copilot/VS Code extension이 저장한 credential 파일을 찾아 읽기
- GitHub CLI 또는 Copilot CLI credential store를 무단으로 읽기
- 사용자의 홈 디렉터리를 광범위하게 스캔하기
- `api.githubcopilot.com` endpoint를 공식 안정 API처럼 하드코딩하기
- OAuth authorization URL 전체를 기본 stdout에 출력하기
- Client Secret, access token, refresh token, Authorization header를 로그에 출력하기
- OAuth 실패 시 mock provider로 조용히 fallback하기
- 인증 실패 후 `git add`, `git commit`, `git push`, `reset`을 자동 실행하기
- API Key 방식과 OAuth 방식을 섞어서 같은 요청에 함께 사용하기

## 권장 구현안 A - GitHub Copilot SDK 기반 실험 provider

공식 SDK 사용이 가능하다고 확인된 경우에만 이 경로로 진행합니다.

### 파일 변경 후보

- `src/providers/github-copilot.js`
- `src/providers/index.js`
- `src/config/defaults.js`
- `src/commands/model.js`
- `src/auth/oauth.js`
- `src/auth/oauthProviders.js`
- `src/utils/ui.js`
- `tests/provider-routing.test.js`
- `tests/model-command.test.js`
- `tests/oauth.test.js`

### provider 노출 정책

`src/config/defaults.js`의 기본 `PROVIDERS`에는 바로 넣지 않습니다.

권장 방식:

```js
export const PROVIDERS = ["mock", "localLLM", "gemini", "openaiCompatible"];
export const EXPERIMENTAL_PROVIDERS = [
  "antigravity",
  "manus",
  "github-copilot",
];
```

대화형 `--model` UI에서는 명시 opt-in이 있을 때만 `github-copilot`을 추가합니다.

예시 opt-in 후보:

- config의 `experimentalGitHubCopilot: true`
- 환경 변수 `CONVENTION_EXPERIMENTAL_GITHUB_COPILOT=true`
- 명령 옵션이 이미 명시적으로 `convention --model github-copilot oauth`인 경우

### OAuth Client 설정 정책

일반 사용자에게 Client ID/Secret을 즉석 입력받는 흐름은 기본 구현으로 두지 않습니다.

이유:

- Client Secret은 "사용자 개인 비밀번호"가 아니라 OAuth App 소유자의 app secret입니다.
- 일반 사용자는 대개 GitHub OAuth App을 직접 만들지 않았습니다.
- 잘못 안내하면 사용자가 다른 서비스의 secret을 붙여 넣거나, secret을 convention-cli에 불필요하게 저장할 수 있습니다.

허용 방식:

- `CONVENTION_GITHUB_CLIENT_ID`
- `CONVENTION_GITHUB_CLIENT_SECRET`
- 또는 추후 config에 명시적으로 저장된 non-secret client id와 credentials에 저장된 client secret

환경 변수가 없으면 아래처럼 중단합니다.

```text
GitHub Copilot OAuth requires a GitHub OAuth App client ID and client secret.
Create your own GitHub OAuth App or use a supported token method, then set CONVENTION_GITHUB_CLIENT_ID and CONVENTION_GITHUB_CLIENT_SECRET.
```

### OAuth token 저장 정책

OAuth token은 기존 구조를 유지합니다.

```json
{
  "oauth": {
    "github-copilot": {
      "accessToken": "[REDACTED]",
      "refreshToken": null,
      "expiresAt": null,
      "tokenType": "Bearer",
      "scope": null
    }
  }
}
```

Client Secret을 저장해야 하는 경우에는 token과 분리합니다.

```json
{
  "oauthClients": {
    "github-copilot": {
      "clientId": "client-id",
      "clientSecret": "[REDACTED]"
    }
  }
}
```

다만 이 저장 기능은 기본값으로 켜지지 않아야 하며, 저장 전 사용자 confirm이 필요합니다.

### 세션 관리 UI

기존 OAuth token이 있을 때만 세션 UI를 보여줍니다.

선택지:

1. `Keep current connection`
2. `Logout and re-authenticate`
3. `Cancel`

동작:

- `Keep current connection`: token 원문을 확인하거나 출력하지 않고 기존 token을 사용합니다.
- `Logout and re-authenticate`: 사용자 confirm 후 `clearOAuthTokens("github-copilot")`를 호출합니다.
- `Cancel`: config 저장과 provider 요청 없이 중단합니다.

현재 연동 계정의 이메일, 로그인명, 조직 정보를 보여주려면 별도 GitHub API 요청이 필요합니다. 이 요청도 외부 요청이므로 token 원문 없이 실패를 안전하게 처리해야 합니다. 필수 기능으로 넣지 않습니다.

### provider 구현 정책

GitHub Copilot SDK를 사용할 수 있으면 SDK wrapper로 구현합니다.

원칙:

- provider 함수는 `headers.Authorization` 또는 OAuth token 원문을 로그에 남기지 않습니다.
- SDK client 생성은 요청 직전에 수행합니다.
- SDK가 세션 또는 agent 형태로 응답한다면 commit message generation에 필요한 최소 prompt만 전달합니다.
- SDK가 파일 편집, tool call, repository mutation을 수행할 수 있다면 모두 비활성화합니다.
- commit message만 반환하도록 강제합니다.

직접 HTTP endpoint 호출은 공식 문서에서 endpoint와 request/response schema가 확인되지 않으면 구현하지 않습니다.

## 권장 구현안 B - Fine-grained PAT 기반 실험 provider

공식 문서상 Copilot CLI는 비대화형 환경에서 fine-grained PAT의 `Copilot Requests` permission을 사용하는 흐름을 안내합니다. 이 방식이 SDK에서도 지원되는지 확인되면 `authType: "api"` 또는 별도 `authType: "pat"`로 구현할 수 있습니다.

권장 UX:

```text
convention --model github-copilot api gpt-4.1
```

주의:

- PAT는 API Key와 동일하게 secret입니다.
- `credentials.json`에만 저장합니다.
- config에는 저장하지 않습니다.
- 출력은 항상 `[REDACTED]`로 마스킹합니다.
- organization token이 아니라 사용자 소유 fine-grained PAT가 필요한지 확인합니다.

## `src/commands/model.js` 수정 지침

기존 `SUPPORTED_AUTH_TYPES_BY_PROVIDER`에 무조건 `github-copilot: ["oauth"]`를 추가하지 않습니다.

권장:

```js
const SUPPORTED_AUTH_TYPES_BY_PROVIDER = {
  mock: ["none"],
  localLLM: ["none"],
  gemini: ["api"],
  openaiCompatible: ["api", "none"],
  antigravity: ["oauth"],
  "github-copilot": ["oauth"], // 단, experimental opt-in 검증 뒤에만 허용
};
```

추가 검증:

- `github-copilot` + `oauth`는 opt-in이 없으면 명확한 오류로 중단합니다.
- OAuth client 설정이 없으면 secret prompt를 띄우지 말고 안내 후 중단합니다.
- `github-copilot`이 기본 provider 목록에 보이지 않더라도, 명시 명령 `convention --model github-copilot oauth`는 실험 기능 안내와 confirm 뒤에 처리할 수 있습니다.

## `src/auth/oauthProviders.js` 수정 지침

GitHub OAuth endpoint 자체는 공식 GitHub OAuth 문서로 확인 가능합니다. 다만 그것이 Copilot SDK 요청에 필요한 token으로 충분한지 반드시 검증해야 합니다.

권장 config:

```js
"github-copilot": {
  provider: "github-copilot",
  authUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scopes: [],
  client: {
    idEnv: "CONVENTION_GITHUB_CLIENT_ID",
    secretEnv: "CONVENTION_GITHUB_CLIENT_SECRET",
    requiresSecret: true
  },
  supportsPKCE: true,
  supportsRefresh: false,
  oauthAvailable: true,
  requiresExperimentalOptIn: true
}
```

주의:

- scope는 과도하게 요청하지 않습니다.
- `read:user`가 꼭 필요한지 확인하기 전에는 빈 scope를 우선 고려합니다.
- GitHub OAuth token은 권한을 추가로 만들어내지 않으며, 사용자가 가진 Copilot 권한과 조직 정책의 영향을 받습니다.

## `src/utils/ui.js` 수정 지침

추가 가능한 UI 함수:

```js
export async function selectCopilotSessionAction() {
  // 기존 GitHub Copilot OAuth token이 있을 때만 호출합니다.
  // token 원문, client secret, Authorization header는 절대 표시하지 않습니다.
}
```

선택지:

- `keep`
- `logout`
- `cancel`

`promptSecret()`은 이미 존재하므로 재사용할 수 있습니다. 다만 OAuth Client Secret 입력에는 기본적으로 사용하지 않습니다. 사용자가 명시적으로 "client secret을 convention-cli credentials에 저장"하겠다고 confirm한 경우에만 사용합니다.

## 테스트 계획

실제 GitHub OAuth server, Copilot SDK, Copilot provider를 unit test에서 호출하지 않습니다.

필수 테스트:

- opt-in 없이 `github-copilot` 선택 시 중단
- 명시 opt-in이 있을 때만 provider 목록에 표시
- OAuth client env가 없으면 secret prompt 없이 안내 후 중단
- 기존 OAuth token이 있으면 keep/logout/cancel 선택지가 동작
- logout 선택 시 `oauth.github-copilot`만 삭제
- 다른 provider의 OAuth token은 삭제하지 않음
- token, client secret, Authorization header가 stdout/stderr/logger에 출력되지 않음
- `authType: "oauth"`이면 API Key를 읽지 않음
- `authType: "api"`이면 OAuth token을 읽지 않음
- OAuth 실패 시 commit/push/reset이 실행되지 않음
- 직접 HTTP endpoint를 사용할 경우 `experimentalGitHubCopilot === true`와 명시 `baseURL` 없이는 fetch를 호출하지 않음

검증 명령 후보:

```bash
node --test tests/oauth.test.js tests/provider-routing.test.js tests/model-command.test.js
npm.cmd test
```

PowerShell에서 `npm test`가 실행 정책에 막히면 `npm.cmd test`를 사용합니다.

## 완료 기준

아래 조건을 모두 만족해야 완료로 봅니다.

- GitHub Copilot 연동은 실험 기능으로만 노출됩니다.
- 사용자가 명시적으로 opt-in하지 않으면 외부 Copilot 요청이 발생하지 않습니다.
- 일반 사용자에게 OAuth Client ID/Secret을 무작정 요구하지 않습니다.
- token과 client secret은 config.json에 저장되지 않습니다.
- OAuth token, refresh token, client secret, Authorization header 원문이 로그에 남지 않습니다.
- 기존 `openaiCompatible`, `gemini`, `localLLM`, `mock` flow가 깨지지 않습니다.
- OAuth 실패가 mock fallback이나 자동 commit으로 이어지지 않습니다.

## 참고 공식 문서

- GitHub Docs - Authenticating GitHub Copilot CLI
  - https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- GitHub Docs - Using GitHub OAuth with Copilot SDK
  - https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/github-oauth
- GitHub Docs - Scopes for OAuth apps
  - https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
