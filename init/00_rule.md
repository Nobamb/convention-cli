Agent 작업 공통 규칙 문서
Convention CLI 프로젝트 및 범용 AI Agent 운영 기준

1. 문서 목적
   본 문서는 Convention CLI 프로젝트에서 모든 AI Agent 작업에 공통 적용되는 운영 규칙이다.
   이 문서는 1차 MVP뿐 아니라 이후 기능 확장, 리팩토링, 테스트, 보안 검토 작업에도 동일하게 적용한다.
   또한 다른 프로젝트에서도 재사용할 수 있도록, 범용 Agent 작업 규칙과 Convention CLI 전용 규칙을 구분하여 관리한다.

Part A. 범용 Agent 작업 규칙

2. 규칙 우선순위
   Agent는 작업 중 판단이 필요한 상황에서 아래 우선순위를 따른다.
   2-1. 보안 규칙
   2-2. 사용자 데이터 보호
   2-3. Git 히스토리 보호
   2-4. 테스트 격리
   2-5. 기능 구현
   2-6. 코드 스타일
   2-7. 편의성 개선

기능 구현이 가능하더라도 보안 규칙 또는 사용자 데이터 보호 원칙에 어긋나면 구현하지 않는다.

3. 공통 개발 규칙
   모든 Agent는 아래 개발 규칙을 따른다.
   3-1. Node.js ESM 방식 사용
   - package.json에 "type": "module" 설정
   - import/export 문법 사용
     3-2. Git 명령어는 execFileSync 또는 spawnSync 사용
   - execSync 문자열 조합 금지
     3-3. 경로 조합은 path.join 사용
   - 문자열로 / 또는 \ 직접 조합 금지
     3-4. 설정 파일 경로는 프로젝트에서 지정한 공통 경로를 사용
     3-5. 모든 함수는 명확한 입력과 출력을 가진다.
     3-6. console.log 직접 사용은 최소화하고 logger.js 사용

3-7. 민감정보, diff 원문, API Key, OAuth Token, Secret은 로그에 출력하지 않는다.

3-8. 외부 API 호출 전 사용자 데이터 전송 여부를 확인한다.

3-9. 테스트는 실제 사용자 환경이 아니라 격리된 테스트 환경에서 수행한다.

4. 작업 금지 범위
   Agent는 아래 작업을 수행하면 안 된다.
   4-1. 사용자 홈 디렉토리 전체 스캔 금지
   4-2. Git 저장소 밖의 파일 읽기 금지
   4-3. .env, credentials, private key 파일 내용 출력 금지
   4-4. API Key, OAuth Token, Secret 값을 로그로 출력 금지
   4-5. execSync 문자열 조합 방식 사용 금지
   4-6. git reset --hard, rm -rf 등 파괴적 명령어 구현 금지
   4-7. npm publish 자동 실행 금지
   4-8. 외부 AI API로 diff를 전송하기 전 사용자 확인 없이 전송 금지
   4-9. 사용자 동의 없이 git commit 자동 실행 금지
   4-10. 테스트 목적으로 실제 사용자 Git 히스토리를 변경하는 코드 작성 금지

5. 공통 보안 원칙
   5-1. 민감정보 탐지
   AI에 보내기 전 diff에서 민감정보 패턴을 탐지해야 한다.
   탐지 후보
   API_KEY=
   SECRET=
   TOKEN=
   PASSWORD=
   PRIVATE_KEY
   DATABASE_URL
   AWS_ACCESS_KEY_ID
   -----BEGIN PRIVATE KEY-----

   처리 방식
   1. 위험 패턴 탐지
   2. 사용자에게 경고
   3. 필요 시 해당 값 마스킹
   4. 외부 AI 전송 여부 확인

5-2. Diff 제외 파일
민감할 가능성이 높은 파일은 AI 분석 대상에서 기본 제외한다.
기본 제외 후보
.env
.env.\*
_.pem
_.key
id_rsa
id_ed25519
credentials.json
secrets.json

5-3. 안전한 Git 명령어 실행
Git 명령어는 문자열 조합 방식이 아니라 인자 배열 방식으로 실행한다.
허용 예시
execFileSync("git", ["diff", "HEAD"]);
execFileSync("git", ["add", file]);
execFileSync("git", ["commit", "-m", message]);

금지 예시
execSync(`git add ${file}`);
execSync(`git commit -m "${message}"`);

사용자 입력, 파일 경로, 커밋 메시지를 쉘 문자열에 직접 삽입하지 않는다.

5-4. 사용자 확인
실제 Git 히스토리를 변경하는 작업 전에는 사용자 확인을 받는다.
예시
AI 생성 커밋 메시지:
feat: 로그인 기능 추가

