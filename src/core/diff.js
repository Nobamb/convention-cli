import { DEFAULT_CONFIG } from "../config/defaults.js";
import { buildChunkSummaryPrompt } from "./prompt.js";
import { maskSensitiveDiff } from "./security.js";
import { generateWithProvider } from "../providers/index.js";
import { redactSecrets } from "../utils/logger.js";

// 청크(chunk) 분할 옵션의 기본값
const DEFAULT_CHUNK_OPTIONS = {
  maxChunkCharacters: 12000,
  maxChunkLines: 400,
};

// 요약(summary) 재시도 횟수의 기본값
const DEFAULT_SUMMARY_OPTIONS = {
  maxRetries: 2,
};

// 비밀 정보(secret) 탐지를 위한 정규 표현식 패턴
const SECRET_MARKER_PATTERN =
  /(API_KEY\s*=|SECRET\s*=|TOKEN\s*=|PASSWORD\s*=|PRIVATE_KEY|DATABASE_URL|AWS_ACCESS_KEY_ID|-----BEGIN PRIVATE KEY-----)/iu;

/**
 * 주어진 값이 양의 정수인지 확인하고, 유효하지 않으면 기본값을 반환합니다.
 */
function positiveIntegerOrDefault(value, defaultValue) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : defaultValue;
}

/**
 * 설정 객체에서 대용량 diff 처리 임계값을 추출하고 기본값으로 보완합니다.
 */
function resolveLargeDiffThreshold(config = {}) {
  const configured = config.largeDiffThreshold || {};

  // config에 일부 값만 있어도 나머지는 DEFAULT_CONFIG 기준을 유지합니다.
  return {
    // diff의 최대 문자 수
    maxCharacters: positiveIntegerOrDefault(
      configured.maxCharacters,
      DEFAULT_CONFIG.largeDiffThreshold.maxCharacters,
    ),
    // diff를 구성하는 최대 파일 수
    maxFiles: positiveIntegerOrDefault(
      configured.maxFiles,
      DEFAULT_CONFIG.largeDiffThreshold.maxFiles,
    ),
    // diff의 최대 라인 수
    maxLines: positiveIntegerOrDefault(
      configured.maxLines,
      DEFAULT_CONFIG.largeDiffThreshold.maxLines,
    ),
  };
}

/**
 * 문자열의 줄 수를 계산합니다.
 */
function countLines(value) {
  // 문자열이 비어있으면 0 반환
  if (value.length === 0) {
    return 0;
  }

  // 마지막에 하나 이상의 줄바꿈이 연속으로 있는 경우 제거
  const withoutTrailingNewline = value.replace(/(?:\r?\n)+$/u, "");
  if (withoutTrailingNewline.length === 0) {
    return 0;
  }

  // 줄바꿈 문자 기준으로 분할하여 개수 반환
  return withoutTrailingNewline.split(/\r?\n/u).length;
}

/**
 * 문자열을 줄 단위로 분리하여 배열로 반환합니다.
 */
function splitLines(value) {
  // 문자열이 비어있으면 빈 배열 반환
  if (value.length === 0) {
    return [];
  }

  // 줄바꿈 문자 기준으로 분할
  const lines = value.split(/\r?\n/u);
  // 마지막 요소가 빈 문자열이면 제거
  if (lines.at(-1) === "") {
    lines.pop();
  }
  // 줄 분할 후 남은 배열 반환
  return lines;
}

/**
 * 너무 긴 줄을 지정된 최대 문자 수에 맞춰 여러 줄로 분할합니다.
 */
