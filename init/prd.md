Convention CLI 최종 통합 기획서

AI 기반 Git 커밋 컨벤션 자동화 CLI 도구

---

1. 기획 개요

Convention CLI는 개발자가 Git 커밋 메시지를 작성하는 과정에서 발생하는 반복적인 작업을 줄이기 위한 AI 기반 CLI 도구입니다.

사용자는 터미널에서 convention 명령어를 입력하는 것만으로 마지막 커밋 이후 변경된 내용을 AI가 분석하게 할 수 있습니다. AI는 변경된 코드 흐름을 파악한 뒤, 설정된 언어와 Git 커밋 컨벤션에 맞는 커밋 메시지를 자동으로 생성합니다.

또한 단순히 커밋 메시지를 만들어주는 수준을 넘어, 커밋 실행, push, reset, AI 모델 설정, 언어 설정, 로컬 LLM 연동, OAuth/API Key 인증까지 지원하는 개발자 워크플로우 자동화 도구를 목표로 합니다.

---

2. 기획 배경

개발자는 기능 구현, 버그 수정, 리팩토링 등 다양한 작업을 진행한 뒤 Git 커밋을 작성합니다. 이때 커밋 메시지는 프로젝트 히스토리 관리와 협업 품질을 위해 중요하지만, 실제 개발 과정에서는 다음과 같은 문제가 자주 발생합니다.

---

2-1. 기존 Git 커밋 작성의 불편함

1. 개발 흐름이 끊김

코드를 작성한 뒤 커밋 메시지를 작성하려면 변경된 파일과 내용을 다시 확인해야 합니다.

git diff
git status
git log

이 과정에서 작업 흐름이 끊기고, 커밋 메시지를 작성하는 데 생각보다 많은 시간이 소요됩니다.

---

2. 커밋 컨벤션 작성이 번거로움

팀이나 프로젝트에서 Conventional Commits 형식을 사용할 경우, 매번 아래와 같은 형식을 고민해야 합니다.

feat: add user login flow
fix: resolve token refresh error
refactor: simplify auth middleware
docs: update README setup guide

변경 내용 자체보다 “어떤 타입을 붙여야 하는지”, “어떻게 요약해야 하는지”를 고민하는 시간이 반복적으로 발생합니다.

---

3. 변경 파일이 많을수록 커밋 단위 판단이 어려움

하나의 작업 안에서도 여러 파일이 변경될 수 있습니다.

예를 들어 다음 파일들이 동시에 변경되었다고 가정할 수 있습니다.

auth.ts
login-page.tsx
user-api.ts
README.md

이 경우 모든 변경 사항을 하나의 커밋으로 묶어야 할지, 파일별로 나누어야 할지 판단이 필요합니다.

---

4. 커밋 이후 후속 명령어도 반복됨

커밋 이후에는 상황에 따라 push 또는 reset을 실행해야 합니다.

git push
git reset HEAD~1

이러한 작업 역시 반복적으로 발생하므로, 하나의 CLI 흐름 안에서 처리할 수 있다면 개발 효율성이 높아집니다.

---

3. 제품 목표

Convention CLI의 목표는 다음과 같습니다.

Git 변경 사항 분석
→ AI 기반 커밋 메시지 생성
→ Git 커밋 실행
→ 필요 시 push/reset 처리

이 전체 과정을 하나의 CLI 명령어로 자동화하는 것입니다.

---

3-1. 핵심 목표

1. 개발자가 커밋 메시지 작성에 쓰는 시간을 줄입니다.

2. Git 커밋 컨벤션을 일관되게 유지합니다.

3. 변경 파일 단위 또는 전체 변경 단위로 커밋 방식을 선택할 수 있게 합니다.

4. AI 모델과 언어를 사용자 환경에 맞게 설정할 수 있게 합니다.

5. npm 기반 전역 설치로 쉽게 사용할 수 있게 합니다.

6. 클라우드 AI와 로컬 LLM을 모두 지원합니다.

7. Windows, macOS, Linux에서 모두 동작하도록 설계합니다.

---

4. 핵심 사용자

4-1. 주요 타깃

1. 개인 개발자

개인 프로젝트에서 커밋 메시지 작성 시간을 줄이고 싶은 개발자입니다.

2. 팀 단위 개발자

팀 컨벤션에 맞춰 일관된 커밋 메시지를 유지하고 싶은 개발자입니다.

3. 오픈소스 기여자

명확한 커밋 히스토리를 유지하며 프로젝트에 기여하고 싶은 사용자입니다.

4. AI 개발 워크플로우에 익숙한 사용자

Gemini, OpenAI, Claude, Ollama, LM Studio 등 AI 도구를 개발 과정에 적극적으로 활용하는 사용자입니다.

---

5. 제품 컨셉

Convention CLI는 다음과 같은 개발자 경험을 지향합니다.

convention

위 명령어 하나로 현재 Git 프로젝트의 변경 사항을 분석하고, AI가 적절한 커밋 메시지를 생성한 뒤 커밋까지 진행합니다.

필요한 경우 아래처럼 옵션을 추가할 수 있습니다.

convention --step
convention --batch
convention --push
convention --reset
convention --language en
convention --model gemini

즉, Convention CLI는 Git 커밋 메시지 작성 보조 도구이면서 동시에 AI 기반 Git 워크플로우 자동화 도구입니다.

---

6. CLI 명령어 명세

