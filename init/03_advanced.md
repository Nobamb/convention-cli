# 3차 고도화 개발 오케스트레이션 분해안

## 전제

3차 고도화는 1차·2차 MVP 위에 올라가는 단계입니다.
즉, 아래 상태가 이미 완료되었다고 가정합니다.
1차 MVP 완료 상태:

- convention 기본 실행
- --step
- --batch
- --set-mode
- --language
- --help
- 설정 파일 저장/로드
- Git diff 분석
- Mock 또는 실제 Provider 기반 커밋 메시지 생성
- confirm 후 git commit

2차 MVP 완료 상태:

- --model
- Provider 구조
- localLLM 연동
- API Key 인증
- credentials 저장
- Provider 라우팅
- --push
- --reset

3차 고도화는 이제 제품 완성도, 협업 기능, 대규모 변경 대응, PR 자동화, OAuth, 팀 컨벤션 관리, CI 연동을 추가하는 단계입니다.

## 1. 3차 고도화 기준 기능

PRD에 명시된 3차 고도화 범위는 아래 기능들로 정리할 수 있습니다.

1. OAuth 인증
2. 커밋 메시지 미리보기
3. 커밋 전 사용자 승인 고도화
4. AI 생성 메시지 재생성
5. 파일 변경 사항 자동 그룹핑
6. 대용량 diff 요약 처리
7. 팀별 커밋 컨벤션 템플릿
8. GitHub PR 제목 및 설명 자동 생성
9. npm 자동 업데이트 알림
10. GitHub Actions 연동

## 2. 3차 고도화 핵심 목표

3차 고도화의 목표는 단순 기능 추가가 아닙니다.
2차 MVP까지는 “커밋 자동화 CLI”였다면, 3차부터는 아래 수준을 목표로 합니다.
AI 기반 Git 커밋 자동화 도구
→ 팀 컨벤션 대응 가능
→ 대규모 변경 대응 가능
→ PR 생성까지 확장 가능
→ OAuth 기반 인증 UX 제공
→ CI/GitHub Actions 환경에서도 사용 가능
→ 사용자가 더 안전하게 검토·수정·재생성 가능

## 3. 전체 개발 순서 요약

3차 고도화는 아래 순서로 진행하는 것이 좋습니다.

1. 2차 MVP 회귀 테스트
2. Config schema versioning 추가
3. 커밋 메시지 미리보기 구조 구현
4. confirm UX 고도화
5. AI 메시지 재생성 기능 구현
6. 커밋 메시지 수동 수정 기능 구현
7. 대용량 diff 감지 구현
8. diff chunking 구현
9. chunk별 요약 구현
10. 요약 기반 최종 커밋 메시지 생성 구현
11. 파일 변경 사항 자동 그룹핑 구현
12. 그룹별 커밋 플로우 구현
13. 팀 컨벤션 템플릿 schema 구현
14. 템플릿 로드/검증/적용 구현
15. OAuth 기본 아키텍처 구현
16. OAuth PKCE/state/callback 구현
17. OAuth token 저장/갱신 구현
18. GitHub PR 제목/본문 생성 구현
19. GitHub PR 생성 또는 PR 문서 출력 구현
20. npm 최신 버전 확인 및 업데이트 알림 구현
21. GitHub Actions/CI 모드 구현
22. 전체 통합 테스트

## 4. 3차 고도화 Phase 구성

### Phase 0. 2차 MVP 회귀 확인

A. 2차 MVP 회귀 테스트 Agent

목표:
3차 기능 추가 전에 기존 기능이 깨지지 않았는지 확인

### Phase 1. 사용자 검토 UX 고도화

B. Config Versioning Agent
C. Commit Preview Agent
D. Confirm UX Agent
E. Regenerate Agent
F. Manual Edit Agent
G. Commit Decision Flow Agent

목표:
AI 메시지를 바로 커밋하지 않고, 미리보기/재생성/수동수정/취소가 가능한 구조 구현

### Phase 2. 대용량 diff 처리

H. Large Diff Detector Agent
I. Diff Chunking Agent
J. Chunk Summary Agent
K. Summary Merge Agent
L. Large Diff Commit Message Agent

목표:
토큰 제한을 초과할 수 있는 큰 변경사항도 안정적으로 처리

### Phase 3. 파일 변경 사항 자동 그룹핑

M. Changed File Classifier Agent
N. Diff Intent Analyzer Agent
O. File Grouping Agent
P. Grouping Preview Agent
Q. Grouped Commit Flow Agent

목표:
서로 다른 목적의 변경 파일을 AI가 그룹으로 묶고 그룹별 커밋 가능

### Phase 4. 팀 컨벤션 템플릿

R. Template Schema Agent
S. Template Load Agent
T. Template Validation Agent
U. Template Apply Agent
V. Template Command Agent

목표:
팀별 커밋 타입, 메시지 형식, 언어, prefix 규칙을 적용 가능

### Phase 5. OAuth 인증

W. OAuth Architecture Agent
X. OAuth Provider Config Agent
Y. OAuth Local Callback Agent
Z. OAuth PKCE State Agent
AA. OAuth Token Store Agent
AB. OAuth Refresh Agent
AC. OAuth Provider Integration Agent

