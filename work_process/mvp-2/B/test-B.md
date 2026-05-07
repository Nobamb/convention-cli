# Phase B Provider 인터페이스 정의 Agent Test

`research-B.md` 기준으로 정의된 Provider 인터페이스가 향후 어떤 Provider로 변경되어도 `core/ai.js`에서 동일한 방식으로 호출 가능하도록 추상화되었는지 검증하기 위한 테스트 항목입니다.

## 1. 정적 검증 항목

| ID  | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :---------- | :-------- | :-------- |

| B-V-1 | 공통 인터페이스 구조 확인 | `src/providers/index.js` (또는 추상화 문서) 확인 | `generateCommitMessage`, `listModels`, `validateConfig` 함수 시그니처가 정의되어 있다. |
| B-V-2 | 라우팅 구조 확인 | `src/providers/index.js` 확인 | `getProvider(providerName)` 등의 라우팅 함수가 존재하며, 특정 provider 모듈을 반환한다. |

## 2. 기능 테스트 항목

### B-T-1: Provider 추상화 호출

- **준비:** 임의의 테스트용 Provider 모듈(예: `dummyProvider`)을 만들고 라우터에 등록한다.
- **실행:** `core/ai.js`에서 `getProvider('dummy')`를 통해 획득한 객체의 `generateCommitMessage({ prompt, config })`를 호출한다.
- **예상 결과:** `core/ai.js`가 `dummyProvider`의 내부 구현을 모르더라도 공통 인터페이스만으로 호출에 성공하고 결과를 반환받는다.

### B-T-2: 지원하지 않는 Provider 호출

- **준비:** 정의되지 않은 Provider 이름(예: `unknown`)을 준비한다.
- **실행:** `getProvider('unknown')` 호출
- **예상 결과:** 명확한 에러(예: "지원하지 않는 Provider입니다")가 발생하거나 적절한 기본값/예외 처리가 이루어진다.

## 3. 테스트 절차

1. Provider 인터페이스가 모든 Provider에서 공통적으로 노출해야 할 파라미터와 반환 타입을 규정하는지 확인한다.
2. `getProvider` 라우터가 입력된 provider명에 매칭되는 모듈 객체를 정확히 반환하는지 테스트한다.

## 4. 검증 결과 요약

- **모든 항목 통과 시:** Provider 인터페이스 추상화 초안이 성공적으로 마련됨.
- **실패 항목 존재 시:** 공통 인터페이스 파라미터 구조나 반환 타입, 에러 처리 로직을 점검한다.
