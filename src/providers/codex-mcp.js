import { spawn as defaultSpawn } from "node:child_process";

// Codex MCP provider가 모델 목록을 직접 조회하지 않을 때 사용하는 기본 모델명입니다.
// 사용자가 --model codex-mcp none <modelVersion> 형태로 명시하면 config.modelVersion이 우선됩니다.
const DEFAULT_CODEX_MCP_MODEL = "gpt-5.3-codex";
// Codex MCP 서버가 ChatGPT 또는 API 계정 연동 시 제공하는 가용 모델 후보군 목록입니다.
const SUPPORTED_CODEX_MCP_MODELS = [
  "gpt-5.3-codex", // 1순위 추천 모델 (기본값)
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.2"
];
// MCP stdio 서버가 시작되고 initialize 응답을 줄 때까지 기다리는 기본 제한 시간입니다.
const DEFAULT_STARTUP_TIMEOUT_MS = 10000;
// Codex MCP tool 호출이 commit message를 생성할 때까지 기다리는 기본 제한 시간입니다.
const DEFAULT_TOOL_TIMEOUT_MS = 60000;
// subprocess 종료나 stream cleanup이 멈출 때 CLI 종료를 막지 않기 위한 짧은 제한 시간입니다.
const DEFAULT_CLEANUP_TIMEOUT_MS = 5000;
// MCP 표준 문서에서 확인한 최신 protocol version을 명시합니다.
const MCP_PROTOCOL_VERSION = "2025-06-18";
// convention-cli가 commit message 생성 용도로만 호출할 수 있는 Codex MCP tool 이름입니다.
const CODEX_TOOL_NAME = "codex";

/**
 * 사용자가 config에 넘긴 timeout 값을 양의 안전한 정수로 정규화합니다.
 * 잘못된 값은 setTimeout 동작을 예측하기 어렵게 만들 수 있으므로 provider 기본값으로 되돌립니다.
 *
 * @param {unknown} value - 사용자 설정 timeout 후보 값입니다.
 * @param {number} fallback - 유효하지 않을 때 사용할 기본 timeout입니다.
 * @returns {number} 밀리초 단위 timeout 값입니다.
 */
