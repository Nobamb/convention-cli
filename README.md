<!-- 프로젝트 제목 및 간단한 설명: Convention CLI는 AI 기반의 Git 커밋 자동화 도구입니다. -->

# Convention CLI

**Convention CLI** is an AI-powered command-line tool designed to help automate the Git commit workflow. It analyzes changes in your Git repository using `git diff` and generates commit message candidates that follow the **Conventional Commits** standard.

<!-- 프로젝트 개요: 커밋 메시지 작성의 번거로움을 해결하기 위한 프로젝트 목적과 배경을 설명합니다. -->

## Project Overview

Writing meaningful and consistent commit messages can be tedious. Convention CLI solves this by hooking into your standard workflow, analyzing your file changes, and generating a standardized commit message. The 1st MVP uses a Mock AI Provider first, so the Git and commit flow can be verified without sending data to an external AI service.

<!-- 주요 기능: 지원하는 AI 모델, 커밋 모드(step/batch), 자동화 옵션, 다국어 지원 등 핵심 기능을 나열합니다. -->

## Key Features

- **Mock AI Provider First**: The 1st MVP uses a mock provider that returns a Conventional Commits-style message without external API calls.
- **Commit Modes**:
  - `--step`: Iterates through changed files one by one for granular, individual commits.
  - `--batch`: Analyzes all staged or unstaged changes at once to create a single, consolidated commit.
  - `--group`: Smartly groups changed files by their intent (e.g., feat, fix, docs) and area, then commits them per group.
- **Workflow Automation**:
  - `convention`: Runs the default commit flow.
  - `--set-mode`: Stores the default commit mode.
- **Custom Templates**: Manage custom commit message templates using `--template`.
- **Multilingual Support**: Generate commit messages in your preferred language using `--language`. Supported languages include Korean (`ko`, default), English (`en`), Japanese (`jp`), and Chinese (`cn`).
- **Cross-Platform**: Fully supported on Windows, macOS, and Linux.

<!-- 설치 방법: 프로젝트를 로컬 환경에 설치하고 설정하는 절차를 설명합니다. -->

## Installation

To install Convention CLI globally on your machine, clone the repository and use `npm link` or install it directly.

```bash
# Clone the repository
git clone https://github.com/Nobamb/convention-cli.git
cd convention-cli

# Install dependencies
npm install

# Link the package globally
npm link
```

_(Note: Once published to npm, you will be able to install it using `npm install -g convention-cli`)_

<!-- 사용법: CLI 명령어의 기본 사용법과 주요 옵션들을 예제와 함께 안내합니다. -->

## Usage

Once installed, you can use the `convention` command from within any Git repository.

<!-- 기본 명령어: 도움말 확인, 기본 커밋 실행, 배치/단계별 커밋 등 자주 사용하는 명령어를 보여줍니다. -->

### Basic Commands

```bash
# Display help and available commands
convention --help

# Run the default commit flow (analyzes changes and prompts for commit)
convention

# Commit all changes as a single batch
convention --batch

# Commit changes file-by-file
convention --step

# Group changed files by intent and commit per group
convention --group
```

<!-- 설정 관리: 커밋 모드나 출력 언어 등 사용자 환경설정 방법을 설명합니다. -->

### Configuration

You can easily set your preferences so you don't have to provide flags every time.

```bash
# Set the default commit mode to 'batch' or 'step'
convention --set-mode batch

# Set the default language for commit messages (e.g., English)
convention --language en

# Choose whether Convention CLI asks before committing generated messages
convention --question
# Short alias
convention -q

# Configure an AI provider/model (Short alias: -m)
convention -m
convention --model
convention -m gemini api
convention -m github-copilot oauth
convention --model openaiCompatible api "gpt-compatible"
convention -m localLLM none "qwen2.5:7b"

# Manage custom commit templates (action: init, show, validate)
convention --template
convention --template init
```

### API Key and 429 Recovery

API keys are stored in `~/.config/convention/credentials.json`, not in `config.json`. If `--model` is run for an API-key provider that already has a stored key, Convention CLI asks whether to replace it before continuing.

During `convention`, `--step`, or `--batch`, a Gemini/OpenAI-compatible HTTP 429 or usage-exhausted response opens a terminal choice: enter another API key and retry, switch provider/model through the existing model setup flow and retry, or stop without staging or committing.