6-1. 기본 사용법

convention [options]

---

6-2. Help 출력 문구

Usage: convention [options]

AI 에이전트를 활용한 지능형 Git 커밋 & 워크플로우 자동화 툴 🚀

Options:
(명령어 없음) 현재 설정된 기본 모드(step 또는 batch)에 따라
마지막 커밋과 비교하여 변경된 내용의 커밋을 진행합니다.

--step 변경된 파일을 하나씩 순회하며, 각 파일의 변경 사항에
맞는 개별 커밋 메시지를 작성합니다.
--batch 변경된 모든 파일을 한 번에 분석하여 하나의 통합된
커밋 메시지로 작성합니다.

--push AI 커밋 작성이 완료된 후, 현재 브랜치의 내용을
원격 저장소(GitHub)로 즉시 푸시합니다.
--reset 가장 최근에 진행된 커밋을 취소합니다.
(git reset HEAD~1 명령어와 동일하게 동작)

Configuration Options:
--set-mode <mode> 기본 convention 명령어의 동작 방식을 변경합니다.
(사용 가능 값: step, batch)
--model <model_name> AI 분석에 사용할 모델을 변경합니다.
(사용 가능 값: gemini, codex, ollama 등)
--language <lang> 커밋 컨벤션을 작성할 기본 언어를 변경합니다.
(사용 가능 값: ko(기본), en, jp, cn)

--help, -h 현재 보고 있는 도움말을 출력합니다.

---

7. 명령어별 상세 설명

7-1. convention

convention

현재 설정된 기본 모드에 따라 마지막 커밋 이후 변경된 내용을 분석하고 커밋을 진행합니다.

기본 모드는 step 또는 batch 중 하나입니다.

동작 흐름

1. 현재 폴더가 Git 저장소인지 확인
2. 마지막 커밋 이후 변경 사항 확인
3. 설정된 기본 모드 확인
4. Git diff 데이터 추출
5. AI 에이전트가 변경 내용 분석
6. 커밋 컨벤션에 맞는 메시지 생성
7. git add 및 git commit 실행

---

7-2. convention --step

convention --step

변경된 파일을 하나씩 순회하며 각 파일의 변경 사항에 맞는 개별 커밋 메시지를 작성합니다.

적합한 상황

파일별로 커밋을 나누고 싶을 때

변경 파일마다 목적이 다를 때

커밋 히스토리를 세밀하게 관리하고 싶을 때

여러 작업이 한 번에 섞여 있는 경우

예시

변경 파일:

- auth.ts
- login-page.tsx
- user-api.ts

AI 생성 커밋 예시:
feat: add authentication logic
fix: update login page validation
refactor: simplify user api request flow

---

7-3. convention --batch

convention --batch

변경된 모든 파일을 한 번에 분석하여 하나의 통합된 커밋 메시지를 작성합니다.

적합한 상황

여러 파일 변경이 하나의 기능에 해당할 때

빠르게 하나의 커밋으로 묶고 싶을 때

전체 변경 흐름이 하나의 작업 단위일 때

예시

변경 파일:

- auth.ts
- login-page.tsx
- user-api.ts

AI 생성 커밋 예시:
feat: implement user login flow

---

7-4. convention --push

convention --push

AI 커밋 작성이 완료된 후 현재 브랜치를 원격 저장소로 push합니다.

내부 동작 예시

git push

또는

git push origin HEAD

동작 흐름

1. 변경 사항 분석
2. AI 커밋 메시지 생성
3. git commit 실행
4. git push 실행

---

7-5. convention --reset

convention --reset

가장 최근에 진행한 커밋을 취소합니다.

내부적으로는 다음 명령어와 동일하게 동작합니다.

git reset HEAD~1

적합한 상황

방금 생성한 커밋을 취소하고 싶을 때

AI가 생성한 커밋 메시지를 다시 만들고 싶을 때

커밋 단위를 다시 나누고 싶을 때

---

8. 설정 관련 명령어

8-1. convention --set-mode <mode>

convention --set-mode step

또는

convention --set-mode batch

convention 명령어만 입력했을 때 사용할 기본 동작 방식을 변경합니다.

사용 가능 값

step
batch

예시

convention --set-mode batch

이후 아래 명령어는 batch 모드로 실행됩니다.

convention

---

8-2. convention --model
convention --model
convention --model 명령어는 AI 커밋 메시지 생성에 사용할 AI Agent Provider, 인증 방식, 모델 버전을 설정하는 기능입니다.
기존에는 단순히 사용할 모델명을 변경하는 기능으로 볼 수 있었지만, 최종 설계에서는 다음 세 가지를 함께 설정하는 명령어로 확장합니다.

1. 사용할 AI Agent Provider
2. 인증 방식
3. 사용할 모델 버전

지원 예정 AI Agent Provider
Convention CLI는 AI Agent Provider를 안정 연동 가능 여부에 따라 Stable Provider와 Experimental Provider로 구분합니다.
Stable Providers
gemini
github-copilot
codex
claude
grok
deepseek
kimi
glm
localLLM
Experimental Providers
antigravity
manus
Stable Provider는 공식 API, SDK, OAuth 또는 OpenAI-compatible endpoint 등 외부 CLI 연동에 사용할 수 있는 공식 또는 준공식 경로가 있는 Provider를 의미합니다.
Experimental Provider는 공식 외부 API 또는 OAuth 연동 방식이 명확하지 않거나, IDE/Agent 플랫폼 내부 인증에 의존할 가능성이 있는 Provider를 의미합니다.