function normalizeTimeout(value, fallback) {
  // 숫자이면서 안전한 정수이고 0보다 큰 경우에만 timeout 설정으로 인정합니다.
  if (Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  // 문자열, 음수, NaN, Infinity 등은 모두 기본값으로 처리합니다.
  return fallback;
}

/**
 * Codex MCP provider에서 사용할 timeout 묶음을 구성합니다.
 * 일반 provider의 timeoutMs가 있으면 tool call timeout으로 사용하고, 세부 값이 있으면 각각 우선합니다.
 *
 * @param {object} config - 사용자 provider 설정입니다.
 * @returns {{startupTimeoutMs: number, toolTimeoutMs: number, cleanupTimeoutMs: number}} timeout 설정입니다.
 */
function resolveTimeouts(config = {}) {
  // 기존 provider들과 맞추기 위해 config.timeoutMs는 가장 긴 tool 호출 timeout으로 해석합니다.
  const toolTimeoutMs = normalizeTimeout(
    config.toolTimeoutMs ?? config.timeoutMs,
    DEFAULT_TOOL_TIMEOUT_MS,
  );

  return {
    // startup timeout은 initialize/tools/list 같은 짧은 lifecycle 요청에 사용합니다.
    startupTimeoutMs: normalizeTimeout(
      config.startupTimeoutMs,
      DEFAULT_STARTUP_TIMEOUT_MS,
    ),
    // tool timeout은 실제 Codex commit message 생성 요청에 사용합니다.
    toolTimeoutMs,
    // cleanup timeout은 child process 종료를 기다릴 때만 사용합니다.
    cleanupTimeoutMs: normalizeTimeout(
      config.cleanupTimeoutMs,
      DEFAULT_CLEANUP_TIMEOUT_MS,
    ),
  };
}

/**
 * timeout 오류를 짧고 안전하게 만듭니다.
 * prompt, diff, stderr, MCP raw payload는 포함하지 않아 민감 정보가 노출되지 않게 합니다.
 *
 * @param {string} action - timeout이 발생한 작업 이름입니다.
 * @param {number} timeoutMs - 적용된 제한 시간입니다.
 * @returns {Error} 사용자에게 보여줄 수 있는 안전한 오류입니다.
 */
function createTimeoutError(action, timeoutMs) {
  return new Error(`Codex MCP ${action} timed out after ${timeoutMs}ms.`);
}

/**
 * Codex MCP 오류를 짧고 안전한 메시지로 바꿉니다.
 * MCP 서버가 반환한 error.data나 stderr에는 계정, 경로, 토큰 같은 세부 정보가 섞일 수 있으므로 노출하지 않습니다.
 *
 * @param {string} action - 실패한 작업 이름입니다.
 * @returns {Error} 안전한 provider 오류입니다.
 */
function createSafeMCPError(action) {
  return new Error(`Codex MCP ${action} failed.`);
}

/**
 * Promise에 제한 시간을 적용합니다.
 * MCP stdio 요청은 AbortSignal을 직접 지원하지 않으므로 호출자 관점에서 대기 시간을 제한합니다.
 *
 * @template T
 * @param {Promise<T>} promise - 제한 시간을 적용할 작업입니다.
 * @param {object} options - timeout 옵션입니다.
 * @param {string} options.action - 오류 메시지에 사용할 작업 이름입니다.
 * @param {number} options.timeoutMs - 제한 시간입니다.
 * @returns {Promise<T>} 작업 결과입니다.
 */
async function withTimeout(promise, { action, timeoutMs }) {
  let timeout;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        // 정상 응답이 오지 않을 때 안전한 timeout 오류로 빠져나옵니다.
        timeout = setTimeout(
          () => reject(createTimeoutError(action, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    // 정상 완료든 실패든 timer를 제거해 이벤트 루프를 불필요하게 붙잡지 않습니다.
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

/**
 * child process stderr를 제한된 길이로만 모읍니다.
 * 현재는 사용자에게 출력하지 않지만, 프로세스 종료 판정이나 향후 redacted debug에 사용할 수 있도록 과도한 메모리 사용을 막습니다.
 *
 * @param {string} current - 현재까지 누적된 stderr 문자열입니다.
 * @param {Buffer|string} chunk - 새 stderr chunk입니다.
 * @returns {string} 최대 길이로 제한된 stderr 문자열입니다.
 */
function appendCappedStderr(current, chunk) {
  // stderr 원문은 기본 출력하지 않지만, 너무 큰 로그로 메모리를 쓰지 않도록 4KB까지만 보관합니다.
  const next = `${current}${String(chunk)}`;
  return next.length > 4096 ? next.slice(-4096) : next;
}

/**
 * MCP JSON-RPC 결과에서 commit message 후보 문자열을 추출합니다.
 * 최신 MCP client는 structuredContent를 우선 보고, 구형 client 호환을 위해 content[] text도 허용합니다.
 *
 * @param {object} result - tools/call의 result 객체입니다.
 * @returns {string} 추출된 응답 문자열입니다.
 */
function extractToolText(result) {
  let text = "";
  
  // Codex MCP 문서 예시의 최신 응답 위치입니다.
  if (typeof result?.structuredContent?.content === "string") {
    text = result.structuredContent.content;
  } else if (Array.isArray(result?.content)) {
    // 일부 MCP client/server 조합은 content 배열에 text block을 담을 수 있습니다.
    text = result.content
      .map((item) => {
        // text block만 commit message 후보로 사용하고 다른 타입은 무시합니다.
        if (item?.type === "text" && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  const trimmed = text.trim();
  // 반환된 결과가 JSON 형식의 에러 명세 문자열인지 파싱 및 예외 방어 처리를 수행합니다.
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === "error" || parsed.error) {
        const errorMsg = parsed.error?.message || parsed.message || "Codex MCP server internal error";
        throw new Error(errorMsg);
      }
    } catch (e) {
      // JSON 파싱 실패는 일반 텍스트일 수 있으므로 넘어가고,
      // 명시적으로 던진 에러(Error) 유형인 경우에만 상위로 전파합니다.
      if (e.message !== "Codex MCP response did not include a commit message." && !e.name.includes("SyntaxError")) {
        throw e;
      }
    }
  }

  return text;
}

/**
 * Codex MCP server가 반환한 tools/list 결과에 codex tool이 있는지 확인합니다.
 * 다른 tool이 있더라도 convention-cli는 commit message 생성을 위한 codex tool만 호출합니다.
 *
 * @param {object} result - tools/list 응답 result입니다.
 * @returns {boolean} codex tool 존재 여부입니다.
 */
function hasCodexTool(result) {
  // MCP tools/list 응답은 일반적으로 result.tools 배열을 반환합니다.
  const tools = Array.isArray(result?.tools) ? result.tools : [];
  return tools.some((tool) => tool?.name === CODEX_TOOL_NAME);
}

/**
 * Codex MCP tool에 전달할 arguments를 구성합니다.
 * 파일 쓰기나 shell 실행이 필요 없는 commit message 생성만 수행하도록 read-only sandbox와 never approval을 강제합니다.
 *
 * @param {object} params - tool argument 구성 값입니다.
 * @param {string} params.prompt - Codex에 전달할 prompt입니다.
 * @param {object} params.config - 사용자 provider 설정입니다.
 * @returns {object} tools/call arguments 객체입니다.
 */
function buildCodexToolArguments({ prompt, config = {} }) {
  // 사용자가 위험한 sandbox를 config에 넣어도 commit message provider에서는 절대 반영하지 않습니다.
  const args = {
    prompt,
    "approval-policy": "never",
    sandbox: "read-only",
    cwd: process.cwd(),
  };

  // 모델 버전은 비어 있지 않은 문자열일 때만 Codex MCP tool에 전달합니다.
  if (
    typeof config.modelVersion === "string" &&
    config.modelVersion.trim().length > 0
  ) {
    args.model = config.modelVersion.trim();
  }

  return args;
}

/**
 * Codex MCP server subprocess를 안전하게 시작합니다.
 * shell 문자열을 사용하지 않고 command와 args를 분리해 실행합니다.
 *
 * @param {object} options - 실행 옵션입니다.
 * @param {Function} options.spawnImpl - 테스트에서 주입할 수 있는 spawn 구현입니다.
 * @returns {import("node:child_process").ChildProcess} Codex MCP server process입니다.
 */
function startCodexMCPServer({ spawnImpl = defaultSpawn } = {}) {
  const isWin = process.platform === "win32";
  
  // 윈도우 환경에서는 Node.js 최근 보안 패치(CVE-2024-27983 등) 영향으로 
  // shell: false 상태에서 배치 파일(.cmd)을 직접 spawn하면 EINVAL이 발생합니다.
  // 따라서 윈도우인 경우 shell: true를 사용하여 셸을 통해 배치 파일이 실행되도록 합니다.
  // 이때 Node.js 최근 버전(v22, v24)에서 shell: true 상태로 args 배열을 함께 보낼 때 
  // 출력되는 DEP0190 DeprecationWarning을 방지하기 위해 단일 문자열 명령어("codex mcp-server")로 묶어서 실행합니다.
  if (isWin) {
    return spawnImpl("codex mcp-server", [], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      windowsHide: true,
    });
  }

  // Unix-like 플랫폼에서는 shell: false 및 인자 배열 방식을 철저히 고수합니다.
  return spawnImpl("codex", ["mcp-server"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  });
}

/**
 * line-delimited JSON-RPC를 사용하는 최소 MCP stdio client입니다.
 * 외부 SDK를 추가하지 않고 Codex MCP provider에 필요한 initialize/tools/list/tools/call만 처리합니다.
 */
class MCPStdioClient {
  /**
   * @param {object} params - client 생성 옵션입니다.
   * @param {import("node:child_process").ChildProcess} params.child - MCP server subprocess입니다.
   */
  constructor({ child }) {
    // MCP server subprocess 참조입니다.
    this.child = child;
    // JSON-RPC 요청 id를 단조 증가시켜 response와 request를 매칭합니다.
    this.nextId = 1;
    // 아직 응답을 받지 못한 request resolve/reject 목록입니다.
    this.pending = new Map();
    // stdout chunk가 줄 단위로 끊겨 오지 않을 수 있으므로 남은 조각을 보관합니다.
    this.stdoutBuffer = "";
    // stderr는 출력하지 않지만 과도한 메모리 사용을 막기 위해 capped buffer로 보관합니다.
    this.stderrBuffer = "";
    // cleanup 중복 호출을 막기 위한 상태입니다.
    this.closed = false;

    this.attachListeners();
  }

  /**
   * child process stream과 lifecycle event listener를 연결합니다.
   * stdout에는 MCP JSON-RPC 메시지만 와야 하므로 parsing 실패 시 raw payload 없이 안전하게 실패시킵니다.
   */
  attachListeners() {
    // stdout data는 newline-delimited JSON-RPC 메시지로 파싱합니다.
    this.child.stdout?.on("data", (chunk) => {
      this.handleStdout(chunk);
    });

    // stderr는 사용자에게 직접 보여주지 않고 제한된 길이로만 보관합니다.
    this.child.stderr?.on("data", (chunk) => {
      this.stderrBuffer = appendCappedStderr(this.stderrBuffer, chunk);
    });

    // process 시작 자체가 실패하면 모든 대기 요청을 안전한 오류로 실패시킵니다.
    this.child.on?.("error", () => {
      this.rejectAll(new Error("Codex MCP server could not be started. Install Codex CLI and login before using codex-mcp."));
    });

    // 예상보다 먼저 종료되면 pending 요청은 raw stderr 없이 안전한 오류로 실패시킵니다.
    this.child.on?.("exit", () => {
      this.rejectAll(new Error("Codex MCP server exited before completing the request."));
    });
  }

  /**
   * stdout chunk를 line 단위 JSON-RPC 메시지로 처리합니다.
   *
   * @param {Buffer|string} chunk - MCP server stdout chunk입니다.
   */
  handleStdout(chunk) {
    // chunk boundary가 JSON line boundary와 다를 수 있으므로 buffer에 누적합니다.
    this.stdoutBuffer += String(chunk);
    const lines = this.stdoutBuffer.split(/\r?\n/u);
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      // 빈 줄은 무시합니다.
      if (line.trim().length === 0) {
        continue;
      }

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        // raw line에는 prompt/diff가 섞일 수 있으므로 출력하지 않고 모든 요청을 안전하게 실패시킵니다.
        this.rejectAll(createSafeMCPError("response parsing"));
        continue;
      }

      this.handleMessage(message);
    }
  }

  /**
   * JSON-RPC message를 pending request에 연결합니다.
   * server notification이나 client로 오는 request는 provider에 필요하지 않으므로 무시합니다.
   *
   * @param {object} message - JSON-RPC message입니다.
   */
  handleMessage(message) {
    // response id가 없는 notification/request는 현재 provider가 처리할 필요가 없습니다.
    if (!Object.hasOwn(message, "id")) {
      return;
    }

    // matching pending request가 없으면 오래된 응답이거나 server 오동작이므로 무시합니다.
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    // 응답을 받은 request는 pending 목록에서 제거합니다.
    this.pending.delete(message.id);

    // JSON-RPC error는 raw data 없이 안전한 provider 오류로 변환합니다.
    if (message.error) {
      pending.reject(createSafeMCPError(pending.action));
      return;
    }

    // 정상 result를 resolve합니다.
    pending.resolve(message.result);
  }

  /**
   * MCP server에 JSON-RPC request를 보냅니다.
   *
   * @param {string} method - JSON-RPC method입니다.
   * @param {object} params - JSON-RPC params입니다.
   * @param {string} action - 오류 메시지에 사용할 작업 이름입니다.
   * @returns {Promise<object>} JSON-RPC result입니다.
   */
  request(method, params, action) {
    // request id를 발급합니다.
    const id = this.nextId;
    this.nextId += 1;

    // MCP stdio transport는 newline-delimited JSON-RPC 메시지를 stdin에 씁니다.
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return new Promise((resolve, reject) => {
      // pending에 먼저 등록한 뒤 write 실패도 같은 reject 경로로 처리합니다.
      this.pending.set(id, { resolve, reject, action });

      try {
        this.child.stdin?.write(`${payload}\n`, "utf8", (error) => {
          if (error) {
            this.pending.delete(id);
            reject(createSafeMCPError(action));
          }
        });
      } catch {
        this.pending.delete(id);
        reject(createSafeMCPError(action));
      }
    });
  }

  /**
   * MCP server에 response가 필요 없는 JSON-RPC notification을 보냅니다.
   *
   * @param {string} method - JSON-RPC notification method입니다.
   * @param {object} params - notification params입니다.
   */
  notify(method, params = {}) {
    // initialized notification은 응답을 기다리지 않으므로 pending에 등록하지 않습니다.
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    });

    try {
      this.child.stdin?.write(`${payload}\n`, "utf8");
    } catch {
      // notification 실패는 다음 request 실패로 드러나므로 여기서는 raw error를 노출하지 않습니다.
    }
  }

  /**
   * pending request를 모두 실패 처리합니다.
   *
   * @param {Error} error - 안전하게 만든 오류입니다.
   */
  rejectAll(error) {
    // 이미 종료된 client에서 중복 reject하는 것을 막습니다.
    if (this.closed) {
      return;
    }

    for (const { reject } of this.pending.values()) {
      reject(error);
    }
    this.pending.clear();
  }

  /**
   * MCP server process를 정리합니다.
   * stdin을 닫고 아직 살아 있으면 kill을 시도하되, cleanup 실패를 사용자-facing 오류로 만들지 않습니다.
   */
  async close() {
    // cleanup은 여러 finally 경로에서 호출될 수 있으므로 한 번만 수행합니다.
    if (this.closed) {
      return;
    }
    this.closed = true;

    // 더 이상 응답을 기다리지 않도록 pending 요청을 정리합니다.
    this.pending.clear();

    try {
      this.child.stdin?.end();
    } catch {
      // stdin 종료 실패에는 로컬 경로나 내부 상태가 들어갈 수 있어 출력하지 않습니다.
    }

    // 이미 종료된 process라면 kill을 호출하지 않습니다.
    if (this.child.exitCode !== null || this.child.killed === true) {
      return;
    }

    try {
      this.child.kill?.();
    } catch {
      // kill 실패도 cleanup best-effort로 보고 사용자에게 노출하지 않습니다.
    }
  }
}

/**
 * Codex MCP server와 통신해 commit message를 생성합니다.
 *
 * @param {object} params - 실행 매개변수입니다.
 * @param {string} params.prompt - Codex에 전달할 commit prompt입니다.
 * @param {object} params.config - 사용자 provider 설정입니다.
 * @param {Function} [params.spawnImpl] - 테스트에서 주입할 수 있는 spawn 구현입니다.
 * @returns {Promise<string>} Codex MCP가 생성한 commit message 후보입니다.
 */
export async function generateCommitMessage({
  prompt,
  config = {},
  spawnImpl = defaultSpawn,
}) {
  // prompt가 비어 있으면 MCP server를 실행하지 않고 바로 중단합니다.
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new TypeError("prompt must be a non-empty string");
  }

  // codex-mcp는 convention-cli가 인증 정보를 관리하지 않으므로 none 인증만 허용합니다.
  if (config.authType && config.authType !== "none") {
    throw new Error('codex-mcp provider only supports authType "none".');
  }

  // timeout 설정을 한 곳에서 정규화합니다.
  const timeouts = resolveTimeouts(config);
  // Codex MCP server subprocess를 안전한 argv 배열 방식으로 시작합니다.
  const child = startCodexMCPServer({ spawnImpl });
  // stdout/stdin JSON-RPC lifecycle을 관리하는 최소 MCP client를 생성합니다.
  const client = new MCPStdioClient({ child });

  try {
    // MCP lifecycle 첫 단계인 initialize 요청을 보냅니다.
    await withTimeout(
      client.request(
        "initialize",
        {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "convention-cli",
            version: "1.0.0",
          },
        },
        "initialize",
      ),
      {
        action: "initialize",
        timeoutMs: timeouts.startupTimeoutMs,
      },
    );

    // initialize 완료 후 MCP 규약에 맞춰 initialized notification을 보냅니다.
    client.notify("notifications/initialized");

    // Codex MCP server가 필요한 codex tool을 제공하는지 확인합니다.
    const toolsResult = await withTimeout(
      client.request("tools/list", {}, "tools/list"),
      {
        action: "tools/list",
        timeoutMs: timeouts.startupTimeoutMs,
      },
    );

    // codex tool이 없으면 다른 tool을 호출하지 않고 명확하게 중단합니다.
    if (!hasCodexTool(toolsResult)) {
      throw new Error("Codex MCP server did not expose the required codex tool.");
    }

    // commit message 생성은 codex tool 하나만 호출합니다.
    const toolResult = await withTimeout(
      client.request(
        "tools/call",
        {
          name: CODEX_TOOL_NAME,
          arguments: buildCodexToolArguments({ prompt, config }),
        },
        "commit message request",
      ),
      {
        action: "commit message request",
        timeoutMs: timeouts.toolTimeoutMs,
      },
    );

    // tool result에서 commit message 후보 텍스트를 추출합니다.
    const message = extractToolText(toolResult).trim();

    // 응답이 비어 있으면 상위 AI cleanup 단계가 처리할 수 없으므로 provider에서 명확히 실패시킵니다.
    if (message.length === 0) {
      throw new Error("Codex MCP response did not include a commit message.");
    }

    return message;
  } finally {
    // 성공/실패와 관계없이 MCP subprocess를 정리해 CLI가 오래 붙잡히지 않게 합니다.
    await withTimeout(client.close(), {
      action: "cleanup",
      timeoutMs: timeouts.cleanupTimeoutMs,
    }).catch(() => {});
  }
}

