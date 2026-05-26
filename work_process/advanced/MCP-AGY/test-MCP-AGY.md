# MCP 기반 Antigravity 연동 Test Plan (`antigravity-mcp`)

## 테스트 목표

`convention-cli`를 로컬 MCP(Model Context Protocol) 서버로 구동하는 `--mcp` 모드의 동작을 검증한다. 본 테스트 플랜은 구글 `antigravity` 에이전트 인프라가 "호스트(클라이언트)"로 동작하고, 우리 CLI 도구가 "로컬 MCP 서버"로서 안전하게 Git 메타데이터와 커밋 제어 권한을 제공하는 **"인증 주체의 반전"** 아키텍처를 안전하고 신뢰성 있게 수립하기 위함이다.

외부 구글 OAuth API를 무단으로 우회 호출하거나, 사용자의 구글 계정 세션을 유출하는 보안 결함이 발생하지 않도록 철저히 차단하며 아래의 핵심 항목들을 집중 검증한다.

### 핵심 검증 항목
- CLI 진입점에서 `--mcp` 옵션을 파싱하고 JSON-RPC stdio transport 서버로 정상 라우팅되는지 확인한다.
- `get_masked_git_diff` 도구가 민감 정보를 완벽히 필터링하고 `[REDACTED]` 마스킹 처리하여 호스트로 전달하는지 검증한다.
- `build_commit_prompt` 도구가 `.convention/template.json` 컨벤션 가이드라인과 다국어 설정을 올바르게 빌드하는지 확인한다.
- `execute_git_commit` 도구가 수신된 메시지로 로컬 스테이징 및 커밋을 실행하되, `confirmBeforeCommit` 로컬 확인 단계를 필수적으로 거치도록 보장한다.
- JSON-RPC stdio 파이프가 끊기거나 비정상 스트림이 유입될 때 덤프 없이 클린업(Cleanup) 및 프로세스 종료가 수행되는지 검증한다.

---

## 단위 테스트 (Unit Tests)

### 1. CLI 라우팅 및 인수 파싱 테스트
**대상 파일**: `tests/mcp-routing.test.js`

- **테스트 케이스**:
  - `node bin/convention.js --mcp` 기동 시, 기존의 대화형 commit flow로 빠지지 않고 즉시 MCP 서버 리스너 모듈(`src/commands/mcp.js` 또는 `src/core/mcpServer.js`)로 진입하는가?
  - `CONVENTION_EXPERIMENTAL_ANTIGRAVITY=true` 환경 변수가 누락되었을 때, 비공식 실험적 기능으로서 적절한 경고 알림 또는 보안 차단이 발동하는가?
- **예상 결과**:
  - 옵션 `--mcp`가 주어지면 `stdin/stdout` 파이프 리스닝 상태가 활성화된다.
  - 지원하지 않는 인자가 함께 조합되었을 경우 표준 에러와 함께 `Exit 1` 처리가 명확히 이루어진다.

### 2. `get_masked_git_diff` 도구 검증
**대상 파일**: `tests/mcp-tool-diff.test.js`

- **테스트 케이스**:
  - 제외 대상 파일 후보(`.env`, `*.pem`, `credentials.json`, `secrets.json`)가 포함된 Git diff를 임시 저장소(Fixtures)에서 생성했을 때, 해당 파일의 변경 내용이 추출 범위에서 사전에 완벽히 제외되는가?
  - diff 본문 내에 민감한 형태의 데이터(`API_KEY=12345`, `SECRET=abcde`, `TOKEN=xyz`, `-----BEGIN PRIVATE KEY-----`)가 존재할 경우, 해당 키 밸류 라인 전체 혹은 우측 값이 `[REDACTED]`로 성공적으로 변환되는가?
- **예상 결과**:
  - 외부 Antigravity로 원문 Secret 정보가 절대 평문 상태로 전달되지 않는다.
  - 마스킹이 정상 수행되었다는 사실이 로컬 경고 로깅(`logger.warn()`)에만 기록되고, MCP JSON-RPC 응답 데이터 페이로드에는 마스킹된 안전한 텍스트만 포함된다.