기본 실행 방식
convention --model
위 명령어를 입력하면 대화형 선택 UI가 실행됩니다.
? 사용할 AI Agent를 선택하세요:

Stable Providers:

> gemini
> github-copilot
> codex
> claude
> grok
> deepseek
> kimi
> glm
> localLLM

Experimental Providers:
antigravity
manus
사용자는 위아래 방향키로 사용할 AI Agent Provider를 선택합니다.

Provider 선택 후 인증 방식 선택
예를 들어 gemini를 선택하면 다음으로 인증 방식을 선택합니다.
? Gemini를 어떤 방식으로 사용할까요?

> OAuth 로그인
> API Key 직접 입력

인증 방식
OAuth 방식
OAuth 방식을 선택하면 사용자가 이미 구독 중이거나 로그인 가능한 계정을 브라우저 인증을 통해 연결합니다.
🌐 브라우저를 열어 Gemini 계정 로그인을 진행합니다.
✅ Gemini OAuth 인증이 완료되었습니다.
이후 Convention CLI는 저장된 OAuth 토큰을 사용하여 해당 계정에서 사용 가능한 모델을 호출합니다.
API Key 방식
API Key 방식을 선택하면 사용자가 직접 발급받은 API Key를 입력합니다.
? Gemini API Key를 입력하세요:

---

입력된 API Key는 로컬 credentials 파일에 저장합니다.
이미 해당 Provider의 API Key가 저장되어 있으면, `convention --model`은 새 key를 바로 요구하지 않고 먼저 교체 여부를 묻습니다. 사용자가 교체를 거절하면 기존 key를 유지한 채 모델 버전 선택과 설정 저장을 계속 진행합니다. 사용자가 교체를 승인한 경우에만 비밀번호 입력 prompt로 새 API Key를 받아 credentials 파일에 덮어씁니다.
None 방식
localLLM처럼 별도 인증이 필요하지 않은 Provider는 authType을 none으로 저장합니다.
{
"provider": "localLLM",
"authType": "none"
}

모델 버전 선택
인증 방식까지 선택한 뒤에는 사용할 모델 버전을 선택합니다.
? 사용할 Gemini 모델 버전을 선택하세요:

> gemini 3.1 pro
> gemini 3.1 flash
> gemini 2.5 pro
> gemini 2.5 flash
> 사용자는 방향키로 모델 버전을 선택합니다.
> 설정 저장 시에는 사용자에게 보여주는 이름과 내부 호출용 값을 분리할 수 있습니다.
> {
> "provider": "gemini",
> "authType": "oauth",
> "modelDisplayName": "gemini 3.1 pro",
> "modelVersion": "gemini-3.1-pro"
> }

convention --model 사용 패턴

   전체 대화형 설정
   convention --model
   AI Agent Provider, 인증 방식, 모델 버전을 모두 대화형 UI에서 선택합니다.
   AI Agent Provider 선택
   OAuth/API Key/None 인증 방식 선택
   모델 버전 선택
   설정 저장

Provider만 지정
   convention --model gemini
   gemini를 사용할 AI Agent Provider로 지정하고, 이후 인증 방식과 모델 버전만 대화형 UI로 선택합니다.
   ? Gemini를 어떤 방식으로 사용할까요?
   > OAuth 로그인
   > API Key 직접 입력

? 사용할 Gemini 모델 버전을 선택하세요:

> gemini 3.1 pro
> gemini 3.1 flash
> gemini 2.5 pro
> gemini 2.5 flash

Provider + 인증 방식 지정
   convention --model gemini oauth
   gemini와 oauth 방식을 지정하고, 모델 버전만 대화형 UI로 선택합니다.
   ? 사용할 Gemini 모델 버전을 선택하세요:

   > gemini 3.1 pro
   > gemini 3.1 flash
   > gemini 2.5 pro
   > gemini 2.5 flash

Provider + 인증 방식 + 모델 버전까지 한 번에 지정
   convention --model gemini oauth "3.1 pro"
   AI Agent Provider, 인증 방식, 모델 버전을 한 번에 지정합니다.
   이 경우 대화형 UI 없이 바로 설정을 저장합니다.
   {
   "provider": "gemini",
   "authType": "oauth",
   "modelDisplayName": "gemini 3.1 pro",
   "modelVersion": "gemini-3.1-pro"
   }

명령어 설계 규칙
기본 구조
convention --model [provider] [authType] [modelVersion]
인자별 의미
인자
설명
예시
provider
사용할 AI Agent Provider
gemini, github-copilot, claude, localLLM
authType
인증 방식
oauth, api, none
modelVersion
사용할 모델 버전
"3.1 pro", "sonnet", "qwen2.5:7b"

사용 예시
convention --model
전체 대화형 설정을 실행합니다.
convention --model gemini
Gemini를 선택한 뒤 인증 방식과 모델 버전을 선택합니다.
convention --model gemini oauth
Gemini OAuth 방식을 선택한 뒤 모델 버전만 선택합니다.
convention --model gemini oauth "3.1 pro"
Gemini OAuth 방식과 3.1 pro 모델 버전을 한 번에 설정합니다.
convention --model claude api
Claude API Key 방식을 선택한 뒤 모델 버전을 선택합니다.
convention --model github-copilot oauth
GitHub Copilot OAuth 방식을 선택한 뒤 사용할 모델 또는 실행 방식을 선택합니다.
convention --model localLLM
Local LLM 환경을 선택한 뒤 로컬 endpoint와 설치된 모델 목록을 확인합니다.

