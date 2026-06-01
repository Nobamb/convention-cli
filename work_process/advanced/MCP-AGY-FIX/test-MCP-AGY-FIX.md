# MCP-AGY-FIX Test Plan

## 테스트 목적

Antigravity MCP 설정 자동화가 사용자 환경과 기존 CLI 동작을 해치지 않는지 검증한다.

검증 핵심:

- `-am/--agy-mcp` 서버 모드는 계속 JSON-RPC 전용 stdout을 유지한다.
- `--install-agy-mcp/-iam`은 `mcp_config.json`만 생성 또는 병합한다.
- `--uninstall-agy-mcp/-uam`은 `convention-cli-mcp` 엔트리만 제거한다.
- `--target/-tg`는 명시한 후보만 대상으로 한다.
- `--preview/-pv`는 어떤 경우에도 파일을 쓰지 않는다.
- 기존 다른 MCP 서버 설정과 사용자 설정을 보존한다.
- secret, token, 기존 config 원문을 출력하지 않는다.

실제 사용자 홈 설정 파일을 테스트에서 직접 건드리지 않는다. 모든 파일 시스템 테스트는 임시 디렉터리 또는 mock fs를 사용한다.

## 단위 테스트 대상

권장 테스트 파일:

```text
tests/agy-mcp-install.test.js
```

권장 대상 모듈:

```text
src/core/agyMcpConfig.js
src/commands/agyMcpInstall.js
bin/convention.js
src/commands/mcp.js
```

## 1. 대상 경로 후보 생성

### 1-1. OS 독립 후보 경로 생성

입력:

```js
homeDir = "/home/tester"
```

기대:

```text
/home/tester/.gemini/antigravity/mcp_config.json
/home/tester/.gemini/antigravity-cli/mcp_config.json
/home/tester/.gemini/antigravity-ide/mcp_config.json
/home/tester/.gemini/config/mcp_config.json
```

검증:

- 문자열 직접 연결 대신 `path.join()` 결과와 일치한다.
- 후보는 정해진 4개만 반환한다.
- 홈 하위 전체 스캔을 수행하지 않는다.

### 1-2. target 매핑

입력과 기대:

```text
editor -> .gemini/antigravity/mcp_config.json
cli    -> .gemini/antigravity-cli/mcp_config.json
ide    -> .gemini/antigravity-ide/mcp_config.json
gemini -> .gemini/config/mcp_config.json
```

검증:

- `--target editor`, `-tg editor`가 같은 대상으로 해석된다.
- 알 수 없는 값은 오류로 중단한다.
- fallback으로 다른 target을 선택하지 않는다.

### 1-3. target 단독 사용 금지

명령:

```bash
node bin/convention.js --target cli
node bin/convention.js -tg cli
```

기대:

- commit flow를 실행하지 않는다.
- 설정 파일을 쓰지 않는다.
- `--target`은 설치/제거 명령과 함께 사용해야 한다는 오류를 출력한다.

## 2. MCP 서버 설정 생성

### 2-1. 서버 설정 shape

입력:

```js
{
  nodePath: "C:\\Program Files\\nodejs\\node.exe",
  cliPath: "C:\\repo\\bin\\convention.js",
  cwd: "C:\\repo"
}
```

기대:

```json
{
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": ["C:\\repo\\bin\\convention.js", "-am"],
  "cwd": "C:\\repo",
  "env": {
    "CONVENTION_EXPERIMENTAL_ANTIGRAVITY": "true"
  }
}
```

검증:

- `args`는 배열이다.
- `command`에 shell fragment가 들어가지 않는다.
- `env`에는 필요한 키만 포함한다.
- secret 또는 사용자 환경 변수 전체를 복사하지 않는다.

### 2-2. process.execPath 우선 사용

검증:

- 설치 명령이 생성하는 `command`는 기본적으로 `process.execPath`를 사용한다.
- `node` 문자열 PATH 의존을 기본값으로 삼지 않는다.

### 2-3. CLI 절대 경로 계산

검증:

- `bin/convention.js` 절대 경로를 사용한다.
- 현재 작업 디렉터리에 의존해 상대 경로를 저장하지 않는다.

## 3. Create 동작

### 3-1. 파일이 없으면 새 config 생성

준비:

