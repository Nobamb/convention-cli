import { DEFAULT_CONFIG } from "../config/defaults.js";
import {
  getCurrentVersion,
  getPackageName,
} from "./version.js";

// npm 공식 registry의 기본 주소입니다. custom registry를 주입하지 않으면 이 주소로 latest metadata를 조회합니다.
export const DEFAULT_NPM_REGISTRY_URL = "https://registry.npmjs.org";

// update check는 하루 1회 이하로 제한합니다. 밀리초 단위 상수로 두어 테스트에서 정책 기준을 명확히 검증할 수 있습니다.
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// registry 응답이 느릴 때 CLI의 commit/pr 작업을 오래 붙잡지 않기 위한 기본 timeout입니다.
export const UPDATE_CHECK_TIMEOUT_MS = 1500;

/**
 * npm registry base URL과 package name으로 latest endpoint URL을 만듭니다.
 *
 * @param {object} params URL 생성에 필요한 입력값입니다.
 * @param {string} params.packageName npm package name입니다. scoped package도 안전하게 인코딩합니다.
 * @param {string} [params.registryUrl] npm registry base URL입니다. 기본값은 공식 registry입니다.
 * @returns {string} `/package/latest` 형태의 registry endpoint URL입니다.
 * @throws {Error} package name이 비어 있거나 registry URL이 유효하지 않으면 오류를 던집니다.
 */
export function buildLatestVersionUrl({
  packageName,
  registryUrl = DEFAULT_NPM_REGISTRY_URL,
}) {
  // package name은 URL path에 들어가므로 빈 값이면 registry 요청을 만들 수 없습니다.
  if (typeof packageName !== "string" || packageName.trim().length === 0) {
    throw new Error("package name이 필요합니다.");
  }

  // URL 생성자에게 검증을 맡겨 잘못된 custom registry URL이 fetch까지 넘어가지 않게 합니다.
  const baseUrl = new URL(registryUrl);
  // scoped package의 slash도 path 구분자로 해석되지 않게 encodeURIComponent로 보호합니다.
  const encodedPackageName = encodeURIComponent(packageName.trim());

  // registry URL 끝의 slash 유무와 관계없이 정확히 latest endpoint를 구성합니다.
  baseUrl.pathname = pathJoinUrl(baseUrl.pathname, encodedPackageName, "latest");
  baseUrl.search = "";
  baseUrl.hash = "";

  return baseUrl.toString();
}

/**
 * URL path 조각을 slash 하나로 이어 붙입니다.
 *
 * @param {...string} segments URL pathname 조각입니다.
 * @returns {string} 중복 slash를 제거한 pathname입니다.
 */
