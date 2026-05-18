# Phase 3 / N Diff Intent Analyzer Agent Research

## 1. 개요

Phase N은 Phase M의 변경 파일 분류 결과와 파일별 diff를 바탕으로 각 파일의 변경 의도를 분석하는 단계입니다. 목적은 파일마다 `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore` 후보와 짧은 요약을 만들고, 이후 Phase O File Grouping Agent가 같은 목적의 파일을 묶을 수 있는 안정적인 metadata를 제공하는 것입니다.

이 단계는 Git 작업을 직접 수행하지 않습니다. `git add`, `git commit`, `git push`, `git reset`을 호출하지 않고, 파일별 diff 입력을 분석 결과로 변환하는 core 계층 기능만 설계합니다.

## 2. 작업 목표

- `src/core/grouping.js`에 diff intent 분석 함수를 정의합니다.
- `src/core/prompt.js`에 파일별 intent 분석 prompt 생성 함수를 추가합니다.
- `src/core/ai.js`를 통해 provider 기반 intent 분석을 호출하되, 보안 gate를 통과한 diff만 사용합니다.
- AI 분석이 불가능한 경우 rule 기반 fallback으로 최소한의 intent 후보를 반환합니다.
- 분석 결과에는 raw diff가 포함되지 않도록 합니다.
- unsupported provider 또는 보안 gate 실패를 조용히 mock fallback으로 숨기지 않습니다.

## 3. 구현 대상 파일

- `src/core/grouping.js`
  - `analyzeDiffIntent({ file, diff, classification, config, language })`
  - `analyzeDiffIntents({ fileDiffs, classifications, config, language })`
  - `inferIntentByRules({ file, diff, classification })`
  - `normalizeIntentResult(result, fallback)`
- `src/core/prompt.js`
  - `buildDiffIntentPrompt({ file, diff, classification, language })`
- `src/core/ai.js`
  - 기존 `generateCommitMessage(prompt, config)` 또는 provider routing 함수를 재사용
  - 필요하면 intent 전용 wrapper `generateDiffIntent(prompt, config)` 추가

## 4. 입력과 출력 계약

입력은 `getFileDiffs(files)`와 Phase M의 파일 분류 결과를 결합해 구성합니다.

```javascript
{
  file: "src/auth/login.js",
  diff: "...",
  classification: {
    file: "src/auth/login.js",
    fileType: "source"
  }
}
```

출력은 이후 grouping 단계에서 바로 사용할 수 있는 순수 metadata여야 합니다.

```javascript
{
  file: "src/auth/login.js",
  intent: "feat",
  summary: "로그인 인증 흐름을 추가",
  confidence: "high",
  source: "ai"
}
```

허용 intent는 Conventional Commits type과 동일하게 제한합니다.

- `feat`
- `fix`
- `refactor`
- `docs`
- `style`
- `test`
- `chore`

## 5. 권장 처리 흐름

`analyzeDiffIntent()`는 아래 순서로 동작하는 것이 적합합니다.

```javascript
async function analyzeDiffIntent({
  file,
  diff,
  classification,
  config,
  language = "ko"
}) {
  validateFileDiffInput({ file, diff });

  const ruleFallback = inferIntentByRules({ file, diff, classification });

  if (!shouldUseAIForIntent(config)) {
    return ruleFallback;
  }

  assertDiffSecurityGatePassed({ file, diff, config });

  const prompt = buildDiffIntentPrompt({
    file,
    diff,
    classification,
    language
  });

  const response = await generateCommitMessage(prompt, config);
  const parsed = parseIntentResponse(response);

  return normalizeIntentResult(parsed, ruleFallback);
}
```

`analyzeDiffIntents()`는 파일별 분석을 순회하며, 한 파일의 분석 실패가 전체 프로세스를 무조건 망가뜨리지 않도록 파일 단위 fallback을 적용합니다. 단, 보안 gate 실패나 unsupported provider는 정책 위반에 가까우므로 조용히 진행하지 않고 상위 flow가 중단할 수 있는 명확한 오류로 올립니다.

## 6. Prompt 기준

`buildDiffIntentPrompt()`는 commit message 생성을 요청하지 않고 intent 분석만 요청해야 합니다.

포함할 내용:

- 파일 경로
- Phase M classification metadata. 파일 유형은 `classification.fileType`으로만 참조하며, `classification.category` 또는 `classification.type` 별칭은 사용하지 않습니다.
- 허용 intent 목록
- 설정 언어
- 짧은 요약 요구
- JSON 형태 출력 요구
- raw diff에서 secret 값을 복사하지 말라는 지시

