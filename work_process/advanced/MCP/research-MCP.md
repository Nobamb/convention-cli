# MCP 기반 Codex 연동 Research

## 결론

MCP 기반 구현은 가능하다.

단, `dangerous/dangerous12.md`에서 보류한 "OpenAI/Codex OAuth를 convention-cli가 직접 구현하는 방식"을 다시 시도하면 안 된다. 가능한 방식은 `convention-cli`가 OpenAI OAuth endpoint, Codex entitlement API, Codex CLI credential 파일을 직접 다루지 않고, 공식 Codex CLI가 제공하는 `codex mcp-server`를 MCP server로 실행한 뒤 MCP tool 호출 결과만 provider 응답으로 받는 구조다.

이 방식은 `dangerous12.md`의 핵심 문제를 아래처럼 피한다.

- OpenAI/Codex OAuth endpoint를 추정하지 않는다.
- `~/.codex` 또는 Codex CLI credential 파일을 convention-cli가 읽지 않는다.
- Plus/Pro entitlement를 convention-cli가 비공식 API로 판단하지 않는다.
- Codex CLI가 인증 실패, 권한 부족, 요금제 미지원 오류를 반환하면 그 오류를 일반 provider 실패로 다루고, 기존 모델 전환 flow로 연결한다.
- diff 전송 전 보안 gate와 사용자 확인은 기존 `commit.js` 경로에서 유지한다.

## 공식 문서에서 확인한 근거

- MCP는 client-server 구조이며, data layer는 JSON-RPC 기반이고 server가 `tools`, `resources`, `prompts` 같은 primitive를 노출한다.
  - https://modelcontextprotocol.io/docs/learn/architecture
- MCP transport는 표준적으로 stdio와 Streamable HTTP를 지원한다. stdio는 client가 server subprocess를 실행하고 stdin/stdout으로 JSON-RPC 메시지를 주고받는다.
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- Codex CLI 문서는 Codex를 MCP server로 실행할 수 있다고 안내한다.
  - command: `codex mcp-server`
  - MCP tool: `codex`, `codex-reply`
  - `codex` tool 입력에는 `prompt`, `approval-policy`, `sandbox`, `cwd`, `model` 등이 포함된다.
  - `sandbox` 값에는 `read-only`, `workspace-write`, `danger-full-access`가 있다.
  - https://developers.openai.com/codex/guides/agents-sdk
- Codex CLI는 ChatGPT 계정 또는 API key로 인증할 수 있고, Codex 포함 plan은 Plus, Pro, Business, Edu, Enterprise로 안내되어 있다.
  - https://developers.openai.com/codex/cli

## 목표

`convention-cli`에 `codex-mcp` provider를 추가한다.

이 provider는 커밋 메시지 생성만 담당한다. 파일 수정, shell 실행, git 조작, 자동 commit은 허용하지 않는다.

권장 사용자 흐름:

```text
convention --model codex-mcp none gpt-5.3-codex
convention --batch
```

`authType`은 우선 `none`으로 둔다. 이유는 convention-cli가 Codex credential을 저장하거나 갱신하지 않기 때문이다. Codex 로그인은 사용자가 Codex CLI에서 별도로 완료해야 한다.

```text
codex
# 최초 실행 시 ChatGPT 계정 또는 API key로 로그인
```

또는 사용자가 직접 아래 명령으로 MCP server가 뜨는지 검증할 수 있다.

```text
codex mcp-server
```

## Provider 구조

### 새 파일

- `src/providers/codex-mcp.js`

### 기존 파일 수정 후보

- `src/providers/index.js`
  - `codex-mcp` provider 등록
- `src/config/defaults.js`
  - `PROVIDERS`에 `codex-mcp` 추가
  - 필요 시 `DEFAULT_CODEX_MCP_*` 상수 추가
- `src/commands/model.js`
  - `SUPPORTED_AUTH_TYPES_BY_PROVIDER["codex-mcp"] = ["none"]`
  - `DEFAULT_MODEL_VERSION_BY_PROVIDER["codex-mcp"]` 추가
- `src/utils/validator.js`
  - `codex-mcp`를 유효 provider로 허용
- `src/commands/commit.js`
  - 외부 AI provider 판정에 `codex-mcp` 포함
  - 기존 외부 전송 confirm/masking gate를 재사용
- `tests/provider-routing.test.js`
  - provider routing 테스트 추가
- `tests/model-command.test.js`
  - `--model codex-mcp none <model>` 설정 저장 테스트 추가
- `tests/commit-command.test.js`
  - 외부 전송 거부 시 MCP server가 실행되지 않는지 테스트 추가

## MCP Client 구현 방향

### 1. stdio transport 우선

처음에는 Streamable HTTP가 아니라 stdio transport만 지원한다.

이유:

- Codex CLI 공식 실행 방식이 `codex mcp-server`다.
- 외부 URL, bearer token, OAuth callback 같은 추가 보안 표면을 만들지 않는다.
- local subprocess는 `spawn`/`execFile`의 argv 배열 방식으로 안전하게 실행할 수 있다.

권장 실행:

```js
spawn("codex", ["mcp-server"], {
  cwd: repoRoot,
  stdio: ["pipe", "pipe", "pipe"],
  shell: false,
});
```

주의:

- `execSync` 문자열 조합 금지
- `shell: true` 금지
- 사용자가 입력한 command 문자열을 그대로 shell에 전달 금지
- stderr는 기본 출력하지 말고, debug 모드에서도 logger redaction을 거친다

