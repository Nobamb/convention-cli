// GitHub Copilot SDK 공식 예제에서 사용하는 기본 모델명입니다.
// 사용자가 --model 세 번째 인자로 다른 모델을 명시하면 그 값을 우선 사용합니다.
const DEFAULT_COPILOT_MODEL = "gpt-4.1";

/**
 * GitHub Copilot provider가 실험 기능임을 명확하게 확인합니다.
 * config 파일에 저장된 opt-in 또는 환경변수 opt-in 중 하나가 true일 때만 SDK 호출을 허용합니다.
 *
 * @param {object} config - 사용자 설정 객체입니다.
 * @param {object} env - 테스트에서 주입 가능한 환경변수 객체입니다.
 * @returns {boolean} 실험 기능 사용 허용 여부입니다.
 */
export function isGitHubCopilotOptedIn(config = {}, env = process.env) {
  // config 값은 boolean true만 허용해서 문자열 "true"가 실수로 저장된 경우를 opt-in으로 보지 않습니다.
  if (config.experimentalGitHubCopilot === true) {
    return true;
  }

  // 환경변수는 CLI 실행 시 명시적으로 켜는 사용성을 위해 문자열 true를 허용합니다.
  return env.CONVENTION_EXPERIMENTAL_GITHUB_COPILOT === "true";
}

/**
 * Copilot SDK 의존성을 필요 시점에만 로드합니다.
 * 이렇게 하면 github-copilot provider를 사용하지 않는 기존 mock/localLLM/gemini 흐름이 SDK 설치 여부와 무관하게 동작합니다.
 *
 * @returns {Promise<object>} @github/copilot-sdk 모듈입니다.
 */
async function loadCopilotSdk() {
  try {
    // 정적 import를 쓰면 provider registry를 읽는 순간 SDK가 필요해지므로, 실제 Copilot 호출 직전에만 동적 로드합니다.
    return await import("@github/copilot-sdk");
  } catch {
    // 원본 module resolution 오류에는 로컬 경로나 내부 상세가 포함될 수 있으므로 짧은 안내로 감싸서 노출합니다.
    throw new Error(
      "GitHub Copilot SDK dependency is required. Install dependencies with `npm install` before using github-copilot.",
    );
  }
}

/**
 * OAuth access token을 SDK client로 바꿉니다.
 * useLoggedInUser=false를 지정해 사용자의 Copilot CLI/VS Code credential store로 조용히 fallback하지 않게 합니다.
 *
 * @param {object} params
 * @param {string} params.oauthAccessToken - credentials.json에서 읽은 GitHub OAuth access token입니다.
 * @param {object} [params.sdkModule] - 테스트에서 주입할 수 있는 SDK 모듈입니다.
 * @returns {Promise<object>} CopilotClient 인스턴스입니다.
 */
async function createCopilotClient({ oauthAccessToken, sdkModule }) {
  // token 값은 절대 로그로 출력하지 않고 존재 여부만 검사합니다.
  if (
    typeof oauthAccessToken !== "string" ||
    oauthAccessToken.trim().length === 0
  ) {
    throw new Error("GitHub Copilot OAuth token is missing.");
  }
  // sdkModule이 없으면 동적으로 로드합니다.
  const sdk = sdkModule || (await loadCopilotSdk());
  // sdk에서 CopilotClient를 가져옵니다.
  const { CopilotClient } = sdk;

  // CopilotClient가 없으면 에러를 던집니다.
  if (typeof CopilotClient !== "function") {
    throw new Error("GitHub Copilot SDK does not expose CopilotClient.");
  }

  // CopilotClient 인스턴스를 반환합니다.
  return new CopilotClient({
    gitHubToken: oauthAccessToken,
    useLoggedInUser: false,
  });
}

/**
 * Copilot agent가 파일 수정, shell 실행 같은 도구를 호출하지 못하도록 모든 tool use를 차단합니다.
 * convention-cli는 이미 Git diff를 prompt로 전달하므로 Copilot SDK에는 commit message 생성 외 권한이 필요하지 않습니다.
 *
 * @returns {object} SDK createSession에 넘길 hook 설정입니다.
 */