목표:
API Key 없이 브라우저 로그인 기반 인증 가능

### Phase 6. PR 자동화

AD. PR Prompt Agent
AE. PR Title Generator Agent
AF. PR Body Generator Agent
AG. GitHub Remote Detector Agent
AH. GitHub PR Integration Agent
AI. PR Preview Agent

목표:
커밋 diff 또는 commit history 기반으로 PR 제목과 설명 자동 생성

### Phase 7. npm 업데이트 알림

AJ. Package Version Agent
AK. npm Registry Check Agent
AL. Update Notification Agent
AM. Update Policy Agent

목표:
사용자가 오래된 convention-cli 버전을 사용 중이면 업데이트 안내

### Phase 8. GitHub Actions / CI 연동

AN. CI Mode Agent
AO. Non-interactive Mode Agent
AP. GitHub Actions Output Agent
AQ. Workflow Example Agent
AR. CI Security Agent

목표:
GitHub Actions 환경에서도 안전하게 사용할 수 있는 비대화형 실행 모드 제공

### Phase 9. 통합 검증

AS. 3차 통합 테스트 Agent
AT. Regression Test Agent
AU. Security Review Agent
AV. Documentation Update Agent

목표:
1차·2차·3차 기능 전체 회귀 테스트 및 문서화 완료

## 5. 3차 고도화 Agent 상세 분해

### A. 2차 MVP 회귀 테스트 Agent

역할
3차 고도화 작업 전에 2차 MVP 기능이 정상 동작하는지 확인합니다.
담당 작업

1. convention 기본 실행 확인
2. --step 확인
3. --batch 확인
4. --model 확인
5. localLLM Provider 확인
6. API Key Provider 확인
7. --push 확인
8. --reset 확인
9. credentials 보안 확인
10. confirm 동작 확인

테스트 명령어
convention --help
convention --set-mode batch
convention --language ko
convention --model mock
convention --batch
convention --step
convention --reset

완료 기준
2차 MVP 기능이 모두 정상 동작하고, 3차 작업 시작 전 안정 상태가 확인된다.

### B. Config Versioning Agent

역할
3차부터 설정 항목이 많아지므로 config schema 버전을 관리합니다.
구현 대상 파일
src/config/defaults.js
src/config/store.js
src/config/migration.js

담당 작업

1. configVersion 필드 추가
2. 기존 config 파일 로드 시 버전 확인
3. 구버전 config 자동 migration
4. 누락 필드 기본값 보정
5. migration 실패 시 안전한 에러 출력

Config 예시
{
"configVersion": 3,
"mode": "step",
"language": "ko",
"provider": "localLLM",
"authType": "none",
"modelDisplayName": "qwen2.5:7b",
"modelVersion": "qwen2.5:7b",
"baseURL": "http://localhost:11434/v1",
"confirmBeforeCommit": true,
"previewBeforeCommit": true,
"template": null
}

완료 기준
기존 1차/2차 config가 있어도 3차 config 구조로 안전하게 보정된다.

### C. Commit Preview Agent

역할
AI가 생성한 커밋 메시지를 실제 커밋 전에 보여줍니다.
구현 대상 파일
src/commands/commit.js
src/utils/ui.js
src/utils/logger.js

담당 작업

1. 생성된 커밋 메시지 출력
2. 변경 파일 요약 출력
3. mode 정보 출력
4. provider 정보 출력
5. step/batch 모두에서 preview 지원

출력 예시
AI가 생성한 커밋 메시지:

feat: 사용자 로그인 흐름 추가

변경 파일:

- src/auth/login.js
- src/pages/LoginPage.jsx

Provider:
localLLM / qwen2.5:7b

완료 기준
커밋 전 사용자가 AI 생성 메시지와 변경 파일을 확인할 수 있다.

### D. Confirm UX Agent

역할
커밋 전 사용자 선택지를 고도화합니다.
구현 대상 파일
src/utils/ui.js
src/commands/commit.js

담당 작업

1. Yes/No 단순 confirm을 다중 선택으로 확장
2. Commit 선택
3. Regenerate 선택
4. Edit manually 선택
5. Cancel 선택
6. 선택 결과를 commit flow로 전달

UI 예시
이 메시지로 커밋하시겠습니까?

> Commit
> Regenerate
> Edit manually
> Cancel

완료 기준
사용자가 커밋, 재생성, 수동 수정, 취소 중 하나를 선택할 수 있다.

### E. Regenerate Agent

역할
AI 커밋 메시지가 마음에 들지 않을 때 다시 생성합니다.
구현 대상 파일
src/commands/commit.js
src/core/ai.js
src/core/prompt.js

담당 작업

1. 기존 diff 유지
2. 기존 prompt에 regeneration instruction 추가
3. 이전 생성 메시지 전달
4. 재생성 횟수 제한
5. 재생성 후 다시 preview 표시

재생성 프롬프트 추가 조건
이전 메시지와 다른 표현으로 다시 작성해 주세요.
의미는 유지하되 더 명확한 커밋 메시지를 생성해 주세요.

기본 제한
maxRegenerateCount: 3

완료 기준
사용자가 Regenerate를 선택하면 새 커밋 메시지가 생성되고 다시 선택 UI로 돌아온다.

