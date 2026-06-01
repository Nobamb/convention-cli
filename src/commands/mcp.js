import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { addFile, getChangedFiles, getFileDiffs, commit } from "../core/git.js";
import { maskSensitiveDiff } from "../core/security.js";
import { loadConfig } from "../config/store.js";
import { loadValidatedTemplate } from "../templates/loader.js";
import { buildCommitPrompt } from "../core/prompt.js";

// MCP 프로토콜 및 통신에 사용되는 상수들을 선언합니다.
const MCP_PROTOCOL_VERSION = "2025-06-18";
const REDACTED = "[REDACTED]";

/**
 * ESM 환경의 유닛 테스트에서 종속성 모킹(Mocking)이 가능하도록 
 * Git 처리 및 설정 로드 함수들을 하나의 의존성 객체로 구조화합니다.
 */
export const deps = {
  addFile,
  getChangedFiles,
  getFileDiffs,
  commit,
  loadConfig,
  loadValidatedTemplate,
  buildCommitPrompt,
};

/**
 * MCP 호스트가 전달한 파일 경로와 Git이 반환한 파일 경로를 같은 기준으로 비교하기 위해 정규화합니다.
 *
 * Windows 환경에서는 호스트나 테스트가 역슬래시(`\`)를 넘길 수 있지만 Git porcelain 출력과 diff pathspec은
 * 일반적으로 슬래시(`/`)를 사용합니다. 비교 기준만 맞추기 위한 함수이며, 실제 Git 명령에 넘길 값은
 * `getChangedFiles()`에서 확인된 원본 경로를 사용합니다.
 *
 * @param {string} file - MCP 호스트가 전달했거나 Git이 반환한 파일 경로입니다.
 * @returns {string} 슬래시 기준으로 정규화된 파일 경로입니다.
 */
function normalizeMcpFilePath(file) {
  return file.replaceAll("\\", "/");
}

/**
 * MCP 호스트가 넘긴 `files` 항목이 안전한 저장소 내부 상대 경로인지 검사합니다.
 *
 * Git은 `--` 뒤의 인자도 단순 literal path로만 처리하지 않고 `:(glob)**` 같은 pathspec magic을 해석합니다.
 * MCP 호스트는 신뢰 경계 밖 입력이므로 pathspec magic, glob 패턴, 절대 경로, 상위 디렉터리 이동을 모두
 * 거부해야 민감 파일 제외 정책이 우회되지 않습니다.
 *
 * @param {unknown} file - MCP `execute_git_commit`의 `files` 배열에서 전달된 단일 항목입니다.
 * @returns {boolean} 안전한 상대 파일 경로로 볼 수 있으면 true, Git pathspec 또는 범위 확장 위험이 있으면 false입니다.
 */
function isSafeMcpRequestedFile(file) {
  if (typeof file !== "string" || file.length === 0 || file !== file.trim()) {
    return false;
  }

  if (file.includes("\0")) {
    return false;
  }

  const normalized = normalizeMcpFilePath(file);

  return (
    !normalized.startsWith(":") &&
    !normalized.startsWith("/") &&
    !path.isAbsolute(file) &&
    !/[?*[\]]/u.test(normalized) &&
    !normalized.split("/").includes("..")
  );
}

/**
 * MCP 호스트가 특정 파일 목록을 요청했을 때 실제 변경 파일 목록과 교집합을 계산합니다.
 *
 * 외부 입력인 `requestedFiles`를 그대로 Git pathspec으로 넘기면 `:(glob)**` 같은 magic pathspec으로
 * `.env` 등 민감 파일 제외 정책을 우회할 수 있습니다. 따라서 먼저 `getChangedFiles()`가 반환한 실제 변경
 * 파일 목록을 기준 목록으로 삼고, MCP가 요청한 값은 안전한 상대 경로인지 확인한 뒤 정확히 일치하는 항목만
 * 커밋 후보로 사용합니다.
 *
 * @param {string[]} requestedFiles - MCP 호스트가 커밋 대상으로 요청한 파일 목록입니다.
 * @param {string[]} changedFiles - Git porcelain에서 확인한 실제 변경 파일 목록입니다.
 * @returns {string[]} 실제 변경 파일 중 MCP 요청과 안전하게 매칭된 파일 목록입니다.
 */