### GitHub Copilot Integration (Experimental)

To use GitHub Copilot as the AI provider:

1. Create a GitHub OAuth App in **Settings > Developer settings > OAuth Apps > Register a new application**.
   - **Homepage URL**: `http://localhost`
   - **Authorization callback URL**: `http://localhost/oauth/callback`
2. Export your client details as environment variables in your terminal:
   ```bash
   export CONVENTION_GITHUB_CLIENT_ID="your_client_id"
   export CONVENTION_GITHUB_CLIENT_SECRET="your_client_secret"
   ```
3. Enable the experimental opt-in either by setting `CONVENTION_EXPERIMENTAL_GITHUB_COPILOT=true` as an environment variable or by adding `"experimentalGitHubCopilot": true` in `~/.config/convention/config.json`.
4. Configure the model:
   ```bash
   convention -m github-copilot oauth
   ```
   This will automatically trigger a browser-based OAuth flow using PKCE, storing the token safely under `credentials.json` namespace.

### Antigravity MCP Integration (Experimental)

**Convention CLI** can be run as a local MCP (Model Context Protocol) Stdio server. This enables Gemini, Grok, or Google's **Antigravity** agent host to communicate with your local repository using standard JSON-RPC protocol over Stdio without exposing sensitive credentials, creating an **"Inversion of Authentication"** architecture.

1. **Find your local paths**:
   - Project path: the absolute path to this repository, for example `C:\Users\USER\Desktop\develop\convention-cli`.
   - Node path: use an absolute `node.exe` path on Windows, for example `C:\Program Files\nodejs\node.exe`. GUI apps do not always inherit the terminal `PATH`.