### F. Manual Edit Agent

역할
사용자가 AI 커밋 메시지를 직접 수정할 수 있게 합니다.
구현 대상 파일
src/utils/ui.js
src/commands/commit.js

담당 작업

1. 기존 AI 메시지를 기본값으로 입력창 제공
2. 사용자가 직접 수정
3. 빈 메시지 입력 방지
4. 수정된 메시지로 commit 진행

UI 예시
커밋 메시지를 수정하세요:
feat: 사용자 로그인 흐름 추가

완료 기준
사용자가 직접 수정한 커밋 메시지로 git commit이 실행된다.

### G. Commit Decision Flow Agent

역할
Preview, Confirm, Regenerate, Edit, Cancel 흐름을 하나로 연결합니다.
구현 대상 파일
src/commands/commit.js
src/utils/ui.js

담당 작업

1. AI 메시지 생성
2. Preview 출력
3. 사용자 선택 받기
4. Commit 선택 시 git add/commit
5. Regenerate 선택 시 AI 재호출
6. Edit 선택 시 수동 입력
7. Cancel 선택 시 안전 종료

완료 기준
batch/step 모두 동일한 결정 흐름을 사용한다.

### H. Large Diff Detector Agent

역할
diff 크기가 너무 큰 경우 대용량 처리 플로우로 전환합니다.
구현 대상 파일
src/core/diff.js
src/core/git.js
src/config/defaults.js

담당 작업

1. diff 문자 길이 측정
2. 파일 수 측정
3. line count 측정
4. 설정 기준 초과 여부 판단
5. 대용량 diff 플래그 반환

기본 기준 예시
{
"largeDiffThreshold": {
"maxCharacters": 30000,
"maxFiles": 30,
"maxLines": 1200
}
}

완료 기준
큰 diff를 감지하면 일반 AI 호출 대신 large diff flow로 전환된다.

### I. Diff Chunking Agent

역할
대용량 diff를 AI가 처리 가능한 작은 단위로 나눕니다.
구현 대상 파일
src/core/diff.js

담당 작업

1. 파일 단위 chunk 생성
2. 너무 큰 파일 diff는 line 기준 chunk 생성
3. chunk index 부여
4. 각 chunk에 파일명 metadata 포함
5. 빈 chunk 제거

반환 예시
[
{
index: 1,
file: "src/auth/login.js",
diff: "..."
},
{
index: 2,
file: "src/pages/LoginPage.jsx",
diff: "..."
}
]

완료 기준
대용량 diff가 여러 chunk 배열로 분리된다.

### J. Chunk Summary Agent

역할
각 diff chunk를 AI에게 보내 요약합니다.
구현 대상 파일
src/core/ai.js
src/core/prompt.js
src/core/diff.js

담당 작업

1. chunk summary prompt 생성
2. chunk별 AI 호출
3. 요약 결과 저장
4. 실패 chunk 재시도
5. 요약 실패 시 fallback 처리

Chunk 요약 prompt 조건
이 diff chunk의 변경 목적과 주요 변경 내용을 짧게 요약해 주세요.
커밋 메시지는 아직 작성하지 말고 요약만 작성해 주세요.

완료 기준
각 chunk가 짧은 변경 요약으로 변환된다.

### K. Summary Merge Agent

역할
chunk별 요약을 하나의 전체 변경 요약으로 병합합니다.
구현 대상 파일
src/core/diff.js
src/core/prompt.js

담당 작업

1. chunk summary 목록 입력
2. 중복 요약 제거
3. 파일별/기능별 변경 의도 병합
4. 최종 commit prompt에 넣을 summary 생성

완료 기준
대용량 diff 전체를 대표하는 요약 문자열이 생성된다.

### L. Large Diff Commit Message Agent

역할
원본 diff 대신 병합 요약을 기반으로 커밋 메시지를 생성합니다.
구현 대상 파일
src/core/ai.js
src/core/prompt.js
src/commands/commit.js

담당 작업

1. Large diff 여부 확인
2. chunk 요약 생성
3. summary merge
4. summary 기반 commit message prompt 생성
5. AI 커밋 메시지 생성

완료 기준
대용량 diff에서도 AI 커밋 메시지가 안정적으로 생성된다.

### M. Changed File Classifier Agent

역할
변경 파일을 유형별로 분류합니다.
구현 대상 파일
src/core/grouping.js
src/core/git.js

분류 기준 예시

- source
- test
- docs
- config
- style
- dependency
- generated

담당 작업

1. 파일 경로 기반 1차 분류
2. 확장자 기반 분류
3. package.json, README.md 등 특수 파일 분류
4. 테스트 파일 감지
5. docs 파일 감지

완료 기준
변경 파일 목록이 유형별 metadata를 가진 배열로 변환된다.

### N. Diff Intent Analyzer Agent

역할
각 파일 diff의 변경 의도를 분석합니다.
구현 대상 파일
src/core/grouping.js
src/core/prompt.js
src/core/ai.js

담당 작업

1. 파일별 diff 입력
2. 변경 의도 분석 prompt 생성
3. AI 또는 rule 기반 intent 추출
4. feat/fix/refactor/docs/test/chore 후보 추정

반환 예시
{
file: "src/auth/login.js",
intent: "feat",
summary: "로그인 인증 흐름 추가"
}