function resolveRequestedFiles(requestedFiles, changedFiles) {
  const changedFileByNormalizedPath = new Map(
    changedFiles.map((file) => [normalizeMcpFilePath(file), file]),
  );
  const resolvedFiles = [];

  for (const requestedFile of requestedFiles) {
    if (!isSafeMcpRequestedFile(requestedFile)) {
      throw new Error("MCP files argument contains an unsafe file path.");
    }

    const matchedFile = changedFileByNormalizedPath.get(
      normalizeMcpFilePath(requestedFile),
    );

    if (!matchedFile) {
      throw new Error("MCP files argument contains a file that is not changed.");
    }

    if (!resolvedFiles.includes(matchedFile)) {
      resolvedFiles.push(matchedFile);
    }
  }

  return resolvedFiles;
}

function resolveCommittableFiles(requestedFiles) {
  const changedFiles = deps.getChangedFiles();
  const candidateFiles =
    Array.isArray(requestedFiles) && requestedFiles.length > 0
      ? resolveRequestedFiles(requestedFiles, changedFiles)
      : changedFiles;
  const fileDiffs = deps.getFileDiffs(candidateFiles);

  return fileDiffs.map(({ file }) => file);
}

function stageAndCommit(message, requestedFiles) {
  const files = resolveCommittableFiles(requestedFiles);

  if (files.length === 0) {
    throw new Error("No committable changes were found.");
  }

  for (const file of files) {
    deps.addFile(file);
  }

  deps.commit(message, files);
  return files;
}

/**
 * 윈도우(CON) 및 유닉스(/dev/tty) 환경에 맞추어 stdio 파이프 라인의 충돌 없이 
 * 사용자에게 직접 커밋 최종 승인을 요청하는 대화형 TTY 프롬프트입니다.
 * 
 * @param {string} message - 사용자에게 콘솔로 보여줄 프롬프트 안내문
 * @returns {Promise<boolean>} - 사용자가 Y/y를 선택해 승인하면 true, N/n을 선택하거나 취소하면 false
 */
async function promptTtyConfirm(message) {
  const isWin = process.platform === "win32";
  const ttyInPath = isWin ? "CON" : "/dev/tty";
  const ttyOutPath = isWin ? "CON" : "/dev/tty";

  let input, output;
  try {
    // stdio 파이프와 무관한 키보드 다이렉트 입출력 채널을 엽니다.
    input = fs.createReadStream(ttyInPath);
    output = fs.createWriteStream(ttyOutPath);
  } catch {
    // TTY 스트림을 열 수 없는 비인터랙티브 환경(CI/CD 등)인 경우 안전하게 거부 처리합니다.
    return false;
  }

  const rl = readline.createInterface({
    input,
    output,
  });

  return new Promise((resolve) => {
    // stderr와 다이렉트 TTY를 활용해 로컬 최종 컨펌 메시지를 띄웁니다.
    rl.question(`\n${message} (Y/n): `, (answer) => {
      rl.close();
      input.destroy();
      output.destroy();
      const normalized = answer.trim().toLowerCase();
      // 사용자가 그냥 엔터를 치거나(y) 혹은 y, yes를 입력한 경우 승인으로 판정합니다.
      resolve(normalized === "" || normalized === "y" || normalized === "yes");
    });
  });
}

/**
 * stdout으로 안전하게 JSON-RPC 응답 패킷을 뉴라인과 함께 흘려보냅니다.
 * 
 * @param {object} response - JSON-RPC 응답 객체
 */
function sendJSONRPCResponse(response) {
  process.stdout.write(JSON.stringify(response) + "\n");
}

