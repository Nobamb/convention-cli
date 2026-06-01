import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import prompts from "prompts";
import {
  AGY_MCP_SERVER_NAME,
  buildConventionMcpServerConfig,
  detectExistingTargets,
  getAntigravityMcpConfigCandidate,
  getAntigravityMcpConfigCandidates,
  mergeMcpServerConfig,
  readMcpConfig,
  removeMcpServerConfig,
  writeMcpConfig,
} from "../core/agyMcpConfig.js";
import { info, success, warn } from "../utils/logger.js";
import { confirmAction } from "../utils/ui.js";

/**
 * 현재 설치된 convention CLI entry 파일의 절대 경로를 반환합니다.
 *
 * 이 command 파일은 `src/commands`에 있으므로 repository/package 기준 `bin/convention.js`는
 * 두 단계 위의 `bin` 폴더에 있습니다. 전역 npm 설치 환경에서도 import.meta.url은 실제 설치된
 * 파일 위치를 가리키므로 Antigravity 설정에 상대 경로 대신 안전한 절대 경로를 기록할 수 있습니다.
 *
 * @returns {string} `bin/convention.js`의 절대 경로입니다.
 */
function resolveConventionCliPath() {
  return fileURLToPath(new URL("../../bin/convention.js", import.meta.url));
}

/**
 * Git 저장소 루트를 찾고, 실패하면 현재 작업 디렉터리를 반환합니다.
 *
 * `mcp_config.json`의 `cwd`가 저장소 밖이면 MCP 서버가 Git 변경사항을 찾지 못할 수 있습니다.
 * 그래서 우선 `git rev-parse --show-toplevel`을 argv 배열 방식으로 실행하고, Git 저장소가 아닌
 * 위치에서는 사용자가 명령을 실행한 현재 디렉터리를 보존합니다.
 *
 * @param {string} [cwd=process.cwd()] - Git 루트 탐색을 시작할 작업 디렉터리입니다.
 * @returns {string} Git 저장소 루트 또는 fallback 현재 작업 디렉터리입니다.
 */
function resolveRepositoryRootOrCwd(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd;
  }
}

/**
 * 사용자에게 Antigravity target 후보를 선택하게 합니다.
 *
 * 이 함수는 선택 가능한 target key와 표시용 label/path만 보여주며, 기존 config 원문이나 다른 MCP
 * 서버 설정은 출력하지 않습니다. prompt가 취소되면 파일 쓰기를 진행하지 않도록 오류를 던집니다.
 *
 * @param {Array<{target: string, label: string, configPath: string}>} candidates - 선택 가능한 후보 목록입니다.
 * @returns {Promise<string>} 사용자가 선택한 target key입니다.
 */
async function selectAgyMcpTarget(candidates) {
  const response = await prompts(
    {
      type: "select",
      name: "target",
      message: "Antigravity MCP 설정을 저장할 profile을 선택하세요.",
      choices: candidates.map((candidate) => ({
        title: `${candidate.label} (${candidate.target})`,
        description: candidate.configPath,
        value: candidate.target,
      })),
      initial: 0,
    },
    {
      // target 선택이 취소되면 create/update/delete를 진행하지 않습니다.
      onCancel: () => false,
    },
  );

  if (typeof response?.target !== "string" || response.target.length === 0) {
    throw new Error("Antigravity MCP target 선택이 취소되었습니다.");
  }

  return response.target;
}

/**
 * CLI 옵션과 감지 결과를 기준으로 실제 작업 대상 후보를 결정합니다.
 *
 * `--target/-tg`가 있으면 해당 후보만 반환합니다. target이 없으면 고정 후보 중 이미 존재하는
 * 디렉터리/파일을 찾고, 후보가 여러 개이거나 없을 때는 interactive 환경에서만 사용자 선택을 받습니다.
 *
 * @param {object} params - target 결정 인자입니다.
 * @param {string} [params.target] - 사용자가 지정한 target key입니다.
 * @param {string} params.homeDir - 사용자 홈 디렉터리 또는 테스트용 임시 홈입니다.
 * @param {boolean} params.interactive - prompt를 띄울 수 있는 실행인지 여부입니다.
 * @param {typeof fs} params.fsImpl - 파일 시스템 구현체입니다.
 * @returns {Promise<{target: string, label: string, dirPath: string, configPath: string}>} 선택된 설정 파일 후보입니다.
 */