localLLM 처리 방식
localLLM은 클라우드 AI Agent와 다르게 OAuth/API Key 중심이 아니라, 로컬 서버 endpoint와 로컬 모델 선택 중심으로 동작합니다.
convention --model localLLM
실행 예시:
? 로컬 LLM 서버 주소를 입력하세요:
http://localhost:11434/v1

🔍 로컬 모델 목록을 불러오는 중입니다...

? 사용할 로컬 모델을 선택하세요:

> qwen2.5:7b
> gemma2:9b
> llama3:8b
> 저장 예시:
> {
> "provider": "localLLM",
> "authType": "none",
> "baseURL": "http://localhost:11434/v1",
> "modelDisplayName": "qwen2.5:7b",
> "modelVersion": "qwen2.5:7b"
> }

설정 파일 갱신안
기존 설정 파일에서 model 하나로만 관리하지 않고, 아래처럼 Provider, 인증 방식, 모델 표시명, 실제 모델 식별자를 분리합니다.
{
"mode": "step",
"provider": "gemini",
"authType": "oauth",
"modelDisplayName": "gemini 3.1 pro",
"modelVersion": "gemini-3.1-pro",
"language": "ko",
"baseURL": null
}
API Key 방식일 경우:
{
"mode": "step",
"provider": "claude",
"authType": "api",
"modelDisplayName": "claude sonnet",
"modelVersion": "claude-sonnet",
"language": "ko",
"baseURL": null
}
Local LLM 방식일 경우:
{
"mode": "step",
"provider": "localLLM",
"authType": "none",
"modelDisplayName": "qwen2.5:7b",
"modelVersion": "qwen2.5:7b",
"language": "ko",
"baseURL": "http://localhost:11434/v1"
}

8-2 최종 반영 문장
convention --model 명령어는 AI 커밋 메시지 생성에 사용할 AI Agent Provider, 인증 방식, 모델 버전을 설정하는 기능이다. 사용자는 gemini, github-copilot, codex, claude, grok, deepseek, kimi, glm, localLLM 등 Stable Provider와 antigravity, manus 등 Experimental Provider 중 하나를 선택할 수 있다. 선택한 Provider에 따라 OAuth, API Key 또는 인증 없음 방식으로 연결하며, 각 Provider에서 사용할 모델 버전을 선택할 수 있도록 한다.
명령어는 대화형 설정과 직접 지정 방식을 모두 지원한다. convention --model은 Provider, 인증 방식, 모델 버전을 모두 대화형으로 선택하며, convention --model gemini는 인증 방식과 버전만 선택한다. convention --model gemini oauth는 모델 버전만 선택하고, convention --model gemini oauth "3.1 pro"처럼 입력하면 모든 설정을 한 번에 저장한다.
GitHub Copilot은 공식 CLI, OAuth 인증, Copilot SDK 등을 통한 외부 도구 연동 가능성이 비교적 명확하므로 Stable Provider 후보로 포함한다. 반면 Antigravity는 agent-first IDE 플랫폼 성격이 강하고, 외부 CLI에서 직접 호출 가능한 공식 Provider 구조가 명확하지 않으므로 Experimental Provider로 분류한다. 향후 공식 API, OAuth, MCP 또는 CLI 브릿지 방식이 안정화될 경우 정식 Provider로 승격할 수 있다.

---

8-3. convention --language <lang>

convention --language ko

커밋 컨벤션을 작성할 기본 언어를 변경합니다.

사용 가능 값

ko
en
jp
cn

언어별 의미

ko: 한국어, 기본값
en: 영어
jp: 일본어
cn: 중국어

---

8-4. convention --help, convention -h

convention --help

또는

convention -h

현재 사용할 수 있는 명령어와 옵션 설명을 출력합니다.

---


8-5. 커밋 및 전송 확인 질문 설정

사용자는 `convention --question` 또는 `convention -q`로 커밋 메시지 생성 후 확인 질문 및 외부 AI 전송 확인 질문을 사용할지 설정할 수 있습니다.

1. 커밋 전 확인 질문 (confirmBeforeCommit)
   - `true`: 기본값입니다. AI가 생성한 커밋 메시지를 보여주고, 이 메시지로 커밋할지 사용자에게 확인합니다.
   - `false`: 확인 질문을 생략합니다. `convention` 실행 시 메시지를 생성한 뒤 바로 `git add`와 `git commit`을 실행합니다.

2. 외부 AI 전송 확인 질문 (confirmExternalTransmission)
   - `always`: 기본값입니다. 매 파일(또는 batch 실행 시 매번) 외부 AI로 코드를 보내기 전 확인합니다.
   - `once`: 실행 세션 중 첫 번째 파일에서만 확인합니다. 한 번 승인하면 이후 파일은 자동으로 전송합니다.
   - `never`: 확인 절차 없이 바로 외부 AI로 코드를 전송합니다.

- 설정값은 `~/.config/convention/config.json`에 저장합니다.
- 설정 변경은 방향키 선택 UI로 제공하며, 실행 후 커밋 플로우를 수행하지 않습니다.
- 도움말에는 `-q, --question` 옵션과 각 설정의 의미를 포함합니다.



