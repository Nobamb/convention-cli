# Convention CLI Agent Guidelines

## 문서 우선순위

이 저장소에서 작업하는 Agent는 `init/` 문서를 기준으로 구현한다. 판단이 충돌하면 아래 순서를 따른다.

1. `init/00_rule.md`의 보안, 사용자 데이터 보호, Git 히스토리 보호 규칙
2. `init/01_mvp-1.md`의 1차 MVP 범위와 작업 순서
3. `init/02_mvp-2.md`의 2차 MVP 확장 범위와 작업 순서
4. `init/prd.md`의 제품 요구사항
5. `init/structure.md`의 모듈 구조
6. 이 `AGENTS.md`

기능 구현이 가능하더라도 보안 규칙, 사용자 데이터 보호, Git 히스토리 보호 원칙에 어긋나면 구현하지 않는다. 2차 MVP 기능도 1차 MVP의 안전한 commit flow를 깨지 않는 방향으로 확장한다.

## Project Structure & Module Organization

구현은 아래 구조를 따른다.

- `package.json`: npm 패키지 정보, `bin` 진입점, 의존성 및 scripts 관리
- `bin/convention.js`: 실행 가능한 CLI 진입점, shebang, `commander` 옵션 파싱, command 함수 라우팅
- `src/commands/`: 사용자 명령 흐름 담당
  - `commit.js`: `runDefaultCommit()`, `runStepCommit()`, `runBatchCommit()`, `--push` 연결
  - `config.js`: `setMode()`, `setLanguage()`
  - `help.js`: `printHelp()`
  - `model.js`: `--model` Provider/Auth/Version 설정
  - `reset.js`: `runReset()`
- `src/core/`: Git 처리, prompt 생성, AI orchestration 등 핵심 로직
- `src/providers/`: `mock`, `localLLM`, `gemini`, `openai-compatible`, 기타 provider 구현
- `src/auth/`: API Key 및 이후 OAuth 인증 처리
- `src/config/`: config 및 credentials 저장소, 기본값, 경로 관리
- `src/utils/`: logger, validator, UI, 공통 helper
- `tests/` 또는 `test/`: source module과 대응되는 테스트

Provider 세부 API 연동은 `src/providers/` 안에 격리하고, `src/core/ai.js`는 설정을 읽어 적절한 provider로 요청을 위임하는 인터페이스 역할을 한다.

## 1차 MVP 범위

1차 MVP는 아래 기능에 한정한다.

- npm 전역 설치 후 `convention` 명령 실행
- `convention`, `convention --step`, `convention --batch`
- `convention --set-mode step|batch`
- `convention --language ko|en|jp|cn`
- `convention --help`, `convention -h`
- 설정 파일 저장 및 불러오기
- Git 저장소 확인, 변경 파일 확인, diff 추출
- Conventional Commits prompt 생성
- Mock AI Provider 기반 커밋 메시지 생성
- 사용자 confirm 이후 `git add` 및 `git commit`

Mock Provider는 기본적으로 `chore: update project files`를 반환해 API 없이 Git/commit 흐름을 검증한다.

## 2차 MVP 범위

2차 MVP는 1차 MVP의 commit flow 위에 아래 기능을 추가한다.

- `convention --model` 명령 구현
- AI Provider 구조 분리
- Mock Provider를 정식 provider 구조로 이전
- `localLLM` 연동
- localLLM endpoint 설정
- `/v1/models` 기반 로컬 모델 목록 조회
- 로컬 모델 선택 UI
- API Key 인증 방식 구현
- Gemini 또는 OpenAI-compatible Provider 1개 이상 연동
- `convention --push` 구현
- `convention --reset` 구현

2차 MVP의 가장 먼저 시작할 작업은 Provider 구조 전환이다. `core/ai.js`가 특정 provider 구현을 직접 알지 않도록 `src/providers/index.js`를 통해 routing하고, 이후 localLLM, Gemini, OpenAI-compatible provider를 같은 방식으로 붙일 수 있어야 한다.

## 2차 MVP 작업 순서

2차 MVP는 아래 순서로 진행한다.

1. 1차 MVP 상태 평가
2. Provider 공통 인터페이스 정의
3. Mock Provider를 Provider 구조로 이전
4. Provider 목록 및 validator 정의
5. localLLM 기본 설정 정의
6. localLLM 연결 확인 구현
7. `/v1/models` 모델 목록 조회 구현
8. 로컬 모델 선택 UI 구현
9. `--model` CLI 라우팅 구현
10. `--model` 대화형 설정 flow 구현
11. API Key 입력 및 credentials 저장 구조 구현
12. Gemini 또는 OpenAI-compatible Provider 1개 이상 구현
13. Provider routing을 `core/ai.js`에 연결
14. `--push` 구현
15. `--reset` 구현
16. 보안 확인 및 통합 테스트