function pathJoinUrl(...segments) {
  const joinedPath = segments
    .map((segment) => String(segment).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");

  return `/${joinedPath}`;
}

/**
 * semver 문자열을 비교 가능한 구조로 변환합니다.
 *
 * @param {string} version npm semver 문자열입니다.
 * @returns {{major: number, minor: number, patch: number, prerelease: string[]} | null} 비교 가능한 버전 객체입니다.
 */
function parseSemver(version) {
  if (typeof version !== "string") {
    return null;
  }

  // build metadata는 버전 우선순위에 영향을 주지 않으므로 비교 전에 제거합니다.
  const [withoutBuild] = version.trim().split("+");
  const match = withoutBuild.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/,
  );

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

/**
 * semver prerelease 식별자 두 개를 비교합니다.
 *
 * @param {string} left 왼쪽 prerelease 식별자입니다.
 * @param {string} right 오른쪽 prerelease 식별자입니다.
 * @returns {number} left가 낮으면 -1, 같으면 0, 높으면 1을 반환합니다.
 */
function comparePrereleaseIdentifier(left, right) {
  const leftIsNumber = /^\d+$/.test(left);
  const rightIsNumber = /^\d+$/.test(right);

  if (leftIsNumber && rightIsNumber) {
    return Math.sign(Number(left) - Number(right));
  }

  // semver 규칙상 numeric identifier는 non-numeric identifier보다 낮은 우선순위를 가집니다.
  if (leftIsNumber) {
    return -1;
  }

  if (rightIsNumber) {
    return 1;
  }

  return left.localeCompare(right);
}

/**
 * 현재 버전과 최신 버전을 semver 기준으로 비교합니다.
 *
 * @param {string} currentVersion 현재 설치된 CLI 버전입니다.
 * @param {string} latestVersion npm registry에서 확인한 최신 버전입니다.
 * @returns {number | null} 현재 버전이 낮으면 -1, 같으면 0, 높으면 1, 비교 불가이면 null을 반환합니다.
 */
export function compareVersions(currentVersion, latestVersion) {
  const current = parseSemver(currentVersion);
  const latest = parseSemver(latestVersion);

  // 잘못된 version 문자열은 update 여부를 판단하지 않고 호출자가 조용히 skip하게 합니다.
  if (!current || !latest) {
    return null;
  }

  for (const key of ["major", "minor", "patch"]) {
    if (current[key] !== latest[key]) {
      return Math.sign(current[key] - latest[key]);
    }
  }

  const currentPrerelease = current.prerelease;
  const latestPrerelease = latest.prerelease;

  // prerelease가 없는 정식 release는 같은 major/minor/patch의 prerelease보다 높습니다.
  if (currentPrerelease.length === 0 && latestPrerelease.length > 0) {
    return 1;
  }

  if (currentPrerelease.length > 0 && latestPrerelease.length === 0) {
    return -1;
  }

  const maxPrereleaseLength = Math.max(
    currentPrerelease.length,
    latestPrerelease.length,
  );

  for (let index = 0; index < maxPrereleaseLength; index += 1) {
    const currentIdentifier = currentPrerelease[index];
    const latestIdentifier = latestPrerelease[index];

    if (currentIdentifier === undefined && latestIdentifier === undefined) {
      return 0;
    }

    if (currentIdentifier === undefined) {
      return -1;
    }

    if (latestIdentifier === undefined) {
      return 1;
    }

    const identifierComparison = comparePrereleaseIdentifier(
      currentIdentifier,
      latestIdentifier,
    );

    if (identifierComparison !== 0) {
      return Math.sign(identifierComparison);
    }
  }

  return 0;
}

/**
 * npm registry에서 latest version을 조회하고 현재 버전과 비교합니다.
 *
 * @param {object} params update check 입력값입니다.
 * @param {string} params.packageName 조회할 npm package name입니다.
 * @param {string} params.currentVersion 현재 설치된 CLI 버전입니다.
 * @param {string} [params.registryUrl] npm registry base URL입니다.
 * @param {typeof fetch} [params.fetchImpl] 테스트에서 network 호출을 mock하기 위한 fetch 구현입니다.
 * @param {Date} [params.now] checkedAt에 기록할 현재 시각입니다.
 * @param {number} [params.timeoutMs] registry 응답을 기다릴 최대 시간입니다. 초과하면 조용히 skip합니다.
 * @returns {Promise<object | null>} update 결과 객체를 반환하며, 실패나 비교 불가 상태에서는 null을 반환합니다.
 */
export async function checkLatestVersion({
  packageName,
  currentVersion,
  registryUrl = DEFAULT_NPM_REGISTRY_URL,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  timeoutMs = UPDATE_CHECK_TIMEOUT_MS,
}) {
  let timeoutId;

  try {
    // fetch가 없는 런타임에서는 update check를 기능 실패가 아니라 skip으로 처리합니다.
    if (typeof fetchImpl !== "function") {
      return null;
    }

    const latestVersionUrl = buildLatestVersionUrl({
      packageName,
      registryUrl,
    });

    // AbortController가 있는 런타임에서는 timeout signal을 fetch에 전달해 느린 registry가 CLI를 막지 않게 합니다.
    const abortController =
      typeof AbortController === "function" && Number.isFinite(timeoutMs)
        ? new AbortController()
        : null;

    if (abortController) {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, Math.max(0, timeoutMs));
    }

    // registry 호출에는 인증 header를 넣지 않습니다. npm token이 로그나 요청에 섞이지 않게 하기 위함입니다.
    const response = await fetchImpl(latestVersionUrl, {
      headers: {
        accept: "application/json",
      },
      signal: abortController?.signal,
    });

    // 404/5xx 등 registry 오류는 사용자의 본래 CLI 작업 실패로 만들지 않고 조용히 skip합니다.
    if (!response || !response.ok) {
      return null;
    }

    const registryMetadata = await response.json();
    const latestVersion = registryMetadata?.version;

    if (typeof latestVersion !== "string" || latestVersion.trim().length === 0) {
      return null;
    }

    const comparison = compareVersions(currentVersion, latestVersion);

    if (comparison === null) {
      return null;
    }

    return {
      packageName,
      currentVersion,
      latestVersion: latestVersion.trim(),
      hasUpdate: comparison < 0,
      checkedAt: now.toISOString(),
    };
  } catch {
    // 네트워크 오류, JSON parse 오류, URL 오류는 모두 update check skip으로 취급해 CLI 본래 작업을 방해하지 않습니다.
    return null;
  } finally {
    // 정상/실패 여부와 관계없이 timeout timer를 정리해 테스트와 CLI 프로세스가 불필요하게 대기하지 않도록 합니다.
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * update 안내 메시지를 사람이 읽기 쉬운 문자열로 만듭니다.
 *
 * @param {object} params update 안내에 필요한 정보입니다.
 * @param {string} params.currentVersion 현재 설치된 CLI 버전입니다.
 * @param {string} params.latestVersion npm registry의 최신 버전입니다.
 * @param {string} params.packageName npm package name입니다.
 * @returns {string | null} 안내 메시지를 반환하며, 필수 값이 없으면 null을 반환합니다.
 */
export function formatUpdateNotification({
  currentVersion,
  latestVersion,
  packageName,
}) {
  if (
    typeof currentVersion !== "string" ||
    currentVersion.trim().length === 0 ||
    typeof latestVersion !== "string" ||
    latestVersion.trim().length === 0 ||
    typeof packageName !== "string" ||
    packageName.trim().length === 0
  ) {
    return null;
  }

  return [
    `${packageName.trim()} 새 버전이 있습니다.`,
    `현재 버전: ${currentVersion.trim()}`,
    `최신 버전: ${latestVersion.trim()}`,
    `업데이트: npm install -g ${packageName.trim()}@latest`,
  ].join("\n");
}

/**
 * update check 결과를 logger로 안내합니다.
 *
 * @param {object | null} updateInfo checkLatestVersion이 반환한 update 결과입니다.
 * @param {object} [logger] logger 주입 객체입니다. 기본값은 console을 직접 쓰지 않기 위해 호출자가 전달하는 logger를 기대합니다.
 * @param {(message: string) => void} [logger.info] 정보 메시지를 출력하는 함수입니다.
 * @returns {boolean} 안내를 실제 출력했으면 true, 출력하지 않았으면 false를 반환합니다.
 */
export function notifyUpdate(updateInfo, logger = {}) {
  // update가 없거나 check가 skip된 경우에는 아무것도 출력하지 않습니다.
  if (!updateInfo || updateInfo.hasUpdate !== true) {
    return false;
  }

  const message = formatUpdateNotification(updateInfo);

  if (!message || typeof logger.info !== "function") {
    return false;
  }

  try {
    logger.info(message);
    return true;
  } catch {
    // update 알림 출력 실패는 본래 CLI 작업 실패로 전파하지 않습니다.
    return false;
  }
}

/**
 * 설정과 현재 시각을 기준으로 npm registry check를 수행할지 판단합니다.
 *
 * @param {object} [config] 사용자 config 객체입니다.
 * @param {Date} [now] 비교 기준 시각입니다.
 * @returns {boolean} check가 필요하면 true, 아니면 false를 반환합니다.
 */
export function shouldCheckUpdate(config = DEFAULT_CONFIG, now = new Date()) {
  // 사용자가 updateCheck를 false로 명시하면 어떤 경우에도 네트워크 호출을 하지 않습니다.
  if (config?.updateCheck === false) {
    return false;
  }

  const lastUpdateCheckAt = config?.lastUpdateCheckAt;

  // 마지막 확인 시각이 없거나 잘못된 값이면 최초 확인 대상으로 취급합니다.
  if (typeof lastUpdateCheckAt !== "string" || lastUpdateCheckAt.length === 0) {
    return true;
  }

  const lastCheckedTime = new Date(lastUpdateCheckAt).getTime();

  if (Number.isNaN(lastCheckedTime)) {
    return true;
  }

  return now.getTime() - lastCheckedTime >= UPDATE_CHECK_INTERVAL_MS;
}

/**
 * update check 시각을 반영한 새 config 객체를 만듭니다.
 *
 * @param {object} config 기존 사용자 config입니다.
 * @param {Date} [checkedAt] 저장할 확인 시각입니다.
 * @returns {object} 기존 설정을 보존하면서 lastUpdateCheckAt만 갱신한 새 config 객체입니다.
 */
export function markUpdateChecked(config, checkedAt = new Date()) {
  return {
    ...(config ?? {}),
    lastUpdateCheckAt: checkedAt.toISOString(),
  };
}

/**
 * 정책에 따라 필요한 경우에만 update check를 실행하고 알림을 출력합니다.
 *
 * @param {object} params 실행에 필요한 의존성 묶음입니다.
 * @param {object} params.config 사용자 config 객체입니다.
 * @param {(config: object) => void} params.saveConfig update check 시각을 저장하는 함수입니다.
 * @param {object} params.logger logger 객체입니다.
 * @param {string} [params.packageName] package name입니다. 없으면 package.json에서 읽습니다.
 * @param {string} [params.currentVersion] 현재 version입니다. 없으면 package.json에서 읽습니다.
 * @param {Date} [params.now] 기준 시각입니다.
 * @param {typeof fetch} [params.fetchImpl] registry 호출에 사용할 fetch 구현입니다.
 * @param {string} [params.registryUrl] npm registry base URL입니다.
 * @param {number} [params.timeoutMs] registry 응답을 기다릴 최대 시간입니다.
 * @param {boolean} [params.isCI] CI 환경 여부입니다. true면 기본 정책상 update check를 생략합니다.
 * @returns {Promise<object>} update check 수행 여부와 결과를 담은 객체입니다.
 */
export async function runUpdateCheckIfNeeded({
  config,
  saveConfig,
  logger,
  packageName,
  currentVersion,
  now = new Date(),
  fetchImpl = globalThis.fetch,
  registryUrl = DEFAULT_NPM_REGISTRY_URL,
  timeoutMs = UPDATE_CHECK_TIMEOUT_MS,
  isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true",
}) {
  // CI에서는 stdout/stderr가 다음 step의 입력으로 쓰일 수 있으므로 기본적으로 update check를 생략합니다.
  if (isCI) {
    return { checked: false, skipped: true, reason: "ci" };
  }

  if (!shouldCheckUpdate(config, now)) {
    return { checked: false, skipped: true, reason: "policy" };
  }

  let resolvedPackageName;
  let resolvedCurrentVersion;

  try {
    resolvedPackageName = packageName ?? getPackageName();
    resolvedCurrentVersion = currentVersion ?? getCurrentVersion();
  } catch {
    return { checked: false, skipped: true, reason: "package-metadata" };
  }

  const updateInfo = await checkLatestVersion({
    packageName: resolvedPackageName,
    currentVersion: resolvedCurrentVersion,
    registryUrl,
    fetchImpl,
    now,
    timeoutMs,
  });

  // 네트워크 실패도 확인 시도로 기록해 매 실행마다 실패 요청이 반복되지 않게 합니다.
  try {
    if (typeof saveConfig === "function") {
      saveConfig(markUpdateChecked(config, now));
    }
  } catch {
    // config 저장 실패는 update check 부가 기능 실패로만 취급하고 본래 CLI 작업에는 영향을 주지 않습니다.
  }

  notifyUpdate(updateInfo, logger);

  return {
    checked: true,
    skipped: false,
    updateInfo,
  };
}