### 3. `build_commit_prompt` 도구 검증
**대상 파일**: `tests/mcp-tool-prompt.test.js`

- **테스트 케이스**:
  - 현재 설정된 `--language`(ko, en, jp, cn) 메타데이터가 프롬프트 생성 지시서에 포함되는지 확인한다.
  - 프로젝트 루트의 커스텀 템플릿(`.convention/template.json`)이 존재할 때, 이를 올바르게 파싱하여 Conventional Commits 가이드라인 지시문에 주입하는지 검증한다.
- **예상 결과**:
  - 반환된 프롬프트 문자열은 `git commit -m`을 위해 완벽하게 최적화된 시스템 지시어 세트여야 하며, Antigravity가 복잡한 분석 없이 즉각 준수 가능한 형태를 지닌다.

### 4. `execute_git_commit` 도구 및 안전장치 검증
**대상 파일**: `tests/mcp-tool-commit.test.js`

- **테스트 케이스**:
  - Antigravity가 JSON-RPC `tools/call` 요청을 통해 `execute_git_commit` 도구를 호출할 때, `message` 매개변수가 빈 문자열이거나 유효하지 않은 형태(예: 셸 인젝션 공격 유형)일 때 안전하게 거부하는가?
  - `confirmBeforeCommit` 설정값이 `true`로 설정되어 있을 때, 로컬 콘솔 상에서 사용자의 `Y/N` 최종 수동 컨펌을 대기하도록 강제하는가? (자율 폭주 방지)
  - 사용자가 확인을 거부(`No`)했을 때, 실제 `git commit` 프로세스가 물리적으로 차단되고 MCP 응답에 `Commit cancelled by user` 메시지가 정상 회신되는가?
- **예상 결과**:
  - 셸 인젝션성 특수문자 조합이 들어와도 `execFileSync` 또는 `spawnSync`에 안전한 인자 배열 형태로 매핑되므로 실행 레벨의 취약점이 원천 차단된다.
  - 사용자의 로컬 Confirm이 생략된 강제 커밋은 발생하지 않는다.

---

## JSON-RPC 프로토콜 및 stdio Transport 통합 테스트

**대상 파일**: `tests/mcp-server-protocol.test.js`

실제 Antigravity 에이전트를 모방한 가상의 **Mock MCP 호스트 프로세스**를 구성하여 `stdin`으로 JSON-RPC 규격의 패킷을 흘려보내고, `stdout`으로 회신되는 응답의 규격을 전수 분석한다.

```mermaid
sequenceDiagram
    participant MockHost as 가상 MCP 호스트 (Antigravity 모방)
    participant MCPServer as convention-cli (--mcp)
    
    MockHost->>MCPServer: initialize 요청 (JSON-RPC)
    MCPServer-->>MockHost: initialize 응답 (capabilities 반환)
    Note over MockHost, MCPServer: initialized Notification 통신 완료
    
    MockHost->>MCPServer: tools/list 요청
    MCPServer-->>MockHost: 도구 목록 반환 (get_masked_git_diff, build_commit_prompt, execute_git_commit)
    
    MockHost->>MCPServer: tools/call (get_masked_git_diff)
    MCPServer-->>MockHost: 마스킹 완료된 안전한 Git Diff 결과 반환
```

### 프로토콜 테스트 항목
1. **`initialize` 흐름**:
   - `initialize` 요청 패킷이 유입되었을 때, MCP 프로토콜 스펙 표준(2025-06-18 버전 기준)을 충족하는 적절한 `capabilities` 및 `serverInfo` 데이터가 `stdout`으로 출력되는지 확인한다.
2. **`tools/list` 스키마 검증**:
   - 반환되는 각 도구의 `name`, `description`, `inputSchema`가 JSON Schema 규격에 정확하게 부합하는지 린트 검사 및 검증을 실시한다.
