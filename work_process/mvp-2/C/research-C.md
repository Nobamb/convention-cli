# Phase C Mock Provider 이전 Agent Research

## 1. 개요

Phase C는 1차 MVP에서 `src/core/ai.js` 등에 하드코딩되었거나 혼재되어 있던 Mock 로직을 `src/providers/mock.js`로 완전히 이전하는 단계입니다. 이를 통해 Phase B에서 정의한 Provider 라우팅 구조를 실질적으로 검증하고, 향후 다른 Provider 추가를 위한 기반을 다집니다.

## 2. 작업 목표

- `src/providers/mock.js` 파일 생성 및 구현
- 항상 고정된 커밋 메시지를 반환하는 `generateCommitMessage` 작성
- `src/providers/index.js`에 `mock` Provider 라우팅 연결
- `src/core/ai.js`가 새로운 인터페이스(`getProvider('mock')`)를 통해 Mock Provider를 호출하도록 로직 변경

## 3. 구체적인 구현 로직

### `src/providers/mock.js`

- Provider 인터페이스 규격에 맞춰 `generateCommitMessage`, `listModels`, `validateConfig` 함수를 export 합니다.
- `generateCommitMessage`는 프롬프트 내용에 상관없이 항상 일정한 값(예: `chore: update project files`)을 반환하여 1차 MVP와 동일한 동작을 보장합니다.
- 외부 API 호출(Network I/O)이 발생하지 않도록 합니다.

### `src/providers/index.js`

- `mock.js`를 import 하고 `getProvider` 라우팅 함수에서 `'mock'` 요청 시 해당 모듈을 반환합니다.

### `src/core/ai.js`

- 내부의 하드코딩된 mock 응답 생성 로직을 제거합니다.
- 설정된 `config.provider` 값(없으면 기본값 `'mock'`)을 기반으로 `providers/index.js`의 `getProvider`를 호출합니다.
- 반환받은 Provider 객체의 `generateCommitMessage` 메서드에 `prompt`와 `config`를 전달하여 실행합니다.

## 4. 보안 및 안정성 기준

- `mock.js` 내부에서 불필요하게 `config` 전체를 로깅하지 않습니다.
- 1차 MVP의 커밋 흐름이 끊어지지 않고 동일하게 작동하는 것이 가장 중요합니다.

## 5. 다음 단계 연결

Phase C를 통해 `mock` Provider가 새로운 구조 하에 정상 동작하는 것을 확인하면, Phase D에서 지원할 전체 Provider 목록을 정의하고 검증 로직을 구체화합니다.