- 임시 home에 `.gemini/antigravity-cli/` 디렉터리만 만든다.
- `mcp_config.json`은 없다.

명령:

```bash
node bin/convention.js -iam -tg cli --yes
```

기대:

- `.gemini/antigravity-cli/mcp_config.json` 생성
- BOM 없는 UTF-8 JSON
- 최상위 `mcpServers` 존재
- `mcpServers["convention-cli-mcp"]` 존재

### 3-2. 부모 디렉터리가 없으면 confirm 필요

준비:

- 임시 home에 `.gemini/antigravity/`가 없다.

명령:

```bash
node bin/convention.js -iam -tg editor --no-interactive
```

기대:

- `--yes`가 없으면 생성하지 않고 중단한다.
- 파일 시스템을 변경하지 않는다.

명령:

```bash
node bin/convention.js -iam -tg editor --yes --no-interactive
```

기대:

- 명시 승인 상태이므로 대상 디렉터리와 파일 생성
- 생성 경로는 target 후보 안에만 있어야 한다.

## 4. Read 동작

### 4-1. 깨진 JSON은 자동 수정하지 않음

준비:

```json
{ "mcpServers":
```

명령:

```bash
node bin/convention.js -iam -tg cli --yes
```

기대:

- 쓰기를 중단한다.
- 기존 파일 내용을 덮어쓰지 않는다.
- 오류 출력에 기존 파일 원문이 포함되지 않는다.

### 4-2. 기존 최상위 키 보존

준비:

```json
{
  "customKey": { "enabled": true },
  "mcpServers": {}
}
```

기대:

- 설치 후 `customKey`가 그대로 남는다.

## 5. Update 동작

### 5-1. 다른 MCP 서버 보존

준비:

```json
{
  "mcpServers": {
    "other-server": {
      "command": "other",
      "args": []
    }
  }
}
```

명령:

```bash
node bin/convention.js -iam -tg cli --yes
```

기대:

- `other-server`는 그대로 남는다.
- `convention-cli-mcp`만 추가된다.

### 5-2. 기존 convention-cli-mcp 갱신

준비:

```json
{
  "mcpServers": {
    "convention-cli-mcp": {
      "command": "node",
      "args": ["old.js", "-am"],
      "cwd": "old"
    }
  }
}
```

기대:

- 새 `command`, `args`, `cwd`, `env`로 갱신된다.
- 갱신 전 confirm이 필요하다.
- `--no-interactive`이고 `--yes`가 없으면 중단한다.

### 5-3. 이미 동일한 설정이면 noop

준비:

- 생성될 설정과 동일한 `convention-cli-mcp` 엔트리를 둔다.

기대:

- 파일을 다시 쓰지 않는다.
- 결과는 noop 또는 already configured로 보고한다.

## 6. Delete 동작

### 6-1. convention-cli-mcp만 제거

준비:

```json
{
  "mcpServers": {
    "convention-cli-mcp": {
      "command": "node",
      "args": ["convention.js", "-am"]
    },
    "other-server": {
      "command": "other"
    }
  }
}
```

명령:

```bash
node bin/convention.js -uam -tg cli --yes
```

기대:

- `convention-cli-mcp`만 제거한다.
- `other-server`는 보존한다.
- 파일 전체를 삭제하지 않는다.

### 6-2. 제거 대상이 없으면 noop

준비:

```json
{
  "mcpServers": {
    "other-server": {
      "command": "other"
    }
  }
}
```

기대:

- 오류가 아니라 noop으로 처리한다.
- 다른 설정을 변경하지 않는다.

## 7. Preview 동작

### 7-1. install preview는 파일을 쓰지 않음

명령:

```bash
node bin/convention.js -iam -tg cli -pv
```

기대:

- `mcp_config.json`을 생성하지 않는다.
- 부모 디렉터리도 만들지 않는다.
- 출력에는 대상 경로와 create/update/noop 요약만 포함한다.

### 7-2. uninstall preview는 파일을 쓰지 않음

명령:

```bash
node bin/convention.js -uam -tg cli -pv
```

기대:

- 기존 파일을 수정하지 않는다.
- 제거될 서버 이름만 요약한다.

### 7-3. preview와 yes 동시 사용

명령:

```bash
node bin/convention.js -iam -tg cli -pv --yes
```

기대:

- `--yes`가 있어도 파일을 쓰지 않는다.
- preview 우선순위가 더 높다.

### 7-4. preview 단독 사용 금지

명령:

```bash
node bin/convention.js --preview
node bin/convention.js -pv
```

기대:

- 설치/제거 명령과 함께 사용하라는 오류를 출력한다.
- commit flow를 실행하지 않는다.

## 8. CLI 충돌 테스트

### 8-1. 설치 명령과 commit flow 동시 사용 금지

금지 명령:

```bash
node bin/convention.js -iam --batch
node bin/convention.js -iam --step
node bin/convention.js -iam --group
node bin/convention.js -iam --push
```

기대:

- 상호 배타 옵션 오류
- commit flow 미실행
- 파일 미변경

### 8-2. 설치 명령과 설정 명령 동시 사용 금지

금지 명령:

```bash
node bin/convention.js -iam --model mock
node bin/convention.js -iam --language ko
node bin/convention.js -iam --set-mode batch
node bin/convention.js -iam --template show
```

기대:

- 상호 배타 옵션 오류
- config 저장 미실행
- MCP 파일 미변경

### 8-3. 설치 명령과 MCP 서버 모드 동시 사용 금지

금지 명령:

```bash
node bin/convention.js -iam -am
node bin/convention.js -uam --agy-mcp
```

기대:

- 상호 배타 옵션 오류
- MCP 서버를 시작하지 않는다.
- stdout에 JSON-RPC가 아닌 설치 안내가 섞이지 않는다.

### 8-4. install과 uninstall 동시 사용 금지

명령:

```bash
node bin/convention.js -iam -uam
```

기대:

- 상호 배타 옵션 오류
- 파일 미변경

## 9. MCP 서버 회귀 테스트

### 9-1. tools/list 유지

명령:

```bash
node bin/convention.js -am
```

JSON-RPC 요청:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

기대:

- tools 배열에 3개 도구가 유지된다.
- 설치 자동화 안내 문구가 stdout에 섞이지 않는다.

### 9-2. initialize 유지

기대:

- `protocolVersion`과 `serverInfo.name` 기존 값 유지
- `runMCPServer()` 시작 시 파일 생성 시도를 하지 않는다.

### 9-3. parse error 유지

기대:

- 잘못된 JSON 입력에 대해 JSON-RPC parse error만 반환한다.
- raw input을 출력하지 않는다.

## 10. 보안 출력 테스트

### 10-1. 기존 config 원문 미출력

준비:

```json
{
  "mcpServers": {
    "secret-server": {
      "command": "cmd",
      "env": {
        "TOKEN": "secret-token"
      }
    }
  }
}
```

명령:

```bash
node bin/convention.js -iam -tg cli -pv
```

기대:

- `secret-token`이 출력되지 않는다.
- `TOKEN` 값이 출력되지 않는다.
- 다른 서버 설정 전체가 출력되지 않는다.

### 10-2. JSON 파싱 실패 원문 미출력

준비:

```text
{ "token": "secret-token",
```

기대:

- 오류 출력에 `secret-token`이 포함되지 않는다.

### 10-3. 환경 변수 전체 복사 금지

검증:

- 생성된 `env`에는 `CONVENTION_EXPERIMENTAL_ANTIGRAVITY`만 포함한다.
- `process.env` 전체를 저장하지 않는다.

## 11. 실제 실행 확인 후보

실제 사용자 홈을 쓰지 않는 임시 home 또는 mock 환경에서만 실행한다.

```bash
node --test tests/agy-mcp-install.test.js
node --test tests/mcp-server.test.js
node bin/convention.js --help
node bin/convention.js -iam -tg cli -pv
node bin/convention.js -iam -tg cli --yes --no-interactive
node bin/convention.js -uam -tg cli -pv
node bin/convention.js -uam -tg cli --yes --no-interactive
```

## 완료 기준

- 모든 단위 테스트 통과
- 기존 `tests/mcp-server.test.js` 통과
- 기존 commit/reset/PR 관련 CLI 충돌 규칙이 깨지지 않음
- 실제 사용자 홈 파일을 테스트에서 변경하지 않음
- `-am` stdout에 JSON-RPC 외 텍스트가 섞이지 않음
- secret 또는 기존 config 원문이 출력되지 않음