완료 기준
각 파일별 변경 의도와 요약이 생성된다.

### O. File Grouping Agent

역할
파일들을 변경 목적별 그룹으로 묶습니다.
구현 대상 파일
src/core/grouping.js

담당 작업

1. 파일 유형 기반 그룹 후보 생성
2. intent 기반 그룹 후보 생성
3. 관련 파일 묶기
4. 너무 작은 그룹 병합
5. 그룹별 대표 type 추정

반환 예시
[
{
groupName: "login-feature",
type: "feat",
files: ["src/auth/login.js", "src/pages/LoginPage.jsx"]
},
{
groupName: "docs-update",
type: "docs",
files: ["README.md"]
}
]

완료 기준
변경 파일이 하나 이상의 커밋 그룹으로 나뉜다.

### P. Grouping Preview Agent

역할
AI가 제안한 파일 그룹을 사용자에게 보여줍니다.
구현 대상 파일
src/utils/ui.js
src/commands/commit.js

UI 예시
AI가 다음과 같이 커밋 그룹을 제안했습니다.

Group 1: feat / login-feature

- src/auth/login.js
- src/pages/LoginPage.jsx

Group 2: docs / docs-update

- README.md

이 그룹으로 커밋하시겠습니까?

> Yes
> Edit manually
> Use batch instead
> Cancel

완료 기준
사용자가 그룹핑 결과를 확인하고 승인/취소할 수 있다.

### Q. Grouped Commit Flow Agent

역할
그룹별로 커밋 메시지를 생성하고 커밋합니다.
구현 대상 파일
src/commands/commit.js
src/core/grouping.js
src/core/git.js

담당 작업

1. 그룹별 파일 목록 확인
2. 그룹별 diff 생성
3. 그룹별 commit prompt 생성
4. 그룹별 AI 메시지 생성
5. 그룹별 preview/confirm
6. 그룹별 git add
7. 그룹별 git commit

완료 기준
자동 그룹핑 기반으로 여러 개의 의미 있는 커밋이 생성된다.

### R. Template Schema Agent

역할
팀별 커밋 컨벤션 템플릿 schema를 정의합니다.
구현 대상 파일
src/templates/schema.js
src/config/defaults.js

템플릿 예시
{
"name": "default",
"language": "ko",
"format": "{type}: {message}",
"types": ["feat", "fix", "refactor", "docs", "test", "chore"],
"rules": {
"maxLength": 72,
"requireScope": false,
"allowEmoji": false
}
}

완료 기준
템플릿 구조가 명확히 정의되고 기본 템플릿이 제공된다.

### S. Template Load Agent

역할
프로젝트 또는 사용자 홈 디렉토리에서 템플릿을 불러옵니다.
구현 대상 파일
src/templates/loader.js
src/config/store.js

검색 순서

1. 프로젝트 루트 .convention/template.json
2. 프로젝트 루트 .conventionrc
3. 사용자 홈 ~/.config/convention/template.json
4. 기본 템플릿

완료 기준
프로젝트별 템플릿이 있으면 우선 적용되고, 없으면 기본 템플릿이 적용된다.

### T. Template Validation Agent

역할
템플릿이 올바른지 검증합니다.
구현 대상 파일
src/templates/validator.js
src/utils/validator.js

담당 작업

1. 필수 필드 확인
2. types 배열 검증
3. format 문자열 검증
4. language 검증
5. maxLength 검증
6. 잘못된 템플릿 fallback 처리

완료 기준
잘못된 템플릿이 있어도 CLI가 죽지 않고 기본 템플릿으로 fallback한다.

### U. Template Apply Agent

역할
커밋 메시지 생성 prompt에 팀 템플릿을 반영합니다.
구현 대상 파일
src/core/prompt.js
src/templates/loader.js

담당 작업

1. template 로드
2. prompt에 허용 type 반영
3. format 규칙 반영
4. language 반영
5. maxLength 반영

완료 기준
AI가 팀 템플릿 규칙에 맞는 커밋 메시지를 생성한다.

### V. Template Command Agent

역할
템플릿 관련 명령어를 추가합니다.
구현 대상 파일
bin/convention.js
src/commands/template.js

명령어 후보
convention --template
convention --template init
convention --template show
convention --template validate

완료 기준
팀 컨벤션 템플릿을 생성, 확인, 검증할 수 있다.

### W. OAuth Architecture Agent

역할
OAuth 인증 전체 구조를 설계하고 공통 모듈을 만듭니다.
구현 대상 파일
src/auth/oauth.js
src/auth/oauthProviders.js
src/config/store.js

담당 작업

1. OAuth Provider별 설정 구조 정의
2. authorization URL 생성 구조 정의
3. callback 처리 구조 정의
4. token 저장 구조 정의
5. refresh 구조 정의

완료 기준
Provider별 OAuth 구현이 공통 구조 위에서 확장 가능하다.

### X. OAuth Provider Config Agent

역할
OAuth Provider별 client 설정을 관리합니다.
구현 대상 파일
src/auth/oauthProviders.js

설정 예시
export const OAUTH_PROVIDERS = {
github: {
authUrl: "...",
tokenUrl: "...",
scopes: ["..."]
},
gemini: {
authUrl: "...",
tokenUrl: "...",
scopes: ["..."]
}
};

