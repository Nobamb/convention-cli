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

☕ 1. 폴더/파일 구조의 역할 (카페 비유)
bin/convention.js (키오스크 & 문지기)
손님(사용자)이 convention --step 같은 명령어를 치면 가장 먼저 맞이하는 곳입니다. "아, 이 손님은 개별 커밋(--step)을 원하시는구나!" 하고 파악만 한 뒤, 담당 점장(commands/)에게 넘깁니다.
src/commands/ (점장님들)
주문을 받아 전체적인 작업 흐름(순서)을 지휘합니다.
commit.js: "자, git에서 코드 가져오고, 프롬프트 만들어서 AI한테 보내고, 응답 오면 커밋해!" 하고 순서를 지시합니다.
model.js: "손님이 AI 모델 바꾸고 싶대. 프롬프트 띄워서 뭐로 바꿀지 물어봐!"
src/core/ (매장의 핵심 주방 시설)
카페의 변하지 않는 핵심 기능(샷 추출, 우유 스팀 등)을 담당하는 전문가들입니다.
git.js: Git을 다루는 전문가. 변경된 코드를 퍼오고, 커밋을 쾅 찍는 역할만 합니다.
prompt.js: 레시피북. "AI한테 이렇게 물어봐야 대답을 잘해"라며 질문을 예쁘게 포장해 줍니다.
ai.js: AI 총괄 매니저 (이 역할은 아래에서 자세히 설명할게요!).
src/providers/ (외부 원두 납품 업체들)
우리가 커피를 만들기 위해 원두를 사 오는 외부 업체들입니다.
gemini.js (구글 농장), claude.js (앤스로픽 농장), localLLM.js (우리 집 뒷마당 로스터기) 등 각각 연락처와 주문 방식이 다릅니다.
src/auth/ (신분증 검사소)
API Key나 OAuth 토큰 등 보안과 로그인을 전담합니다.
src/config/ (카페 운영 매뉴얼 & 금고)
"우리 기본 언어는 한국어", "오늘은 Gemini 원두 쓴다" 같은 설정값과 비밀번호를 보관합니다.
src/utils/ (컵, 냅킨, 데코레이션)
터미널 글씨를 초록색으로 칠해주거나(chalk), 빙글빙글 로딩 스피너(ora)를 보여주는 등 예쁘게 꾸며주는 공통 도구들입니다.

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

🧠 2. core/ai.js는 왜 Provider를 직접 처리하면 안 될까?
이 부분이 핵심입니다. "대체 ai.js는 무슨 일을 하길래 공급업체(Provider)를 모른다는 거지?" 라는 의문이 드는 게 맞습니다.
❌ 만약 ai.js가 직접 다 처리한다면? (나쁜 구조)
ai.js 파일 하나에 Gemini한테 보내는 코드, Ollama한테 보내는 코드, Claude한테 보내는 코드를 다 때려 넣었다고 생각해 보세요.
JavaScript
// 나쁜 예시: ai.js 하나에서 다 처리할 때
async function getCommitMessage(aiName, prompt) {
if (aiName === 'gemini') {
// 구글 주소로 요청 보내고... 구글 방식대로 결과 뜯어내고...
} else if (aiName === 'ollama') {
// 로컬 주소로 요청 보내고... 로컬 방식대로 결과 뜯어내고...
} else if (aiName === 'claude') {
// 앤스로픽 주소로 보내고...
}
}

이렇게 짜면, 나중에 새로운 AI(예: GPT-5)가 나왔을 때 ai.js 파일을 열어서 else if를 또 추가해야 합니다. 코드가 1000줄 넘게 뚱뚱해지고, 한 줄 실수하면 기존에 잘 되던 Gemini까지 에러가 터지는 유지보수 지옥이 열립니다.
⭕ ai.js와 providers를 분리한다면? (좋은 구조)
여기서 ai.js의 역할은 "우리 카페 점장님(commit.js)과 외부 납품 업체(providers) 사이의 연락 담당자(인터페이스)"입니다.
commit.js (점장): "ai.js야, 이 코드(diff) 요약해서 커밋 메시지 하나만 빨리 가져와 줘!"
ai.js (총괄 매니저): "알겠습니다! (설정 파일을 쓱 봄) 아, 손님이 오늘은 Gemini 쓰라고 해놨네. 어이, Gemini 담당자(providers/gemini.js), 이 프롬프트 줄 테니까 통신해서 결과물만 딱 내놔!"
providers/gemini.js (Gemini 전담 직원): "넵! Gemini API 주소로 HTTP 요청 쏘고, 복잡한 JSON 결과에서 딱 텍스트만 발라내서 ai.js한테 드리겠습니다."
즉, ai.js는 "무엇을 해야 하는지(프롬프트를 보내고 결과를 받는다)"만 알고 있으면 됩니다. "어떻게(어떤 API 주소로 어떤 형태의 데이터를 보낼지)"는 각 Provider 전담 직원들이 알아서 하는 겁니다.
💡 왜 이렇게 할까요? (이점)
이 구조의 가장 큰 장점은 "확장성"입니다. 내일 당장 엄청난 성능의 새로운 AI가 출시되었다고 가정해 볼까요?
나쁜 구조에서는 핵심 파일인 ai.js를 뜯어고쳐야 합니다.
이 좋은 구조에서는 ai.js는 건드릴 필요도 없습니다. 그냥 providers/새로운AI.js 파일을 하나 띡 만들어서 추가해주기만 하면 끝납니다.
핵심 비즈니스 로직(AI에게 물어보고 결과를 받는다)과 세부 구현(Gemini 방식, 로컬 방식)을 분리하여 서로 영향을 주지 않게 만드는 것, 이게 바로 좋은 소프트웨어 설계의 근본적인 이유입니다.

Convention CLI는 bin, commands, core, providers, auth, config, utils로 역할을 분리한다. bin/convention.js는 CLI 진입점으로 명령어를 파싱하고 각 command 모듈로 라우팅한다. commands는 사용자 명령어별 실행 흐름을 담당하고, core는 Git 처리, AI 호출, 프롬프트 생성 등 핵심 비즈니스 로직을 담당한다. AI Provider별 세부 연동은 providers 폴더로 분리하여 Gemini, GitHub Copilot, Claude, localLLM, OpenAI-compatible 계열을 독립적으로 확장할 수 있도록 설계한다. 인증 처리는 auth 폴더에서 API Key와 OAuth 방식으로 분리하고, 설정값과 credentials는 config 모듈에서 일관되게 관리한다.
