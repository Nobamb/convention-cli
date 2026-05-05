# Phase U AI 응답 정리 Agent Research

## 1. 개요

Phase U는 AI Provider가 반환한 응답을 `git commit -m`에 바로 사용할 수 있는 깨끗한 커밋 메시지 문자열로 정리하는 단계입니다. 구현 대상은 `src/core/ai.js`의 `cleanAIResponse(response)`입니다.

AI 응답에는 markdown 코드블록, 따옴표, 설명 문장, 여러 줄 후보, 앞뒤 공백이 섞일 수 있으므로 commit workflow에 넘기기 전에 안전하게 정규화해야 합니다.

## 2. 작업 목표

- `src/core/ai.js`에 `cleanAIResponse(response): string` 구현
- 앞뒤 공백 제거
- markdown 코드블록 fence 제거
- 불필요한 따옴표 wrapper 제거
- 여러 줄 응답에서 첫 번째 유효 커밋 메시지 라인 선택
- 빈 응답 또는 정리 후 빈 문자열이면 에러 처리
- Conventional Commits 형태를 최대한 보존
- raw 응답을 console/logger로 출력하지 않음

## 3. 정리 기준

권장 처리 순서:

1. `response`가 문자열인지 확인
2. 앞뒤 공백 제거
3. markdown 코드블록 fence 제거
4. 줄 단위로 분리
5. 빈 줄과 설명성 prefix를 제외하고 첫 번째 유효 라인 선택
6. 선택된 라인의 앞뒤 공백 제거
7. 전체를 감싸는 불필요한 따옴표 제거
8. 결과가 비어 있으면 에러 발생

## 4. 코드블록 처리 기준

AI가 아래와 같이 응답할 수 있습니다.

```text
```text
feat: add user login
```
```

또는:

```text
```commit
fix: handle empty config
```
```

이 경우 fence(````text`, ````commit`, ````)를 제거하고 내부 커밋 메시지만 반환해야 합니다.

## 5. 여러 줄 응답 처리 기준

AI가 설명과 커밋 메시지를 함께 반환할 수 있습니다.

```text
Here is the commit message:
feat: add user login
```

1차 MVP에서는 `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `test:`, `chore:`로 시작하는 첫 번째 유효 라인을 선택하는 방식을 권장합니다.

Conventional Commits type을 찾지 못한 경우에는 첫 번째 비어 있지 않은 라인을 fallback으로 선택할 수 있으나, 가능하면 prompt 단계에서 이 상황을 줄여야 합니다.

## 6. 따옴표 제거 기준

AI가 아래처럼 전체 메시지를 따옴표로 감싸는 경우가 있습니다.

```text
"chore: update project files"
'fix: handle config parse error'
`docs: update README usage`
```

이 경우 바깥쪽 따옴표만 제거하고 내부 내용은 보존합니다. 메시지 중간에 포함된 따옴표는 제거하지 않습니다.

## 7. 에러 처리 기준

- `response`가 문자열이 아니면 `TypeError`
- `response.trim()`이 비어 있으면 Error
- 코드블록과 따옴표 제거 후 결과가 비어 있으면 Error
- 정리 실패 시 raw response를 로그에 출력하지 않음

## 8. 보안 및 로그 기준

- AI 응답에는 diff 일부나 민감 정보가 포함될 수 있으므로 raw response를 console/logger에 출력하지 않습니다.
- 에러 메시지는 일반화된 문구를 사용합니다.
- commit message로 확정되기 전에는 사용자 confirm 단계에서 정리된 메시지만 보여줍니다.

## 9. 테스트 관점

- 일반 문자열 응답 정리
- 앞뒤 공백 제거
- markdown 코드블록 응답 정리
- 큰따옴표, 작은따옴표, 백틱 wrapper 제거
- 여러 줄 응답에서 Conventional Commits 라인 선택
- 빈 응답과 비문자열 입력 에러 처리
- raw response 로그 금지

## 10. 다음 단계 연결

Phase U의 결과는 V/W commit workflow에서 사용자에게 표시되고 confirm을 받은 뒤 `git commit -m`으로 전달됩니다. 따라서 이 함수는 메시지를 과도하게 변형하지 않되, Git 커밋 메시지 인자로 넣기 어려운 wrapper와 불필요한 설명을 제거하는 데 집중해야 합니다.