async function resolveTargetCandidate({ target, homeDir, interactive, fsImpl }) {
  if (typeof target === "string" && target.trim().length > 0) {
    return getAntigravityMcpConfigCandidate(target, homeDir);
  }

  const candidates = getAntigravityMcpConfigCandidates(homeDir);
  const existingCandidates = detectExistingTargets(candidates, { fsImpl });

  if (existingCandidates.length === 1) {
    return existingCandidates[0];
  }

  if (!interactive) {
    throw new Error(
      "Antigravity MCP target을 자동으로 결정할 수 없습니다. --target 또는 -tg 값을 지정해 주세요.",
    );
  }

  const selectableCandidates =
    existingCandidates.length > 1
      ? existingCandidates
      : candidates.filter((candidate) =>
          ["editor", "cli"].includes(candidate.target),
        );
  const selectedTarget = await selectAgyMcpTarget(selectableCandidates);
  return getAntigravityMcpConfigCandidate(selectedTarget, homeDir);
}

/**
 * preview와 완료 로그에 사용할 안전한 작업 요약을 출력합니다.
 *
 * 기존 `mcp_config.json` 원문이나 다른 MCP server 설정은 출력하지 않고, 이번 작업 대상과
 * convention-cli 서버 설정의 핵심 metadata만 보여줍니다. logger는 secret-like 값을 한 번 더
 * 마스킹하므로 경로/메시지에 토큰 형태 문자열이 섞여도 방어적으로 처리됩니다.
 *
 * @param {object} params - 출력할 요약 정보입니다.
 * @param {"install" | "uninstall"} params.mode - 설치 또는 제거 작업 종류입니다.
 * @param {"create" | "update" | "delete" | "noop"} params.action - 실제 수행될 세부 작업입니다.
 * @param {{target: string, label: string, configPath: string}} params.candidate - 대상 후보입니다.
 * @param {object|null} [params.serverConfig=null] - 설치 시 기록될 서버 설정입니다.
 * @returns {void}
 */
function printAgyMcpSummary({ mode, action, candidate, serverConfig = null }) {
  info(`Antigravity MCP ${mode} ${action}`);
  info(`Target: ${candidate.target} (${candidate.label})`);
  info(`Config path: ${candidate.configPath}`);
  info(`Server: ${AGY_MCP_SERVER_NAME}`);

  if (serverConfig) {
    info(`Command: ${serverConfig.command}`);
    info(`Args: ${serverConfig.args.join(" ")}`);
    info(`Cwd: ${serverConfig.cwd}`);
    info(`Env keys: ${Object.keys(serverConfig.env).join(", ")}`);
  }
}

/**
 * 위험 작업 실행 전 사용자 승인 여부를 판단합니다.
 *
 * preview/noop 작업은 파일을 쓰지 않으므로 confirm이 필요하지 않습니다. 그 외 파일 생성/수정/제거는
 * `--yes`가 있으면 승인된 것으로 보고, 비대화형 환경에서 `--yes`가 없으면 prompt 없이 중단합니다.
 *
 * @param {object} params - 승인 판단 인자입니다.
 * @param {boolean} params.yes - 사용자가 `--yes`를 지정했는지 여부입니다.
 * @param {boolean} params.interactive - prompt를 띄울 수 있는 실행인지 여부입니다.
 * @param {string} params.message - 사용자에게 보여줄 confirm 문구입니다.
 * @returns {Promise<boolean>} 승인되면 true, 취소되면 false입니다.
 */
async function confirmWriteIfNeeded({ yes, interactive, message }) {
  if (yes) {
    return true;
  }

  if (!interactive) {
    throw new Error(
      "비대화형 모드에서는 Antigravity MCP 설정 파일을 변경하려면 --yes를 함께 사용해야 합니다.",
    );
  }

  return confirmAction(message);
}

/**
 * Antigravity MCP 설정을 생성하거나 갱신합니다.
 *
 * @param {object} [options={}] - 설치 실행 옵션입니다.
 * @param {string} [options.target] - 대상 profile key입니다. editor, cli, ide, gemini 중 하나입니다.
 * @param {boolean} [options.preview=false] - true이면 파일을 쓰지 않고 작업 요약만 출력합니다.
 * @param {boolean} [options.yes=false] - true이면 파일 쓰기 confirm을 명시 승인으로 처리합니다.
 * @param {boolean} [options.interactive=true] - prompt를 띄울 수 있는 실행인지 여부입니다.
 * @param {string} [options.homeDir=os.homedir()] - 사용자 홈 또는 테스트용 임시 홈입니다.
 * @param {string} [options.cwd=process.cwd()] - MCP 서버 cwd 계산 기준 작업 디렉터리입니다.
 * @param {typeof fs} [options.fsImpl=fs] - 파일 시스템 구현체입니다.
 * @returns {Promise<{target: string, configPath: string, action: string, preview: boolean}>} 수행 결과 요약입니다.
 */
