# proposal3: Antigravity MCP 자동 설정 보완안

## 결론

`proposal2.md`의 문제의식은 타당하다. 사용자가 Antigravity 설정 폴더를 직접 찾아가 `mcp_config.json`을 작성하는 과정은 충분히 어렵고, 경로와 JSON 구조를 잘못 적기 쉽다.

다만 현재 내용만으로 바로 구현하기에는 부족하다. 특히 아래 두 지점은 수정이 필요하다.

1. `convention -am` / `convention --agy-mcp`는 이미 JSON-RPC stdio MCP 서버 실행 모드다. 이 옵션에서 사용자 confirm, 설치 안내, 파일 생성 로그를 stdout으로 출력하면 Antigravity가 기대하는 JSON-RPC 스트림이 깨질 수 있다.
2. Antigravity 연동에 필요한 파일은 `mcp/convention-cli-mcp/*.json` 도구 스키마 3개가 아니라, Antigravity가 읽는 `mcp_config.json`의 `mcpServers` 설정이다. 도구 스키마는 현재 `src/commands/mcp.js`의 `tools/list` 응답으로 동적으로 제공된다.

따라서 `proposal2.md`를 그대로 구현하기보다, 설치/CRUD 명령과 MCP 서버 실행 명령을 분리하는 방식이 더 안전하다.

## 권장 CLI 설계

### 유지할 명령

```bash
convention -am
convention --agy-mcp
```

역할:

- Antigravity가 stdio로 실행하는 순수 MCP 서버 모드
- stdout에는 JSON-RPC 응답만 출력
- 사용자 안내, 설치, 파일 생성, confirm prompt를 실행하지 않음
- 현재 `runMCPServer()`의 역할 유지

### 새로 추가할 명령

```bash
convention --install-agy-mcp
convention -iam
```

역할:

- Antigravity MCP 설정 파일 자동 생성 또는 병합
- 사용자 터미널에서 직접 실행하는 설치 명령
- 파일 쓰기 전 변경 대상과 내용을 요약해서 confirm
- 성공 후 Antigravity 재시작 안내

선택 옵션 후보:

```bash
convention --install-agy-mcp
convention -iam

convention --install-agy-mcp --target editor
convention -iam -tg editor

convention --install-agy-mcp --target cli
convention -iam -tg cli

convention --install-agy-mcp --target ide
convention -iam -tg ide

convention --install-agy-mcp --target gemini
convention -iam -tg gemini

convention --install-agy-mcp --preview
convention -iam -pv

convention --uninstall-agy-mcp
convention -uam
```

#### `--target` / `-tg`

`--target`은 Antigravity 설정 파일 후보 중 어느 프로필에 MCP 서버 설정을 쓸지 지정하는 설치 전용 옵션이다.

지원 후보:

```text
editor -> ~/.gemini/antigravity/mcp_config.json
cli    -> ~/.gemini/antigravity-cli/mcp_config.json
ide    -> ~/.gemini/antigravity-ide/mcp_config.json
gemini -> ~/.gemini/config/mcp_config.json
```

동작 원칙:

- `--target`은 `--install-agy-mcp` 또는 `--uninstall-agy-mcp`와 함께 사용할 때만 유효하다.
- `--target`이 없으면 기존 디렉터리 탐지 결과를 기준으로 사용자에게 선택지를 보여준다.
- `--target`이 있으면 해당 후보 경로만 대상으로 생성, 갱신, 제거를 시도한다.
- 알 수 없는 target 값은 조용히 fallback하지 않고 명확한 오류로 중단한다.

#### `--preview` / `-pv`

`--preview`는 실제 파일을 생성하거나 수정하지 않고, 어떤 `mcp_config.json` 파일에 어떤 MCP 서버 설정이 추가, 갱신, 제거될지 미리 보여주는 설치 전용 옵션이다.

동작 원칙:

- `--preview`는 `--install-agy-mcp` 또는 `--uninstall-agy-mcp`와 함께 사용할 때만 유효하다.
- `--preview` 실행 중에는 `fs.writeFileSync`, `fs.mkdirSync` 같은 파일 쓰기 작업을 수행하지 않는다.
- 출력에는 대상 경로, 작업 종류(create/update/delete), 서버 이름(`convention-cli-mcp`), command/args/cwd/env 키 요약만 포함한다.
- 기존 `mcp_config.json` 전체 원문, 다른 MCP 서버 설정 전체, secret 값, 환경 변수 전체를 출력하지 않는다.
- `--yes`와 함께 지정되어도 preview 모드에서는 파일을 쓰지 않는다.

