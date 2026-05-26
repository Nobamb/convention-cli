# MCP 기반 Antigravity 연동 Research (`antigravity-mcp`)

## 1. 개요 및 결론

**MCP(Model Context Protocol) 기반의 Antigravity 연동은 기술적으로 완벽히 실현 가능하며, 현재 처해 있는 보안 및 인증 한계를 돌파할 수 있는 궁극의 해법입니다.**

기존의 2차/3차 OAuth 흐름(`src/auth/oauthProviders.js` 등)에서 `antigravity`는 구글의 공식 OAuth API 및 인증 엔드포인트 정책이 대중적으로 오픈되어 있지 않아 `oauthAvailable: false` 상태로 차단되어 있었습니다.

하지만 연동의 관점을 뒤바꾸어, **Antigravity CLI(또는 에이전트 인프라)를 "MCP 호스트(클라이언트)"로 삼고, 우리 `convention-cli`를 "로컬 MCP 서버"로 빌드**하면 모든 보안 병목이 일시에 해결됩니다.

### 💡 아키텍처 패러다임 전환 (인증 주체의 반전)
- **과거 실패 모델 (순방향)**: `convention-cli`가 주체가 되어 구글 Antigravity API 권한을 획득하고자 세션 토큰을 무단 탈출하려 하거나 미공개 엔드포인트 우회 시도 $\rightarrow$ 보안 차단 및 구현 불가능.
- **MCP 연동 모델 (역방향)**: **Antigravity가 호스트**가 되고, `convention-cli`가 **안전한 로컬 Git 처리 전용 MCP 서버**로 작동.
  - 구글 세션 로그인과 AI 추론 비용은 공식 Antigravity CLI가 전적으로 부담합니다.
  - 우리 툴은 Antigravity 에이전트가 로컬 Git을 조회하거나 커밋할 때 호출하는 안전한 **도구(Tool)** 제공자 역할만 수행합니다.

---

## 2. 공식 문서 및 표준 명세 근거

1. **MCP 아키텍처 및 Transport 표준**:
   - MCP는 JSON-RPC 기반의 메시징 프로토콜을 사용하며, 클라이언트가 서버 하위 프로세스(Subprocess)를 구동하여 `stdin/stdout` 파이프(stdio transport)로 안전하게 요청을 주고받습니다.
   - [MCP Transports Spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
2. **Antigravity의 MCP 완벽 지원**:
   - Claude, Cursor와 함께 구글의 Antigravity 에이전트 환경은 플러그인 확장 규격으로 **MCP 사양을 표준 연동 수단**으로 공식 탑재하고 있습니다.
   - 따라서 `convention-cli`를 MCP 서버 규격에 맞춰 실행할 수 있는 진입점(`--mcp` 모드)만 제공하면 별도의 복잡한 어댑터 없이 직결할 수 있습니다.

---

## 3. `convention-cli` MCP 서버 구현 방향

`convention-cli`는 Antigravity 에이전트가 로컬 Git 저장소를 요약하고 Conventional Commits를 작성할 때 사용할 수 있는 **세 가지 안전한 핵심 도구(Tools)**를 노출합니다.

### 1) 노출 도구 계약 (Tool Contracts)

#### 🛠️ `get_masked_git_diff` (Git 변경 사항 분석용)
- **역할**: 로컬 Git 저장소의 변경 diff를 추출하여 반환하되, 전송 전 완벽한 보안 정화 필터를 적용합니다.
- **보안 Gate 강제**:
  - 기본 diff 제외 후보(`.env`, `*.pem`, `credentials.json` 등) 자동 누락.
  - diff 내부의 민감 정보 패턴(`API_KEY=`, `SECRET=`, `DATABASE_URL` 등) 탐지 시 즉각 `[REDACTED]` 마스킹 처리.
- **출력**: 마스킹 및 정화 처리가 완수된 안전한 Git Diff 텍스트.

#### 🛠️ `build_commit_prompt` (컨벤션 가이드 제공용)
- **역할**: 설정되어 있는 메시지 생성 언어(ko, en 등) 및 팀별 커밋 컨벤션 템플릿(`.convention/template.json`) 정보가 주입된 최적의 프롬프트를 구성해 Antigravity에게 전달합니다.
- **출력**: Conventional Commits 형식을 정확히 강제하기 위한 고품질 프롬프트 지시문.

#### 🛠️ `execute_git_commit` (안전한 커밋 집행용)
- **역할**: Antigravity가 본인의 AI 연산으로 정교하게 생성해 낸 최종 커밋 메시지를 매개변수로 전달받아, 실제 로컬 Git 저장소에 커밋을 최종 집행합니다.
- **인수**: `message` (생성된 커밋 메시지), `files` (커밋 대상 파일 목록)
- **confirmBeforeCommit 준수**: 이 도구를 수행할 때도 사용자의 최종 로컬 CLI 확인(Confirm) 단계를 유기적으로 결합하여 자동 폭주를 방지합니다.

---

## 4. MCP 서버 기동 및 연동 설정 (UX)

사용자는 본인의 Antigravity 설정 파일(예: `~/.config/antigravity/config.json` 또는 `mcpServers` 구성)에 `convention-cli`를 단 몇 줄의 로컬 서버 설정으로 탑재하여 가동합니다.

```json
{
  "mcpServers": {
    "convention-mcp-server": {
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

---

## 5. 보안 수칙 및 예외 방어 설계

MCP 서버로서의 `convention-cli`는 `init/00_rule.md` 규정을 빈틈없이 수호하기 위해 다음을 강제해야 합니다.

* **권한 범위 제한 (Read-Only 중심)**:
  - Antigravity 에이전트가 임의의 셸 명령어를 실행하거나 로컬 소스 코드를 변조하도록 허용하는 도구는 일절 노출하지 않습니다. 오직 Git diff 읽기(`get_masked_git_diff`)와 최종 커밋(`execute_git_commit`)만 허용 범위에 한정합니다.
* **비동기 런타임 오류 방어**:
  - JSON-RPC 파이프 연결이 끊어지거나 비정상적인 stdin 스트림 유입 시에도 CLI 프로세스가 덤프를 남기지 않고 즉시 리소스를 해제하며 안전하게 안전 종료(Clean Exit) 하도록 설계합니다.
* **Secret Redaction**:
  - JSON-RPC payload를 덤프하는 로그나 디버그 모드가 켜져 있어도, 사용자 PC의 Git diff secret 원본이나 OAuth 토큰은 콘솔 및 오류 객체에 노출되는 것을 완전히 거부합니다.

---

## 6. 기대 효과 및 시너지
- **인증 해방**: 더 이상 구글 OAuth 개발자용 App 연동 제한 때문에 머리를 싸매지 않아도 됩니다.
- **에이전트 시너지**: Antigravity의 극적인 연산력과 `convention-cli`의 견고한 Conventional Commits 도메인 지식이 융합되어, 완벽한 "AI 자율 커밋 팀 파트너" 워크플로우를 선사하게 됩니다.
