# MCP 기반 Codex 연동 Test Plan

## 테스트 목표

`codex-mcp` provider가 `dangerous12.md`의 보안 문제를 다시 만들지 않으면서, Codex MCP server를 통해 commit message를 생성할 수 있는지 검증한다.

핵심 검증 항목:

- OpenAI/Codex OAuth endpoint를 직접 사용하지 않는다.
- Codex credential 파일을 직접 읽지 않는다.
- 외부 전송 confirm 거부 시 MCP server를 실행하지 않는다.
- diff의 민감정보는 MCP server로 가기 전에 마스킹된다.
- MCP subprocess는 argv 배열 방식으로 실행된다.
- `approval-policy: "never"`와 `sandbox: "read-only"`가 tool call에 들어간다.
- timeout과 cleanup이 동작한다.
- 오류 메시지에 prompt, diff, token, stderr 원문이 나오지 않는다.

## 단위 테스트

### 1. provider routing

파일: `tests/provider-routing.test.js`

테스트:

- `getProvider("codex-mcp")`가 provider를 반환한다.
- `generateWithProvider({ config: { provider: "codex-mcp" } })`가 `codex-mcp` provider로 위임된다.
- unsupported provider는 기존처럼 mock fallback 없이 실패한다.

예상:

- `codex-mcp`는 명시 provider로만 동작한다.
- 실패 시 `Unsupported provider`가 아니라 실제 MCP provider 오류가 나온다.

### 2. model command

파일: `tests/model-command.test.js`

테스트:

- `runModelSetup("codex-mcp", "none", "gpt-5.3-codex")` 실행 시 config가 저장된다.
- 저장 config:

```json
{
  "provider": "codex-mcp",
  "authType": "none",
  "modelVersion": "gpt-5.3-codex",
  "modelDisplayName": "gpt-5.3-codex"
}
```

추가 확인:

- `credentials.json`에 OpenAI/Codex 관련 secret이 저장되지 않는다.
- `authType: "api"` 또는 `authType: "oauth"`는 거부한다.

### 3. MCP subprocess 실행 방식

파일: `tests/codex-mcp-provider.test.js`

테스트 방식:

- 실제 `codex`를 실행하지 않는다.
- provider 내부의 process launcher를 테스트 주입 가능하게 만들거나, child_process `spawn` 호출을 mock한다.

검증:

- command는 `"codex"`
- args는 `["mcp-server"]`
- `shell`은 `false` 또는 미설정
- cwd는 Git repository root 또는 명시 config cwd
- stdin/stdout/stderr는 pipe 기반

금지:

- `execSync("codex mcp-server")` 같은 shell 문자열 실행
- 사용자 입력을 command 문자열에 직접 붙이기

### 4. MCP lifecycle

파일: `tests/codex-mcp-provider.test.js`

mock MCP server stdout/stdin으로 아래 흐름을 검증한다.

1. `initialize` 요청 전송
2. `initialized` notification 전송
3. `tools/list` 요청 전송
4. `tools/call` 요청 전송
5. `codex` tool result 파싱
6. server 종료

검증:

- `tools/list` 결과에 `codex` tool이 없으면 명확한 오류로 실패한다.
- raw JSON-RPC payload는 오류 메시지에 포함하지 않는다.
- `structuredContent.content`가 있으면 그 값을 우선 사용한다.
- `content[]` text만 있는 구형 응답도 처리한다.

### 5. tool call arguments 보안

파일: `tests/codex-mcp-provider.test.js`

검증:

- `tools/call`의 `name`은 항상 `"codex"`다.
- arguments에는 `approval-policy: "never"`가 들어간다.
- arguments에는 `sandbox: "read-only"`가 들어간다.
- config에 `sandbox: "workspace-write"` 또는 `danger-full-access`가 있어도 commit message provider에서는 거부하거나 `read-only`로 강제한다.
- prompt에는 commit message 생성 요구만 포함하고, 파일 수정 요청을 넣지 않는다.

### 6. timeout

파일: `tests/codex-mcp-provider.test.js`

테스트:

- server startup이 응답하지 않으면 startup timeout으로 실패한다.
- `initialize` 응답이 없으면 initialize timeout으로 실패한다.
- `tools/call` 응답이 없으면 tool timeout으로 실패한다.
- timeout 후 subprocess kill/cleanup이 호출된다.

검증:

- 오류 메시지는 짧고 안전하다.
- prompt, diff, token, stderr 원문이 없다.