function splitLongLine(line, maxChunkCharacters) {
  // 최대 문자 수보다 짧으면 분할하지 않고 그대로 반환
  if (line.length <= maxChunkCharacters) {
    return [line];
  }

  // diff 접두사(+,-,공백) 확인 및 추출
  const prefix = /^[+\- ]/u.test(line) ? line[0] : "";
  // 접두사 제거
  const body = prefix ? line.slice(1) : line;
  // 첫 번째 줄의 본문 길이 제한
  const firstBodyLimit = Math.max(1, maxChunkCharacters - prefix.length);
  // 접두사 반복 문자열
  const nextPrefix = prefix ? `${prefix}... ` : "... ";
  // 이후 줄의 본문 길이 제한
  const nextBodyLimit = Math.max(1, maxChunkCharacters - nextPrefix.length);
  // 분할된 줄들을 담을 배열 생성
  const segments = [];

  // 첫 번째 줄 생성
  segments.push(`${prefix}${body.slice(0, firstBodyLimit)}`);

  // 나머지 줄 생성
  // 첫 번째 줄 이후부터 나머지 문자열을 순회하며 분할
  for (let index = firstBodyLimit; index < body.length; index += nextBodyLimit) {
    segments.push(`${nextPrefix}${body.slice(index, index + nextBodyLimit)}`);
  }
  // 분할된 줄들을 배열로 반환
  return segments;
}

/**
 * 단일 diff 청크 객체를 생성하여 반환합니다.
 */
function buildChunk({
  file,
  diff,
  chunkType,
  part,
  totalParts,
  startLine,
  endLine,
  index,
}) {
  return {
    index,
    file,
    files: [file],
    chunkType,
    part,
    totalParts,
    startLine,
    endLine,
    lineCount: countLines(diff),
    characterCount: diff.length,
    diff,
  };
}

/**
 * 대용량 파일의 diff를 설정된 제한에 따라 여러 부분으로 분할합니다.
 */
function splitLargeFileDiff({ file, diff, maxChunkCharacters, maxChunkLines }) {
  // diff를 줄 단위로 분할
  const lines = splitLines(diff);
  // 청크(chunk)들을 담을 배열 생성
  const parts = [];
  // 현재 처리 중인 줄들을 저장할 배열
  let currentLines = [];
  // 현재 처리 중인 청크의 시작 줄 번호
  let currentStartLine = 1;
  // 현재 처리 중인 청크의 문자 수
  let currentCharacters = 0;

  /**
   * 청크를 완성하고 parts 배열에 추가하는 내부 함수
   * @param {number} endLine - 청크의 마지막 줄 번호
   */
  function flush(endLine) {
    // 현재 처리 중인 줄이 없으면 아무것도 하지 않음
    if (currentLines.length === 0) {
      return;
    }

    // 완성된 청크를 parts 배열에 추가
    parts.push({
      file,
      diff: currentLines.join("\n"),
      startLine: currentStartLine,
      endLine,
    });

    // 다음 청크를 위해 현재 처리 중인 줄들을 초기화
    currentLines = [];
    // 다음 청크를 위해 현재 처리 중인 문자 수를 초기화
    currentCharacters = 0;
    // 다음 청크의 시작 줄 번호를 현재 청크의 마지막 줄 번호 + 1로 설정
    currentStartLine = endLine + 1;
  }

  // lines 배열을 순회하면서 청크를 분할
  lines.forEach((sourceLine, offset) => {
    // 줄 번호를 계산
    const lineNumber = offset + 1;
    // 긴 줄을 여러 줄로 분할
    const lineSegments = splitLongLine(sourceLine, maxChunkCharacters);

    // 분할된 줄들을 순회하면서 청크를 분할
    for (const line of lineSegments) {
      // 다음 청크의 문자 수를 계산
      const nextCharacters = currentCharacters + line.length + (currentLines.length > 0 ? 1 : 0);
      // 줄 수 제한 초과 확인
      const exceedsLineLimit = currentLines.length >= maxChunkLines;
      // 문자 수 제한 초과 확인
      const exceedsCharacterLimit =
        currentLines.length > 0 && nextCharacters > maxChunkCharacters;
      // 줄 수 또는 문자 수 제한이 초과되면 청크를 완성
      if (exceedsLineLimit || exceedsCharacterLimit) {
        flush(lineNumber - 1);
      }
      // 현재 줄을 현재 청크에 추가
      currentLines.push(line);
      // 현재 청크의 문자 수를 업데이트
      currentCharacters += line.length + (currentLines.length > 1 ? 1 : 0);
    }
  });

  // 마지막 청크를 완성
  flush(lines.length);

  // 청크 배열 반환
  return parts;
}


/**
 * 청크에서 파일 목록을 추출하여 정규화합니다.
 * @param {object} chunk - 청크 객체
 * @returns {string[]} 파일 목록 배열
 */
