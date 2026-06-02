# AS. 3차 통합 테스트 Agent 구현 계획

## 작업 범위

AS 단계는 3차 고도화 기능이 기존 commit flow와 함께 정상 동작하는지 통합 검증하는 작업이다.

핵심 목표는 preview, regenerate, manual edit, large diff, grouping, template, OAuth mock, PR 생성, update check, CI mode가 각각 독립적으로 동작하면서도 `convention`, `--step`, `--batch` 흐름을 깨지 않는지 확인하는 것이다.

## 선행 조건

- 1차 MVP의 안전한 commit flow가 유지된다.
- 2차 MVP의 provider, credentials, `--push`, `--reset` 흐름이 존재한다.
- 3차 고도화 B~AR 단계의 구현 또는 문서화가 완료되어 있다.
- 외부 provider 호출 전 diff 보안 gate 정책이 유지된다.

## 생성 또는 수정 대상

실제 구현 시 예상 파일은 다음과 같다.

- `tests/phase3-integration.test.js`
- `tests/commit-command.test.js`
- `tests/grouping.test.js`
- `tests/template-command.test.js`
- `tests/oauth.test.js`
- `tests/pr-phase6.test.js`
- `tests/update.test.js`
- `tests/env.test.js`

이번 문서 작업에서는 구현 파일을 수정하지 않고, 통합 검증 계획만 정리한다.

## 통합 검증 시나리오

검증은 실제 사용자 저장소가 아니라 격리된 임시 Git 저장소 또는 fixture에서 수행한다.

1. `convention --batch`에서 AI 메시지 preview와 사용자 결정 흐름 확인
2. Regenerate 선택 후 새 메시지 생성 및 다시 preview로 복귀 확인
3. Manual edit 선택 후 직접 수정한 메시지로 commit 연결 확인
4. 대용량 diff 감지, chunk summary, 최종 메시지 생성 확인
5. 변경 파일 grouping 제안, preview, 그룹별 commit flow 확인
6. template init/show/validate 및 prompt 반영 확인
7. OAuth flow는 실제 브라우저/외부 API 대신 callback, state, token 저장을 mock 처리
8. PR 제목/본문 생성, preview, print-only, create 선택 흐름 확인
9. npm update check는 registry 호출을 mock 처리하고 실패 시 조용히 무시하는지 확인
10. CI mode에서 prompt 없이 안전하게 실패하거나 실행되는지 확인

## 49번 최종 검증 반영 기준

통합 테스트 계획은 `init/03_advanced.md`의 3차 고도화 범위를 기준으로 한다.

검증 중 다음 항목이 발견되면 해당 단계 문서 또는 `prompt.md` 수정 후보로 기록한다.

- B~AV 단계 중 누락된 기능 또는 테스트
- 잘못된 `work_process/advanced/*` 파일 경로
- `research-*.md` 또는 `test-*.md` 지시 누락
- 1차·2차 MVP의 commit, provider, reset, push flow를 약화하는 지시
- 보안 gate, secret masking, confirm 정책을 우회할 가능성이 있는 지시

## 보안 기준

- 테스트 중 실제 사용자 Git 히스토리를 변경하지 않는다.
- `git commit`, `git push`, `git reset` 검증은 fixture 또는 mock에서 수행한다.
- 실제 OAuth token, API Key, credentials 내용을 사용하지 않는다.
- diff 원문, provider raw response, credentials 원문을 로그에 출력하지 않는다.
- 외부 네트워크 호출은 unit/integration test에서 mock 처리한다.

## 완료 기준

- 3차 기능 전체가 기존 commit flow와 함께 검증된다.
- integration test가 fixture 기반으로 구성된다.
- 외부 네트워크와 실제 사용자 Git 히스토리를 사용하지 않는다.
- 49번 기준의 누락/경로/보안/회귀 위험 점검 항목이 테스트 계획에 반영된다.