/**
 * 에러 발생 시 raw stack이나 환경 정보를 노출시키지 않도록
 * 규격에 맞는 안전한 JSON-RPC 에러 응답을 송출합니다.
 * 
 * @param {number|string|null} id - 요청 ID
 * @param {number} code - JSON-RPC 에러 코드
 * @param {string} message - 에러 설명 메시지
 */
function sendJSONRPCError(id, code, message) {
  sendJSONRPCResponse({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

/**
 * convention-cli를 로컬 MCP 서버 모드로 동작하도록 가동시키는 핵심 제어기입니다.
 * process.stdin의 스트림을 줄 단위로 안전하게 버퍼링하여 파싱하고 라우팅합니다.
 */
export async function runMCPServer() {
  let stdinBuffer = "";

  // 표준 입력(stdin) 스트림을 utf-8로 읽기 대기합니다.
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (chunk) => {
    stdinBuffer += chunk;
    const lines = stdinBuffer.split(/\r?\n/u);
    // 마지막 미완성 줄은 버퍼에 그대로 남겨두어 다음 데이터 유입 시 결합되게 합니다.
    stdinBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }

      let request;
      try {
        request = JSON.parse(line);
      } catch {
        // 파싱 실패 시, raw line 노출 없이 규격화된 parsing error 응답만 돌려줍니다.
        sendJSONRPCError(null, -32700, "Parse error");
        continue;
      }

      // JSON-RPC 2.0 스펙 규격 충족 검사
      if (request.jsonrpc !== "2.0") {
        sendJSONRPCError(request.id ?? null, -32600, "Invalid Request");
        continue;
      }

      handleRPCRequest(request).catch((err) => {
        sendJSONRPCError(request.id ?? null, -32603, err.message || "Internal error");
      });
    }
  });

  // 호스트 측 파이프가 끊겨 stdin 스트림이 종료(end)되면 안전하고 깔끔하게 안전 종료(Exit 0)합니다.
  process.stdin.on("end", () => {
    process.exit(0);
  });
}

/**
 * 개별 JSON-RPC 요청의 method를 판별하여 분기 라우팅을 수행합니다.
 * 
 * @param {object} request - 파싱된 JSON-RPC 요청 객체
 */
async function handleRPCRequest(request) {
  const { method, params, id } = request;

  switch (method) {
    case "initialize": {
      // MCP 규격에 맞게 protocolVersion 및capabilities를 담아 응답합니다.
      sendJSONRPCResponse({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "convention-cli-mcp",
            version: "1.0.0",
          },
        },
      });
      break;
    }

    case "notifications/initialized": {
      // initialized notification은 반환할 응답이 불필요하므로 안전하게 수신 완료 로깅만 거치고 넘어갑니다.
      break;
    }

    case "tools/list": {
      // convention-cli가 에이전트에게 공급하는 3가지 세부 도구 목록을 반환합니다.
      sendJSONRPCResponse({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_masked_git_diff",
              description: "로컬 Git 저장소의 변경 diff를 안전하게 정화하여 추출합니다. 비밀키/패스워드 등 민감 정보가 사전에 마스킹 처리되어 제공됩니다.",
              inputSchema: {
                type: "object",
                properties: {},
              },
            },
            {
              name: "build_commit_prompt",
              description: "현재 설정되어 있는 언어(ko, en 등)와 프로젝트 내의 .convention/template.json 규칙을 통합하여 최적화된 Conventional Commits 프롬프트 가이드라인을 빌드합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  diff: {
                    type: "string",
                    description: "프롬프트 내에 포함시킬 원본 Git Diff 본문 문자열입니다.",
                  },
                },
              },
            },
            {
              name: "execute_git_commit",
              description: "AI가 최종 생성해 낸 커밋 메시지를 주입받아 실제 로컬 Git 저장소에 안전 커밋을 최종 집행합니다. (로컬 사용자 최종 Y/N 확인 절차가 필수 가동됩니다.)",
              inputSchema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "생성된 Conventional Commits 형식의 최종 커밋 메시지입니다.",
                  },
                  files: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                    description: "커밋 대상 파일 목록입니다. 지정하지 않을 경우 전체 변경 파일이 대상이 됩니다.",
                  },
                },
                required: ["message"],
              },
            },
          ],
        },
      });
      break;
    }

    case "tools/call": {
      if (!params || typeof params.name !== "string") {
        sendJSONRPCError(id, -32602, "Invalid params");
        return;
      }

      await handleToolCall(id, params.name, params.arguments ?? {});
      break;
    }

    default: {
      sendJSONRPCError(id, -32601, "Method not found");
      break;
    }
  }
}

