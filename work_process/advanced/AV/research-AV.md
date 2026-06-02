# AV. Documentation Update Agent 구현 계획

## 작업 범위

AV 단계는 3차 고도화 기능을 README와 docs 문서에 반영하는 작업이다.

핵심 목표는 사용자가 문서만 보고 preview/regenerate/edit, large diff, grouping, template, OAuth, PR, GitHub Actions 기능을 이해하고 안전하게 사용할 수 있도록 정리하는 것이다.

## 선행 조건

- 3차 고도화 B~AR 단계의 기능 또는 구현 계획이 정리되어 있다.
- `docs/github-actions.md`가 AQ/AR 단계 기준을 반영한다.
- API Key, OAuth token, credentials, diff 보안 규칙이 문서에 반영되어야 한다.
- 문서 예시는 실제 secret 값을 포함하지 않는다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `README.md`
- `docs/model.md`
- `docs/oauth.md`
- `docs/templates.md`
- `docs/pr.md`
- `docs/github-actions.md`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 문서 갱신 계획만 정리한다.

## README 갱신 계획

README에는 전체 기능을 길게 설명하기보다 핵심 사용법과 상세 문서 링크를 둔다.

포함 항목:

- 기본 commit flow
- preview/regenerate/edit 요약
- `--step`, `--batch`, `--model`, `--push`, `--reset`
- template, PR, GitHub Actions 문서 링크
- secret과 외부 provider 전송 주의사항

## docs/model.md 계획

포함 항목:

- provider 설정 방식
- localLLM 설정
- API Key provider 설정
- OAuth provider 설정 후보
- credentials와 config 분리 원칙
- unsupported provider는 mock fallback 없이 오류 처리한다는 정책

## docs/oauth.md 계획

포함 항목:

- OAuth flow 개요
- state/PKCE 사용 이유
- local callback 동작
- token 저장 위치
- token refresh 개요
- token 로그 출력 금지
- 실패 시 문제 해결

## docs/templates.md 계획

포함 항목:

- template schema
- `.convention/template.json`
- template init/show/validate
- 허용 type, format, language, maxLength
- invalid template fallback 정책
- prompt 반영 방식

## docs/pr.md 계획

포함 항목:

- PR 제목/본문 생성 방식
- PR preview 선택지
- print-only와 create PR 차이
- GitHub remote 감지
- `gh` CLI 사용 조건
- PR body secret scan 주의사항

## docs/github-actions.md 계획

포함 항목:

- CI mode와 `--no-interactive`
- `--print-only` 중심 안전 예시
- GitHub Actions output 사용
- GitHub Secrets 설정
- fork PR 주의사항
- 최소 permissions 예시
- secret 로그 출력 금지

## 49번 최종 검증 반영 기준

문서 갱신 전후로 다음 항목을 확인한다.

- README와 docs가 `init/03_advanced.md`의 3차 범위와 일치하는지
- B~AV 단계의 test/research 파일에서 언급한 기능이 문서에 누락되지 않았는지
- 문서 경로가 실제 repo 경로와 일치하는지
- 보안 규칙과 confirm 정책이 문서에서 약화되어 표현되지 않았는지
- 1차·2차 MVP 명령 사용법이 3차 설명으로 인해 혼동되지 않는지

## 보안 기준

- 문서 예시에 실제 API Key, OAuth token, private key를 넣지 않는다.
- `npm publish` 자동 실행 예시를 넣지 않는다.
- `git reset --hard` 예시를 넣지 않는다.
- 외부 provider 사용 전 diff 전송 주의사항을 설명한다.
- `--yes`는 보안 gate 우회가 아니라 명시 승인 옵션이라는 점을 설명한다.

## 완료 기준

- README와 주요 docs에 3차 고도화 기능 사용법이 반영된다.
- 사용자가 문서만 보고 주요 기능을 실행할 수 있다.
- 문서 예시가 보안 규칙을 위반하지 않는다.
- 1차·2차 MVP 기능과 3차 기능의 관계가 명확히 설명된다.