9. 설치 및 배포 방식

Convention CLI는 Node.js 기반으로 개발하고 npm 패키지로 배포합니다.

사용자는 아래 명령어로 전역 설치할 수 있습니다.

npm install -g convention-cli

설치 후에는 터미널에서 바로 convention 명령어를 사용할 수 있습니다.

convention

---

9-1. npm 전역 실행 설정

package.json에 bin 필드를 추가합니다.

{
"name": "convention-cli",
"version": "1.0.0",
"description": "AI-powered Git commit convention generator",
"bin": {
"convention": "./bin/index.js"
}
}

실행 파일에는 Shebang을 추가합니다.

#!/usr/bin/env node

---

9-2. npm 배포

공개 npm 패키지로 배포하는 것을 기본 방향으로 합니다.

npm publish

---

9-3. npm 업데이트 정책

npm 패키지는 로컬 코드나 GitHub 코드가 수정된다고 자동으로 업데이트되지 않습니다.

수정 사항을 npm에 반영하려면 버전을 올리고 다시 publish해야 합니다.

버그 수정

npm version patch
npm publish

기능 추가

npm version minor
npm publish

사용자의 업데이트

npm update -g convention-cli

또는

npm install -g convention-cli@latest

---

10. 최초 실행 온보딩

처음 convention 명령어를 실행했을 때 설정 파일이 없거나 AI 모델이 설정되어 있지 않다면, 초기 설정 마법사를 실행합니다.

에러를 출력하고 종료하는 것이 아니라, 사용자가 바로 설정을 완료할 수 있도록 대화형 UI를 제공합니다.

---

10-1. 초기 실행 예시

$ convention

⚠️ 아직 설정된 AI 모델이 없습니다.
Convention CLI를 사용하기 위한 초기 설정을 시작합니다.

? 사용할 AI 환경을 선택하세요:

1. 클라우드 AI API
2. OAuth 로그인
3. 로컬 LLM

---

10-2. 초기 설정 항목

초기 설정에서 확인해야 할 항목은 다음과 같습니다.

1. 사용할 AI 환경
2. 인증 방식
3. 사용할 모델
4. 기본 커밋 모드
5. 커밋 메시지 언어
6. 설정 저장 여부

---

11. 인증 방식

Convention CLI는 사용자 환경에 따라 두 가지 인증 방식을 지원합니다.

1. API Key 방식
2. OAuth 방식

---

11-1. API Key 방식

사용자가 AI 서비스에서 발급받은 API Key를 직접 입력하는 방식입니다.

입력 예시

? 인증 방식을 선택하세요:

1. API Key 직접 입력
2. OAuth 브라우저 로그인

? API Key를 입력하세요:

---

입력값은 화면에 노출되지 않도록 비밀번호 입력 형태로 처리합니다.

---

11-2. OAuth 방식

API Key를 직접 복사해 붙여넣지 않고, 브라우저 로그인을 통해 인증하는 방식입니다.

동작 흐름

1. 사용자가 OAuth 인증 방식 선택
2. CLI가 임시 localhost 서버 실행
3. 사용자의 기본 브라우저 오픈
4. AI 서비스 로그인 및 권한 승인
5. OAuth callback으로 access token 수신
6. 토큰을 로컬 credentials 파일에 저장
7. 이후 요청부터 저장된 토큰 사용

사용자 경험 예시

$ convention

? 인증 방식을 선택하세요:

1. OAuth 브라우저 로그인
2. API Key 직접 입력

🌐 브라우저를 열어 로그인을 진행합니다.
✅ 인증이 완료되었습니다.

---

11-3. 인증 방식 설계 방향

API Key와 OAuth를 모두 지원하는 투트랙 구조를 채택합니다.

API Key 방식의 장점

구현이 단순함

대부분의 AI API에서 지원

빠른 MVP 개발에 적합

OAuth 방식의 장점

사용자가 API Key를 직접 복사하지 않아도 됨

사용자 경험이 좋음

상용 CLI 도구와 유사한 완성도 제공

---

12. AI 모델 연동 구조

Convention CLI는 AI 환경을 크게 두 가지로 구분합니다.

1. 클라우드 AI 모델
2. 로컬 LLM

---

12-1. 클라우드 AI 모델

외부 AI 서비스의 API 또는 OAuth를 통해 연동합니다.

지원 예정 예시

Gemini
OpenAI
Claude
Codex

클라우드 AI는 일반적으로 API Key 또는 OAuth 인증이 필요합니다.

---

12-2. 로컬 LLM

로컬 LLM은 개별 모델명을 기준으로 나누기보다, Local LLM 환경이라는 하나의 카테고리로 관리합니다.

여기서 중요한 개념은 다음과 같습니다.

Ollama, LM Studio, llama.cpp 등 = 모델 실행기 또는 로컬 서버
Gemma, Qwen, Llama 등 = 실제 AI 모델

즉, Convention CLI는 Gemma, Qwen 같은 모델에 직접 연결하는 것이 아니라, Ollama나 LM Studio 같은 실행기에서 제공하는 로컬 API 서버와 통신합니다.

---

12-3. 로컬 LLM 기본 endpoint

기본값 예시:

http://localhost:11434/v1

이는 Ollama의 OpenAI API 호환 endpoint를 기준으로 한 예시입니다.

---

