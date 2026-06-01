# MCP-AGY-FIX Research

## 목적

Antigravity MCP 연동을 위해 사용자가 직접 `mcp_config.json`을 찾아 만들고 수정해야 하는 부담을 줄인다. 다만 기존 `convention -am` / `convention --agy-mcp`는 이미 JSON-RPC stdio MCP 서버 실행 모드이므로, 설치 자동화와 서버 실행 책임을 분리해야 한다.

## 현재 상태

현재 CLI에는 `-am, --agy-mcp` 옵션이 존재하며, 이 옵션은 `src/commands/mcp.js`의 `runMCPServer()`를 실행한다.

`runMCPServer()`는 stdin/stdout 기반 JSON-RPC 서버로 동작한다. Antigravity가 이 프로세스를 MCP 서버로 실행하면 stdout에는 JSON-RPC 응답만 흘러야 한다.

현재 MCP 서버는 `tools/list` 응답으로 아래 3개 도구를 동적으로 제공한다.

- `get_masked_git_diff`
- `build_commit_prompt`
- `execute_git_commit`

따라서 별도의 `mcp/convention-cli-mcp/*.json` 도구 스키마 파일을 생성하는 방식은 현재 구현과 맞지 않는다. 실제로 필요한 자동화 대상은 Antigravity가 읽는 `mcp_config.json`의 `mcpServers["convention-cli-mcp"]` 엔트리다.

## 핵심 판단

`proposal3.md` 기준으로 구현 방향은 타당하다.

핵심은 다음과 같다.

1. `-am/--agy-mcp`는 순수 MCP 서버 모드로 유지한다.
2. Antigravity 설정 자동화는 별도 설치 명령으로 분리한다.
3. 자동화는 `mcp_config.json` 생성/병합/제거에 한정한다.
4. 기존 Antigravity 설정과 다른 MCP 서버 설정을 보존한다.
5. 파일 쓰기 전 confirm과 `--preview/-pv`를 제공한다.

이 방식이면 기존 commit, reset, PR, provider 흐름에 영향을 최소화하면서 사용자의 수동 설정 부담을 줄일 수 있다.

## 권장 CLI

### MCP 서버 실행

```bash
convention -am
convention --agy-mcp
```

역할:

- Antigravity가 stdio로 실행하는 서버 모드
- stdout에는 JSON-RPC 응답만 출력
- 설치 안내, 파일 생성, 사용자 confirm prompt를 수행하지 않음

### MCP 설정 설치

```bash
convention --install-agy-mcp
convention -iam
```

역할:

- Antigravity MCP 설정 파일 자동 생성 또는 병합
- 대상 경로와 변경 종류를 보여준 뒤 사용자 confirm
- 성공 후 Antigravity 재시작 안내

### MCP 설정 제거

```bash
convention --uninstall-agy-mcp
convention -uam
```

역할:

- `mcpServers["convention-cli-mcp"]`만 제거
- 다른 MCP 서버 설정은 보존
- 파일 전체 삭제는 하지 않음

### 대상 선택

```bash
convention -iam --target editor
convention -iam -tg cli
```

지원 target:

```text
editor -> ~/.gemini/antigravity/mcp_config.json
cli    -> ~/.gemini/antigravity-cli/mcp_config.json
ide    -> ~/.gemini/antigravity-ide/mcp_config.json
gemini -> ~/.gemini/config/mcp_config.json
```

동작 원칙:

- `--target/-tg`는 `--install-agy-mcp` 또는 `--uninstall-agy-mcp`와 함께 사용할 때만 유효하다.
- 알 수 없는 target 값은 명확한 오류로 중단한다.
- target이 없으면 기존 후보 디렉터리를 탐지해 사용자에게 선택하게 한다.

### 미리보기

```bash
convention --install-agy-mcp --preview
convention -iam -pv
```

역할:

- 실제 파일을 쓰지 않음
- 어떤 파일에 어떤 작업이 수행될지 요약
- `--yes`와 함께 지정되어도 파일을 쓰지 않음

출력 범위:

- 대상 `mcp_config.json` 경로
- 작업 종류: create/update/delete/noop
- 서버 이름: `convention-cli-mcp`
- command/args/cwd/env 키 요약

출력 금지:

- 기존 `mcp_config.json` 전체 원문
- 다른 MCP 서버 설정 전체
- secret 값
- 환경 변수 전체

## 대상 파일 후보

홈 디렉터리는 반드시 `os.homedir()`와 `path.join()`으로 조합한다.

```text
~/.gemini/antigravity/mcp_config.json
~/.gemini/antigravity-cli/mcp_config.json
~/.gemini/antigravity-ide/mcp_config.json
~/.gemini/config/mcp_config.json
```

자동 탐지 기본 정책:

- 정해진 후보 경로만 확인한다.
- 홈 전체를 스캔하지 않는다.
- 후보 디렉터리가 하나만 있으면 해당 경로를 제안한다.
- 후보 디렉터리가 여러 개면 선택 UI를 띄운다.
- 후보가 없으면 `editor` 또는 `cli` 중 선택하게 한다.
- `--target/-tg`가 있으면 해당 후보만 사용한다.

## 생성할 MCP 서버 설정

`mcp_config.json`에는 아래 구조를 생성 또는 병합한다.

```json
{
  "mcpServers": {
    "convention-cli-mcp": {
      "command": "<process.execPath>",
      "args": [
        "<absolute path to bin/convention.js>",
        "-am"
      ],
      "cwd": "<current repo root or process cwd>",
      "env": {
        "CONVENTION_EXPERIMENTAL_ANTIGRAVITY": "true"
      }
    }
  }
}
```

구현 주의:

- `command`는 `process.execPath`를 우선 사용한다. Antigravity 실행 환경에서 `node` PATH가 없을 수 있기 때문이다.
- CLI 경로는 `import.meta.url` 기반으로 현재 패키지의 `bin/convention.js` 절대 경로를 계산한다.
- `cwd`는 현재 Git 저장소 루트를 우선 사용하고, 실패하면 `process.cwd()`를 사용한다.
- `args`는 문자열 하나가 아니라 배열이어야 한다.
- shell 문자열을 만들지 않는다.

## CRUD 정책

### Create

- 대상 파일이 없으면 새 `mcp_config.json`을 만든다.
- 부모 디렉터리가 없으면 confirm 이후 생성한다.
- BOM 없는 UTF-8로 저장한다.
- JSON 최상위에 `mcpServers` 객체를 둔다.

### Read

- 기존 파일은 JSON으로 파싱한다.
- 깨진 JSON이면 자동 수정하지 않고 중단한다.
- 오류 메시지에 파일 원문을 출력하지 않는다.

### Update

- 기존 최상위 키와 다른 MCP 서버 엔트리를 보존한다.
- `mcpServers["convention-cli-mcp"]`만 추가 또는 갱신한다.
- 기존 같은 이름의 서버가 있으면 차이를 요약하고 confirm을 받는다.

### Delete

- `mcpServers["convention-cli-mcp"]`만 제거한다.
- `mcpServers`가 비어도 파일 전체 삭제는 하지 않는다.
- 제거 전 confirm을 받는다.

## 구현 위치

권장 모듈:

```text
src/core/agyMcpConfig.js
src/commands/agyMcpInstall.js
tests/agy-mcp-install.test.js
```

권장 함수:

```js
export function getAntigravityMcpConfigCandidates(homeDir = os.homedir())
export function detectExistingTargets(candidates)
export function buildConventionMcpServerConfig({ nodePath, cliPath, cwd })
export function mergeMcpServerConfig(existingConfig, serverConfig)
export function removeMcpServerConfig(existingConfig)
export function readMcpConfig(filePath)
export function writeMcpConfig(filePath, config)
```

명령 함수:

```js
export async function runAgyMcpInstall(options = {})
export async function runAgyMcpUninstall(options = {})
```

`src/commands/mcp.js`는 JSON-RPC 서버 책임만 유지하고 설치 CRUD 로직을 넣지 않는다.

## CLI 충돌 규칙

`--install-agy-mcp/-iam`과 `--uninstall-agy-mcp/-uam`은 설정 명령으로 취급한다.

허용:

- `--target/-tg`
- `--preview/-pv`
- `--yes`
- `--no-interactive`

금지:

- `--step`
- `--batch`
- `--group`
- `--push`
- `--reset`
- `--pr`
- `--model`
- `--template`
- `--language`
- `--set-mode`
- `-am/--agy-mcp`

`--target/-tg` 또는 `--preview/-pv`가 단독으로 들어오면 오류로 중단한다.

## 보안 평가

안전하게 구현 가능하다. 다만 아래 규칙을 반드시 지켜야 한다.

- 홈 전체 스캔 금지
- 정해진 후보 경로만 확인
- 기존 config 전체 출력 금지
- secret, token, private key 출력 금지
- 파일 쓰기 전 confirm
- preview 모드에서는 절대 파일 쓰기 금지
- 기존 다른 MCP 서버 설정 보존
- `-am` 서버 모드 stdout 오염 금지
- shell 문자열 조합 금지

## 결론

이 기능은 구현 가치가 충분하다. 단, `-am` 최초 실행에서 자동 설정을 수행하는 방식은 피해야 한다. 설치/제거 전용 명령을 추가하고 `mcp_config.json`의 `convention-cli-mcp` 엔트리만 관리하는 방식이 현재 구조와 가장 잘 맞고, 보안상 부작용도 작다.