function normalizeFiles(chunk = {}) {
  // 파일 목록이 배열이고 길이가 0보다 크면
  if (Array.isArray(chunk.files) && chunk.files.length > 0) {
    // 문자열이고 길이가 0보다 큰 파일만 필터링하여 반환
    return chunk.files.filter((file) => typeof file === "string" && file.length > 0);
  }

  // 파일이 문자열이고 길이가 0보다 크면
  if (typeof chunk.file === "string" && chunk.file.length > 0) {
    // 청크의 파일 이름을 배열에 담아 반환
    return [chunk.file];
  }

  // 파일이 없으면 ["unknown"] 반환
  return ["unknown"];
}

/**
 * fallback 요약 생성
 * @param {object} chunk - 청크 객체
 * @param {number} attempts - 시도 횟수
 * @param {string} errorType - 오류 유형
 * @returns {object} - fallback 요약 객체
 */
function createFallbackSummary(chunk, attempts, errorType = "provider_error") {
  // 파일 목록 정규화
  const files = normalizeFiles(chunk);
  // fallback 요약 객체 생성
  return {
    index: chunk?.index ?? null,
    files,
    summary: `Chunk ${chunk?.index ?? "unknown"} summary failed; affected files: ${files.join(", ")}.`,
    status: "fallback",
    attempts,
    errorType,
  };
}

/**
 * LLM 응답 요약을 정규화합니다.
 * @param {*} value - LLM 응답 요약
 * @returns {string} - 정규화된 LLM 응답 요약
 */
