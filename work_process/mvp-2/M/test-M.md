# Phase M OpenAI-compatible Provider Agent Test

`research-M.md` 기준으로 정의된 OpenAI-compatible Provider가 주어진 baseURL과 모델 버전으로 올바른 페이로드를 생성하고 응답을 파싱하는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| M-V-1 | 페이로드 형식 검증 | `openai-compatible.js` 구현 확인 | `messages` 배열이 `[{ role: 'user', content: '...' }]` 형식을 준수한다. |
| M-V-2 | 응답 추출 구조 | 결과 반환 부분 확인 | 응답 JSON에서 `choices[0].message.content`를 올바르게 접근하여 반환한다. |

## 2. 기능 테스트 항목

### M-T-1: 모의 서버(Mock) 정상 응답

- **준비:** OpenAI 응답 형식을 반환하는 로컬 테스트 서버 또는 Mock fetch 설정
- **실행:** `generateCommitMessage({ prompt, config })` 호출
- **예상 결과:** 모의 서버의 `content` 값을 성공적으로 추출하여 반환한다.

### M-T-2: 인증 토큰 포함 여부 확인

- **준비:** config 객체에 임의의 API Key 포함
- **실행:** 요청 시 HTTP 헤더를 인터셉트하여 확인
- **예상 결과:** `Authorization: Bearer <API_KEY>` 헤더가 정상적으로 포함되어 서버로 전송된다.

### M-T-3: 비정상적인 응답 구조 처리

- **준비:** `choices` 배열이 비어있거나, 형식이 깨진 JSON 응답 유도
- **실행:** API 호출
- **예상 결과:** 프로그램이 크래시되지 않고, "AI 응답 형식을 파싱할 수 없습니다" 등의 예외를 깔끔하게 던진다.

## 3. 검증 결과 요약

- **모든 항목 통과 시:** 범용 OpenAI-compatible API 연동 구조가 성공적으로 확립됨.
- **실패 항목 존재 시:** fetch 헤더 구성 및 JSON 깊이(depth) 접근 로직을 점검한다.
