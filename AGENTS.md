# Convention CLI Agent Guidelines

## 문서 우선순위

이 저장소에서 작업하는 Agent는 `init/` 문서를 기준으로 구현한다. 판단이 충돌하면 아래 순서를 따른다.

1. `init/00_rule.md`의 보안, 사용자 데이터 보호, Git 히스토리 보호 규칙
2. `init/01_mvp-1.md`의 1차 MVP 범위와 작업 순서
3. `init/prd.md`의 제품 요구사항
4. `init/structure.md`의 모듈 구조
5. 이 `AGENTS.md`

기능 구현이 가능하더라도 보안 규칙, 사용자 데이터 보호, Git 히스토리 보호 원칙에 어긋나면 구현하지 않는다.

## Project Structure & Module Organization

현재 저장소는 기획 문서를 `init/`에 보관한다. 구현이 추가되면 아래 구조를 따른다.

- `package.json`: npm 패키지 정보, `bin` 진입점, 의존성 및 scripts 관리
- `bin/convention.js`: 실행 가능한 CLI 진입점, shebang, `commander` 옵션 파싱, command 함수 라우팅
- `src/commands/`: 사용자 명령 흐름 담당
  - `commit.js`: `runDefaultCommit()`, `runStepCommit()`, `runBatchCommit()`
  - `config.js`: `setMode()`, `setLanguage()`
  - `help.js`: `printHelp()`
  - `model.js`: 이후 `--model` Provider/Auth/Version 설정
- `src/core/`: Git 처리, prompt 생성, AI orchestration 등 핵심 로직
- `src/providers/`: `mock`, `localLLM`, `gemini`, `github-copilot`, `claude`, OpenAI-compatible provider 구현
- `src/auth/`: API Key 및 OAuth 인증 처리
- `src/config/`: config 및 credentials 저장소, 기본값, 경로 관리
- `src/utils/`: logger, validator, 공통 helper
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

초기에는 실제 외부 AI API보다 `src/providers/mock.js`를 먼저 구현한다. Mock Provider는 기본적으로 `chore: update project files`를 반환해 API 없이 Git/commit 흐름을 검증한다. `--model`, OAuth, API Key, localLLM, Gemini 등 실제 Provider 확장은 이후 단계로 분리한다.

## Build, Test, and Development Commands

현재 구현 전 단계라 `package.json`이 없을 수 있다. Node.js CLI가 scaffold되면 표준 npm scripts를 사용한다.

- `npm install`: local dependencies 설치
- `npm test`: 테스트 실행
- `npm run lint`: formatting 및 static rules 검사
- `node bin/convention.js --help`: CLI 진입점 로컬 확인
- `npm link`: 전역 `convention` 명령 테스트
- `convention --help`: link 이후 help 확인

scripts가 추가되거나 이름이 바뀌면 이 섹션을 같이 갱신한다. `npm publish`는 자동 실행하지 않는다.

## Coding Style & Naming Conventions

- 초기 구현 언어는 JavaScript로 한다. TypeScript 마이그레이션이 명시되기 전까지 JS를 유지한다.
- Node.js ESM을 사용한다. `package.json`에는 `"type": "module"`을 설정하고 `import/export` 문법을 사용한다.
- indentation은 2 spaces를 기본으로 한다. 세미콜론은 formatter 설정을 따른다.
- 경로 조합은 `path.join()`을 사용하고, home 경로는 `os.homedir()`로 얻는다.
- UTF-8 파일 처리와 Git 출력 처리를 명시한다. 한글/일본어/중국어 파일명 diff가 깨지지 않도록 Git diff에는 `-c core.quotepath=false` 사용을 고려한다.
- 직접 `console.log`를 남발하지 말고 `src/utils/logger.js`의 `success()`, `error()`, `warn()`, `info()`를 사용한다.
- command parsing은 `bin/` 또는 `src/commands/`에 둔다. provider-specific API detail은 `src/providers/`에 둔다.

## Configuration Contract