/**
 * MCP tools/call을 통해 에이전트가 호출한 도구 핸들러를 물리적으로 집행합니다.
 * 
 * @param {number|string} id - 요청 ID
 * @param {string} toolName - 도구 이름
 * @param {object} args - 도구에 전달된 매개변수 인수
 */
async function handleToolCall(id, toolName, args) {
  switch (toolName) {
    case "get_masked_git_diff": {
      // 1) deps.getChangedFiles()를 통해 변경된 로컬 파일 목록 수집
      const files = deps.getChangedFiles();
      // 2) deps.getFileDiffs(files)를 사용하여 민감 파일은 사전에 배제한 채로 안전하게 파일별 diff 추출
      const fileDiffs = deps.getFileDiffs(files);
      
      // 3) 각 diff 본문 내의 비밀키나 패스워드 패턴을 찾아 철저하게 마스킹 처리(redaction)
      const maskedDiffs = fileDiffs.map(({ file, diff }) => {
        const result = maskSensitiveDiff(diff);
        return `diff --git a/${file} b/${file}\n${result.diff}`;
      }).join("\n");

      sendJSONRPCResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: maskedDiffs,
            },
          ],
        },
      });
      break;
    }

    case "build_commit_prompt": {
      const config = deps.loadConfig();
      const template = deps.loadValidatedTemplate();
      const diffContent = args.diff || "(No diff content provided)";

      // 기존 prompt.js의 buildCommitPrompt를 재사용하여 완벽히 일관성 있는 Conventional Commits 시스템 프롬프트 조립
      const prompt = deps.buildCommitPrompt({
        diff: diffContent,
        language: config.language || "ko",
        mode: config.mode || "batch",
        template: template,
      });

      sendJSONRPCResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      });
      break;
    }

    case "execute_git_commit": {
      const { message } = args;
      const files = args.files ?? [];

      if (typeof message !== "string" || message.trim().length === 0) {
        sendJSONRPCError(id, -32602, "message must be a non-empty string");
        return;
      }

      if (!Array.isArray(files)) {
        sendJSONRPCError(id, -32602, "files must be an array when provided");
        return;
      }

      const config = deps.loadConfig();
      let isApproved = true;

      // confirmBeforeCommit이 true로 활성화되어 있다면, 로컬 TTY 입출력을 통해 사용자 수동 컨펌을 대기합니다.
      if (config.confirmBeforeCommit !== false) {
        const previewMsg = `✨ Antigravity MCP Generated Commit Message:\n========================================\n${message}\n========================================`;
        isApproved = await promptTtyConfirm(`${previewMsg}\n\n이 메시지로 커밋하시겠습니까?`);
      }

      if (!isApproved) {
        // 사용자가 최종 승인을 거부(No)한 경우 실제 커밋을 차단하고 결과를 응답합니다.
        sendJSONRPCResponse({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: "Commit cancelled by user.",
              },
            ],
          },
        });
        return;
      }

      try {
        // Stage only files that survived the same sensitive-file/diff filter used for prompts.
        stageAndCommit(message, files);
        sendJSONRPCResponse({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: "Commit completed successfully.",
              },
            ],
          },
        });
      } catch (err) {
        // Git 실행 오류 시 raw error 노출 없이 깔끔한 실패 알림 전송
        sendJSONRPCResponse({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Failed to create commit: ${err.message || "Git execution failed"}`,
              },
            ],
          },
        });
      }
      break;
    }

    default: {
      sendJSONRPCError(id, -32601, "Tool not found");
      break;
    }
  }
}