### 7. stderr redaction

파일: `tests/codex-mcp-provider.test.js`

mock stderr:

```text
Authorization: Bearer sk-test
OPENAI_API_KEY=sk-test
```

검증:

- 기본 사용자 출력에는 stderr가 나오지 않는다.
- debug 요약을 구현하는 경우 `[REDACTED]`로 마스킹된다.

## commit flow 통합 테스트

### 1. 외부 전송 거부 시 MCP server 미실행

파일: `tests/commit-command.test.js`

조건:

- config provider: `codex-mcp`
- `confirmExternalTransmission: "always"`
- 사용자 confirm: false

검증:

- `spawn("codex", ["mcp-server"])`가 호출되지 않는다.
- git add/commit도 호출되지 않는다.
- 사용자 working tree는 변경되지 않는다.

### 2. 민감정보 마스킹 후 전송

파일: `tests/commit-command.test.js`

diff 예:

```text
API_KEY=real-secret
TOKEN=real-token
```

검증:

- MCP tool call prompt에는 `[REDACTED]`만 들어간다.
- raw secret은 prompt, logger, error에 없다.
- warning에 "masked before external AI transmission" 계열 메시지가 나온다.

### 3. batch commit 성공 흐름

파일: `tests/commit-command.test.js`

mock MCP result:

```text
feat: add codex mcp provider
```

검증:

- commit preview가 표시된다.
- 사용자 commit confirm 이후에만 `git add`와 `git commit`이 실행된다.
- commit message는 MCP 응답에서 정리된 값이다.

### 4. step commit 성공 흐름

파일: `tests/commit-command.test.js`

검증:

- 파일별 prompt가 각각 MCP provider로 전달된다.
- 하나의 파일에서 MCP 오류가 나도 기존 step failure 정책을 따른다.
- 사용자 승인 없는 commit은 없다.

## 실제 환경 수동 테스트

실제 Codex CLI와 연동하는 테스트는 자동 unit test에서 수행하지 않는다. 사용자의 Codex 로그인 상태, plan, 네트워크, 설치 상태에 의존하기 때문이다.

격리된 테스트 repository에서만 아래를 수동 확인한다.

### 준비

```text
codex --version
codex
```

최초 실행 시 ChatGPT 계정 또는 API key로 로그인한다.

### MCP server 확인

```text
codex mcp-server
```

별도 터미널 또는 MCP Inspector로 `tools/list`를 호출해 `codex`, `codex-reply`가 보이는지 확인한다.

### convention 설정

```text
node bin/convention.js --model codex-mcp none gpt-5.3-codex
```

### batch 확인

임시 Git 저장소에서만 실행한다.

```text
node bin/convention.js --batch
```

확인:

- 외부 AI 전송 확인 질문이 나온다.
- commit preview가 나온다.
- 사용자가 승인해야 commit된다.
- Codex가 파일을 수정하지 않는다.

## 실패 케이스

### Codex CLI 미설치

예상:

```text
Codex MCP server could not be started. Install Codex CLI and login before using codex-mcp.
```

### Codex 미로그인 또는 plan 미지원

예상:

- convention-cli는 plan 여부를 직접 판정하지 않는다.
- Codex MCP server가 반환한 실패를 안전한 provider 오류로 바꾼다.
- 기존 모델 전환 flow로 이어질 수 있게 한다.

### MCP server가 다른 tool만 제공

예상:

```text
Codex MCP server did not expose the required codex tool.
```

### Codex가 설명문을 반환

예상:

- `cleanAIResponse()`로 정리한다.
- 정리 후 빈 문자열이면 실패한다.
- 설명문 전체를 commit message로 그대로 쓰지 않는다.

## 완료 기준

- `npm test` 통과
- `node --test tests/codex-mcp-provider.test.js` 통과
- `node --test tests/provider-routing.test.js` 통과
- `node --test tests/model-command.test.js` 통과
- `node --test tests/commit-command.test.js` 통과
- 실제 Codex CLI 없이도 unit test가 통과
- 실제 Codex CLI 연동은 수동 테스트 문서대로만 확인

## 보안 완료 기준

- OpenAI/Codex OAuth endpoint 직접 구현 없음
- Codex credential 파일 직접 읽기 없음
- `danger-full-access` 사용 없음
- 외부 전송 confirm 전 MCP 호출 없음
- 민감 diff 마스킹 확인
- raw MCP payload 출력 없음
- raw stderr 출력 없음
- mock fallback 없음