완료 기준
Provider별 OAuth URL과 scope를 분리 관리할 수 있다.

### Y. OAuth Local Callback Agent

역할
CLI OAuth 인증을 위한 localhost callback 서버를 구현합니다.
구현 대상 파일
src/auth/oauth.js

담당 작업

1. 임시 localhost 서버 실행
2. 랜덤 port 사용
3. callback path 처리
4. authorization code 수신
5. 성공 후 서버 종료
6. timeout 처리

완료 기준
브라우저 인증 후 CLI가 authorization code를 수신한다.

### Z. OAuth PKCE State Agent

역할
OAuth 보안에 필요한 PKCE와 state 검증을 구현합니다.
구현 대상 파일
src/auth/oauth.js
src/auth/security.js

담당 작업

1. code_verifier 생성
2. code_challenge 생성
3. state 생성
4. callback state 검증
5. 검증 실패 시 토큰 요청 차단

완료 기준
OAuth 인증 과정에서 PKCE와 state 검증이 적용된다.

### AA. OAuth Token Store Agent

역할
OAuth access token과 refresh token을 안전하게 저장합니다.
구현 대상 파일
src/config/store.js
src/auth/oauth.js

담당 작업

1. credentials.json에 token 저장
2. provider별 token 분리
3. token 출력 금지
4. 파일 권한 제한
5. 만료 시간 저장

완료 기준
OAuth token이 credentials.json에 저장되고 로그에 노출되지 않는다.

### AB. OAuth Refresh Agent

역할
access token 만료 시 refresh token으로 갱신합니다.
구현 대상 파일
src/auth/oauth.js
src/core/ai.js

담당 작업

1. token 만료 여부 확인
2. refresh token 존재 여부 확인
3. token refresh 요청
4. 새 token 저장
5. refresh 실패 시 재로그인 안내

완료 기준
OAuth token 만료 시 자동 갱신 또는 안전한 재로그인 안내가 동작한다.

### AC. OAuth Provider Integration Agent

역할
OAuth 인증 정보를 실제 Provider 호출에 연결합니다.
구현 대상 파일
src/providers/index.js
src/providers/gemini.js
src/providers/github-copilot.js
src/auth/oauth.js

담당 작업

1. authType oauth일 때 OAuth token 로드
2. Provider 요청 Authorization header 구성
3. token 만료 시 refresh 호출
4. 인증 실패 처리

완료 기준
OAuth 방식으로 설정된 Provider가 저장된 token을 사용해 요청한다.

### AD. PR Prompt Agent

역할
PR 제목과 본문 생성을 위한 prompt를 만듭니다.
구현 대상 파일
src/core/prPrompt.js
src/core/git.js

입력 데이터

- 현재 브랜치명
- base branch
- commit log
- diff summary
- 변경 파일 목록

완료 기준
PR 제목/본문 생성을 위한 prompt가 생성된다.

### AE. PR Title Generator Agent

역할
AI로 PR 제목을 생성합니다.
구현 대상 파일
src/core/pr.js
src/core/ai.js

출력 예시
feat: add AI-based commit generation flow

완료 기준
현재 변경사항 또는 커밋 목록 기반 PR 제목이 생성된다.

### AF. PR Body Generator Agent

역할
AI로 PR 본문을 생성합니다.
구현 대상 파일
src/core/pr.js

PR 본문 구조 예시

#### Summary

- AI 기반 커밋 메시지 생성 흐름 추가
- Provider 설정 구조 개선

#### Changes

- Added model setup command
- Added localLLM provider

#### Test

- convention --batch
- convention --model localLLM

완료 기준
PR 설명이 markdown 형식으로 생성된다.

### AG. GitHub Remote Detector Agent

역할
현재 Git 저장소가 GitHub remote를 사용하는지 확인합니다.
구현 대상 파일
src/core/git.js
src/core/github.js

담당 작업

1. git remote -v 확인
2. origin URL 파싱
3. owner/repo 추출
4. GitHub URL 여부 확인
5. GitHub가 아니면 PR 생성 대신 문서 출력

완료 기준
현재 저장소의 GitHub owner/repo 정보를 추출한다.

### AH. GitHub PR Integration Agent

역할
GitHub CLI 또는 GitHub API를 통해 PR을 생성합니다.
구현 대상 파일
src/core/github.js
src/commands/pr.js

구현 방식 후보

1. GitHub CLI gh 사용
2. GitHub REST API 사용
3. 3차 MVP에서는 우선 PR 제목/본문 출력만 지원

권장 순서

1. PR 제목/본문 생성
2. 터미널에 출력
3. gh CLI 설치 여부 확인
4. 사용자가 동의하면 gh pr create 실행

완료 기준
PR 제목/본문을 생성하고, 가능한 경우 GitHub PR 생성까지 연결한다.

### AI. PR Preview Agent

역할
PR 생성 전 제목과 본문을 미리 보여줍니다.
구현 대상 파일
src/utils/ui.js
src/commands/pr.js

UI 예시
생성된 PR 제목:
feat: add provider-based AI commit flow

생성된 PR 본문:
...

이 내용으로 PR을 생성하시겠습니까?