12-4. 로컬 모델 목록 조회

사용자가 로컬 LLM을 선택하면 CLI는 로컬 서버에 모델 목록을 요청합니다.

GET /v1/models

이후 설치된 모델 목록을 가져와 사용자가 방향키로 선택할 수 있도록 합니다.

모델 선택 UI 예시

? 사용할 로컬 모델을 선택하세요:
qwen2.5:7b
gemma2:9b
llama3:8b

---

12-5. 로컬 LLM 연결 실패 처리

로컬 LLM 서버가 실행 중이 아니거나 모델이 설치되어 있지 않을 경우, CLI는 친절한 안내 메시지를 제공합니다.

❌ 로컬 LLM 서버에 연결할 수 없습니다.

확인해 주세요:

1. Ollama 또는 LM Studio가 실행 중인지 확인
2. 로컬 서버 주소가 올바른지 확인
3. 모델이 최소 1개 이상 설치되어 있는지 확인

필요한 경우 모델명을 수동 입력할 수 있는 fallback을 제공합니다.

? 모델 목록을 불러오지 못했습니다. 모델명을 직접 입력하시겠습니까?

---

13. 설정 파일 구조

Convention CLI는 사용자 설정과 인증 정보를 분리해 관리합니다.

---

13-1. 설정 파일 위치

추천 경로:

~/.config/convention/config.json

인증 정보:

~/.config/convention/credentials.json

간단한 MVP에서는 다음과 같은 단일 설정 파일로 시작할 수도 있습니다.

~/.conventionrc

---

13-2. config.json 예시

{
"mode": "step",
"provider": "local",
"model": "qwen2.5:7b",
"language": "ko",
"baseURL": "http://localhost:11434/v1",
"authType": "none"
}

---

13-3. credentials.json 예시

API Key 방식:

{
"provider": "gemini",
"authType": "apiKey",
"apiKey": "**\*\***\*\*\***\*\***"
}

OAuth 방식:

{
"provider": "openai",
"authType": "oauth",
"accessToken": "**\*\***\*\*\***\*\***",
"refreshToken": "**\*\***\*\*\***\*\***"
}

---

14. 기술 스택

Convention CLI는 Node.js 기반으로 개발합니다.

14-1. 핵심 런타임

Node.js

CLI 실행, 파일 접근, Git 명령어 실행, AI API 통신을 모두 처리합니다.

---

14-2. 명령어 파싱

commander

다음과 같은 옵션을 파싱합니다.

--step
--batch
--push
--reset
--set-mode
--model
--language
--help

---

14-3. 대화형 터미널 UI

prompts

초기 설정, 인증 방식 선택, 로컬 모델 선택 등 사용자 입력을 처리합니다.

---

14-4. 터미널 시각 효과

chalk
ora

chalk

성공, 실패, 경고 메시지에 색상을 적용합니다.

ora

AI가 변경 사항을 분석하는 동안 로딩 스피너를 표시합니다.

예시:

⠋ AI가 변경 사항을 분석 중입니다...

---

14-5. OAuth 처리

express
open

express

OAuth callback을 받기 위한 임시 로컬 서버를 실행합니다.

open

사용자의 기본 브라우저를 열어 OAuth 로그인 페이지로 이동합니다.

---

14-6. HTTP 통신

Node.js 내장 fetch API

외부 의존성을 줄이기 위해 axios는 사용하지 않고 Node.js 내장 fetch를 사용합니다.

fetch 사용 이유

1. 별도 패키지 설치 불필요
2. 의존성 감소
3. 공급망 공격 리스크 감소
4. AI API 호출에는 충분한 기능 제공

---

14-7. 시스템 명령어 실행

child_process

Git 명령어 실행에 사용합니다.

예시:

git diff
git add
git commit
git push
git reset HEAD~1

---

14-8. 파일 및 설정 관리

fs
path
os

설정 파일과 인증 정보를 저장하고 불러오는 데 사용합니다.

---

15. 운영체제 호환성

Convention CLI는 Node.js 기반으로 개발하므로 Windows, macOS, Linux에서 모두 사용할 수 있도록 설계합니다.

15-1. 지원 대상

Windows
macOS
Linux

---

15-2. Docker 사용 여부

기본적으로 Docker는 사용하지 않습니다.

Convention CLI는 사용자의 현재 프로젝트 폴더와 .git 디렉토리에 직접 접근해야 합니다. Docker로 실행할 경우 매번 현재 디렉토리를 컨테이너에 마운트해야 하므로 CLI 사용성이 떨어집니다.

예를 들어 Docker를 사용하면 다음과 같은 불편한 명령어가 필요할 수 있습니다.

docker run -v $(pwd):/app convention-cli

따라서 이 프로젝트는 Docker 기반보다 로컬 Node.js CLI 실행 방식이 적합합니다.

---

16. 경로 및 인코딩 정책

16-1. 경로 처리

운영체제마다 경로 구분자가 다르기 때문에 문자열로 직접 경로를 조합하지 않고 Node.js의 path 모듈을 사용합니다.

예시:

import path from "path";
import os from "os";

const configPath = path.join(
os.homedir(),
".config",
"convention",
"config.json"
);

---

16-2. UTF-8 처리

Convention CLI는 한국어, 영어, 일본어, 중국어 커밋 메시지를 지원하므로 UTF-8 처리가 중요합니다.

