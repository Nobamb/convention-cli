/*
 * 시크릿 문자열 마스킹
 */
const REDACTED = "[REDACTED]";

/*
 * 시크릿 문자열 패턴
 */
const SECRET_VALUE_PATTERNS = [
  /\b(API_KEY\s*=\s*)[^\r\n]*/giu,
  /\b(SECRET\s*=\s*)[^\r\n]*/giu,
  /\b(TOKEN\s*=\s*)[^\r\n]*/giu,
  /\b(PASSWORD\s*=\s*)[^\r\n]*/giu,
  /\b(PRIVATE_KEY\b\s*=?\s*)[^\r\n]*/giu,
  /\b(DATABASE_URL\b\s*=?\s*)[^\r\n]*/giu,
  /\b(AWS_ACCESS_KEY_ID\b\s*=?\s*)[^\r\n]*/giu,
];

/**
 * 줄 끝 문자열 분리
 *
 * @param {*} line
 * @returns
 */

function splitLineEnding(line) {
  // 줄 바꿈 기호 찾기
  const match = line.match(/(\r?\n)$/u);
  // 줄 바꿈 기호가 없으면
  // 공백만 있는 라인도 포함
  if (!match) {
    return { body: line, ending: "" };
  }
  // 줄 바꿈 기호가 있으면
  // 줄 바꿈 기호를 제외한 나머지 문자열
  return {
    body: line.slice(0, -match[0].length),
    ending: match[0],
  };
}

/**
 * diff 앞부분의 접두사 추출
 * @param {*} line
 * @returns
 */

function getDiffLinePrefix(line) {
  //만약에 라인의 앞부분이 +,-,공백이고 뒷부분이 +,-,공백이 아니면
  if (/^[+\- ](?![+\- ]{2})/u.test(line)) {
    return line[0];
  }

  // 빈 문자열 반환
  return "";
}

/**
 * diff 앞부분의 접두사를 제외한 나머지 문자열 마스킹
 * @param {*} line
 * @returns
 */
function redactPrivateKeyLine(line) {
  // 접두사 추출
  const prefix = getDiffLinePrefix(line);
  // 접두사와 마스킹된 문자열 반환
  return `${prefix}${REDACTED}`;
}

/**
 * 시크릿 문자열 마스킹
 *
 * @param {*} line
 * @returns
 */
function maskSecretValues(line) {
  // line을 받아서 masked하도록 지정
  let masked = line;

  // 시크릿 문자열 패턴을 찾아서 마스킹
  for (const pattern of SECRET_VALUE_PATTERNS) {
    masked = masked.replace(pattern, `$1${REDACTED}`);
  }
  // 마스킹 반환
  return masked;
}

/**
 * 알려진 시크릿 마커에 대해 Git diff 본문을 검사하고 마스킹된 diff를 반환합니다.
 * 원본 값은 findings에서 반환되지 않으므로 호출자는 count만 안전하게 기록할 수 있습니다.
 *
 * @param {string} diff
 * @returns {{ diff: string, found: boolean, count: number }}
 */
export function maskSensitiveDiff(diff) {
  // 문자열 타입 검사
  if (typeof diff !== "string") {
    throw new TypeError("diff must be a string");
  }

  // 시크릿 발견 여부
  let found = false;
  // 시크릿 개수
  let count = 0;
  // privateKeyBlock 초기화
  let insidePrivateKeyBlock = false;

  // diff를 줄 단위로 분리
  const lines = diff.match(/[^\r\n]*(?:\r?\n|$)/gu) ?? [];
  // 줄 단위로 분리된 diff를 순회하면서 마스킹
  const maskedLines = lines.map((line) => {
    // 빈 줄은 그대로 반환
    if (line === "") {
      return line;
    }

    // 줄 끝 문자열 분리
    const { body, ending } = splitLineEnding(line);

    // privateKeyBlock안에 있는지 확인
    if (insidePrivateKeyBlock) {
      // 시크릿 발견
      found = true;
      // 시크릿 개수 증가
      count += 1;

      // END 키가 있으면 privateKeyBlock을 false로 변경
      if (/-----END PRIVATE KEY-----/iu.test(body)) {
        // privateKeyBlock을 false로 변경
        insidePrivateKeyBlock = false;
      }
      // 마스킹된 privateKeyLine 반환
      return `${redactPrivateKeyLine(body)}${ending}`;
    }

    // BEGIN 키가 있으면
    if (/-----BEGIN PRIVATE KEY-----/iu.test(body)) {
      // 시크릿 발견
      found = true;
      // 카운트 증가
      count += 1;
      // privateKeyBlock을 true로 변경
      insidePrivateKeyBlock = true;
      // 마스킹된 privateKeyLine 반환
      return `${redactPrivateKeyLine(body)}${ending}`;
    }
    // 시크릿 문자열 마스킹
    const maskedBody = maskSecretValues(body);

    // 만약에 maskedBody가 body와 다르면 시크릿 발견
    if (maskedBody !== body) {
      // 시크릿 발견
      found = true;
      // 카운트 증가
      count += 1;
    }

    // 마스킹된 body와 ending 반환
    return `${maskedBody}${ending}`;
  });

  // 마스킹된 diff, 시크릿 발견 여부, 시크릿 개수 반환
  return {
    diff: maskedLines.join(""),
    found,
    count,
  };
}