> Create PR
> Edit manually
> Print only
> Cancel

완료 기준
PR 생성 전 사용자가 내용을 확인하고 선택할 수 있다.

### AJ. Package Version Agent

역할
현재 설치된 convention-cli 버전을 확인합니다.
구현 대상 파일
src/core/version.js
package.json

담당 작업

1. 현재 package.json version 읽기
2. 실행 중인 CLI version 출력 가능
3. convention --version 연결

완료 기준
convention --version으로 현재 버전을 확인할 수 있다.

### AK. npm Registry Check Agent

역할
npm registry에서 최신 버전을 확인합니다.
구현 대상 파일
src/core/update.js

담당 작업

1. npm registry API 호출
2. latest version 확인
3. 현재 version과 비교
4. 네트워크 실패 시 조용히 무시
5. 하루 1회 이하로 체크 제한

완료 기준
현재 버전보다 최신 버전이 있는지 확인할 수 있다.

### AL. Update Notification Agent

역할
새 버전이 있을 때 사용자에게 업데이트를 안내합니다.
구현 대상 파일
src/core/update.js
src/utils/logger.js

출력 예시
⚠️ convention-cli 새 버전이 있습니다.
현재 버전: 1.2.0
최신 버전: 1.3.0

업데이트:
npm install -g convention-cli@latest

완료 기준
사용자 작업을 방해하지 않는 방식으로 업데이트 안내가 표시된다.

### AM. Update Policy Agent

역할
업데이트 확인 정책을 설정합니다.
구현 대상 파일
src/config/defaults.js
src/core/update.js

설정 예시
{
"updateCheck": true,
"lastUpdateCheckAt": "2026-05-14T00:00:00.000Z"
}

완료 기준
매 실행마다 npm registry를 호출하지 않고 설정된 주기에 따라 확인한다.

### AN. CI Mode Agent

역할
GitHub Actions 같은 CI 환경에서 동작할 수 있도록 CI mode를 추가합니다.
구현 대상 파일
bin/convention.js
src/config/defaults.js
src/utils/env.js

감지 기준
CI=true
GITHUB_ACTIONS=true

완료 기준
CI 환경에서 interactive prompt가 자동으로 비활성화된다.

### AO. Non-interactive Mode Agent

역할
CI에서 사용할 비대화형 옵션을 구현합니다.
구현 대상 파일
bin/convention.js
src/commands/commit.js

명령어 후보
convention --batch --yes
convention --batch --no-interactive
convention --pr --print-only

담당 작업

1. --yes 옵션 처리
2. --no-interactive 옵션 처리
3. prompt 호출 금지
4. 필요한 값이 없으면 명확한 에러 출력

완료 기준
CI 환경에서 사용자 입력 없이 명령어가 실행 또는 안전하게 실패한다.

### AP. GitHub Actions Output Agent

역할
GitHub Actions에서 사용할 수 있는 output을 생성합니다.
구현 대상 파일
src/utils/githubActions.js
src/commands/pr.js

output 예시
commit_message=feat: add login flow
pr_title=feat: add AI commit generation
pr_body=...

완료 기준
GitHub Actions에서 다음 step이 convention 결과를 사용할 수 있다.

### AQ. Workflow Example Agent

역할
GitHub Actions 사용 예시 문서를 제공합니다.
구현 대상 파일
docs/github-actions.md
README.md

예시
name: Convention CLI

on:
pull_request:

jobs:
convention:
runs-on: ubuntu-latest
steps: - uses: actions/checkout@v4 - run: npm install -g convention-cli - run: convention --pr --print-only --no-interactive

완료 기준
사용자가 GitHub Actions에서 convention-cli를 쓰는 방법을 문서로 확인할 수 있다.

### AR. CI Security Agent

역할
CI 환경에서 민감정보가 노출되지 않도록 방어합니다.
구현 대상 파일
src/utils/logger.js
src/core/ai.js
src/auth/apiKey.js

담당 작업

1. CI 로그에 token 출력 금지
2. GitHub Actions secret masking 안내
3. credentials 파일 사용 제한
4. 환경변수 기반 API Key 지원 검토
5. PR from fork 환경 주의 안내

완료 기준
CI 환경에서 secret이 로그로 노출되지 않는다.

### AS. 3차 통합 테스트 Agent

역할
3차 기능 전체를 통합 검증합니다.
담당 작업

1. commit preview 테스트
2. regenerate 테스트
3. manual edit 테스트
4. large diff 테스트
5. grouping 테스트
6. template 테스트
7. OAuth mock 테스트
8. PR 생성 테스트
9. update check 테스트
10. CI mode 테스트

완료 기준
3차 기능이 각각 독립적으로, 그리고 기존 commit flow와 함께 정상 동작한다.

### AT. Regression Test Agent

역할
1차·2차 기능이 3차 변경으로 깨지지 않았는지 확인합니다.
테스트 대상

1. convention
2. --step
3. --batch
4. --set-mode
5. --language
6. --model
7. localLLM
8. API Key Provider
9. --push
10. --reset

완료 기준
1차·2차 기능이 모두 이전과 동일하게 동작한다.

### AU. Security Review Agent

역할
3차 기능 추가 후 전체 보안 검토를 진행합니다.
검토 항목