3. **stdio 비정상 예외 대응**:
   - 호스트 측 파이프가 예기치 않게 유실되어 `stdin` 스트림에 `end` 이벤트가 발생하거나 닫혔을 때, MCP 서버 자식 프로세스가 무한 루프나 유령 좀비 프로세스로 남지 않고 안전하게 `process.exit(0)`으로 파괴 및 자원 정리(Cleanup)가 수행되는지 검증한다.

---

## 실제 환경 수동 테스트 시나리오

실제 구글 Antigravity CLI 및 환경과의 완벽한 유기적 직결 상태는 네트워크 자원 및 로컬 로그인 상태가 관여하므로 격리된 수동 검증 환경(`fixtures/mcp-test-repo`)에서만 실행한다.

### Step 1. 로컬 환경 패키지 링크 및 설치 상태 확보
```powershell
# 개발 디렉토리 내부에서 글로벌 링크 처리
npm link
```

### Step 2. Antigravity MCP 연동 설정 등록
사용자 홈 디렉토리 하위의 Antigravity 에이전트 설정 정보 파일(`~/.config/antigravity/config.json`)을 다음과 같이 모방하여 연동 구성을 적용한다.

```json
{
  "mcpServers": {
    "convention-cli-mcp": {
      "command": "node",
      "args": [
        "C:/Users/USER/AppData/Roaming/npm/node_modules/convention-cli/bin/convention.js",
        "--mcp"
      ],
      "env": {
        "CONVENTION_EXPERIMENTAL_ANTIGRAVITY": "true"
      }
    }
  }
}
```

### Step 3. MCP Inspector를 활용한 도구 탐색 검증
공식 `@modelcontextprotocol/inspector` 도구를 활용하여, stdio 파이프가 규격대로 정합성을 유지하며 활성화되어 반응하는지 GUI를 통해 확인한다.
```powershell
npx @modelcontextprotocol/inspector node bin/convention.js --mcp
```
* **확인 사항**:
  - Inspector UI 화면 좌측 목록에 `get_masked_git_diff`, `build_commit_prompt`, `execute_git_commit` 3가지 기능이 또렷하게 등재되어 있는지 확인한다.
  - 각 도구를 호출(Call Tool)해 보았을 때 JSON 페이로드가 누수 없이 반환되는지 확인한다.

---

## 보안 완료 기준 (Security Gate)

본 테스트 플랜의 모든 구현 단계는 `init/00_rule.md`를 철저히 계승하며, 단 한 개라도 미달할 시 배포 및 머지를 불가능한 것으로 판정한다.

- [ ] **구글 OAuth Direct API 우회 부재**: 구글의 비공개 인증 엔드포인트를 노출하여 세션 정보를 갈취하는 우회 코드가 일절 존재하지 않는다.
- [ ] **전송 전 완벽 정화 기제**: Git diff 정보를 외부 호스트로 반환하기 이전에, 제외 대상 파일 및 패턴 기반 마스킹(`get_masked_git_diff` 필터링 레이어)이 로컬 샌드박스에서 선제 작동한다.
- [ ] **파괴적 행위 원천 불허**: Git을 파괴하는 명령(`git reset --hard` 등)이나 쉘 탈옥 명령어 실행을 대행해 주는 악성 도구(Tool) 프로토타입은 포함되지 않는다.
- [ ] **에러 원문 숨김 규칙**: JSON-RPC 통신 에러, Git 실행 에러 발생 시 credentials나 API Key 원문이 에러 스택/stderr 아웃풋에 절대로 묻어나오지 않으며 전부 `[REDACTED]` 처리한다.

---

## 완료 및 패스 기준

- `npm test`를 통한 모든 mcp 모의 테스트 스크립트 실행이 에러 없이 무결 통과해야 한다.
- `tests/mcp-tool-diff.test.js`, `tests/mcp-tool-commit.test.js` 테스트 커버리지가 핵심 분기 기준 90% 이상을 상회해야 한다.
- Mock MCP 호스트의 비정상적인 파이프 해제 스트림에 노출되었을 때 프로세스의 CPU 누수가 유발되지 않음이 완전 입증되어야 한다.