Git 명령어 실행 결과를 읽을 때 명시적으로 UTF-8 인코딩을 지정합니다.

const diffData = execSync("git diff --staged", {
encoding: "utf-8"
});

---

16-3. 다국어 파일명 깨짐 방지

한글, 일본어, 중국어 파일명이 Git diff에서 깨지는 것을 방지하기 위해 core.quotepath=false 옵션을 사용합니다.

const diffData = execSync("git -c core.quotepath=false diff --staged", {
encoding: "utf-8"
});

이를 통해 AI가 분석하는 diff 데이터와 커밋 메시지가 깨지지 않도록 처리합니다.

---

17. 전체 동작 아키텍처

사용자
↓
convention CLI 실행
↓
명령어 파싱(commander)
↓
설정 파일 확인
↓
초기 설정 필요 여부 판단
↓
AI 환경 선택
├─ 클라우드 AI API
├─ OAuth 로그인
└─ 로컬 LLM
↓
/v1/models 조회
↓
로컬 모델 선택
↓
Git 변경 사항 확인
↓
git diff 추출
↓
AI 에이전트에 분석 요청
↓
커밋 메시지 생성
↓
git add / git commit 실행
↓
옵션에 따라 push 또는 reset 수행

---

18. 모드별 동작 흐름

18-1. Step 모드

1. 변경된 파일 목록 확인
2. 파일별 diff 추출
3. 각 파일 단위로 AI 분석
4. 파일별 커밋 메시지 생성
5. 파일별 git add 실행
6. 파일별 git commit 실행

장점

- 커밋 히스토리가 세밀해짐
- 파일별 변경 의도를 명확히 남길 수 있음
- 여러 작업이 섞인 경우 유용함

---

18-2. Batch 모드

1. 전체 변경 파일 목록 확인
2. 전체 diff 추출
3. AI가 전체 변경 흐름 분석
4. 하나의 통합 커밋 메시지 생성
5. 전체 git add 실행
6. git commit 실행

장점

- 빠르게 커밋 가능
- 하나의 기능 단위 작업에 적합
- 개발 흐름을 가장 적게 방해함

---

19. AI 프롬프트 설계 방향

AI가 불필요한 설명을 붙이지 않고, 커밋 메시지만 생성하도록 프롬프트를 강하게 제한해야 합니다.

---

19-1. 기본 프롬프트 요구사항

1. 변경 사항을 분석할 것
2. Git 커밋 컨벤션에 맞게 작성할 것
3. 설정된 언어로 작성할 것
4. 설명, 인사말, 마크다운 없이 커밋 메시지만 반환할 것
5. 변경 내용에 적합한 type을 선택할 것

---

19-2. 프롬프트 예시

다음 Git diff를 분석해서 Conventional Commits 형식의 커밋 메시지를 작성해줘.

조건:

- 언어: 한국어
- 형식: type: message
- 설명 없이 커밋 메시지만 반환
- 변경 내용에 가장 적합한 type을 선택
- 가능한 type: feat, fix, refactor, docs, style, test, chore

Git diff:
{{diff}}

---

19-3. AI 응답 예시

feat: 사용자 로그인 흐름 추가

또는 영어 설정 시:

feat: add user login flow

---

20. 예외 처리 정책

20-1. Git 저장소가 아닌 경우

❌ 현재 폴더는 Git 저장소가 아닙니다.
Git 저장소 안에서 convention 명령어를 실행해 주세요.

---

20-2. 변경 사항이 없는 경우

✅ 변경된 파일이 없습니다.
커밋할 내용이 없습니다.

---

20-3. AI 모델이 설정되지 않은 경우

⚠️ 설정된 AI 모델이 없습니다.
초기 설정을 시작합니다.

---

20-4. API 인증 실패

❌ AI 서비스 인증에 실패했습니다.
API Key 또는 OAuth 인증 정보를 다시 확인해 주세요.

---

20-5. 로컬 LLM 연결 실패

❌ 로컬 LLM 서버에 연결할 수 없습니다.
Ollama 또는 LM Studio가 실행 중인지 확인해 주세요.

---

20-6. AI 응답이 비정상인 경우

❌ 커밋 메시지를 생성하지 못했습니다.
다시 시도하거나 모델 설정을 변경해 주세요.

---

20-7. AI Provider 429 또는 사용량 소진

Gemini 또는 OpenAI-compatible Provider가 HTTP 429, rate limit, usage exhausted 상태를 반환하면 CLI는 raw response body를 출력하지 않고 status만 보존합니다. 이때 사용자는 터미널에서 다음 중 하나를 선택합니다.

1. 다른 API Key를 입력하고 같은 Provider/모델로 재시도
2. 기존 `convention --model` 설정 flow로 Provider 또는 모델을 바꾼 뒤 재시도
3. git add/git commit 없이 안전하게 중단

재시도 전에도 외부 AI 전송 확인과 민감정보 마스킹 정책은 유지됩니다.

---

21. MVP 개발 범위

21-1. 1차 MVP

초기 버전에서 반드시 구현할 기능입니다.

1. npm 전역 설치
2. convention 기본 명령어
3. --step
4. --batch
5. --set-mode
6. --language
7. --help
8. 설정 파일 저장 및 불러오기
9. Git diff 분석
10. AI 커밋 메시지 생성

---

21-2. 2차 MVP

사용성을 높이기 위한 확장 기능입니다.

