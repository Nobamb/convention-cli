# Phase L Gemini Provider Agent Test

`research-L.md` 기준으로 정의된 Gemini Provider가 실제 API 호출을 성공적으로 수행하고, 올바른 형식의 응답을 반환하는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 일치 여부 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| L-V-1 | 인터페이스 준수 | `gemini.js` 구조 확인 | `generateCommitMessage`가 올바르게 구현되어 export 되고 있다. |
| L-V-2 | 에러 핸들링 | 네트워크 요청 부분 확인 | try-catch 블록이 존재하며 타임아웃 및 상태 코드 체크가 존재한다. |

## 2. 기능 테스트 항목

### L-T-1: 정상적인 커밋 메시지 생성

- **준비:** 유효한 Gemini API Key와 간단한 테스트용 diff (예: `+ const a = 1;`) 준비
- **실행:** `generateCommitMessage({ prompt, config })` 호출
- **예상 결과:** API 호출이 성공하고, "feat: add variable a" 형태의 정상적인 커밋 메시지 문자열이 반환된다.

### L-T-2: 잘못된 API Key 처리

- **준비:** 유효하지 않은 API Key (예: `invalid_key_123`) 준비
- **실행:** `generateCommitMessage({ prompt, config })` 호출
- **예상 결과:** API 401/403 에러가 반환되며, 이를 Provider가 감지하여 사용자에게 명확한 에러 메시지(인증 실패)를 반환한다. (이때 로그에 키가 노출되지 않아야 함 - K단계 검증)

### L-T-3: 타임아웃 처리

- **준비:** 강제로 타임아웃이 발생하도록 설정 조작 (예: timeout = 1ms)
- **실행:** `generateCommitMessage({ prompt, config })` 호출
- **예상 결과:** 무한 대기하지 않고 적절한 시간 내에 "요청 시간 초과" 에러를 반환하며 우아하게 실패한다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** Gemini API 연동이 성공적으로 완료됨.
- **실패 항목 존재 시:** 네트워크 요청 옵션 및 응답 파싱(JSON depth) 부분을 점검한다.