function buildToolDenyHooks() {
  // SDK createSession에 넘길 hook 설정입니다.
  return {
    // onPreToolUse는 SDK가 도구를 호출하기 전에 실행됩니다.
    onPreToolUse: async (input = {}) => ({
      permissionDecision: "deny",
      permissionDecisionReason: `convention-cli only allows commit message generation; tool "${input.toolName || "unknown"}" was blocked.`,
    }),
  };
}

/**
 * SDK 응답 객체에서 commit message 문자열만 안전하게 추출합니다.
 * SDK preview 기간 동안 응답 shape가 바뀔 수 있어 알려진 content 위치만 좁게 허용합니다.
 *
 * @param {object|string} response - SDK sendAndWait 응답입니다.
 * @returns {string} 정리 전 commit message 문자열입니다.
 */
function extractMessageContent(response) {
  // response가 문자열이면 그대로 반환합니다.
  if (typeof response === "string") {
    return response;
  }

  // SDK 응답 객체에서 content를 추출합니다.
  const content =
    response?.data?.content ??
    response?.data?.message?.content ??
    response?.message?.content ??
    response?.content;

  // content가 배열이면 각 요소를 순회하며 문자열로 변환합니다.
  if (Array.isArray(content)) {
    return (
      content
        // 배열 내 각 요소를 순회합니다.
        .map((item) => {
          // item이 문자열이면 그대로 반환합니다.
          if (typeof item === "string") {
            return item;
          }
          // item이 문자열이 아니면 text나 content를 반환합니다.
          return item?.text || item?.content || "";
        })
        .join("\n")
    );
  }

  // content가 문자열이면 그대로 반환하고, 아니라면 빈 문자열을 반환합니다.
  return typeof content === "string" ? content : "";
}

/**
 * SDK 모델 목록 응답을 convention-cli가 사용하는 문자열 배열로 정규화합니다.
 * 모델 객체가 id/name을 모두 제공할 수 있으므로 실제 호출에 안정적인 id를 우선 사용합니다.
 *
 * @param {unknown} modelList - SDK listModels 응답입니다.
 * @returns {string[]} 모델 id 배열입니다.
 */
function normalizeModelList(modelList) {
  // modelList가 배열이면 modelList를 반환하고, 배열이 아니면 modelList.data를 반환하고, data도 배열이 아니면 빈 배열을 반환합니다.
  const models = Array.isArray(modelList)
    ? modelList
    : Array.isArray(modelList?.data)
      ? modelList.data
      : [];

  // 모델 id 배열을 반환합니다.
  return (
    models
      .map((model) => {
        // model이 문자열이면 그대로 반환합니다.
        if (typeof model === "string") {
          return model;
        }
        // model의 id 또는 name을 반환합니다.
        return model?.id || model?.name;
      })
      // 문자열이고 길이가 0보다 큰 모델만 반환합니다.
      .filter((model) => typeof model === "string" && model.trim().length > 0)
  );
}

/**
 * GitHub Copilot SDK를 통해 Conventional Commits 메시지를 생성합니다.
 * 직접 api.githubcopilot.com endpoint를 호출하지 않고, 공식 SDK에 OAuth token을 전달하는 경로만 사용합니다.
 *
 * @param {object} params
 * @param {string} params.prompt - AI에 전달할 commit prompt입니다.
 * @param {object} params.config - 사용자 provider 설정입니다.
 * @param {string} params.oauthAccessToken - credentials.json의 oauth.github-copilot accessToken입니다.
 * @param {object} [params.sdkModule] - 테스트용 SDK 모듈 주입 지점입니다.
 * @returns {Promise<string>} 생성된 commit message입니다.
 */