function normalizeSummaryText(value) {
  // 민감한 정보 제거 및 공백 정리
  return redactSecrets(String(value ?? ""))
    .replace(/```[\s\S]*?```/gu, "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * 지원하지 않는 제공자 오류인지 확인합니다.
 * @param {object} error - 오류 객체
 * @returns {boolean} - 지원하지 않는 제공자 오류 여부
 */
function isUnsupportedProviderError(error) {
  // "Unsupported provider" 문자열이 오류 메시지에 포함되어 있으면 true 반환
  return /Unsupported provider/u.test(String(error?.message ?? ""));
}

/**
 * 민감한 정보를 제거하고 LLM 응답 요약을 정규화합니다.
 * @param {*} value - LLM 응답 요약
 * @returns {string} - 정규화된 LLM 응답 요약
 */
function sanitizeSummary(value) {
  // 민감한 정보 제거 및 공백 정리
  const masked = maskSensitiveDiff(String(value ?? "")).diff;
  return redactSecrets(masked).replace(/\s+/gu, " ").trim();
}

/**
 * LLM 응답 요약 항목을 정규화합니다.
 * @param {*} entry - LLM 응답 요약 항목
 * @returns {object|null} - 정규화된 LLM 응답 요약 항목
 */
function normalizeSummaryEntry(entry) {
  // 문자열인 경우
  if (typeof entry === "string") {
    // 민감한 정보 제거 및 공백 정리
    const summary = sanitizeSummary(entry);
    // 요약이 있으면 { files: ["general"], intent: "general", summary } 반환
    return summary ? { files: ["general"], intent: "general", summary } : null;
  }

  // 객체가 아닌 경우 null 반환
  if (!entry || typeof entry !== "object") {
    return null;
  }

  // 요약이 없으면 null 반환
  const summary = sanitizeSummary(entry.summary);
  if (!summary) {
    return null;
  }

  // 파일 목록 정규화
  const files = normalizeFiles(entry);
  // 함수 이름 정규화
  // 문자열이 아니거나 빈 문자열이면 null 반환
  const functionName =
    typeof entry.functionName === "string" && entry.functionName.trim()
      ? entry.functionName.trim()
      : null;
  // 의도 정규화
  // 문자열이 아니거나 빈 문자열이면 "general" 반환
  const intent =
    typeof entry.intent === "string" && entry.intent.trim()
      ? entry.intent.trim()
      : "general";

  // 정규화된 LLM 응답 요약 항목 반환
  return {
    index: Number.isInteger(entry.index) ? entry.index : Number.MAX_SAFE_INTEGER,
    files,
    functionName,
    intent,
    summary,
  };
}

/**
 * 요약 항목의 키를 반환합니다.
 * @param {*} entry - 요약 항목
 * @returns {string} - 요약 항목의 키
 */
function summaryKey(entry) {
  // 요약 항목의 키를 반환
  return [
    entry.files.join(","),
    entry.functionName || "",
    entry.intent,
    entry.summary.toLowerCase().replace(/\s+/gu, " ").replace(/[.!?。！？]+$/u, ""),
  ].join("|");
}
/**
 * 요약 항목의 그룹 키를 반환합니다.
 * @param {*} entry - 요약 항목
 * @returns {string} - 요약 항목의 그룹 키
 */
function groupKey(entry) {
  // 요약 항목의 그룹 키를 반환
  const file = entry.files[0] || "general";
  return [file, entry.functionName || "", entry.intent || "general"].join("|");
}
/**
 * 요약의 길이를 제한합니다.
 * @param {*} value - 요약
 * @param {*} maxCharacters - 최대 문자 수
 * @returns {string} - 제한된 요약
 * @param {*} maxCharacters 
 * @returns 
 */
function limitSummary(value, maxCharacters) {
  // 요약이 제한된 문자 수보다 짧으면 요약을 반환
  if (value.length <= maxCharacters) {
    return value;
  }

  // 요약을 제한된 문자 수보다 긴 경우 잘라서 반환
  return `${value.slice(0, Math.max(0, maxCharacters - 30)).trim()}\n- Additional changes omitted.`;
}

/**
 * diff 크기를 문자 수, 파일 수, 라인 수 기준으로 판정하여 대용량 여부를 결정합니다.
 * 설정된 임계치(threshold)를 하나라도 초과하면 대용량(isLarge: true)으로 판정하며,
 * 이 결과에 따라 이후 AI 처리 흐름(일반 생성 또는 요약 기반 생성)이 결정됩니다.
 * 
 * @param {Object} params
 * @param {string} params.diff - 판정할 전체 diff 문자열
 * @param {Array} params.files - 변경 사항에 포함된 파일 목록
 * @param {Object} params.config - 사용자 설정 (임계치 설정 포함)
 * @returns {Object} 대용량 여부(isLarge), 판정 이유(reasons), 측정 수치(metrics) 등을 포함하는 결과 객체
 */
export function detectLargeDiff({ diff = "", files = [], config = {} } = {}) {
  // diff가 문자열이 아니면 에러
  if (typeof diff !== "string") {
    throw new TypeError("diff must be a string");
  }

  // files가 배열이 아니면 에러
  if (!Array.isArray(files)) {
    throw new TypeError("files must be an array");
  }

  // 대용량 diff 임계치 설정
  const threshold = resolveLargeDiffThreshold(config);
  // diff 측정 수치
  const metrics = {
    characters: diff.length,
    files: files.length,
    lines: countLines(diff),
  };
  // 대용량 diff 판정 이유
  const reasons = [];

  // 문자 수 판정
  if (metrics.characters > threshold.maxCharacters) {
    reasons.push("characters");
  }
  // 파일 수 판정
  if (metrics.files > threshold.maxFiles) {
    reasons.push("files");
  }
  // 라인 수 판정
  if (metrics.lines > threshold.maxLines) {
    reasons.push("lines");
  }

  // 대용량 diff 여부
  const isLarge = reasons.length > 0;

  // 대용량 diff 결과 반환
  return {
    isLarge,
    reason: reasons[0] ?? null,
    reasons,
    metrics,
    threshold,
    flow: isLarge ? "large-diff" : "normal",
  };
}

/**
 * 파일별 diff 배열을 AI 모델이 한 번에 처리하기에 적합한 크기의 청크(Chunk) 배열로 나눕니다.
 * 개별 파일의 diff가 너무 큰 경우(문자 수나 라인 수 초과), 해당 파일을 여러 파트(Part)로 쪼개어 청크를 구성합니다.
 * 파일명은 메타데이터로 보존하여 이후 요약 및 병합 단계에서 컨텍스트로 사용합니다.
 * 
 * @param {Array} fileDiffs - { file, diff } 객체들의 배열
 * @param {Object} options - 청크 분할 옵션 (최대 문자 수, 라인 수 제한)
 * @returns {Array} 순번(index)과 위치 정보가 포함된 청크 객체 배열
 */
export function chunkDiff(fileDiffs, options = {}) {
  // fileDiffs가 배열이 아니면 에러
  if (!Array.isArray(fileDiffs)) {
    throw new TypeError("fileDiffs must be an array");
  }

  // 청크 분할 옵션 설정
  const maxChunkCharacters = positiveIntegerOrDefault(
    options.maxChunkCharacters,
    DEFAULT_CHUNK_OPTIONS.maxChunkCharacters,
  );
  // 라인 수 제한
  const maxChunkLines = positiveIntegerOrDefault(
    options.maxChunkLines,
    DEFAULT_CHUNK_OPTIONS.maxChunkLines,
  );
  // 청크 배열
  const chunks = [];

  // 파일별 diff 배열 순회
  for (const entry of fileDiffs) {
    // 유효한 파일 diff 검증
    // 조건에 맞지 않으면 건너뛰기
    if (
      !entry ||
      typeof entry.file !== "string" ||
      entry.file.length === 0 ||
      typeof entry.diff !== "string" ||
      entry.diff.trim().length === 0
    ) {
      continue;
    }

    // diff 라인 수 계산
    const lineCount = countLines(entry.diff);
    // diff 크기 검증
    const isOversized =
      entry.diff.length > maxChunkCharacters || lineCount > maxChunkLines;

    // 크기가 적절한 경우
    if (!isOversized) {
      chunks.push(
        buildChunk({
          file: entry.file,
          diff: entry.diff,
          chunkType: "file",
          part: 1,
          totalParts: 1,
          startLine: 1,
          endLine: lineCount,
          index: 0,
        }),
      );
      continue;
    }

    // diff가 큰 경우 분할
    const parts = splitLargeFileDiff({
      file: entry.file,
      diff: entry.diff,
      maxChunkCharacters,
      maxChunkLines,
    });

    // 분할된 diff를 청크로 추가
    parts.forEach((part, partIndex) => {
      chunks.push(
        buildChunk({
          file: entry.file,
          diff: part.diff,
          chunkType: "file-part",
          part: partIndex + 1,
          totalParts: parts.length,
          startLine: part.startLine,
          endLine: part.endLine,
          index: 0,
        }),
      );
    });
  }

  // 청크 순번 재설정
  return chunks.map((chunk, index) => ({
    ...chunk,
    index: index + 1,
  }));
}

/**
 * 분할된 각 diff 청크를 AI 모델을 호출하여 순차적으로 요약합니다.
 * 각 청크 호출 시 민감 정보 마스킹 처리를 수행하며, 실패한 경우 설정된 횟수만큼 재시도합니다.
 * 모든 재시도가 실패하면 해당 청크는 메타데이터(파일명 등) 기반의 폴백 요약으로 대체됩니다.
 * 
 * @param {Object} params
 * @param {Array} params.chunks - 요약할 청크 객체 배열
 * @param {Object} params.config - AI 실행 설정
 * @param {string} params.language - 요약본 생성 언어
 * @param {number} params.maxRetries - 요약 실패 시 최대 재시도 횟수
 * @returns {Promise<Array>} 각 청크의 요약 결과(내용, 상태, 시도 횟수 등) 배열
 */
export async function summarizeDiffChunks({
  chunks,
  config = {},
  language = "ko",
  maxRetries = DEFAULT_SUMMARY_OPTIONS.maxRetries,
} = {}) {
  // chunks가 배열이 아니면 에러
  if (!Array.isArray(chunks)) {
    throw new TypeError("chunks must be an array");
  }

  // 재시도 횟수
  const retryLimit =
    positiveIntegerOrDefault(maxRetries, DEFAULT_SUMMARY_OPTIONS.maxRetries) + 1;
  // 결과 배열
  const results = [];

  // chunks 순회
  for (const chunk of chunks) {
    // 유효한 청크 검증
    if (!chunk || typeof chunk.diff !== "string" || chunk.diff.trim().length === 0) {
      results.push(createFallbackSummary(chunk, 0, "invalid_chunk"));
      continue;
    }

    // 민감 정보 마스킹
    const safeChunk = {
      ...chunk,
      diff: maskSensitiveDiff(chunk.diff).diff,
    };
    // 마지막 에러
    let lastError = null;

    // 재시도
    for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
      try {
        // 프롬프트 생성
        const prompt = buildChunkSummaryPrompt({ chunk: safeChunk, language });
        // AI 모델 호출
        const response = await generateWithProvider({ prompt, config });
        // 요약 텍스트 정규화
        const summary = normalizeSummaryText(response);

        // 요약 텍스트가 없으면 에러
        if (!summary) {
          throw new Error("Chunk summary response was empty.");
        }

        // 결과 추가
        results.push({
          index: chunk.index,
          files: normalizeFiles(chunk),
          summary,
          status: "success",
          attempts: attempt,
        });
        // 성공 시 재시도 횟수 초기화
        lastError = null;
        // 성공 시 루프 탈출
        break;
      } catch (error) {
        // 지원하지 않는 Provider 에러인 경우 그대로 에러 발생
        if (isUnsupportedProviderError(error)) {
          throw error;
        }

        // 마지막 에러 저장
        lastError = error;
      }
    }

    // 재시도 했음에도 에러가 발생한 경우 폴백 요약 생성
    if (lastError) {
      results.push(createFallbackSummary(chunk, retryLimit));
    }
  }

  return results;
}

/**
 * 개별 청크들의 요약 결과를 하나의 통합된 요약 문자열로 병합합니다.
 * 중복된 요약 내용을 제거하고, 동일 파일/함수/의도(Intent)별로 그룹화하여 가독성을 높입니다.
 * 최종 결과물이 너무 길어질 경우 글자 수 제한을 적용하여 커밋 프롬프트 크기를 조절합니다.
 * 
 * @param {Array} chunkSummaries - summarizeDiffChunks를 통해 얻은 요약 결과 배열
 * @param {Object} options - 병합 옵션 (최대 글자 수, 결과가 없을 때의 메시지 등)
 * @returns {string} 병합된 전체 변경 사항 요약 문자열
 */
export function mergeChunkSummaries(chunkSummaries, options = {}) {
  if (!Array.isArray(chunkSummaries)) {
    return options.emptyMessage || "변경 요약 없음";
  }

  // 최대 글자 수
  const maxCharacters = positiveIntegerOrDefault(options.maxCharacters, 12000);
  // 비어있을 때 메시지
  const emptyMessage = options.emptyMessage || "변경 요약 없음";
  // 요약 정규화
  const normalized = chunkSummaries
    .map(normalizeSummaryEntry)
    .filter(Boolean)
    .sort((left, right) => left.index - right.index);

  // 중복 제거
  const seen = new Set();
  // 그룹화
  const groups = new Map();

  // 정규화된 요약 순회
  for (const entry of normalized) {
    // 중복 제거
    const duplicateKey = summaryKey(entry);
    // 중복된 요약인 경우 건너뛰기
    if (seen.has(duplicateKey)) {
      continue;
    }
    // 중복 제거
    seen.add(duplicateKey);

    // 그룹 키 생성
    const key = groupKey(entry);
    // 그룹이 없으면 그룹 생성
    if (!groups.has(key)) {
      groups.set(key, {
        files: entry.files,
        functionName: entry.functionName,
        intent: entry.intent,
        summaries: [],
      });
    }

    // 요약 추가
    groups.get(key).summaries.push(entry.summary);
  }

  // 그룹이 없으면 빈 메시지 반환
  if (groups.size === 0) {
    return emptyMessage;
  }

  // 전체 변경 요약 헤더
  const lines = ["전체 변경 요약:"];
  // 그룹 순회
  for (const group of groups.values()) {
    // 그룹 라벨 생성
    const label = [
      group.files.join(", "),
      group.functionName,
      group.intent && group.intent !== "general" ? group.intent : null,
    ]
      .filter(Boolean)
      .join(" / ");
    lines.push(`- ${label || "general"}: ${group.summaries.join(" ")}`);
  }

  // 글자 수 제한 적용
  return limitSummary(lines.join("\n"), maxCharacters);
}

// 민감 정보 포함 여부 확인
export function containsSecretMarker(value) {
  return SECRET_MARKER_PATTERN.test(String(value ?? ""));
}
