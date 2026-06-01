`convention -am` 또는 `convention --agy-mcp` 최초 실행 시 이를 **자동으로 탐지하고 처리하는 방식**에 대해, 발생할 수 있는 현실적인 변수(리스크)와 이를 극복하는 가장 우아한 설계 방향을 정리해 드립니다.

---

### 1. 발생할 수 있는 주요 변수 및 리스크

자동으로 CRUD 작업을 진행할 때 아래와 같은 환경적 변수들이 발생할 수 있습니다.

#### ① OS 및 환경별 경로의 불일치

- **사용자마다 설치 환경이 다름:**
  - Windows: `C:\Users\<USER>\.gemini\antigravity-ide\...`
  - macOS / Linux: `~/.gemini/antigravity-ide/...`
- **해결법:** `os.homedir()`와 `path.join()`을 사용하여 절대 경로를 동적으로 구성해야 합니다.

#### ② 권한 문제 (Permission Denied)

- **보안 및 권한 제한:** OS 설정, 터미널 실행 권한, 혹은 안티바이러스/샌드박스 정책에 따라 CLI 프로세스가 외부 IDE 설정 디렉토리에 접근하여 폴더를 만들거나 파일을 쓸 때 **Permission Denied** 에러가 발생할 수 있습니다.
- **해결법:** 파일 생성(`fs.mkdirSync`, `fs.writeFileSync`) 작업을 수행할 때 반드시 `try-catch` 블록으로 예외 처리를 감싸고, 실패 시 프로그램이 크래시되지 않도록 방어적인 코드를 작성해야 합니다.

#### ③ 실행 경로(node / convention)의 동적 매핑 문제

- MCP 서버를 구동하려면 Antigravity가 이 CLI를 실행할 수 있는 명령어 정보(또는 절대 경로)를 가지고 있어야 합니다.
- 사용자가 `nvm`을 사용하여 Node.js 버전을 자주 바꾸거나, `npm`, `yarn`, `pnpm` 중 무엇으로 글로벌 설치했는지에 따라 `convention` CLI의 실제 실행 파일 위치가 제각각 달라집니다.
- **해결법:** 단순 스키마 JSON 파일 외에 Antigravity 측 설정(예: `config.json` 등)까지 건드려야 할 경우, CLI의 실제 물리적 실행 경로를 정확히 파악하여 매핑해 주는 복잡성이 추가될 수 있습니다. (스키마 파일만 넣는 구조라면 이 리스크는 다소 줄어듭니다.)

---

### 2. 추천하는 우아한 연동 방식 (대화형 가이드 + 자동 생성)

단순히 사용자의 알림 없이 무단으로 파일을 쓰고 생성하는 것보다, **사용자의 동의를 얻는 대화형(Interactive) 구조**로 구현하는 것을 추천합니다. 이렇게 하면 보안 가이드라인(00_rule.md)에도 부합하며 대단히 세련된 UX를 제공할 수 있습니다.

#### 💡 시나리오 흐름

1. **최초 실행 감지:** `convention -am` 실행 시, target 설정 폴더(`C:\Users\USER\.gemini\antigravity-ide\mcp\convention-cli-mcp`) 내에 필수 도구 스키마 파일들이 존재하는지 체크합니다.
2. **사용자 확인(Confirm):** 파일이 없거나 버전이 다른 경우, 터미널에 안내 메시지를 띄웁니다.
   > _"Antigravity MCP 서버 연동에 필요한 스키마 파일들이 감지되지 않았습니다. 자동으로 해당 경로에 설정을 추가할까요? (Y/n)"_
3. **자동 생성 집행:**
   - `Y` 선택 시: `os.homedir()` 기준으로 `.gemini/antigravity-ide/mcp/convention-cli-mcp/` 폴더를 생성하고 아래의 3개 JSON 파일을 자동으로 생성합니다.
     - `get_masked_git_diff.json`
     - `build_commit_prompt.json`
     - `execute_git_commit.json`
4. **Graceful Fallback (안전장치):**
   - 만약 에러가 발생하여 폴더 생성에 실패하면, 단순히 실패했다는 메시지만 띄우지 않고 **사용자가 직접 복사해서 넣을 수 있는 친절한 마크다운 가이드와 파일 내용**을 터미널 콘솔에 깔끔하게 출력해 줍니다.
   - _"권한 문제로 자동 설정에 실패했습니다. 아래 스크립트를 사용해 해당 디렉터리에 수동으로 생성해 주세요."_

---

### 3. 스키마 파일 구성 Blueprint

`src/commands/mcp.js` 혹은 별도의 `src/config/mcp-setup.js` 모듈을 만들어 스키마 데이터 구조를 내장해 두면 좋습니다.

```javascript
// 예시: 내장할 스키마 템플릿
const MCP_SCHEMAS = {
  "get_masked_git_diff.json": {
    name: "get_masked_git_diff",
    description:
      "로컬 Git 저장소의 변경 diff를 안전하게 정화하여 추출합니다. 비밀키/패스워드 등 민감 정보가 사전에 마스킹 처리되어 제공됩니다.",
    inputSchema: { type: "object", properties: {} },
  },
  "build_commit_prompt.json": {
    name: "build_commit_prompt",
    description: "Conventional Commits 가이드라인을 빌드합니다.",
    inputSchema: {
      type: "object",
      properties: {
        diff: { type: "string", description: "Git Diff 본문" },
      },
    },
  },
  "execute_git_commit.json": {
    name: "execute_git_commit",
    description:
      "AI가 최종 생성해 낸 커밋 메시지를 주입받아 실제 로컬 Git 저장소에 안전 커밋을 최종 집행합니다.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "커밋 메시지" },
        files: { type: "array", items: { type: "string" } },
      },
      required: ["message"],
    },
  },
};
```

### 요약 및 제안

이 기능은 **충분히 구현할 가치가 있고, 개발자 입장에서 환영할 멋진 기능**입니다.

- **구현 방향:** `convention -am` 실행 시 자동으로 경로 존재 여부를 체크하고, `os.homedir()`를 사용해 안전하게 `try-catch`로 3가지 스키마 JSON을 생성하는 로직을 추가하는 방식으로 진행하면 부작용 없이 깔끔하게 도입할 수 있습니다.

해당 기능의 구체적인 구현(코드 설계 및 자동 설치 프로세스 추가)을 진행하고 싶으시다면 말씀해 주세요! 즉시 상세 계획을 세우고 반영하도록 하겠습니다.