1. OAuth state/PKCE 검증
2. token 로그 출력 여부
3. credentials 저장 위치
4. diff 외부 전송 확인
5. large diff chunk 로그 출력 여부
6. PR body에 secret 포함 가능성
7. CI secret 노출 여부
8. reset/push confirm 정책

완료 기준
보안 규칙 위반 가능성이 있는 부분이 정리되고 수정된다.

### AV. Documentation Update Agent

역할
3차 고도화 기능을 README와 docs에 반영합니다.
구현 대상 파일
README.md
docs/model.md
docs/oauth.md
docs/templates.md
docs/pr.md
docs/github-actions.md

담당 작업

1. preview/regenerate/edit 사용법 추가
2. large diff 처리 설명 추가
3. grouping 설명 추가
4. template 사용법 추가
5. OAuth 설정 문서 추가
6. PR 생성 문서 추가
7. GitHub Actions 문서 추가

완료 기준
사용자가 3차 기능을 문서만 보고 사용할 수 있다.

## 6. 3차 고도화 최소 파일 매핑

bin/convention.js

- --template
- --pr
- --yes
- --no-interactive
- --version
- 기존 명령어 확장

src/commands/commit.js

- preview/confirm/regenerate/edit flow
- large diff flow
- grouping flow

src/commands/template.js

- template init/show/validate

src/commands/pr.js

- PR 제목/본문 생성
- PR preview
- GitHub PR 생성 또는 출력

src/core/diff.js

- detectLargeDiff()
- chunkDiff()
- mergeSummaries()

src/core/grouping.js

- classifyChangedFiles()
- analyzeDiffIntent()
- groupFilesByIntent()

src/core/pr.js

- generatePrTitle()
- generatePrBody()

src/core/prPrompt.js

- buildPrPrompt()

src/core/update.js

- checkLatestVersion()
- shouldCheckUpdate()
- notifyUpdate()

src/core/version.js

- getCurrentVersion()

src/auth/oauth.js

- startOAuthFlow()
- handleCallback()
- refreshAccessToken()

src/auth/oauthProviders.js

- provider별 OAuth 설정

src/auth/security.js

- generatePKCE()
- generateState()
- verifyState()

src/templates/schema.js

- template schema

src/templates/loader.js

- loadTemplate()

src/templates/validator.js

- validateTemplate()

src/utils/ui.js

- preview UI
- decision UI
- manual edit UI
- grouping preview UI
- PR preview UI

src/utils/env.js

- isCI()
- isGitHubActions()

src/utils/githubActions.js

- setOutput()

src/config/migration.js

- migrateConfig()

src/config/defaults.js

- configVersion
- default template
- large diff threshold
- update check policy

## 7. 3차 통합 테스트 시나리오

7-1. Preview / Confirm 테스트
convention --batch

확인 사항:

- AI 메시지 미리보기 출력
- Commit / Regenerate / Edit manually / Cancel 선택 가능

7-2. Regenerate 테스트

1. convention --batch 실행
2. Regenerate 선택
3. 새 메시지 생성 확인
4. Commit 선택

7-3. Manual Edit 테스트

1. convention --batch 실행
2. Edit manually 선택
3. 직접 메시지 수정
4. 수정된 메시지로 commit 확인

7-4. Large Diff 테스트

1. 대량 파일 변경 생성
2. convention --batch 실행
3. large diff 감지 확인
4. chunk summary 생성 확인
5. 최종 commit message 생성 확인

7-5. Grouping 테스트
convention --step

또는 향후 옵션:
convention --group

확인 사항:

- 파일 그룹 제안
- 그룹별 preview
- 그룹별 commit 생성

7-6. Template 테스트
convention --template init
convention --template show
convention --template validate
convention --batch

확인 사항:

- template 생성
- template 검증
- AI prompt에 template 반영

7-7. OAuth 테스트
convention --model gemini oauth

확인 사항:

- 브라우저 열림
- localhost callback 수신
- state 검증
- token 저장
- provider 호출

7-8. PR 생성 테스트
convention --pr

확인 사항:

- PR 제목 생성
- PR 본문 생성
- Preview 출력
- Print only 또는 Create PR 선택 가능

7-9. npm Update 테스트
convention --version
convention

확인 사항:

- 현재 버전 출력
- 최신 버전 확인
- 오래된 버전이면 안내

7-10. GitHub Actions 테스트
CI=true convention --batch --yes --no-interactive

확인 사항:

- prompt가 뜨지 않음
- 필요한 값 없으면 안전하게 실패
- secret 로그 출력 없음

## 8. 3차 고도화 실패 케이스

1. config migration 실패
2. preview 출력 중 메시지가 비어 있음
3. regenerate 횟수 초과
4. manual edit에서 빈 메시지 입력
5. diff가 너무 커서 chunking 실패
6. 일부 chunk summary 실패
7. grouping 결과가 비어 있음
8. grouping 결과가 너무 많음
9. template 파일 JSON parse 실패
10. template schema 불일치
11. OAuth callback timeout
12. OAuth state 검증 실패
13. OAuth token refresh 실패
14. PR 생성용 remote가 GitHub가 아님
15. gh CLI가 설치되어 있지 않음
16. GitHub 인증이 되어 있지 않음
17. npm registry 연결 실패
18. CI 환경에서 interactive prompt 호출 시도
19. GitHub Actions secret 노출 가능성
20. 1차/2차 기능 회귀 실패

