# Phase L Gemini Provider Agent Research

## 1. 개요

Phase L은 저장된 API Key를 기반으로 실제 Google Gemini API와 통신하여 커밋 메시지를 생성하는 클라우드 Provider를 구현하는 단계입니다. `core/ai.js`와 통신하기 위해 Phase B에서 정의한 인터페이스를 따릅니다.

## 2. 작업 목표

- `src/providers/gemini.js` 구현
- API Key를 Authorization 형태로 포함하여 Gemini API 엔드포인트로 요청 전송
- 커밋 Diff 프롬프트를 전송하고 응답 텍스트 추출 로직 구현
- 네트워크 지연(timeout) 및 에러(Rate Limit, 권한 오류 등) 처리 로직 작성

## 3. 권장 구현 방향

- Node.js의 `fetch` 또는 `axios`를 사용하거나, 공식 `@google/generative-ai` SDK를 고려할 수 있으나, 의존성 최소화를 위해 REST API를 직접 호출하는 방식도 무방합니다.
- Phase B의 규약에 따라 `generateCommitMessage({ prompt, config })` 함수를 구현합니다.
- 응답 결과에 따라 Phase U(1차 MVP)의 `cleanAIResponse`를 활용하거나, Provider 내에서 자체적으로 응답 형식을 1 정제합니다.

## 4. 보안 및 안정성 기준

- 호출 시 API Key는 헤더(`x-goog-api-key`) 또는 안전한 방식으로 전송되며, URL 파라미터 노출을 최소화합니다.
- 타임아웃 발생 시 무한정 대기하지 않도록 적절한 Timeout(예: 15초~30초)을 설정합니다.

## 5. 다음 단계 연결

Gemini Provider가 완성되면, 비슷한 구조를 가진 Phase M(OpenAI-compatible Provider) 구현이 훨씬 수월해지며, 최종적으로 Phase N 라우터를 통해 실제 동작이 연동됩니다.