export async function runAgyMcpInstall(options = {}) {
  const {
    target,
    preview = false,
    yes = false,
    interactive = true,
    homeDir = os.homedir(),
    cwd = process.cwd(),
    fsImpl = fs,
  } = options;

  const candidate = await resolveTargetCandidate({
    target,
    homeDir,
    interactive,
    fsImpl,
  });
  const serverConfig = buildConventionMcpServerConfig({
    nodePath: process.execPath,
    cliPath: resolveConventionCliPath(),
    cwd: resolveRepositoryRootOrCwd(cwd),
  });
  const existingConfig = readMcpConfig(candidate.configPath, { fsImpl });
  const { config, action } = mergeMcpServerConfig(existingConfig, serverConfig);

  printAgyMcpSummary({
    mode: "install",
    action,
    candidate,
    serverConfig,
  });

  if (preview) {
    info("Preview mode: 파일을 생성하거나 수정하지 않았습니다.");
    return {
      target: candidate.target,
      configPath: candidate.configPath,
      action,
      preview: true,
    };
  }

  if (action === "noop") {
    success("Antigravity MCP 설정이 이미 최신 상태입니다.");
    return {
      target: candidate.target,
      configPath: candidate.configPath,
      action,
      preview: false,
    };
  }

  const approved = await confirmWriteIfNeeded({
    yes,
    interactive,
    message: `${candidate.configPath} 파일에 ${AGY_MCP_SERVER_NAME} 설정을 ${action} 하시겠습니까?`,
  });

  if (!approved) {
    warn("Antigravity MCP 설정 변경이 취소되었습니다.");
    return {
      target: candidate.target,
      configPath: candidate.configPath,
      action: "canceled",
      preview: false,
    };
  }

  writeMcpConfig(candidate.configPath, config, { fsImpl });
  success("Antigravity MCP 설정을 저장했습니다. Antigravity를 재시작하면 변경사항이 반영됩니다.");

  return {
    target: candidate.target,
    configPath: candidate.configPath,
    action,
    preview: false,
  };
}

/**
 * Antigravity MCP 설정에서 convention-cli server 엔트리만 제거합니다.
 *
 * @param {object} [options={}] - 제거 실행 옵션입니다.
 * @param {string} [options.target] - 대상 profile key입니다. editor, cli, ide, gemini 중 하나입니다.
 * @param {boolean} [options.preview=false] - true이면 파일을 쓰지 않고 작업 요약만 출력합니다.
 * @param {boolean} [options.yes=false] - true이면 파일 쓰기 confirm을 명시 승인으로 처리합니다.
 * @param {boolean} [options.interactive=true] - prompt를 띄울 수 있는 실행인지 여부입니다.
 * @param {string} [options.homeDir=os.homedir()] - 사용자 홈 또는 테스트용 임시 홈입니다.
 * @param {typeof fs} [options.fsImpl=fs] - 파일 시스템 구현체입니다.
 * @returns {Promise<{target: string, configPath: string, action: string, preview: boolean}>} 수행 결과 요약입니다.
 */
export async function runAgyMcpUninstall(options = {}) {
  const {
    target,
    preview = false,
    yes = false,
    interactive = true,
    homeDir = os.homedir(),
    fsImpl = fs,
  } = options;

  const candidate = await resolveTargetCandidate({
    target,
    homeDir,
    interactive,
    fsImpl,
  });
  const existingConfig = readMcpConfig(candidate.configPath, { fsImpl });
  const { config, action } = removeMcpServerConfig(existingConfig);

  printAgyMcpSummary({
    mode: "uninstall",
    action,
    candidate,
  });

  if (preview) {
    info("Preview mode: 파일을 생성하거나 수정하지 않았습니다.");
    return {
      target: candidate.target,
      configPath: candidate.configPath,
      action,
      preview: true,
    };
  }

  if (action === "noop") {
    success("제거할 Antigravity MCP 설정이 없습니다.");
    return {
      target: candidate.target,
      configPath: candidate.configPath,
      action,
      preview: false,
    };
  }

  const approved = await confirmWriteIfNeeded({
    yes,
    interactive,
    message: `${candidate.configPath} 파일에서 ${AGY_MCP_SERVER_NAME} 설정을 제거하시겠습니까?`,
  });

  if (!approved) {
    warn("Antigravity MCP 설정 제거가 취소되었습니다.");
    return {
      target: candidate.target,
      configPath: candidate.configPath,
      action: "canceled",
      preview: false,
    };
  }

  writeMcpConfig(candidate.configPath, config, { fsImpl });
  success("Antigravity MCP 설정을 제거했습니다. Antigravity를 재시작하면 변경사항이 반영됩니다.");

  return {
    target: candidate.target,
    configPath: candidate.configPath,
    action,
    preview: false,
  };
}