기본 설정 파일 경로는 `~/.config/convention/config.json`이다. 구현 시 문자열을 직접 이어 붙이지 말고 `os.homedir()`와 `path.join()`을 사용한다.

1차 MVP의 `DEFAULT_CONFIG`는 아래 schema를 유지한다.

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

1차 MVP에서는 `provider`, `authType`, `modelDisplayName`, `modelVersion`, `baseURL`이 `null`이어도 허용한다. 이후 `--model` 확장을 고려해 필드는 초기부터 유지한다. credentials 저장은 이후 단계에서 `~/.config/convention/credentials.json`로 분리한다.

## Function Contracts

Agent들이 서로 다른 API 모양을 만들지 않도록 아래 계약을 따른다.

- `src/config/store.js`
  - `loadConfig(): object`
  - `saveConfig(config): void`
  - `ensureConfigDir(): void`
- `src/config/defaults.js`
  - `DEFAULT_CONFIG`
  - `SUPPORTED_MODES`
  - `SUPPORTED_LANGUAGES`
- `src/core/git.js`
  - `isGitRepository(): boolean`
  - `getChangedFiles(): string[]`
  - `getFullDiff(): string`
  - `getFileDiffs(files): { file: string, diff: string }[]`
  - `addAll(): void`
  - `addFile(file): void`
  - `commit(message): void`
- `src/core/prompt.js`
  - `buildCommitPrompt({ diff, language, mode }): string`
- `src/core/ai.js`
  - `generateCommitMessage(prompt, config): Promise<string>`
  - `cleanAIResponse(response): string`
- `src/commands/commit.js`
  - `runDefaultCommit(): Promise<void>`
  - `runStepCommit(): Promise<void>`
  - `runBatchCommit(): Promise<void>`
- `src/commands/config.js`
  - `setMode(mode): void`
  - `setLanguage(language): void`
- `src/utils/validator.js`
  - `isValidMode(mode): boolean`
  - `isValidLanguage(language): boolean`

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
- 외부 AI API로 diff를 보내기 전 사용자 확인 없이 전송
- 사용자 confirm 없이 `git commit` 자동 실행
- 테스트 목적으로 실제 사용자 Git 히스토리 변경

AI 호출 전 보안 Gate는 아래 순서를 따른다.

1. Git diff 추출
2. 민감 파일 제외
3. 민감정보 패턴 탐지
4. 필요 시 마스킹
5. 외부 AI 전송 여부 확인
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

`confirmBeforeCommit`의 1차 MVP 기본값은 `true`다. AI가 메시지를 생성해도 바로 커밋하지 말고 먼저 사용자에게 보여준다.

## Prompt and Commit Message Rules

생성되는 커밋 메시지는 Conventional Commits 형식을 따른다.

- 허용 type: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
- 설정된 `language`를 prompt에 반영한다.
- `mode`가 `step`이면 파일별 diff를 기준으로 메시지를 만들고, `batch`이면 전체 diff를 기준으로 하나의 메시지를 만든다.
- AI 응답은 `git commit -m`에 넣을 수 있는 깨끗한 문자열로 정리한다.

## Testing Guidelines

테스트는 실제 사용자 환경이 아니라 격리된 환경에서 수행한다. 실제 사용자 저장소에서 자동 commit 테스트를 수행하지 않는다. 테스트용 Git 저장소는 `fixtures/test-repo` 또는 임시 테스트 디렉터리를 사용한다.

중점 테스트 대상:

- Git command wrapper
- config persistence
- mode/language validation
- prompt generation
- AI response cleanup
- provider routing
- batch 및 step commit flow
- confirm 동작

외부 네트워크 호출은 unit test에서 mock 처리한다. local LLM endpoint와 cloud AI provider도 기본적으로 mock한다.

1차 MVP 통합 확인 명령 후보:

- `npm install`
- `npm link`
- `convention --help`
- `convention -h`
- `convention --set-mode batch`
- `convention --language en`

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