이 메시지로 커밋하시겠습니까?

> Yes
> No

6. Agent 작업 결과물 제출 형식
   각 Agent는 작업 완료 후 아래 형식으로 결과를 보고한다.
   6-1. 수정/생성한 파일 목록
   6-2. 구현한 함수 목록
   6-3. 실행한 테스트 명령어
   6-4. 테스트 결과
   6-5. 남은 TODO
   6-6. 보안 규칙 위반 가능성 여부
   6-7. 다음 Agent가 참고해야 할 사항

보고 예시
수정 파일:

- src/config/store.js
- src/config/defaults.js

구현 함수:

- loadConfig()
- saveConfig()
- ensureConfigDir()

테스트:

- node scripts/test-config.js 통과

주의 사항:

- credentials 저장은 아직 구현하지 않음

7. Agent 작업 요청 템플릿
   Agent에게 작업을 요청할 때는 아래 형식을 사용한다.
   Agent 이름:

작업 목표:

수정/생성할 파일:

참조해야 할 파일:

구현해야 할 함수:

입력:

출력:

금지 사항:

보안 규칙:

완료 조건:

테스트 명령어:

예상 실패 케이스:

8. 병렬 작업과 순차 작업 기준
   8-1. 병렬 가능 작업
   아래 작업은 충돌 가능성이 낮으므로 병렬 진행이 가능하다.
   - Help 출력 Agent
   - Logger Agent
   - Validator Agent
   - Prompt 생성 Agent
   - README 초안 Agent

   8-2. 순차 작업 필요
   아래 작업은 의존성이 있으므로 순차 진행한다.
   - 설정 저장 Agent → --set-mode Agent → --language Agent
   - Safe Git Command Agent → Git diff Agent → Batch/Step Agent
   - Prompt 생성 Agent → AI 메시지 생성 Agent → Commit Agent

9. 브랜치 전략
10. main 브랜치는 안정 버전만 유지한다.
11. 각 Agent 작업은 feature/agent-name 형태의 브랜치에서 진행한다.
12. 하나의 Agent는 가능한 한 1~3개 파일만 수정한다.
13. core/git.js처럼 충돌 가능성이 큰 파일은 순차 작업으로 진행한다.
14. 작업 완료 후 PR 또는 patch 단위로 통합한다.

15. 테스트 격리 원칙
    Git 관련 테스트는 실제 프로젝트가 아니라 임시 테스트 저장소에서만 수행한다.
16. Git 관련 테스트는 실제 프로젝트가 아니라 임시 테스트 저장소에서만 수행한다.
17. 테스트 시 /tmp/convention-test-repo 또는 fixtures/test-repo를 사용한다.
18. 테스트 저장소는 매 테스트마다 새로 초기화한다.
19. 실제 사용자 저장소에서 자동 commit 테스트를 수행하지 않는다.

Part B. Convention CLI 전용 규칙

1. Convention CLI Config Schema
   Convention CLI 설정 파일은 아래 schema를 기준으로 한다.
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

1차 MVP에서는 provider, authType, modelDisplayName, modelVersion, baseURL이 null이어도 허용한다.
다만 이후 --model 기능 확장을 고려하여 해당 필드는 초기부터 유지한다.

2. 설정 파일 경로 규칙
   Convention CLI의 기본 설정 파일 경로는 아래로 통일한다.
   ~/.config/convention/config.json

구현 시 직접 문자열을 조합하지 않고 os.homedir()와 path.join()을 사용한다.

3. 함수 계약서
   Agent들이 서로 다른 방식으로 함수를 구현하지 않도록 아래 함수 계약을 따른다.

3-1. src/config/store.js
loadConfig(): object
saveConfig(config): void
ensureConfigDir(): void

3-2. src/core/git.js
isGitRepository(): boolean
getChangedFiles(): string[]
getFullDiff(): string
getFileDiffs(files): { file: string, diff: string }[]
addAll(): void
addFile(file): void
commit(message): void

3-3. src/core/prompt.js
buildCommitPrompt({ diff, language, mode }): string

3-4. src/core/ai.js
generateCommitMessage(prompt, config): Promise<string>
cleanAIResponse(response): string

3-5. src/commands/commit.js
runDefaultCommit(): Promise<void>
runStepCommit(): Promise<void>
runBatchCommit(): Promise<void>

3-6. src/commands/config.js
setMode(mode): void
setLanguage(language): void

4. Agent 작업 순서 의존성
   Convention CLI 작업에서는 아래 의존성을 따른다.
   1. CLI 라우팅 Agent는 Help 출력 Agent보다 먼저 실행한다.
   2. --set-mode Agent와 --language Agent는 설정 파일 읽기/쓰기 Agent 이후 실행한다.
   3. Git diff Agent는 Safe Git Command Agent 규칙을 반드시 따른다.
   4. Batch/Step Agent는 Git diff, Prompt, AI 메시지 생성 Agent가 끝난 뒤 실행한다.
   5. Git commit Agent는 Confirm Agent가 끝난 뒤 연결한다.