## 9. 3차 고도화 보안 주의사항

1. OAuth는 반드시 state 검증을 수행한다.
2. 가능하면 PKCE를 적용한다.
3. OAuth token은 로그에 출력하지 않는다.
4. refresh token은 credentials.json에만 저장한다.
5. credentials.json 파일 권한을 제한한다.
6. PR 본문 생성 시 secret이 포함될 수 있으므로 diff 보안 scan을 재사용한다.
7. large diff chunk 원문을 로그에 출력하지 않는다.
8. grouping 분석 결과에 diff 원문을 그대로 출력하지 않는다.
9. CI 환경에서는 interactive prompt를 실행하지 않는다.
10. --yes 옵션은 CI에서만 권장하고 로컬에서는 신중히 사용한다.
11. npm update check 실패는 기능 실패로 처리하지 않는다.
12. GitHub PR 생성 전 반드시 preview 또는 --yes 정책을 따른다.
13. git reset --hard는 여전히 구현하지 않는다.
14. GitHub Actions 로그에 API Key, token, OAuth 정보 출력 금지.

## 10. 3차 고도화 최종 완료 기준

1. 1차 MVP 기능이 모두 정상 동작한다.
2. 2차 MVP 기능이 모두 정상 동작한다.
3. 커밋 메시지 미리보기가 동작한다.
4. Commit / Regenerate / Edit manually / Cancel 흐름이 동작한다.
5. AI 메시지 재생성이 가능하다.
6. 수동 커밋 메시지 수정이 가능하다.
7. 대용량 diff를 감지할 수 있다.
8. 대용량 diff를 chunk로 나눌 수 있다.
9. chunk summary 기반 커밋 메시지 생성이 가능하다.
10. 변경 파일 자동 그룹핑이 가능하다.
11. 그룹별 커밋 흐름이 동작한다.
12. 팀 컨벤션 템플릿을 로드할 수 있다.
13. 템플릿 검증과 fallback이 동작한다.
14. 템플릿이 AI prompt에 반영된다.
15. OAuth 인증 flow가 구현된다.
16. OAuth token 저장/갱신이 안전하게 동작한다.
17. PR 제목과 본문을 AI로 생성할 수 있다.
18. PR preview가 동작한다.
19. 가능한 경우 GitHub PR 생성까지 연결된다.
20. convention --version이 동작한다.
21. npm 최신 버전 확인과 업데이트 알림이 동작한다.
22. CI 환경에서 non-interactive mode가 동작한다.
23. GitHub Actions 예시 문서가 제공된다.
24. API Key, OAuth Token, Secret이 로그에 노출되지 않는다.
25. 전체 회귀 테스트가 통과한다.

## 11. 3차 고도화에서 가장 먼저 시작할 작업

B. Config Versioning Agent

그다음은:
C. Commit Preview Agent
D. Confirm UX Agent
E. Regenerate Agent
F. Manual Edit Agent
G. Commit Decision Flow Agent

이 순서를 추천합니다.
이유는 다음과 같습니다.

1. 3차부터 설정 항목이 많아지므로 config migration이 먼저 필요하다.
2. Preview/Confirm/Regenerate/Edit은 사용자가 바로 체감하는 안정성 기능이다.
3. 이 흐름이 안정화되어야 large diff, grouping, PR 생성도 같은 UX 패턴을 재사용할 수 있다.
4. OAuth나 PR 자동화보다 위험도가 낮고, 기존 commit flow에 자연스럽게 붙일 수 있다.

## 12. 첫 번째 오케스트레이션 단위

### 목표

커밋 전 사용자 검토 UX 완성

### 참여 Agent

A. 2차 MVP 회귀 테스트 Agent
B. Config Versioning Agent
C. Commit Preview Agent
D. Confirm UX Agent
E. Regenerate Agent
F. Manual Edit Agent
G. Commit Decision Flow Agent

### 완료 확인 명령어

convention --batch
convention --step
convention

### 성공 기준

AI가 생성한 커밋 메시지를 사용자가 확인하고,
Commit / Regenerate / Edit manually / Cancel 중 하나를 선택할 수 있다.

## 13. 최종 요약

3차 고도화는 크게 아래 8개 축으로 진행하면 됩니다.

1. 사용자 검토 UX 고도화
2. 대용량 diff 처리
3. 파일 변경 자동 그룹핑
4. 팀 컨벤션 템플릿
5. OAuth 인증
6. PR 제목/본문 자동 생성
7. npm 업데이트 알림
8. GitHub Actions / CI 연동

실제 작업 순서는 아래가 가장 안전합니다.

1. 2차 MVP 회귀 확인
2. Config versioning
3. Preview / Confirm / Regenerate / Edit
4. Large diff
5. Grouping
6. Template
7. OAuth
8. PR 자동화
9. npm update
10. GitHub Actions
11. 전체 통합 테스트

이렇게 가면 3차 고도화도 1차·2차 MVP처럼 작은 Agent 단위로 안전하게 오케스트레이션할 수 있습니다.