## Provider Contract

2차 MVP Provider는 가능한 한 아래 공통 인터페이스를 따른다.

- `generateCommitMessage({ prompt, config }): Promise<string>`
- `listModels(config): Promise<string[]>`
- `validateConfig(config): boolean | void`

권장 routing 함수:

- `getProvider(providerName)`
- `generateWithProvider({ prompt, config })`
- `listProviderModels(config)`

지원 Provider 범위:

- 2차 MVP 필수: `mock`, `localLLM`, `gemini` 또는 `openaiCompatible` 중 1개 이상
- 안정 Provider 후보: `gemini`, `github-copilot`, `codex`, `claude`, `grok`, `deepseek`, `kimi`, `glm`, `localLLM`
- 실험 Provider 후보: `antigravity`, `manus`

지원하지 않는 provider는 조용히 mock으로 fallback하지 말고 명확한 오류로 중단한다. fallback은 잘못된 설정과 외부 전송 정책 누락을 숨길 수 있다.

## Model Configuration Contract

기본 설정 파일 경로는 `~/.config/convention/config.json`이다. 문자열을 직접 이어 붙이지 말고 `os.homedir()`와 `path.join()`을 사용한다.

`DEFAULT_CONFIG`는 아래 schema를 유지한다.

```json
{
  "mode": "step",
  "language": "ko",
  "provider": null,
  "authType": null,
  "modelDisplayName": null,
  "modelVersion": null,
  "baseURL": null,
  "confirmBeforeCommit": true
}
```

localLLM 기본 설정 후보:

```json
{
  "provider": "localLLM",
  "authType": "none",
  "baseURL": "http://localhost:11434/v1"
}
```

`--model` 결과는 `config.json`에 저장한다. API Key 같은 secret은 `config.json`에 저장하지 않는다.

## Credentials Contract

API Key 및 인증 정보는 설정 파일과 분리해 `~/.config/convention/credentials.json`에 저장한다.

권장 함수:

- `loadCredentials(): object`
- `saveCredentials(credentials): void`
- `promptApiKey(provider): Promise<string>`
- `saveApiKey(provider, apiKey): void`
- `getApiKey(provider): string | null`

규칙:

- API Key를 화면, 로그, 에러 메시지에 출력하지 않는다.
- credentials 파일 내용을 그대로 출력하지 않는다.
- 저장 성공/실패 메시지에도 secret 원문을 포함하지 않는다.
- 가능하면 credentials 파일 권한을 사용자 읽기/쓰기 수준으로 제한한다.
- 출력이 필요하면 `[REDACTED]`로 마스킹한다.

## Function Contracts

Agent들이 서로 다른 API 모양을 만들지 않도록 아래 계약을 따른다.

- `src/config/store.js`
  - `loadConfig(): object`
  - `saveConfig(config): void`
  - `ensureConfigDir(): void`
  - `loadCredentials(): object`
  - `saveCredentials(credentials): void`
- `src/config/defaults.js`
  - `DEFAULT_CONFIG`
  - `SUPPORTED_MODES`
  - `SUPPORTED_LANGUAGES`
  - `PROVIDERS`
  - `DEFAULT_LOCAL_LLM_BASE_URL`
- `src/core/git.js`
  - `isGitRepository(): boolean`
  - `getChangedFiles(): string[]`
  - `getFullDiff(): string`
  - `getFileDiffs(files): { file: string, diff: string }[]`
  - `addAll(): void`
  - `addFile(file): void`
  - `commit(message, files?): void`
  - `push(): void`
  - `resetLastCommit(): void`
- `src/core/prompt.js`
  - `buildCommitPrompt({ diff, language, mode }): string`
- `src/core/ai.js`
  - `generateCommitMessage(prompt, config): Promise<string>`
  - `cleanAIResponse(response): string`
- `src/providers/index.js`
  - `getProvider(providerName)`
  - `generateWithProvider({ prompt, config }): Promise<string>`
  - `listProviderModels(config): Promise<string[]>`
- `src/providers/mock.js`
  - `generateCommitMessage({ prompt, config }): Promise<string>`
- `src/providers/localLLM.js`
  - `checkConnection(config): Promise<boolean>`
  - `listModels(config): Promise<string[]>`
  - `generateCommitMessage({ prompt, config }): Promise<string>`
- `src/providers/gemini.js`
  - `generateCommitMessage({ prompt, config }): Promise<string>`
  - `listModels(config): Promise<string[]>`
- `src/providers/openai-compatible.js`
  - `generateCommitMessage({ prompt, config }): Promise<string>`
  - `listModels(config): Promise<string[]>`
