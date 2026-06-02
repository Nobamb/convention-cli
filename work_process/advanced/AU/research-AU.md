# AU. Security Review Agent 구현 계획

## 작업 범위

AU 단계는 3차 고도화 기능 추가 후 전체 보안 규칙 위반 가능성을 검토하고 필요한 수정 지점을 정리하는 작업이다.

핵심 목표는 OAuth state/PKCE, token 로그 출력, credentials 저장 위치, diff 외부 전송, large diff chunk 로그, PR body secret 포함, CI secret 노출, reset/push confirm 정책을 최종 점검하는 것이다.

## 선행 조건

- `init/00_rule.md`의 보안, 사용자 데이터 보호, Git 히스토리 보호 규칙을 기준으로 검토한다.
- 1차·2차 MVP의 confirm 기반 commit flow가 유지되어야 한다.
- 3차 고도화 기능 B~AR의 구현 또는 문서화가 완료되어 있다.
- CI 보안 문서와 logger redaction 정책이 존재하거나 AR 단계에서 계획되어 있다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `tests/security-review.test.js`
- `tests/security.test.js`
- `tests/oauth.test.js`
- `tests/github-actions-output.test.js`
- `tests/reset-command.test.js`
- `src/auth/security.js`
- `src/utils/logger.js`
- `src/core/security.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 보안 검토 계획만 정리한다.

## 보안 검토 항목

1. OAuth state가 생성, 저장, 검증되는지 확인
2. OAuth PKCE verifier/challenge가 안전하게 생성되는지 확인
3. API Key, OAuth token, refresh token이 로그에 출력되지 않는지 확인
4. credentials가 `config.json`과 분리되어 저장되는지 확인
5. credentials 파일 내용을 그대로 출력하지 않는지 확인
6. 외부 AI provider로 diff 전송 전 민감 파일 제외와 secret scan이 수행되는지 확인
7. large diff chunk 원문이 logger 또는 GitHub Actions output에 출력되지 않는지 확인
8. PR title/body 생성 시 secret 의심 패턴이 마스킹 또는 차단되는지 확인
9. CI 환경에서 env secret과 GitHub token이 출력되지 않는지 확인
10. `--push`와 `--reset`이 사용자 confirm 또는 명시 옵션 없이 실행되지 않는지 확인

## 위험 기준

다음 항목은 즉시 수정이 필요한 보안 위험으로 판단한다.

- secret 원문 출력
- credentials 파일 원문 출력
- diff 원문 전체 로그 출력
- 외부 provider 자동 전송 정책 누락
- `git reset --hard` 구현 또는 테스트
- transaction 검증 없는 reset
- confirm 없는 commit/push/reset/PR create
- unsupported provider의 조용한 mock fallback
- shell 문자열 기반 Git 명령에 사용자 입력 삽입

## 49번 최종 검증 반영 기준

AU 검토는 49번의 최종 감사 기준 중 보안 항목을 담당한다.

다음 사항을 B~AV 문서와 구현 후보에서 함께 확인한다.

- `init/03_advanced.md` 범위를 벗어난 위험 기능이 추가되었는지
- 1차·2차 MVP의 보안 전제를 약화하는 지시가 있는지
- test/research 문서에 보안 검증 항목이 누락되었는지
- 민감정보 처리 규칙이 문서와 테스트 모두에 반영되었는지

## 수정 방향

문제가 발견되면 다음 우선순위로 수정한다.

1. secret 출력 제거 또는 redaction 적용
2. 외부 전송 전 보안 gate 강화
3. confirm 정책 복구
4. Git 명령 argv 배열 방식 보장
5. 문서와 테스트 계획에 보안 기준 명시

## 완료 기준

- OAuth, credentials, provider, PR, CI, reset/push 보안 위험이 검토된다.
- secret 원문 출력 가능성이 있는 경로가 식별되고 수정 후보가 정리된다.
- 1차·2차 MVP의 Git 히스토리 보호 원칙이 유지된다.
- 보안 검토 결과가 테스트 계획으로 연결된다.
