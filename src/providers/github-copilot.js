// GitHub Copilot SDK 공식 예제에서 사용하는 기본 모델명입니다.
// 사용자가 --model 세 번째 인자로 다른 모델을 명시하면 그 값을 우선 사용합니다.
const DEFAULT_COPILOT_MODEL = "gpt-4.1";
// Copilot SDK 호출이 응답하지 않을 때 CLI가 무기한 대기하지 않도록 하는 기본 제한 시간입니다.
// 다른 외부 provider와 같은 60초를 사용해서 사용자가 느끼는 대기 정책을 일관되게 유지합니다.
const DEFAULT_TIMEOUT_MS = 60000;
// SDK 세션과 client를 정리하는 단계는 본 요청보다 짧게 제한합니다.
// 정리 작업 자체가 멈추면 원래 요청은 끝났는데도 CLI가 종료되지 않는 문제가 다시 생길 수 있습니다.
const CLEANUP_TIMEOUT_MS = 5000;

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
 * 사용자 설정의 timeoutMs를 Copilot SDK 호출에 사용할 수 있는 양의 정수로 정규화합니다.
 * 잘못된 값이 들어오면 setTimeout이 즉시 실행되거나 과도하게 오래 대기할 수 있으므로 기본값으로 되돌립니다.
 *
 * @param {object} config - 사용자 provider 설정입니다.
 * @returns {number} 밀리초 단위 timeout 값입니다.
 */
function resolveTimeoutMs(config = {}) {
  // config.timeoutMs가 숫자이고 안전한 양수일 때만 사용자 설정으로 인정합니다.
  if (
    Number.isFinite(config.timeoutMs) &&
    Number.isSafeInteger(config.timeoutMs) &&
    config.timeoutMs > 0
  ) {
    return config.timeoutMs;
  }

  // 문자열, 음수, Infinity, NaN 같은 값은 SDK 호출 시간을 예측하기 어렵게 만들 수 있어 기본값을 사용합니다.
  return DEFAULT_TIMEOUT_MS;
}

/**
 * timeout 오류 메시지를 짧고 안전한 형태로 생성합니다.
 * prompt, OAuth token, SDK 내부 오류 객체는 포함하지 않아 민감 정보가 로그에 섞이지 않게 합니다.
 *
 * @param {string} action - 실패한 SDK 작업 이름입니다.
 * @param {number} timeoutMs - 적용된 제한 시간입니다.
 * @returns {Error} 사용자에게 보여줄 수 있는 timeout 오류입니다.
 */
function createTimeoutError(action, timeoutMs) {
  return new Error(
    `GitHub Copilot SDK ${action} timed out after ${timeoutMs}ms.`,
  );
}

/**
 * Promise 기반 Copilot SDK 작업에 제한 시간을 적용합니다.
 * SDK가 AbortSignal을 직접 받지 않는 호출도 있으므로 Promise.race로 호출자 관점의 대기 시간을 제한합니다.
 *
 * @template T
 * @param {Promise<T>} promise - 제한 시간을 적용할 SDK 작업입니다.
 * @param {object} options - timeout 옵션입니다.
 * @param {string} options.action - 오류 메시지에 사용할 작업 이름입니다.
 * @param {number} options.timeoutMs - 제한 시간입니다.
 * @returns {Promise<T>} SDK 작업 결과입니다.
 */
async function withCopilotTimeout(promise, { action, timeoutMs }) {
  let timeout;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        // timeout 핸들을 저장해 정상 완료 시 즉시 해제합니다.
        timeout = setTimeout(
          () => reject(createTimeoutError(action, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    // SDK 작업이 제한 시간 안에 끝난 경우 불필요한 timer가 이벤트 루프를 붙잡지 않게 제거합니다.
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

/**
 * SDK 정리 작업을 안전하게 실행합니다.
 * 정리 작업 실패는 원래 성공한 요청을 실패로 바꾸지 않도록 삼키되, timeout으로 CLI가 멈추는 상황은 막습니다.
 *
 * @param {Function|undefined} cleanup - session.disconnect 또는 client.stop 같은 정리 함수입니다.
 * @param {string} action - timeout 메시지에 사용할 정리 작업 이름입니다.
 * @returns {Promise<void>}
 */
async function runCleanupWithTimeout(cleanup, action) {
  // SDK 버전에 따라 정리 함수가 없을 수 있으므로 함수일 때만 실행합니다.
  if (typeof cleanup !== "function") {
    return;
  }

  try {
    // 정리 함수 내부에서 this를 사용하지 않도록 호출자는 이미 bind한 함수를 넘겨야 합니다.
    await withCopilotTimeout(Promise.resolve().then(cleanup), {
      action,
      timeoutMs: CLEANUP_TIMEOUT_MS,
    });
  } catch {
    // 정리 실패 원문에는 SDK 내부 상태나 로컬 경로가 들어갈 수 있으므로 여기서 출력하지 않습니다.
    // client.stop/session.disconnect는 best-effort cleanup이며, 사용자-facing 오류는 본 요청 단계에서 처리합니다.
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
  // 모든 Copilot SDK 네트워크/프로세스 호출에 동일한 timeout을 적용합니다.
  const timeoutMs = resolveTimeoutMs(config);

  try {
    // session을 생성합니다.
    const session = await withCopilotTimeout(
      client.createSession({
        model: config.modelVersion || DEFAULT_COPILOT_MODEL,
        hooks: buildToolDenyHooks(),
        // permission handler는 SDK에서 필수입니다. commit message 생성에는 도구 실행이 필요 없으므로 모든 권한 요청을 거부합니다.
        onPermissionRequest: async () => ({ kind: "denied-by-rules" }),
      }),
      {
        action: "session creation",
        timeoutMs,
      },
    );

    try {
      // SDK가 응답할 때까지 기다립니다.
      const response = await withCopilotTimeout(session.sendAndWait({ prompt }), {
        action: "commit message generation",
        timeoutMs,
      });
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
      await runCleanupWithTimeout(
        session.disconnect?.bind(session),
        "session cleanup",
      );
    }
  } finally {
    // SDK client lifecycle을 명확히 종료해 CLI 프로세스가 Copilot CLI server child process를 붙잡지 않게 합니다.
    await runCleanupWithTimeout(client.stop?.bind(client), "client cleanup");
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
  // 모델 목록 조회도 외부 SDK 호출이므로 commit message 생성과 같은 timeout 정책을 적용합니다.
  const timeoutMs = resolveTimeoutMs(config);

  // client를 사용하여 모델 목록을 조회합니다.
  try {
    // CopilotClient는 listModels 호출 시 세션처럼 autoStart를 지원하지 않으므로, 호출 전 명시적으로 start()를 실행해야 합니다.
    await withCopilotTimeout(client.start(), {
      action: "client connection startup",
      timeoutMs,
    });

    // client에 listModels가 없으면 기본 모델을 반환합니다.
    if (typeof client.listModels !== "function") {
      return [config.modelVersion || DEFAULT_COPILOT_MODEL];
    }

    // 정규화 된 모델 목록을 반환합니다.
    return normalizeModelList(
      await withCopilotTimeout(client.listModels(), {
        action: "model list request",
        timeoutMs,
      }),
    );
  } finally {
    // SDK client lifecycle을 명확히 종료해 CLI 프로세스가 Copilot CLI server child process를 붙잡지 않게 합니다.
    await runCleanupWithTimeout(client.stop?.bind(client), "client cleanup");
  }
}
