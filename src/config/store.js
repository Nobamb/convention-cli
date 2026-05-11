import fs from "fs";
import os from "os";
import path from "path";
import { DEFAULT_CONFIG } from "./defaults.js";

// 사용자 홈 디렉터리 아래에 CLI 설정 파일을 저장할 전용 디렉터리 경로입니다.
// OS별 경로 구분자 차이를 피하기 위해 os.homedir()와 path.join()으로 조합합니다.
export const CONFIG_DIR = path.join(os.homedir(), ".config", "convention");

// 실제 사용자 설정값을 저장하고 불러올 config.json 파일의 전체 경로입니다.
export const CONFIG_FILE_PATH = path.join(CONFIG_DIR, "config.json");
// 사용자 자격 증명을 저장하고 불러올 credentials.json 파일의 전체 경로입니다.
export const CREDENTIALS_FILE_PATH = path.join(CONFIG_DIR, "credentials.json");

// 설정 저장 전에 필요한 디렉터리가 있는지 확인하고, 없으면 재귀적으로 생성합니다.
// path.join()으로 만든 CONFIG_DIR을 그대로 사용해 Windows/macOS/Linux 경로 차이를 피합니다.
export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// 전달받은 설정 객체를 실제 config.json 파일에 저장합니다.
// 저장 전 디렉터리를 먼저 보장하고, 사람이 읽기 쉬운 2칸 들여쓰기 JSON을 UTF-8로 기록합니다.
export function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf8");
}

/**
 * restrictUserReadWrite
 * 파일의 권한을 읽기와 쓰기만 가능하도록 변경한다.
 * POSIX 스타일 권한을 지원하지 않는 플랫폼/파일시스템에서는 아무것도 하지 않는다.
 * @param {*} filePath
 */

function restrictUserReadWrite(filePath) {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Some platforms/filesystems do not support POSIX-style permissions.
  }
}

// 설정 파일이 없거나 읽을 수 없으면 CLI가 중단되지 않도록 기본 설정값을 반환합니다.
export function loadConfig() {
  // 사용자 설정 파일은 직접 수정될 수 있으므로, 읽기와 JSON 변환 전체를 안전하게 감쌉니다.
  try {
    // 아직 설정 파일이 생성되지 않은 첫 실행 상태에서는 기본 설정만으로도 CLI가 동작해야 합니다.
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      return { ...DEFAULT_CONFIG };
    }

    // 설정 파일은 한글 등 다국어 값을 포함할 수 있으므로 UTF-8 인코딩을 명시해서 읽습니다.
    const rawConfig = fs.readFileSync(CONFIG_FILE_PATH, "utf8");

    // 디스크에 저장된 JSON 문자열을 실제 설정 객체로 변환합니다.
    const userConfig = JSON.parse(rawConfig);

    // JSON 문법은 맞더라도 null, 배열처럼 설정 객체로 사용할 수 없는 형태는 거부합니다.
    if (
      !userConfig ||
      Array.isArray(userConfig) ||
      typeof userConfig !== "object"
    ) {
      return { ...DEFAULT_CONFIG };
    }

    // 저장된 사용자 설정을 우선 적용하되, 빠진 필드는 DEFAULT_CONFIG로 보완합니다.
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
    };
  } catch {
    // 깨진 JSON이나 읽기 오류가 있어도 파일 원문을 노출하지 않고 안전하게 기본값으로 복구합니다.
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * loadCredentials
 * 저장된 자격 증명 객체를 반환한다. 파일이 없거나 읽을 수 없으면 빈 객체를 반환한다.
 * 자격 증명 파일은 권한을 0600으로 제한하여 읽기와 쓰기만 가능하도록 한다.
 * @returns {Object}
 */
export function loadCredentials() {
  // 사용자 자격 증명 파일은 직접 수정될 수 있으므로, 읽기와 JSON 변환 전체를 안전하게 감싼다.
  try {
    // 아직 자격 증명 파일이 생성되지 않은 첫 실행 상태에서는 빈 객체를 반환한다.
    if (!fs.existsSync(CREDENTIALS_FILE_PATH)) {
      return {};
    }

    // 자격 증명 파일은 한글 등 다국어 값을 포함할 수 있으므로 UTF-8 인코딩을 명시해서 읽는다.
    const rawCredentials = fs.readFileSync(CREDENTIALS_FILE_PATH, "utf8");
    // 디스크에 저장된 JSON 문자열을 실제 자격 증명 객체로 변환한다.
    const credentials = JSON.parse(rawCredentials);

    // JSON 문법은 맞더라도 null, 배열처럼 자격 증명 객체로 사용할 수 없는 형태는 거부한다.
    // null, 배열, 원시 타입 등 유효한 객체가 아닐 경우 빈 객체를 반환한다.
    if (
      !credentials ||
      Array.isArray(credentials) ||
      typeof credentials !== "object"
    ) {
      return {};
    }

    // 저장된 사용자 자격 증명을 반환한다.
    return credentials;
  } catch {
    // 자격 증명 파일 읽기/파싱 중 오류가 발생하면 빈 객체를 반환한다.
    return {};
  }
}

/**
 * saveCredentials
 * 전달받은 자격 증명 객체를 credentials.json 파일에 저장한다.
 * @param {*} credentials
 */
export function saveCredentials(credentials) {
  // 설정 저장 전에 필요한 디렉터리가 있는지 확인하고, 없으면 재귀적으로 생성한다.
  ensureConfigDir();

  // 자격 증명 객체(credentials)가 유효한 경우에만 저장하고, 유효하지 않은 경우 빈 객체로 처리한다.
  const safeCredentials =
    credentials &&
    !Array.isArray(credentials) &&
    typeof credentials === "object"
      ? credentials
      : {};

  // 자격 증명 객체를 JSON 문자열로 변환하여 자격 증명 파일에 저장한다.
  // 저장할 때 한글 등 다국어 값을 위해 UTF-8 인코딩을 명시한다.
  fs.writeFileSync(
    CREDENTIALS_FILE_PATH,
    JSON.stringify(safeCredentials, null, 2),
    "utf8",
  );
  // 자격 증명 파일의 권한을 읽기와 쓰기만 가능하도록 제한한다.
  restrictUserReadWrite(CREDENTIALS_FILE_PATH);
}
