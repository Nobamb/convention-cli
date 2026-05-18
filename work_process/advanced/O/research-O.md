# Phase 3 / O File Grouping Agent Research

## 1. 개요

Phase O는 Phase M의 파일 유형 분류 결과와 Phase N의 변경 의도 분석 결과를 받아, 변경 파일을 커밋 가능한 그룹으로 묶는 단계입니다. 구현 대상은 `src/core/grouping.js`이며, 핵심 목표는 파일 유형과 변경 의도를 함께 고려해 관련 파일을 안정적으로 그룹화하는 것입니다.

이 단계는 실제 `git add`, `git commit`, `git push`, `git reset`을 실행하지 않습니다. 그룹 결과를 다음 단계인 Grouping Preview Agent와 Grouped Commit Flow Agent가 사용할 수 있도록 순수 데이터 구조로 반환해야 합니다.

## 2. 작업 목표

- `groupFilesByIntent()` 또는 동등한 grouping 함수를 `src/core/grouping.js`에 정의합니다.
- 변경 파일 metadata를 파일 유형, 변경 의도, 경로 관계 기준으로 그룹화합니다.
- 너무 작은 그룹은 관련 그룹으로 병합합니다.
- 각 그룹의 대표 Conventional Commit type을 결정합니다.
- 같은 입력은 항상 같은 그룹 순서와 파일 순서를 반환하도록 결정적 동작을 보장합니다.
- grouping 과정에서 diff 원문, secret, credentials 내용을 출력하지 않습니다.

## 3. 입력과 출력 계약

권장 입력은 Phase M, N 결과를 결합한 배열입니다.

```javascript
[
  {
    file: "src/auth/login.js",
    fileType: "source",
    intent: "feat",
    summary: "로그인 인증 흐름 추가"
  },
  {
    file: "src/auth/login.test.js",
    fileType: "test",
    intent: "test",
    summary: "로그인 인증 테스트 추가"
  }
]
```

권장 출력은 다음 형태입니다.

```javascript
[
  {
    groupName: "feat-auth-login",
    type: "feat",
    intent: "feat",
    files: ["src/auth/login.js", "src/auth/login.test.js"],
    fileTypes: ["source", "test"],
    summaries: ["로그인 인증 흐름 추가", "로그인 인증 테스트 추가"]
  }
]
```

`files`는 중복 없이 정렬된 경로 배열이어야 합니다. `summaries`는 있으면 활용하되, 없거나 비어 있어도 그룹 생성을 실패시키지 않습니다.

## 4. 그룹 생성 기준

1차 그룹 후보는 다음 우선순위로 만듭니다.

1. `intent`가 같은 파일을 우선 묶습니다.
2. 같은 기능 영역 또는 디렉터리 prefix를 공유하는 파일을 묶습니다.
3. `source`와 해당 `test` 파일은 가능하면 같은 intent 그룹에 합칩니다.
4. `docs`, `config`, `dependency`, `generated`처럼 커밋 의도가 분명한 파일 유형은 독립 그룹 후보로 둡니다.

파일 유형별 기본 intent 후보:

| fileType | 기본 type 후보 | 비고 |
| :-- | :-- | :-- |
| source | `feat`, `fix`, `refactor` | Phase N intent를 우선합니다. |
| test | `test` | 관련 source 그룹이 있으면 병합 가능합니다. |
| docs | `docs` | 문서만 변경된 경우 대표 type은 `docs`입니다. |
| style | `style` | 코드 의미 변경 없는 포맷 변경입니다. |
| config | `chore` | 설정 변경은 기본적으로 `chore`입니다. |
| dependency | `chore` | package lock과 package manifest를 함께 묶습니다. |
| generated | `chore` | 생성물은 source와 분리하는 것을 기본으로 합니다. |
| unknown | `chore` | Phase M에서 근거 없이 분류할 수 없는 파일은 사용자 확인 대상 또는 `chore` 후보로만 처리합니다. |

## 5. Too-small Group Merge 기준

너무 작은 그룹은 그룹 수를 과도하게 늘려 커밋 흐름을 복잡하게 만들 수 있으므로 병합 규칙이 필요합니다.

권장 기준:

- `minGroupFileCount` 기본값은 `2`로 둡니다.
- 파일 1개짜리 그룹이라도 `docs`, `dependency`, `config`처럼 독립 의미가 명확하면 유지할 수 있습니다.
- `test` 단일 그룹은 같은 디렉터리 또는 같은 basename을 공유하는 `source` 그룹에 병합합니다.
- `style` 단일 그룹은 같은 파일 또는 같은 디렉터리의 `source`/`refactor` 그룹이 있으면 병합하고, 없으면 `style` 그룹으로 유지합니다.
- intent가 불명확한 단일 그룹은 가장 가까운 디렉터리 prefix를 공유하는 그룹에 병합합니다.
- 병합 대상이 없으면 `chore-misc` 그룹에 모읍니다.