포함하지 않을 내용:

- provider credentials
- API Key, token, OAuth 정보
- 다른 파일의 diff
- commit 실행 여부
- grouping 결과 확정 지시

권장 출력 형식:

```json
{
  "intent": "feat",
  "summary": "로그인 인증 흐름을 추가",
  "confidence": "high"
}
```

provider 응답은 JSON parsing을 우선하되, parsing 실패 시 raw response를 로그로 출력하지 않고 rule fallback을 사용합니다.

## 7. Rule 기반 fallback

AI를 사용하지 않거나 provider 호출이 안전하게 완료되지 않은 경우 아래 기준으로 intent를 추정합니다.

- `classification.fileType`이 `docs`이면 `docs`
- `classification.fileType`이 `test`이면 `test`
- `classification.fileType`이 `style`이면 `style`
- `classification.fileType`이 `dependency`, `config`, `generated`, `unknown`이면 `chore`
- diff에 버그 수정 신호가 있으면 `fix`
  - 예: `fix`, `bug`, `error`, `exception`, `fail`, `regression`
- diff에 신규 export, 신규 command, 신규 option, 신규 public function 추가 신호가 강하면 `feat`
- 삭제/이동/구조 변경 중심이면 `refactor`
- 판단이 불명확하면 `chore`

fallback 결과는 반드시 `source: "rule"` 또는 `source: "fallback"`을 포함해 이후 단계가 신뢰도를 판단할 수 있게 합니다.

## 8. Provider 요구사항

- provider routing은 기존 `src/core/ai.js`와 `src/providers/index.js` 계약을 재사용합니다.
- 지원하지 않는 provider는 mock으로 조용히 fallback하지 않고 명확한 오류로 중단합니다.
- 외부 provider를 사용할 때는 diff 전송 전 사용자 확인 또는 명시 설정 정책이 필요합니다.
- provider 응답 원문 전체를 logger, error, preview에 출력하지 않습니다.
- provider가 빈 응답, markdown, code fence, 비 JSON 응답을 반환해도 raw 응답을 노출하지 않고 parsing 실패로 처리합니다.
- localLLM처럼 외부 네트워크가 아닌 provider도 raw diff logging 금지 규칙은 동일하게 적용합니다.

## 9. 보안 Gate 요구사항

AI 호출 전 아래 gate를 통과해야 합니다.

1. 파일 경로가 민감 파일 제외 규칙에 걸리지 않는지 확인합니다.
2. diff에서 민감정보 패턴을 탐지합니다.
3. 필요한 경우 diff를 마스킹합니다.
4. 외부 provider 전송 정책을 확인합니다.
5. gate 통과 후 prompt를 생성합니다.

기본 민감정보 후보:

- `API_KEY=`
- `SECRET=`
- `TOKEN=`
- `PASSWORD=`
- `PRIVATE_KEY`
- `DATABASE_URL`
- `AWS_ACCESS_KEY_ID`
- `-----BEGIN PRIVATE KEY-----`

기본 제외 파일 후보:

- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `id_rsa`
- `id_ed25519`
- `credentials.json`
- `secrets.json`

보안 gate 실패 시 raw diff 기반 AI fallback을 시도하지 않습니다.

## 10. Logging 기준

로그에 출력 가능한 값:

- 파일 경로
- intent 분석 성공/실패 여부
- provider 이름
- fallback 사용 여부
- 분석된 intent type

로그에 출력하지 않는 값:

- raw diff
- prompt 전문
- provider 응답 전문
- secret 후보 문자열
- credentials 파일 내용
- API Key, OAuth token

오류 메시지는 "파일 intent 분석 실패", "provider 응답 parsing 실패", "보안 gate 실패"처럼 원인을 식별할 수 있는 수준으로 유지하되 diff 원문을 포함하지 않습니다.

## 11. 완료 기준

- 파일별 diff를 입력받아 `{ file, intent, summary, confidence, source }` 형태 결과를 반환합니다.
- AI 기반 분석과 rule fallback 경로가 모두 정의됩니다.
- prompt는 intent 분석만 요청하고 commit message 생성을 요청하지 않습니다.
- provider/security gate 요구사항이 구현 계획에 반영됩니다.
- unsupported provider, 보안 gate 실패, 빈 diff, 비 JSON 응답 처리가 명확합니다.
- raw diff, prompt 전문, provider 응답 전문이 로그나 오류 메시지에 노출되지 않습니다.
- 결과는 Phase O File Grouping Agent가 사용할 수 있는 metadata 구조입니다.