2. **Create the Antigravity MCP config file**:
   Antigravity reads MCP settings from `mcp_config.json`, not from arbitrary `mcp.json` or `config.json` files. Use the profile that matches your host:
   - Antigravity Editor: `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
   - Antigravity CLI: `%USERPROFILE%\.gemini\antigravity-cli\mcp_config.json`
   - Antigravity IDE profile, if present: `%USERPROFILE%\.gemini\antigravity-ide\mcp_config.json`
   - Shared Gemini config, if your installed version reads it: `%USERPROFILE%\.gemini\config\mcp_config.json`

   ```json
   {
     "mcpServers": {
       "convention-cli-mcp": {
         "command": "C:\\Program Files\\nodejs\\node.exe",
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

   Replace the example paths with your own absolute paths. `cwd` is important because the MCP server runs Git commands against the current working directory.

3. **Save JSON as UTF-8 without BOM on Windows**:
   Some Antigravity builds reject a UTF-8 BOM with errors such as `invalid character 'ï' looking for beginning of value`. In VS Code, use **Save with Encoding > UTF-8**. In PowerShell, prefer a no-BOM writer when generating the file.

4. **Restart Antigravity**:
   Close and reopen Antigravity Editor/IDE or restart the Antigravity CLI session so it reloads `mcp_config.json`.

5. **Verify the tool is available**:
   Ask Antigravity to list or use the `convention-cli-mcp` MCP server. It should expose these tools:
   - `get_masked_git_diff`: Extract current git diff while purifying it. Sensitive files (like `.env`, `credentials.json`) are automatically excluded, and secret patterns (like `API_KEY`, `PASSWORD`) are replaced with `[REDACTED]`.
   - `build_commit_prompt`: Builds a system prompt instructing the agent to generate Conventional Commits messages based on your local preference (e.g. configured language and template rules).
   - `execute_git_commit`: Receives a commit message from the host agent and executes `git commit` via argument arrays. If `confirmBeforeCommit` is enabled, the server hijacks the physical console TTY (`CON` on Windows, `/dev/tty` on UNIX) to safely wait for your manual `Y/N` confirmation without corrupting the Stdio communication pipe.

6. **Use it from Antigravity**:
   In Antigravity, ask the agent to create a commit through the `convention-cli-mcp` tools. The intended flow is:
   - call `get_masked_git_diff`
   - call `build_commit_prompt` with that diff
   - generate a Conventional Commits message
   - call `execute_git_commit` with the final message

   You normally do not run `convention -am` manually while Antigravity is connected. Antigravity starts that stdio server from `mcp_config.json`.

7. **Troubleshooting**:
   - If Antigravity says the MCP server is not connected, check the file name is exactly `mcp_config.json` and the root key is `mcpServers`.
   - If the server starts outside the repository, add or fix `cwd`.
   - If `node` is not found, use the absolute `node.exe` path in `command`.
   - If JSON parsing fails, remove UTF-8 BOM and ensure the file is not empty.
   - If commit execution fails after the tools appear, run `git status` in the repository and make sure there are committable changes that are not excluded as sensitive files.

---

# Convention CLI 한국어 설명

## 프로젝트 개요

Convention CLI는 Git 변경 사항을 분석해 Conventional Commits 형식의 커밋 메시지 후보를 생성하는 Node.js 기반 CLI 도구입니다. 1차 MVP에서는 실제 외부 AI API보다 Mock AI Provider를 먼저 사용해, API Key 없이 Git diff 분석과 커밋 흐름을 검증하는 것을 목표로 합니다.

## 주요 기능

- **기본 실행**: `convention` 명령으로 설정된 기본 모드에 따라 커밋 흐름을 실행합니다.
- **Step 모드**: `convention --step` 명령으로 변경 파일을 파일별로 처리합니다.
- **Batch 모드**: `convention --batch` 명령으로 전체 변경 사항을 하나의 커밋 흐름으로 처리합니다.
- **Group 모드**: `convention --group` 명령으로 변경된 파일을 의도(feat, fix 등)와 영역에 따라 지능적으로 그룹화하여 커밋을 진행합니다.
- **설정 저장**: `convention --set-mode step|batch`로 기본 실행 모드를 저장합니다.
- **언어 설정**: `convention --language ko|en|jp|cn`으로 커밋 메시지 생성 언어를 설정합니다.
- **커스텀 템플릿**: `convention --template` 명령으로 커스텀 커밋 메시지 템플릿을 관리합니다.
- **도움말**: `convention --help` 또는 `convention -h`로 사용 가능한 옵션을 확인합니다.

## 설치

```bash
git clone https://github.com/Nobamb/convention-cli.git
cd convention-cli
npm install
npm link
```

## 사용법

```bash
# 도움말 확인
convention --help

# 기본 커밋 흐름 실행
convention

# 전체 변경 사항을 하나의 커밋 흐름으로 처리
convention --batch

# 변경 파일을 파일별 커밋 흐름으로 처리
convention --step

# 변경된 파일을 의도와 영역에 따라 지능적으로 그룹화하여 커밋
convention --group
```

## 설정

```bash
# 기본 모드를 batch로 설정
convention --set-mode batch

# 커밋 메시지 언어를 한국어로 설정
convention --language ko

# 커밋 메시지 생성 후 커밋 여부를 물어볼지 설정
convention --question

# 짧은 옵션
convention -q

# AI Provider 및 모델 설정 (단축 별칭: -m)
convention -m
convention --model
convention -m gemini api
convention -m github-copilot oauth
convention --model openaiCompatible api "gpt-compatible"
convention -m localLLM none "qwen2.5:7b"
```

### API Key 및 429 에러 복구

API Key는 `config.json`이 아닌 `~/.config/convention/credentials.json`에 별도로 저장됩니다. 이미 API Key가 저장된 Provider에 대해 `--model` 설정을 다시 실행하면, 기존 키를 교체할지 먼저 확인합니다.

`convention`, `--step`, 또는 `--batch` 실행 중 Gemini나 OpenAI 호환 API에서 HTTP 429(Rate Limit) 또는 할당량 초과 응답이 발생하면 터미널에서 다음 중 하나를 선택할 수 있습니다: 다른 API Key를 입력하고 재시도, 기존 모델 설정 흐름을 통해 Provider/모델을 변경하고 재시도, 혹은 Staging이나 커밋 없이 안전하게 중단.

### GitHub Copilot 연동 가이드 (실험적 기능)

GitHub Copilot을 AI 프로바이더로 사용하기 위한 절차는 다음과 같습니다.

1. **GitHub OAuth App 생성**:
   - GitHub의 **[Settings > Developer settings > OAuth Apps > Register a new application](https://github.com/settings/developers)**으로 이동합니다.
   - 다음과 같이 설정하여 등록합니다:
     - **Homepage URL**: `http://localhost`
     - **Authorization callback URL**: `http://localhost/oauth/callback` _(포트번호를 붙이지 말고 정확히 기입합니다)_
   - 생성된 **Client ID**와 **Client Secret**을 복사합니다.

2. **환경 변수 지정**:
   터미널에서 복사한 키들을 환경 변수로 선언해 줍니다.

   ```powershell
   # Windows PowerShell 기준
   $env:CONVENTION_GITHUB_CLIENT_ID="복사한_Client_ID"
   $env:CONVENTION_GITHUB_CLIENT_SECRET="복사한_Client_Secret"
   ```

3. **실험적 기능 허용 (Opt-in)**:
   GitHub Copilot은 현재 실험적 프로바이더이므로 명시적 활성화가 필요합니다.
   - **방법 A**: 터미널에 `$env:CONVENTION_EXPERIMENTAL_GITHUB_COPILOT="true"` 환경 변수 제공
   - **방법 B**: `~/.config/convention/config.json`에 `"experimentalGitHubCopilot": true` 키 추가

4. **모델 설정 진행**:
   ```bash
   convention -m github-copilot oauth
   ```
   명령어를 실행하면 웹 브라우저가 기동되며 깃허브 소셜 로그인이 가동됩니다. 연동이 끝나면 발급된 토큰이 `credentials.json`의 `oauth.github-copilot` 공간에 자동으로 안전하게 기록됩니다.

### Antigravity MCP 연동 가이드 (실험적 기능)

**Convention CLI**는 로컬 **Model Context Protocol (MCP)** Stdio 서버 모드를 완벽하게 지원합니다. 독점 에이전트 인프라(Grok Build, Antigravity 등)가 API Key를 직접 가로채지 않고, Stdio 파이프라인을 통해 귀하의 로컬 Git 저장소 변경 사항을 안전하게 조회하고 최종 커밋을 자율 실행할 수 있도록 하는 **"인증의 주체 반전"** 아키텍처를 가동합니다.

1. **로컬 경로 확인**:
   - 프로젝트 경로: 이 저장소의 절대 경로입니다. 예: `C:\Users\USER\Desktop\develop\convention-cli`
   - Node 경로: Windows에서는 `node` 대신 `C:\Program Files\nodejs\node.exe`처럼 절대 경로를 권장합니다. GUI 앱은 터미널의 `PATH`를 그대로 상속하지 않을 수 있습니다.

2. **Antigravity MCP 설정 파일 생성**:
   Antigravity는 임의의 `mcp.json`이나 `config.json`이 아니라 `mcp_config.json`을 읽습니다. 사용하는 호스트에 맞춰 아래 위치에 파일을 만듭니다.
   - Antigravity Editor: `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
   - Antigravity CLI: `%USERPROFILE%\.gemini\antigravity-cli\mcp_config.json`
   - Antigravity IDE 프로필이 있는 경우: `%USERPROFILE%\.gemini\antigravity-ide\mcp_config.json`
   - 설치 버전이 공용 Gemini 설정을 읽는 경우: `%USERPROFILE%\.gemini\config\mcp_config.json`

   ```json
   {
     "mcpServers": {
       "convention-cli-mcp": {
         "command": "C:\\Program Files\\nodejs\\node.exe",
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

   예시 경로는 본인 환경의 절대 경로로 바꿔야 합니다. `cwd`는 매우 중요합니다. 이 값이 없으면 MCP 서버가 Antigravity 실행 폴더에서 떠서 Git 저장소를 찾지 못할 수 있습니다.

3. **Windows에서는 UTF-8 BOM 없이 저장**:
   일부 Antigravity 빌드는 UTF-8 BOM이 붙은 JSON을 `invalid character 'ï' looking for beginning of value` 오류로 거부할 수 있습니다. VS Code에서는 **Save with Encoding > UTF-8**로 저장하고, PowerShell로 생성할 때는 BOM 없는 UTF-8 writer를 사용합니다.

4. **Antigravity 재시작**:
   Antigravity Editor/IDE를 완전히 종료 후 다시 열거나, Antigravity CLI 세션을 새로 시작해야 `mcp_config.json`을 다시 읽습니다.

5. **연결 확인**:
   Antigravity에게 `convention-cli-mcp` MCP 서버의 도구 목록을 확인하거나 사용하라고 요청하거나 /mcp를 통해 mcp가 정상적으로 연결되어있는지 확인합니다. 정상 연결되면 아래 3개 도구가 보여야 합니다.
   - `get_masked_git_diff`: 현재 Git 저장소의 변경사항을 획득합니다. 이때 `.env`, `credentials.json` 등 민감정보 파일은 원천 배제되며, diff 내의 `API_KEY=`, `PASSWORD=` 와 같은 비밀 구문들은 전부 `[REDACTED]`로 정화 및 마스킹된 안전한 데이터만 호스트에 전송합니다.
   - `build_commit_prompt`: 설정된 기본 언어(`ko` 등) 및 로컬 `.convention/template.json` 규칙에 일치하도록 호스트 에이전트에게 내릴 Conventional Commits 생성 안내 프롬프트 지시어를 반환합니다.
   - `execute_git_commit`: 호스트 에이전트가 완성해 보낸 커밋 메시지를 검증하고 실제 `git commit`을 물리 집행합니다. 이때 `confirmBeforeCommit`이 활성화되어 있다면, JSON-RPC stdio 채널 패킷 훼손을 방지하기 위해 **플랫폼 전용 가상 TTY 스트림**(`Windows CON` / `Unix /dev/tty`)을 강제로 개방하여 사용자의 물리 Y/N 검증 승인을 대기합니다. 승인 거부 시 실제 커밋은 철저하게 차단됩니다.

6. **Antigravity에서 사용하는 방법**:
   Antigravity에게 `convention-cli-mcp` 도구를 사용해 커밋을 만들라고 요청합니다. 의도한 순서는 아래와 같습니다.
   - `get_masked_git_diff` 호출
   - 반환된 diff로 `build_commit_prompt` 호출
   - Conventional Commits 메시지 생성
   - 최종 메시지로 `execute_git_commit` 호출

   Antigravity에 연결할 때 사용자가 직접 `convention -am`을 별도 터미널에서 실행할 필요는 없습니다. Antigravity가 `mcp_config.json` 설정을 보고 stdio 서버를 직접 실행합니다.

7. **문제 해결 체크리스트**:
   - MCP가 연결되지 않으면 파일명이 정확히 `mcp_config.json`인지, 최상위 키가 `mcpServers`인지 확인합니다.
   - 서버는 보이지만 Git 저장소를 못 찾으면 `cwd`가 이 저장소 절대 경로인지 확인합니다.
   - `node`를 찾지 못하면 `command`에 `node.exe` 절대 경로를 넣습니다.
   - JSON 파싱 오류가 나면 파일이 비어 있지 않은지, UTF-8 BOM이 없는지 확인합니다.
   - 도구는 보이는데 커밋이 실패하면 저장소에서 `git status`를 확인하고, 변경 파일이 민감 파일 제외 규칙에 걸리지 않는지 확인합니다.

기본 설정 파일은 `~/.config/convention/config.json`에 저장합니다. 1차 MVP의 기본 언어는 `ko`, 기본 모드는 `step`, `confirmBeforeCommit` 값은 `true`입니다.

## 보안 및 MVP 주의사항

- 1차 MVP는 Mock AI Provider를 우선 사용합니다.
- 외부 AI Provider로 diff를 전송하는 기능은 이후 단계에서 확장합니다.
- 외부 AI로 diff를 보내기 전에는 사용자 확인과 민감정보 탐지가 필요합니다.
- 커밋 메시지가 생성되어도 사용자 확인 없이 `git commit`을 자동 실행하지 않습니다.
- `.env`, private key, credentials 파일처럼 민감할 수 있는 파일은 diff 분석 대상에서 제외해야 합니다.

## 커밋 확인 질문 설정

`convention --question` 또는 `convention -q`는 방향키로 `true` 또는 `false`를 선택해 `confirmBeforeCommit` 값을 저장합니다. 기본값은 `true`입니다.

- `true`: 생성된 커밋 메시지로 커밋할지 먼저 물어봅니다.
- `false`: 묻지 않고 바로 staging 및 commit을 진행합니다.