5. 보안 Gate 실행 순서
   5-1. AI 호출 전 보안 Gate
   AI 호출 전에는 반드시 아래 순서를 따른다.
   Git diff 추출
   ↓
   Diff 제외 파일 필터링
   ↓
   민감정보 탐지
   ↓
   필요 시 마스킹
   ↓
   외부 AI 전송 여부 확인
   ↓
   AI 호출

   5-2. 커밋 전 보안 Gate
   커밋 전에는 반드시 아래 순서를 따른다.
   AI 커밋 메시지 생성
   ↓
   AI 응답 정리
   ↓
   커밋 메시지 표시
   ↓
   사용자 confirm
   ↓
   git add
   ↓
   git commit

6. Commit Confirm 기본 정책
   1차 MVP 기본값은 아래와 같다.
   {
   "confirmBeforeCommit": true
   }

AI가 메시지를 생성하면 바로 커밋하지 않고 사용자에게 먼저 보여준다.
향후 옵션으로 아래 기능을 추가할 수 있다.
--yes
--no-confirm

7. Mock AI Provider 우선 구현 전략
   처음부터 실제 AI API를 연결하지 않는다.
   초기에는 Mock AI Provider를 먼저 구현한다.

   7-1. Mock AI Provider 구현
   - 항상 "chore: update project files" 반환

   7-2. Prompt 생성 확인

   7-3. commit flow 연결

   7-4. 이후 localLLM 또는 Gemini API 연결

   추천 파일:
   src/providers/mock.js

   Mock Provider를 사용하면 AI API 없이 Git/commit 흐름을 먼저 검증할 수 있다.

8. 통합 테스트 시나리오
   8-1. Phase 1 테스트
   npm install
   npm link
   convention --help
   convention -h
   8-2. Phase 2 테스트
   convention --set-mode batch
   convention --set-mode step
   convention --language en
   convention --language ko
   convention --set-mode fast

   확인 사항:
   - 정상 mode 값 저장
   - 정상 language 값 저장
   - 잘못된 mode 입력 시 에러 출력

   8-3. Phase 3 테스트
   - Git 저장소 밖에서 convention 실행
   - Git 저장소 안에서 변경 파일 목록 확인
   - 한글 파일명 diff 확인
   - .env 파일 제외 확인

   8-4. Phase 4 테스트
   - mock diff로 prompt 생성
   - mock AI 응답 정리
   - 빈 AI 응답 예외 처리

   8-5. Phase 5 테스트
   convention --batch
   convention --step
   convention

   확인 사항:
   - commit 전 confirm 동작 확인
   - 실제 테스트는 임시 Git 저장소에서만 수행

9. 공통 실패 케이스 및 처리 기준
   아래 실패 케이스를 고려해야 한다.
10. Git 저장소가 아닌 폴더에서 실행
11. 변경 사항이 없음
12. 설정 파일 JSON이 깨져 있음
13. 지원하지 않는 mode 입력
14. 지원하지 않는 language 입력
15. localLLM 서버 연결 실패
16. AI 응답이 비어 있음
17. diff에 민감정보가 포함됨
18. git commit 실패
19. 사용자가 confirm 단계에서 취소함

각 실패 케이스는 사용자에게 명확한 메시지를 출력하고, 가능한 경우 안전하게 종료한다.

20. Git Diff Agent 작업 카드 예시
    아래는 보안 규칙을 적용한 Agent 작업 카드 예시다.
    Agent 이름:
    Git diff Agent

작업 목표:
현재 Git 저장소의 변경 파일 목록과 diff를 안전하게 추출한다.

수정/생성할 파일:
src/core/git.js

구현해야 할 함수:

- isGitRepository()
- getChangedFiles()
- getFullDiff()
- getFileDiffs(files)

보안 규칙:

- execSync 문자열 조합 금지
- execFileSync("git", [...args]) 사용
- core.quotepath=false 적용
- encoding: "utf-8" 적용
- 파일 경로를 쉘 문자열에 직접 넣지 말 것

금지 사항:

- 사용자 파일 내용을 로그에 그대로 출력하지 말 것
- .env, _.pem, _.key 파일 diff를 기본 출력하지 말 것

완료 조건:

- Git 저장소 여부를 true/false로 반환
- 변경 파일 목록을 배열로 반환
- 전체 diff를 문자열로 반환
- 파일별 diff를 배열로 반환

테스트 명령어:
node scripts/test-git.js
