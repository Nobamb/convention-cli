convention-cli/
├── package.json # 패키지 정보, bin 진입점, 의존성 관리
├── package-lock.json # 의존성 잠금 파일
├── README.md # 사용 설명서 및 npm 노출 문서
├── .gitignore # Git 제외 파일 설정
├── .npmignore # npm 배포 제외 파일 설정
├── bin/
│ └── convention.js # CLI 진입점, 명령어 파싱 및 라우팅
└── src/
├── commands/ # 명령어별 실행 로직
│ ├── commit.js # 기본 커밋 실행, step/batch 분기
│ ├── config.js # --set-mode, --language 설정 변경
│ └── model.js # --model Provider/Auth/Version 설정
├── core/ # 핵심 비즈니스 로직
│ ├── git.js # git diff, add, commit, push, reset 실행
│ ├── ai.js # Provider에 프롬프트 전송 및 응답 처리
│ └── prompt.js # 커밋 메시지 생성용 프롬프트 빌더
├── providers/ # AI Provider별 연동 모듈
│ ├── index.js # Provider 라우팅
│ ├── gemini.js # Gemini 연동
│ ├── github-copilot.js # GitHub Copilot 연동
│ ├── claude.js # Claude 연동
│ ├── openai-compatible.js # Grok, DeepSeek, Kimi, GLM 등 공통 연동
│ └── localLLM.js # Ollama, LM Studio 등 로컬 LLM 연동
├── auth/ # 인증 처리
│ ├── apiKey.js # API Key 입력 및 저장
│ └── oauth.js # OAuth 브라우저 로그인 및 토큰 저장
├── config/ # 설정 관리
│ ├── store.js # config/credentials 읽기 및 쓰기
│ └── defaults.js # 기본 설정값 및 Provider 목록
└── utils/ # 공통 유틸리티
├── ui.js # prompts, chalk, ora 기반 터미널 UI
├── logger.js # 성공/실패/경고 메시지 출력
└── validator.js # provider, authType, mode, language 검증

core/ai.js는 모든 Provider를 직접 처리하지 않는 게 좋습니다.
좋은 구조는 아래 흐름입니다.
commands/commit.js
↓
core/git.js
↓
core/prompt.js
↓
core/ai.js
↓
providers/index.js
↓
providers/gemini.js 또는 providers/localLLM.js

즉:
core/ai.js = 공통 AI 호출 인터페이스
providers/\* = 실제 Provider별 구현

이렇게 해야 나중에 Provider가 늘어나도 commit.js나 git.js를 거의 수정하지 않아도 됩니다.

Convention CLI는 bin, commands, core, providers, auth, config, utils로 역할을 분리한다. bin/convention.js는 CLI 진입점으로 명령어를 파싱하고 각 command 모듈로 라우팅한다. commands는 사용자 명령어별 실행 흐름을 담당하고, core는 Git 처리, AI 호출, 프롬프트 생성 등 핵심 비즈니스 로직을 담당한다. AI Provider별 세부 연동은 providers 폴더로 분리하여 Gemini, GitHub Copilot, Claude, localLLM, OpenAI-compatible 계열을 독립적으로 확장할 수 있도록 설계한다. 인증 처리는 auth 폴더에서 API Key와 OAuth 방식으로 분리하고, 설정값과 credentials는 config 모듈에서 일관되게 관리한다.