1. --push
2. --reset
3. --model
4. API Key 인증
5. Gemini 또는 OpenAI 연동
6. 로컬 LLM endpoint 설정
7. /v1/models 기반 로컬 모델 선택

---

21-3. 3차 고도화

제품 완성도를 높이기 위한 기능입니다.

1. OAuth 인증
2. 커밋 전 메시지 미리보기
3. 커밋 전 사용자 승인
4. AI 생성 메시지 재생성
5. 파일 변경 사항 자동 그룹핑
6. 대용량 diff 요약 처리
7. 팀별 커밋 컨벤션 템플릿
8. PR 제목 및 설명 자동 생성
9. npm 자동 업데이트 알림
10. GitHub Actions 연동

---

22. 차별화 요소

Convention CLI의 차별점은 단순한 커밋 메시지 생성이 아니라, 실제 Git 워크플로우 전반을 보조한다는 점입니다.

---

22-1. 주요 차별점

1. AI가 Git diff를 직접 분석
2. step/batch 모드 선택 가능
3. 커밋 메시지 자동 생성 후 실제 커밋 실행
4. push/reset 옵션 제공
5. 한국어, 영어, 일본어, 중국어 지원
6. 클라우드 AI와 로컬 LLM 모두 지원
7. npm 전역 설치로 간단한 사용 가능
8. OAuth/API Key 인증 모두 지원
9. 로컬 모델 목록 자동 조회
10. Windows, macOS, Linux 호환

---

23. 기대 효과

23-1. 개발자 생산성 향상

커밋 메시지 작성과 변경 사항 요약에 쓰는 시간을 줄일 수 있습니다.

---

23-2. 커밋 히스토리 품질 개선

AI가 변경 사항을 분석해 일관된 컨벤션으로 메시지를 생성하므로, 프로젝트 히스토리가 더 명확해집니다.

---

23-3. 팀 협업 효율 향상

팀 단위로 동일한 커밋 컨벤션을 유지하기 쉬워집니다.

---

23-4. AI 개발 워크플로우 확장

기존 AI 에이전트 사용 경험을 Git 작업까지 확장할 수 있습니다.

---

24. 향후 확장 방향

24-1. 커밋 메시지 미리보기

AI가 생성한 메시지를 바로 커밋하지 않고 사용자에게 먼저 보여줍니다.

AI가 생성한 커밋 메시지:
feat: 사용자 로그인 흐름 추가

이 메시지로 커밋하시겠습니까?
Yes
Regenerate
Edit manually
Cancel

---

24-2. 커밋 메시지 재생성

사용자가 마음에 들지 않을 경우 AI에게 다시 생성하도록 요청할 수 있습니다.

convention --retry

---

24-3. 커밋 전 승인 모드

기본적으로 AI가 생성한 커밋 메시지를 사용자에게 확인받은 뒤 커밋하도록 할 수 있습니다.

convention --confirm

---

24-4. PR 자동 생성

향후 GitHub CLI와 연동하여 PR 제목과 설명까지 자동 생성할 수 있습니다.

convention --pr

---

24-5. 팀 컨벤션 템플릿

팀마다 다른 커밋 규칙을 설정할 수 있도록 템플릿 기능을 추가할 수 있습니다.

{
"commitTypes": ["feat", "fix", "refactor", "docs", "test", "chore"],
"format": "{type}: {message}",
"language": "ko"
}

---

25. 최종 요약

Convention CLI는 Git 커밋 메시지 작성의 번거로움을 줄이고, AI를 활용해 개발자의 Git 워크플로우를 자동화하는 CLI 도구입니다.

사용자는 convention 명령어 하나로 마지막 커밋 이후의 변경 사항을 분석하고, 설정된 모드에 따라 파일별 또는 통합 커밋 메시지를 자동 생성할 수 있습니다. 또한 --push, --reset, --set-mode, --model, --language 등의 옵션을 통해 커밋 이후 작업과 사용자 환경 설정까지 CLI 안에서 처리할 수 있습니다.

기술적으로는 Node.js 기반 npm 패키지로 배포하며, API Key와 OAuth 인증을 모두 지원하는 구조를 목표로 합니다. 또한 로컬 LLM은 Ollama, LM Studio 등 실행기를 하나의 Local LLM 환경으로 묶고, /v1/models를 통해 사용 가능한 모델 목록을 조회해 사용자가 방향키로 선택할 수 있도록 설계합니다.

최종적으로 Convention CLI는 단순한 커밋 메시지 생성기를 넘어, AI 기반 Git 커밋 자동화 및 개발 워크플로우 보조 도구로 확장될 수 있습니다.

---

26. 한 줄 소개 문구

> Convention CLI는 AI가 Git 변경 사항을 분석해 커밋 컨벤션에 맞는 메시지를 자동 생성하고, 커밋·푸시·설정까지 지원하는 개발자용 CLI 자동화 도구입니다.

---

27. 짧은 소개 문구

> Convention CLI는 개발자가 커밋 메시지를 고민하는 시간을 줄이기 위해 기획된 AI 기반 Git 자동화 도구입니다.
> 마지막 커밋 이후의 변경 사항을 AI가 분석하고, 설정된 언어와 컨벤션에 맞춰 커밋 메시지를 생성합니다.
> 사용자는 step 모드와 batch 모드를 선택할 수 있으며, 클라우드 AI와 로컬 LLM을 모두 사용할 수 있습니다.

---