export async function generateCommitMessage({
  prompt,
  config = {},
  oauthAccessToken,
  sdkModule,
}) {
  // prompt가 문자열이 아니거나 프롬프트가 비어있으면 에러를 던집니다.
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new TypeError("prompt must be a non-empty string");
  }

  // experimentalGitHubCopilot(실험 기능 사용 허부에 대한 여부)이 true가 아니면 에러를 던집니다.
  if (!isGitHubCopilotOptedIn(config)) {
    throw new Error(
      "github-copilot is experimental. Set experimentalGitHubCopilot=true in config or CONVENTION_EXPERIMENTAL_GITHUB_COPILOT=true before use.",
    );
  }

  // Copilot Client 인스턴스를 생성합니다.
  const client = await createCopilotClient({ oauthAccessToken, sdkModule });

  try {
    // session을 생성합니다.
    const session = await client.createSession({
      model: config.modelVersion || DEFAULT_COPILOT_MODEL,
      hooks: buildToolDenyHooks(),
      // permission handler는 SDK에서 필수입니다. commit message 생성에는 도구 실행이 필요 없으므로 모든 권한 요청을 거부합니다.
      onPermissionRequest: async () => ({ kind: "denied-by-rules" }),
    });

    try {
      // SDK가 응답할 때까지 기다립니다.
      const response = await session.sendAndWait({ prompt });
      // SDK 응답에서 commit message를 추출합니다.
      const message = extractMessageContent(response).trim();

      // 응답에서 커밋 메시지가 비어있으면 에러를 던집니다.
      if (message.length === 0) {
        throw new Error(
          "GitHub Copilot SDK response did not include a commit message.",
        );
      }

      return message;
    } finally {
      // session도 명시적으로 끊어 SDK가 보유한 이벤트 핸들러와 내부 상태가 CLI 종료를 막지 않게 합니다.
      if (typeof session.disconnect === "function") {
        await session.disconnect();
      }
    }
  } finally {
    // SDK client lifecycle을 명확히 종료해 CLI 프로세스가 Copilot CLI server child process를 붙잡지 않게 합니다.
    if (typeof client.stop === "function") {
      await client.stop();
    }
  }
}

/**
 * GitHub Copilot SDK가 제공하는 모델 목록을 조회합니다.
 * OAuth token 없이는 요청하지 않으며, 실패 시 mock provider로 fallback하지 않고 오류를 그대로 올립니다.
 *
 * @param {object} config - 사용자 provider 설정입니다.
 * @param {object} options
 * @param {string} options.oauthAccessToken - credentials.json의 oauth.github-copilot accessToken입니다.
 * @param {object} [options.sdkModule] - 테스트용 SDK 모듈 주입 지점입니다.
 * @returns {Promise<string[]>} 사용 가능한 모델 id 배열입니다.
 */
export async function listModels(
  config = {},
  { oauthAccessToken, sdkModule } = {},
) {
  // 만약 experimentalGitHubCopilot(실험 기능 사용 허부에 대한 여부)이 true가 아니면 에러를 던집니다.
  if (!isGitHubCopilotOptedIn(config)) {
    throw new Error(
      "github-copilot is experimental. Set experimentalGitHubCopilot=true in config or CONVENTION_EXPERIMENTAL_GITHUB_COPILOT=true before use.",
    );
  }
  // Copilot Client 인스턴스를 생성합니다.
  const client = await createCopilotClient({ oauthAccessToken, sdkModule });

  // client를 사용하여 모델 목록을 조회합니다.
  try {
    // client에 listModels가 없으면 기본 모델을 반환합니다.
    if (typeof client.listModels !== "function") {
      return [config.modelVersion || DEFAULT_COPILOT_MODEL];
    }

    // 정규화 된 모델 목록을 반환합니다.
    return normalizeModelList(await client.listModels());
  } finally {
    // SDK client lifecycle을 명확히 종료해 CLI 프로세스가 Copilot CLI server child process를 붙잡지 않게 합니다.
    if (typeof client.stop === "function") {
      await client.stop();
    }
  }
}