/**
 * Codex MCP provider의 모델 목록을 반환합니다.
 * 실제 모델 목록 조회는 Codex CLI 내부 정책과 로그인 상태에 의존하므로 초기 구현에서는 외부 호출 없이 기본 모델만 제공합니다.
 *
 * @param {object} config - 사용자 provider 설정입니다.
 * @returns {Promise<string[]>} 선택 가능한 모델명 배열입니다.
 */
export async function listModels(config = {}) {
  // 사용자가 이미 지정한 모델이 있고 가용 리스트에 포함되어 있다면, 
  // 그 선택한 활성 모델을 배열 맨 처음에 두어 기본 커서 선택값으로 제안합니다.
  if (
    typeof config.modelVersion === "string" &&
    config.modelVersion.trim().length > 0
  ) {
    const activeModel = config.modelVersion.trim();
    const filtered = SUPPORTED_CODEX_MCP_MODELS.filter((m) => m !== activeModel);
    return [activeModel, ...filtered];
  }

  // 전체 지원 모델 목록을 순서대로 반환합니다. (gpt-5.3-codex가 배열 맨 첫 자리에 위치)
  return SUPPORTED_CODEX_MCP_MODELS;
}

/**
 * codex-mcp provider 설정을 검증합니다.
 * 인증은 Codex CLI가 자체적으로 처리하므로 convention-cli의 credentials 저장소를 사용하지 않습니다.
 *
 * @param {object} config - 사용자 provider 설정입니다.
 * @returns {boolean} 설정이 유효하면 true입니다.
 */
export function validateConfig(config = {}) {
  // 명시 authType이 있다면 none만 허용합니다.
  if (config.authType && config.authType !== "none") {
    throw new Error('codex-mcp provider only supports authType "none".');
  }

  return true;
}

// 테스트에서 MCP tool argument 보안 정책을 직접 검증할 수 있도록 내부 helper를 명시적으로 내보냅니다.
export const __test__ = {
  buildCodexToolArguments,
  extractToolText,
  hasCodexTool,
};
