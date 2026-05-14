# X 단계: 2차 MVP 통합 및 보안/예외 처리 테스트 명세서

본 테스트 명세서는 2차 MVP에서 새롭게 추가된 기능과 `dangerous3.md`에서 지적된 보안, 안정성, 예외 처리 누락 사항들을 검증하기 위한 통합 테스트 시나리오입니다.

## 1. 신규 생성 파일 (Untracked Files) 스테이징 및 커밋 연동 테스트

**목적:** 한 번도 커밋되지 않은 신규 파일(Untracked 파일)에 대해서도 변경 사항(전체 내용)을 정상적으로 AI가 분석하고 스테이징 및 커밋할 수 있는지 확인합니다.

*   **테스트 시나리오 1.1: 단일 신규 파일 (Step 모드)**
    1.  테스트 저장소에 `new_feature.txt` 파일을 생성하고 내용을 작성한다.
    2.  `git add`를 수행하지 않은 상태(Untracked)에서 `convention --step`을 실행한다.
    3.  CLI가 `new_feature.txt`의 전체 내용을 기반으로 커밋 메시지를 생성하는지 확인한다.
    4.  커밋을 승인했을 때, 파일이 Staging 상태가 되고 커밋이 정상적으로 완료되는지 `git status`와 `git log`로 확인한다.
*   **테스트 시나리오 1.2: 다수 파일 동시 변경 (Batch 모드)**
    1.  기존 추적 중인 파일 1개를 수정하고, 새로운 파일 `new_docs.md`를 생성한다.
    2.  `convention --batch`를 실행한다.
    3.  AI가 기존 파일의 수정 사항과 신규 파일의 전체 내용을 모두 합쳐 분석한 하나의 통합 커밋 메시지를 반환하는지 확인한다.

## 2. `--question` (`-q`) 플래그 검증 테스트

**목적:** 사용자가 `--question` 옵션을 통해 커밋 자동화 수준(확인 후 커밋 vs 즉시 커밋)을 제어할 수 있는지 확인합니다.

*   **테스트 시나리오 2.1: -q 설정 UI 확인**
    1.  `convention -q`를 실행한다.
    2.  "커밋 메시지 생성 후 커밋 여부를 물어볼까요?" 등 2가지 질문(커밋 전 확인, 외부 전송 전 확인)이 표시되는지 확인한다.
    3.  방향키로 "false - 묻지 않고 바로 커밋"을 선택한다.
    4.  `~/.config/convention/config.json` 내 `confirmBeforeCommit` 필드가 `false`로 저장되었는지 확인한다.
*   **테스트 시나리오 2.2: false 상태에서 자동 커밋 흐름**
    1.  `confirmBeforeCommit`이 `false`인 상태에서 코드를 변경한다.
    2.  `convention` 명령어를 실행한다.
    3.  AI 커밋 메시지 생성 후 "이 메시지로 커밋할까요?"라는 질문 없이 자동으로 `git add`와 `git commit`이 실행되는지 확인한다.
    4.  테스트 종료 후 다시 `convention -q`를 실행하여 `true`로 원복한다.

## 3. 보안 마스킹 및 외부 전송 Gate 동작 테스트

**목적:** `dangerous1.md`에서 지적된 6가지 핵심 보안 위험 조치가 통합 환경에서 정상 동작하는지 확인합니다.

*   **테스트 시나리오 3.1: 외부 전송 확인 Gate**
    1.  Config에서 `confirmExternalTransmission`을 `always`로 설정한다.
    2.  코드 변경 후 `convention`을 실행한다.
    3.  실제 Provider로 Diff 데이터를 전송하기 전 "Send Git diff to external AI provider...?"라는 확인 메시지가 노출되는지 검증한다.
    4.  'No' 선택 시 API 요청 없이 안전하게 종료되는지 확인한다.