`-am`을 설치 명령으로 재사용하지 않는 이유는 명확하다. Antigravity가 `-am`을 MCP 서버 실행 인자로 호출하기 때문에, 최초 실행 때 설치 흐름을 끼워 넣으면 호스트 연결이 실패할 수 있다.

## 대상 파일

Antigravity 설정 파일 후보는 OS와 설치 프로필에 따라 달라질 수 있다. 홈 디렉터리는 반드시 `os.homedir()`와 `path.join()`으로 조합한다.

권장 후보:

```text
~/.gemini/antigravity/mcp_config.json
~/.gemini/antigravity-cli/mcp_config.json
~/.gemini/antigravity-ide/mcp_config.json
~/.gemini/config/mcp_config.json
```

Windows에서도 위 상대 경로를 `path.join(os.homedir(), ".gemini", "...")`로 만들면 된다.

자동 설치의 기본 동작은 아래처럼 보수적으로 한다.

- 이미 존재하는 디렉터리를 우선 탐지한다.
- 후보가 하나만 있으면 해당 파일을 대상으로 제안한다.
- 후보가 여러 개면 사용자에게 선택 UI를 제공한다.
- 후보가 없으면 `antigravity`와 `antigravity-cli` 중 어디에 만들지 사용자에게 선택하게 한다.
- `--target` 또는 `-tg`이 지정되면 해당 후보만 대상으로 한다.

## 생성할 JSON 구조

`mcp_config.json`에는 아래 엔트리를 추가 또는 갱신한다.

```json
{
  "mcpServers": {
    "convention-cli-mcp": {
      "command": "node",
      "args": [
        "C:\\Users\\USER\\Desktop\\develop\\convention-cli\\bin\\convention.js",
        "-am"
      ],
      "cwd": "C:\\Users\\USER\\Desktop\\develop\\convention-cli",
      "env": {
        "CONVENTION_EXPERIMENTAL_ANTIGRAVITY": "true"
      }
    }
  }
}
```

실제 구현에서는 예시 경로를 그대로 쓰면 안 된다. 다음 값을 동적으로 계산한다.

- `command`: `process.execPath`를 우선 사용한다. 전역 `node` PATH 문제를 피하기 위함이다.
- `args[0]`: 현재 패키지의 `bin/convention.js` 절대 경로를 사용한다.
- `args[1]`: `-am`
- `cwd`: 설치 명령을 실행한 현재 Git 저장소 루트 또는 현재 작업 디렉터리
- `env.CONVENTION_EXPERIMENTAL_ANTIGRAVITY`: `"true"`

전역 npm 설치 환경에서는 `bin/convention.js`의 실제 절대 경로가 패키지 설치 경로를 가리킬 수 있다. 이 값은 `import.meta.url` 기반으로 계산하는 편이 안전하다.

## CRUD 동작 원칙

### Create

- 대상 `mcp_config.json`이 없으면 새로 만든다.
- 부모 디렉터리가 없으면 사용자 confirm 이후 생성한다.
- 파일은 BOM 없는 UTF-8로 저장한다.
- JSON 최상위에는 `mcpServers` 객체를 둔다.

### Read

- 기존 파일이 있으면 JSON으로 파싱한다.
- 깨진 JSON이면 자동 수정하지 않고 중단한다.
- 오류 메시지에는 파일 경로와 복구 안내만 출력하고, 파일 전체 내용을 출력하지 않는다.

### Update

- 기존 `mcpServers`와 다른 서버 설정은 보존한다.
- `mcpServers["convention-cli-mcp"]`만 생성 또는 갱신한다.
- 기존 같은 이름의 서버가 있으면 덮어쓰기 전 차이를 요약하고 confirm을 받는다.
- 알 수 없는 최상위 키는 보존한다.

### Delete

`convention --uninstall-agy-mcp` 또는 `-uam`를 구현한다면:

- `mcpServers["convention-cli-mcp"]`만 제거한다.
- 다른 MCP 서버 설정은 건드리지 않는다.
- 제거 후 `mcpServers`가 비어도 파일 전체 삭제는 하지 않는다.
- 삭제 전 confirm을 받는다.

## 보안 및 안전 규칙

이 기능은 사용자 홈 아래 설정 파일을 쓰므로 commit flow보다 더 보수적으로 다뤄야 한다.