병합 시 대표 type은 더 강한 의미를 가진 type을 우선합니다.

우선순위 예시:

1. `feat`
2. `fix`
3. `refactor`
4. `test`
5. `docs`
6. `style`
7. `chore`

단, docs-only 그룹은 `docs`, test-only 그룹은 `test`, dependency-only 그룹은 `chore`를 유지합니다.

## 6. Group Type Selection 기준

그룹 type은 그룹 내부 파일들의 `intent`, `fileType`, summary를 기반으로 결정합니다. AI 재호출 없이 rule 기반으로 결정하는 것을 기본으로 합니다.

권장 함수:

- `selectGroupType(groupItems): string`
- `selectGroupName(groupItems, type): string`

type 결정 규칙:

1. 명시적 `intent`가 Conventional Commit 허용 type이면 가장 많이 등장한 intent를 사용합니다.
2. 동률이면 `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore` 순서로 결정합니다.
3. 모든 파일이 docs이면 `docs`를 반환합니다.
4. 모든 파일이 test이면 `test`를 반환합니다.
5. dependency/config/generated만 있으면 `chore`를 반환합니다.
6. 알 수 없는 intent는 `chore`로 정규화합니다.

허용 type은 기존 prompt 규칙과 동일하게 `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`만 사용합니다.

## 7. 결정적 동작 기준

grouping은 같은 입력에 대해 항상 같은 결과를 반환해야 합니다. AI 응답 순서, 파일 시스템 순서, 객체 순회 순서에 의존하지 않습니다.

필수 기준:

- 입력 파일은 내부 처리 전에 normalized path 기준으로 정렬합니다.
- Windows 경로 구분자 `\`는 비교용 key에서 `/`로 정규화합니다.
- group key는 `intent:fileType:area`처럼 명시적 문자열로 만듭니다.
- groupName은 소문자, 하이픈 기반 slug로 생성합니다.
- 그룹 정렬은 type 우선순위, area, groupName, 첫 번째 파일 경로 순서로 고정합니다.
- 중복 파일은 첫 번째 유효 항목만 사용하거나 metadata를 병합하되 결과 순서는 유지합니다.

## 8. 보안 및 데이터 보호 기준

- grouping 함수는 diff 원문을 입력으로 받더라도 출력하거나 저장하지 않습니다.
- logger에는 파일 경로와 groupName 정도만 출력할 수 있으며, diff 내용과 summary 원문 전체는 출력하지 않습니다.
- `.env`, `credentials.json`, `secrets.json`, `*.pem`, `*.key`, private key 후보 파일은 앞선 보안 gate에서 제외되어야 합니다.
- grouping 단계에서 민감 파일이 입력으로 들어오면 내용을 읽지 말고 `sensitive` 또는 `chore` 후보로 분리하거나 상위 flow가 차단하도록 오류를 반환합니다.
- 외부 AI provider 호출은 이 단계에서 수행하지 않습니다.
- Git 히스토리를 변경하는 명령은 이 단계에서 호출하지 않습니다.

## 9. 권장 구현 흐름

```javascript
export function groupFilesByIntent(items, options = {}) {
  const normalizedItems = normalizeGroupingItems(items);
  const candidates = buildGroupCandidates(normalizedItems, options);
  const mergedGroups = mergeTooSmallGroups(candidates, options);

  return finalizeGroups(mergedGroups);
}
```

보조 함수 후보:

- `normalizeGroupingItems(items)`
- `getFileArea(file)`
- `buildGroupKey(item)`
- `mergeTooSmallGroups(groups, options)`
- `selectGroupType(items)`
- `selectGroupName(items, type)`
- `sortGroups(groups)`

## 10. 완료 기준

- 변경 파일 목록이 하나 이상의 커밋 그룹으로 나뉩니다.
- 파일 유형과 intent가 모두 grouping 기준에 반영됩니다.
- too-small group 병합 규칙이 명확히 구현됩니다.
- 각 그룹에는 대표 Conventional Commit type이 있습니다.
- 입력 순서가 바뀌어도 출력 group 구조와 순서가 동일합니다.
- diff 원문, secret, credentials 내용이 로그나 결과에 포함되지 않습니다.
- 구현은 `src/core/grouping.js`에 격리되고, Git 명령이나 provider 호출을 수행하지 않습니다.