*   **테스트 시나리오 3.2: Secret 마스킹 동작 검증**
    1.  변경할 파일 내부에 `API_KEY=sk-test1234567890` 구문을 삽입한다.
    2.  `convention`을 실행해 외부 전송 확인 Gate 단계에서 출력되는 diff 분석 안내를 확인한다.
    3.  (Mock 또는 로깅을 통해) 전송되는 diff 원문에 `API_KEY=***` 형태로 Secret이 마스킹 처리되어 있는지 검증한다.
*   **테스트 시나리오 3.3: 민감 파일 제외**
    1.  `.env` 파일에 내용을 수정하고, `src/main.js` 파일도 수정한다.
    2.  `convention` 실행 시 `.env` 파일은 diff 수집 대상에서 완전히 제외되어 AI에게 전송되지 않는지 확인한다.
*   **테스트 시나리오 3.4: 최상위 에러 출력 통일**
    1.  강제로 인증 오류나 네트워크 오류를 유발한다.
    2.  Node.js의 스택 트레이스 전체가 아닌, `logger.error`를 통해 "API Key is invalid"와 같이 정제된 한 줄의 문자열만 콘솔에 출력되는지 확인한다.
*   **테스트 시나리오 3.5: credentials.json 권한 (Windows 환경 우선)**
    1.  Windows에서 `convention --model gemini api "test-key"` 등으로 API 키를 저장한다.
    2.  `~/.config/convention/credentials.json` 파일의 보안 탭에서 일반 Users의 권한이 제거되고 현재 사용자(Current User)에게만 전체 권한이 부여되었는지 확인한다.

## 4. 모델 재설정 시 API 키 교체 여부 및 429 Fallback 테스트

**목적:** 이미 설정된 모델의 설정 변경 흐름과, Provider 사용량 한도(Rate Limit) 초과 시나리오에 대한 안전한 복구 로직을 테스트합니다.

*   **테스트 시나리오 4.1: 기존 API Key 존재 시 교체 확인**
    1.  이미 Gemini Provider에 API Key가 저장된 상태에서 `convention --model gemini api`를 실행한다.
    2.  "Gemini API Key가 이미 저장되어 있습니다. 새 API Key로 교체할까요?" 질문이 나타나는지 확인한다.
    3.  'No(초기값)'를 선택 시 추가 비밀번호 입력 프롬프트 없이 바로 모델 버전 선택으로 넘어가는지 확인한다.
*   **테스트 시나리오 4.2: HTTP 429(Rate Limit) Fallback 동작**
    1.  테스트를 위해 `src/providers/gemini.js` 내의 fetch 요청이 고의로 상태 코드 429를 반환하도록 Mocking 하거나 제한된 키를 사용한다.
    2.  `convention` 커밋 흐름을 시작한다.
    3.  429 에러 반환 시 "AI Provider 사용량 한도 또는 rate limit에 도달했습니다. 어떻게 진행할까요?" 프롬프트가 노출되는지 확인한다.
    4.  선택지 중 "다른 API Key 입력 후 재시도"를 선택하여 새 키 입력 후 재진행 흐름이 정상 동작하는지 확인한다.
    5.  "Provider/모델 설정을 바꾼 뒤 재시도" 선택 시 전체 `--model` 설정 UI가 나타나고 변경 후 다시 커밋 메시지를 생성하는지 확인한다.
    6.  "커밋하지 않고 안전하게 중단" 선택 시 아무런 파일 스테이징 없이 정상 종료되는지 확인한다.

## 5. --push 및 --reset 동작 확인

**목적:** 커밋 이후 후속 워크플로우에 대한 CLI 옵션 작동을 점검합니다.

*   **테스트 시나리오 5.1: --push**
    1.  `convention --push`를 실행하여 커밋 메시지 작성 후 커밋이 승인되면 자동으로 `git push` 로직이 트리거되는지 확인한다.
*   **테스트 시나리오 5.2: --reset**
    1.  `convention --reset`을 실행한다.
    2.  "정말로 최근 커밋 1개를 취소하시겠습니까?" 와 같은 확인 메시지가 노출되는지 확인한다.
    3.  승인 시 커밋은 취소되되, 수정된 파일 내용은 working tree에 그대로 남아있는지 확인한다 (`git reset HEAD~1` 과 동일한 결과).