- 홈 전체를 스캔하지 않는다. 정해진 후보 경로만 확인한다.
- `.env`, credentials, private key 파일을 읽지 않는다.
- 기존 `mcp_config.json` 전체 내용을 콘솔에 출력하지 않는다.
- JSON 파싱 실패 시 원문을 출력하지 않는다.
- 파일 쓰기 전 대상 경로와 변경 종류를 표시하고 confirm을 받는다.
- `--yes`를 지원하더라도 CI가 아닌 일반 환경에서는 기본 confirm을 유지한다.
- `command`, `args`, `cwd`는 shell 문자열이 아니라 JSON 배열/문자열로만 저장한다.
- Git 명령이 필요하면 `execFileSync` 또는 `spawnSync`의 argv 배열만 사용한다.
- 실패 시 Antigravity 토큰, 원격 URL, 환경 변수 전체를 출력하지 않는다.

## 구현 위치

권장 파일:

```text
src/commands/agyMcpInstall.js
src/core/agyMcpConfig.js
tests/agy-mcp-install.test.js
```

권장 함수:

```js
// src/core/agyMcpConfig.js
export function getAntigravityMcpConfigCandidates(homeDir = os.homedir())
export function detectExistingTargets(candidates)
export function buildConventionMcpServerConfig({ nodePath, cliPath, cwd })
export function mergeMcpServerConfig(existingConfig, serverConfig)
export function removeMcpServerConfig(existingConfig)
export function readMcpConfig(filePath)
export function writeMcpConfig(filePath, config)
```

```js
// src/commands/agyMcpInstall.js
export async function runAgyMcpInstall(options = {})
export async function runAgyMcpUninstall(options = {})
```

`src/commands/mcp.js`는 JSON-RPC 서버 책임만 유지한다. 설치 파일 CRUD 로직을 넣지 않는다.

## CLI 충돌 규칙

`--install-agy-mcp`(또는 `-iam`)와 `--uninstall-agy-mcp`(또는 `-uam`)는 설정 명령으로 취급한다.

- commit flow를 실행하지 않는다.
- `--step`, `--batch`, `--group`, `--push`, `--reset`, `--pr`, `--model`, `--template`, `--language`, `--set-mode`와 함께 사용할 수 없다.
- `--preview`(또는 `-pv`), `--target`(또는 `-tg`), `--yes`, `--no-interactive` 정도만 허용한다.
- `--preview`는 실제 파일을 쓰지 않고 생성 또는 갱신될 MCP 설정 요약만 출력한다.
- `-am/--agy-mcp`와도 함께 사용할 수 없다.

## 테스트 계획

필수 단위 테스트:

- 대상 후보 경로가 OS 독립적으로 생성되는지
- 기존 파일이 없을 때 새 `mcp_config.json`을 만드는지
- 기존 `mcpServers`의 다른 서버 엔트리를 보존하는지
- 기존 `convention-cli-mcp`만 갱신하는지
- 깨진 JSON이면 쓰기를 중단하는지
- uninstall이 `convention-cli-mcp`만 제거하는지
- 파일 출력에 secret 또는 전체 config 원문이 포함되지 않는지
- `-am` 서버 모드 stdout이 여전히 JSON-RPC만 출력하는지

통합 확인 후보:

```bash
node bin/convention.js --install-agy-mcp --preview
node bin/convention.js -iam -pv

node bin/convention.js --install-agy-mcp
node bin/convention.js -iam

node bin/convention.js --uninstall-agy-mcp
node bin/convention.js -uam

node bin/convention.js -am
```

실제 사용자 홈 설정을 건드리는 테스트는 금지한다. 테스트에서는 임시 디렉터리를 home으로 주입하거나, 파일 시스템 함수를 mock한다.

## 구현 가능성 평가

구현 가능성은 충분하다. 단, `proposal2.md`의 “`-am` 최초 실행 시 자동 생성”과 “도구 스키마 JSON 3개 생성”은 현재 구조와 맞지 않는다.

가장 안전한 구현은 다음 순서다.

1. `-am/--agy-mcp`는 현재처럼 MCP 서버 전용으로 유지한다.
2. 별도 설치 명령 `--install-agy-mcp` 또는 `-iam`를 추가한다.
3. 설치 명령은 `mcp_config.json`만 생성/병합한다.
4. 기존 Antigravity 설정과 다른 MCP 서버 설정은 보존한다.
5. 파일 쓰기 전 confirm과 `--preview`(또는 `-pv`)를 제공한다.

이 방향이면 다른 commit, reset, PR, provider 동작에 영향을 거의 주지 않고, 보안상으로도 예측 가능한 범위 안에서 구현할 수 있다.
