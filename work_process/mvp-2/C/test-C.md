# Phase C Mock Provider 이전 Agent Test

`research-C.md` 기준으로 `core/ai.js`에 있던 Mock 로직이 `src/providers/mock.js`로 분리된 후에도, 1차 MVP에서 구현한 커밋 흐름이 정상적으로 동작하는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :--- | :--- | :--- | :--- |
| C-V-1 | mock.js 파일 생성 | `src/providers/mock.js` 확인 | 파일이 존재하며 Provider 인터페이스에 맞춰 export하고 있다. |
| C-V-2 | 하드코딩 로직 제거 | `src/core/ai.js` 확인 | 내부에서 직접 텍스트를 반환하던 로직이 제거되고 `getProvider`를 호출한다. |
| C-V-3 | mock 라우팅 | `src/providers/index.js` 확인 | `'mock'` 요청 시 `mock.js`의 함수들을 반환한다. |

## 2. 기능 테스트 항목

### C-T-1: Mock Provider 메시지 생성
- **준비:** `config.provider = 'mock'` 설정 상태를 준비한다.
- **실행:** `core/ai.js`의 커밋 메시지 생성 함수(또는 커밋 플로우 전체) 실행
- **예상 결과:** `mock.js`에 정의된 고정 커밋 메시지가 정상적으로 반환되며, 에러 없이 커밋 프롬프트가 표시된다.

### C-T-2: 기본 Provider Fallback
- **준비:** `config.provider`가 명시되지 않은 상태를 준비한다.
- **실행:** 커밋 메시지 생성 흐름 실행
- **예상 결과:** 기본적으로 `mock` Provider로 라우팅되어 동작한다 (기존 1차 MVP 동작 호환).

### C-T-3: 네트워크 격리 확인
- **준비:** 네트워크 연결을 차단하거나 HTTP 모킹(nock 등)으로 외부 호출 시 에러가 나도록 설정한다.
- **실행:** `mock` Provider로 커밋 생성 실행
- **예상 결과:** 어떠한 외부 네트워크 호출도 발생하지 않고 즉각 고정된 응답이 반환된다.

## 3. 테스트 절차

1. 단위 테스트에서 `core/ai.js`가 `mock.js`를 호출하는지 spy 객체를 통해 검증한다.
2. CLI 엔드투엔드 수준(또는 통합 수준)에서 옵션 없이(또는 `--step`/`--batch`로) 실행했을 때 1차 MVP와 동일하게 고정 메시지로 커밋 단계를 진행하는지 확인한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** Mock Provider 로직 분리 및 라우팅이 성공적으로 완료됨.
- **실패 항목 존재 시:** `core/ai.js`의 호출부, `providers/index.js`의 분기, `mock.js`의 반환 형태를 재검토한다.