- `src/commands/commit.js`
  - `runDefaultCommit(): Promise<void>`
  - `runStepCommit(): Promise<void>`
  - `runBatchCommit(): Promise<void>`
- `src/commands/model.js`
  - `runModelSetup(...args): Promise<void>`
  - `setupModelInteractively(): Promise<void>`
  - `setupModelWithProvider(provider): Promise<void>`
  - `setupModelWithProviderAndAuth(provider, authType): Promise<void>`
  - `setupModelDirectly(provider, authType, modelVersion): Promise<void>`
- `src/commands/reset.js`
  - `runReset(): Promise<void>`
- `src/commands/config.js`
  - `setMode(mode): void`
  - `setLanguage(language): void`
- `src/utils/ui.js`
  - `selectProvider()`
  - `selectAuthType(provider)`
  - `selectModelVersion(models)`
  - `confirmAction(message)`
  - `promptSecret(message)`
- `src/utils/validator.js`
  - `isValidMode(mode): boolean`
  - `isValidLanguage(language): boolean`
  - `isValidProvider(provider): boolean`
  - `isValidAuthType(authType): boolean`
  - `isValidModelVersion(modelVersion): boolean`
  - `isValidBaseURL(baseURL): boolean`

## CLI Command Rules

지원 명령:

- `convention`
- `convention --step`
- `convention --batch`
- `convention --set-mode step|batch`
- `convention --language ko|en|jp|cn`
- `convention --model`
- `convention --model <provider>`
- `convention --model <provider> <authType>`
- `convention --model <provider> <authType> <modelVersion>`
- `convention --push`
- `convention --reset`
- `convention --help`, `convention -h`

옵션 우선순위:

1. 설정 명령 `--set-mode`, `--language`, `--model`은 commit flow를 실행하지 않는다.
2. `--reset`은 commit flow와 별도이며 반드시 사용자 confirm 이후 실행한다.
3. `--step`, `--batch`는 저장된 mode보다 우선한다.
4. 옵션 없는 `convention`은 config의 `mode`를 따른다.
5. `--push`는 commit 완료 후 push를 실행한다. push만 단독으로 실행할지 여부는 구현 시 명확히 문서화한다.

## Git, Security, and Data Safety

Git 명령어는 `execFileSync` 또는 `spawnSync`를 인자 배열 방식으로 실행한다. 사용자 입력, 파일 경로, 커밋 메시지를 shell 문자열에 직접 삽입하지 않는다.

허용 예시:

```js
execFileSync("git", ["diff", "HEAD"]);
execFileSync("git", ["add", file]);
execFileSync("git", ["commit", "-m", message]);
```

금지 예시:

```js
execSync(`git add ${file}`);
execSync(`git commit -m "${message}"`);
```

다음 작업은 금지한다.

- 사용자 홈 디렉토리 전체 스캔
- Git 저장소 밖의 파일 무단 읽기
- `.env`, credentials, private key 파일 내용 출력
- API Key, OAuth Token, Secret, diff 원문 로그 출력
- `git reset --hard`, `rm -rf` 등 파괴적 명령 구현
- 외부 AI API로 diff를 보내기 전 사용자 확인 또는 명시 설정 없이 전송
- 사용자 confirm 없이 `git commit` 자동 실행
- 사용자 confirm 없이 `git reset` 실행
- 테스트 목적으로 실제 사용자 Git 히스토리 변경
- `npm publish` 자동 실행

AI 호출 전 보안 Gate는 아래 순서를 따른다.

1. Git diff 추출
2. 민감 파일 제외
3. 민감정보 패턴 탐지
4. 필요 시 마스킹
5. 외부 AI 전송 여부 확인 또는 설정 정책 확인
6. AI 호출

기본 민감정보 탐지 후보는 `API_KEY=`, `SECRET=`, `TOKEN=`, `PASSWORD=`, `PRIVATE_KEY`, `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `-----BEGIN PRIVATE KEY-----`이다.

기본 diff 제외 후보는 `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `credentials.json`, `secrets.json`이다.

커밋 전 보안 Gate는 아래 순서를 따른다.

1. AI 커밋 메시지 생성
2. AI 응답 정리
3. 커밋 메시지 표시
4. 사용자 confirm
5. `git add`
6. `git commit`

`confirmBeforeCommit`의 기본값은 `true`다. AI가 메시지를 생성해도 바로 커밋하지 말고 먼저 사용자에게 보여준다.

## Push and Reset Rules

`--push` 규칙:

- commit 완료 후 `git push` 또는 `git push origin HEAD`를 argv 배열 방식으로 실행한다.
- push 실패 시 token, 원격 URL의 민감 정보, 인증 세부 정보를 출력하지 않는다.
- push 전 현재 branch 확인이 가능하면 안내에 활용한다.
- push는 Git 히스토리를 원격으로 전파하므로 실패/성공 메시지를 명확히 한다.

`--reset` 규칙:

- 반드시 사용자 confirm 이후 실행한다.
- `git reset HEAD~1`만 허용한다.
- `git reset --hard`는 구현하지 않는다.
- reset 후 변경사항은 working tree에 남는다는 점을 안내한다.
- reset 실패 시 민감 정보가 포함된 Git stderr를 그대로 출력하지 않는다.

## Prompt and Commit Message Rules

생성되는 커밋 메시지는 Conventional Commits 형식을 따른다.

- 허용 type: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
- 설정된 `language`를 prompt에 반영한다.
- `mode`가 `step`이면 파일별 diff를 기준으로 메시지를 만들고, `batch`이면 전체 diff를 기준으로 하나의 메시지를 만든다.
- AI 응답은 `git commit -m`에 넣을 수 있는 깨끗한 문자열로 정리한다.
- Provider 응답 원문 전체를 로그로 출력하지 않는다.

## Build, Test, and Development Commands

- `npm install`: local dependencies 설치
- `npm test`: 테스트 실행
- `npm run lint`: formatting 및 static rules 검사
- `node bin/convention.js --help`: CLI 진입점 로컬 확인
- `npm link`: 전역 `convention` 명령 테스트
- `convention --help`: link 이후 help 확인

scripts가 추가되거나 이름이 바뀌면 이 섹션을 같이 갱신한다. `npm publish`는 자동 실행하지 않는다.

## Testing Guidelines

테스트는 실제 사용자 환경이 아니라 격리된 환경에서 수행한다. 실제 사용자 저장소에서 자동 commit, push, reset 테스트를 수행하지 않는다. 테스트용 Git 저장소는 `fixtures/test-repo` 또는 임시 테스트 디렉터리를 사용한다.

중점 테스트 대상:

- Git command wrapper
- config persistence
- credentials persistence
- mode/language/provider/authType validation
- prompt generation
- AI response cleanup
- provider routing
- localLLM connection 및 model list parsing
- API Key 입력/저장/마스킹
- batch 및 step commit flow
- confirm 동작
- `--model` 설정 flow
- `--push` flow
- `--reset` confirm 및 soft reset flow

외부 네트워크 호출은 unit test에서 mock 처리한다. local LLM endpoint와 cloud AI provider도 기본적으로 mock한다.

2차 MVP 통합 확인 명령 후보:

- `convention --help`
- `convention --set-mode batch`
- `convention --language ko`
- `convention --model mock`
- `convention --model localLLM`
- `convention --model gemini api`
- `convention --batch`
- `convention --step`
- `convention`
- `convention --push`
- `convention --reset`

## Coding Style & Naming Conventions

- 구현 언어는 JavaScript로 한다. TypeScript 마이그레이션이 명시되기 전까지 JS를 유지한다.
- Node.js ESM을 사용한다. `package.json`에는 `"type": "module"`을 설정하고 `import/export` 문법을 사용한다.
- indentation은 2 spaces를 기본으로 한다.
- 경로 조합은 `path.join()`을 사용하고, home 경로는 `os.homedir()`로 얻는다.
- UTF-8 파일 처리와 Git 출력 처리를 명시한다.
- 한글/일본어/중국어 파일명 diff가 깨지지 않도록 Git diff에는 `-c core.quotepath=false` 사용을 고려한다.
- 직접 `console.log`를 남발하지 말고 `src/utils/logger.js`의 `success()`, `error()`, `warn()`, `info()`를 사용한다.
- command parsing은 `bin/` 또는 `src/commands/`에 둔다.
- provider-specific API detail은 `src/providers/`에 둔다.
- secret redaction은 logger 또는 auth/config 계층에서 공통 처리할 수 있도록 설계한다.

## Commit & Pull Request Guidelines

최근 히스토리는 Conventional Commit 스타일을 사용한다. `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`를 사용하고 요약은 간결한 명령형으로 작성한다.

Pull Request에는 목적, 핵심 구현 내용, 테스트 결과, 관련 이슈를 포함한다. CLI 동작을 설명하는 데 도움이 될 때만 터미널 출력이나 스크린샷을 포함한다.

## Agent Result Reporting

작업 완료 보고에는 아래 내용을 포함한다.

- 수정 또는 생성한 파일
- 구현한 주요 함수
- 실행한 테스트 명령
- 테스트 결과
- 남은 TODO
- 보안 규칙 위반 가능성 여부
- 다음 작업자가 참고해야 할 사항