### 2. JSON-RPC lifecycle

MCP client는 최소 아래 순서를 구현한다.

1. Codex MCP server subprocess 시작
2. `initialize` 요청 전송
3. `initialized` notification 전송
4. `tools/list` 요청 전송
5. `codex` tool 존재 확인
6. `tools/call`로 `codex` 호출
7. `structuredContent.content` 또는 text content에서 결과 추출
8. provider 응답을 `core/ai.cleanAIResponse()`로 정리
9. subprocess 종료

권장 최소 tool call arguments:

```json
{
  "prompt": "Conventional Commit message only...",
  "approval-policy": "never",
  "sandbox": "read-only",
  "cwd": "현재 Git repo root",
  "model": "사용자 config.modelVersion"
}
```

`approval-policy: "never"`와 `sandbox: "read-only"`를 같이 사용한다. commit message 생성은 파일 쓰기나 shell 실행이 필요 없으므로 `workspace-write`를 쓰지 않는다.

### 3. timeout

MCP provider는 timeout이 필수다.

권장 기본값:

- startup timeout: 10초
- initialize timeout: 10초
- tool call timeout: 60초
- cleanup timeout: 5초

timeout 발생 시:

- prompt 원문 출력 금지
- diff 원문 출력 금지
- Codex stderr 원문 출력 금지
- token, path, 내부 JSON-RPC raw payload 출력 금지
- 짧은 메시지만 반환

예:

```text
Codex MCP commit message request timed out after 60000ms.
```

### 4. 응답 정리

Codex MCP server는 tool call 결과에서 `structuredContent`를 반환할 수 있다. provider는 아래 순서로 문자열을 추출한다.

1. `result.structuredContent.content`
2. `result.content[]` 중 `type: "text"`의 `text`
3. 위 둘 다 없으면 오류

그 뒤 기존 `cleanAIResponse()` 흐름을 통과시켜야 한다.

반환값은 Conventional Commits 한 줄 또는 사용자가 허용한 multi-line commit message여야 한다. Codex가 설명문을 섞으면 cleanup 단계에서 제거한다.

## 보안 정책

### 반드시 지킬 것

- convention-cli는 Codex credential 파일을 직접 읽지 않는다.
- convention-cli는 OpenAI/Codex OAuth endpoint를 추정하지 않는다.
- convention-cli는 Plus/Pro plan 여부를 직접 판정하지 않는다.
- MCP server 실행 전 기존 diff masking과 외부 전송 confirm을 통과한다.
- MCP server에는 마스킹된 prompt만 전달한다.
- `approval-policy: "never"`와 `sandbox: "read-only"`를 기본값으로 강제한다.
- `danger-full-access`는 config에 들어와도 거부한다.
- MCP server stdout에는 MCP JSON-RPC 메시지만 온다고 가정하되, parsing 실패 시 raw payload를 출력하지 않는다.
- MCP server stderr는 기본적으로 버린다. 로그가 필요하면 redaction 후 요약만 보여준다.
- MCP server가 `codex` 외 tool을 제공해도 호출하지 않는다.

### 구현하면 안 되는 것

- `~/.codex/config.toml`, `~/.codex/auth.json`, 그 밖의 Codex credential 저장소를 직접 읽기
- `codex login` 또는 브라우저 로그인 flow를 convention-cli가 대신 실행
- OpenAI plan/entitlement 확인용 비공식 endpoint 호출
- `codex` CLI 일반 TUI를 subprocess로 실행해서 stdout을 파싱
- shell 문자열로 `codex mcp-server` 실행
- MCP provider 실패 시 mock으로 fallback
- 외부 전송 confirm 없이 diff를 Codex MCP로 전달

## `dangerous12.md`와의 관계

`dangerous12.md`의 직접 OAuth 구현 불가 판단은 유지된다.

MCP 방식은 "Codex OAuth를 구현할 수 있다"는 뜻이 아니다. 대신 Codex CLI가 공식적으로 제공하는 MCP server interface를 사용해, convention-cli의 provider contract에 맞게 commit message 생성만 요청하는 방식이다.

따라서 구현 명칭도 `codex oauth`가 아니라 `codex-mcp none`이 적절하다.

## 구현 단계

1. `src/providers/codex-mcp.js` 작성
   - `generateCommitMessage({ prompt, config })`
   - `listModels(config)`는 초기에는 `[]` 또는 config 기본 모델만 반환
   - MCP JSON-RPC client helper는 같은 파일의 private 함수로 시작
2. provider registry에 `codex-mcp` 추가
3. model setup에서 `codex-mcp`는 `authType: "none"`만 허용
4. commit 외부 provider 판정에 `codex-mcp` 추가
5. 테스트 추가
6. 문서 갱신

## 향후 확장

추후 MCP provider가 안정화되면 아래를 고려한다.

- `src/providers/mcp.js` 공통 provider로 일반화
- `src/providers/codex-mcp.js`는 공통 MCP provider의 preset으로 분리
- Streamable HTTP MCP server 지원
- MCP server별 allowlisted tool 설정
- MCP server health check
- `convention --model mcp` 대화형 설정

단, 원격 MCP server는 인증, Origin 검증, bearer token 저장, HTTP timeout, session 관리 문제가 추가되므로 stdio Codex MCP가 먼저 안정화된 뒤 진행한다.

