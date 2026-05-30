import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 이 파일은 src/core/version.js 기준으로 프로젝트 루트의 package.json을 역산합니다.
// process.cwd()는 사용자가 CLI를 실행한 Git 저장소를 가리킬 수 있으므로, 패키지 자체의 버전을 읽는 기준으로 쓰지 않습니다.
const VERSION_MODULE_PATH = fileURLToPath(import.meta.url);
const VERSION_MODULE_DIR = path.dirname(VERSION_MODULE_PATH);
const PACKAGE_JSON_PATH = path.join(VERSION_MODULE_DIR, "..", "..", "package.json");

/**
 * package.json을 읽어 안전하게 metadata 객체로 반환합니다.
 *
 * @param {object} [options] 테스트나 특수 실행 환경에서 파일 읽기 동작을 주입하기 위한 옵션입니다.
 * @param {string} [options.packageJsonPath] 읽을 package.json의 전체 경로입니다. 기본값은 현재 CLI 패키지의 package.json입니다.
 * @param {(path: string, encoding: BufferEncoding) => string} [options.readFileSync] 파일을 읽는 함수입니다. 테스트에서는 mock을 주입할 수 있습니다.
 * @returns {object} package.json에서 파싱한 metadata 객체를 반환합니다.
 * @throws {Error} package.json을 찾을 수 없거나, JSON이 깨졌거나, 객체 형태가 아니면 사용자에게 안전한 일반 오류를 던집니다.
 */
export function readPackageMetadata(options = {}) {
  // 테스트에서 별도 경로를 넣을 수 있게 하되, 기본 실행에서는 CLI 자신의 package.json을 사용합니다.
  const packageJsonPath = options.packageJsonPath ?? PACKAGE_JSON_PATH;
  // fs.readFileSync를 직접 고정하지 않고 주입 가능하게 만들어 파일 시스템 테스트를 단순화합니다.
  const readFileSync = options.readFileSync ?? fs.readFileSync;

  try {
    // package.json은 npm metadata라서 UTF-8 JSON으로 읽습니다. 파일 전체 내용은 로그로 출력하지 않습니다.
    const rawPackageJson = readFileSync(packageJsonPath, "utf8");
    // JSON.parse 실패 시 catch에서 일반 오류로 변환해 raw JSON 내용이나 stack trace가 노출되지 않게 합니다.
    const packageMetadata = JSON.parse(rawPackageJson);

    // null, 배열, 문자열 같은 값은 package metadata로 사용할 수 없으므로 명확히 거부합니다.
    if (
      !packageMetadata ||
      Array.isArray(packageMetadata) ||
      typeof packageMetadata !== "object"
    ) {
      throw new Error("Invalid package metadata.");
    }

    return packageMetadata;
  } catch {
    // 파일 경로, 파일 내용, parse stack을 그대로 노출하지 않기 위한 안전한 오류 메시지입니다.
    throw new Error("package.json 정보를 읽을 수 없습니다.");
  }
}

/**
 * 현재 CLI 패키지의 package name을 반환합니다.
 *
 * @param {object} [options] readPackageMetadata에 전달할 파일 읽기 옵션입니다.
 * @returns {string} package.json의 name 필드입니다.
 * @throws {Error} name이 비어 있거나 문자열이 아니면 안전한 오류를 던집니다.
 */
export function getPackageName(options = {}) {
  const packageMetadata = readPackageMetadata(options);
  const packageName = packageMetadata.name;

  // npm package name은 문자열이어야 하며 빈 값이면 registry check URL을 만들 수 없습니다.
  if (typeof packageName !== "string" || packageName.trim().length === 0) {
    throw new Error("package name 정보를 읽을 수 없습니다.");
  }

  return packageName.trim();
}

/**
 * 현재 CLI 패키지의 version을 반환합니다.
 *
 * @param {object} [options] readPackageMetadata에 전달할 파일 읽기 옵션입니다.
 * @returns {string} package.json의 version 필드입니다.
 * @throws {Error} version이 비어 있거나 문자열이 아니면 안전한 오류를 던집니다.
 */
export function getCurrentVersion(options = {}) {
  const packageMetadata = readPackageMetadata(options);
  const currentVersion = packageMetadata.version;

  // version은 npm semver 문자열이어야 하므로 빈 문자열이나 숫자 같은 값은 거부합니다.
  if (typeof currentVersion !== "string" || currentVersion.trim().length === 0) {
    throw new Error("package version 정보를 읽을 수 없습니다.");
  }

  return currentVersion.trim();
}
