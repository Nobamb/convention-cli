# Phase 3 / O File Grouping Agent Test

`research-O.md` 기준으로 변경 파일 grouping이 파일 유형과 변경 의도를 함께 반영하고, 너무 작은 그룹 병합, group type 선택, 결정적 동작, 보안 제약을 지키는지 검증합니다.

## 1. 정적 검증 항목

| ID | 테스트 항목 | 검증 방법 | 예상 결과 |
| :-- | :-- | :-- | :-- |
| O-V-1 | grouping 함수 존재 | `src/core/grouping.js` 확인 | `groupFilesByIntent()` 또는 동등한 공개 함수가 존재합니다. |
| O-V-2 | provider 호출 없음 | import와 함수 호출 확인 | grouping 단계에서 `src/core/ai.js`나 provider를 직접 호출하지 않습니다. |
| O-V-3 | Git 명령 호출 없음 | `execFileSync`, `spawnSync`, `git` 호출 확인 | grouping 함수는 Git 히스토리나 index를 변경하지 않습니다. |
| O-V-4 | 허용 type 제한 | type selection 로직 확인 | `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore` 외 type을 반환하지 않습니다. |
| O-V-5 | 결정적 정렬 | sort 로직 확인 | 파일과 그룹이 명시적 key 기준으로 정렬됩니다. |
| O-V-6 | diff 원문 출력 금지 | logger/error 호출 확인 | diff, secret, provider 응답 원문을 출력하지 않습니다. |

## 2. 기능 테스트 항목

### O-T-1: 같은 intent의 source 파일 grouping

- **준비:** `src/auth/login.js`, `src/auth/session.js`가 모두 `intent: "feat"`, `fileType: "source"`를 갖도록 입력합니다.
- **실행:** `groupFilesByIntent(items)`를 호출합니다.
- **예상 결과:** 두 파일이 하나의 `feat` 그룹으로 묶이고 groupName은 인증 또는 login 영역을 반영합니다.

### O-T-2: source와 관련 test 파일 병합

- **준비:** `src/auth/login.js`는 `feat/source`, `src/auth/login.test.js`는 `test/test`로 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** test 파일이 관련 source 그룹에 병합되고, 대표 type은 `feat`를 유지합니다.

### O-T-3: docs-only 그룹 type 선택

- **준비:** `README.md`, `docs/grouping.md`를 `fileType: "docs"`, `intent: "docs"`로 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** 하나의 `docs` 그룹 또는 docs 영역별 그룹이 생성되고 대표 type은 `docs`입니다.

### O-T-4: dependency/config 그룹 type 선택

- **준비:** `package.json`, `package-lock.json`, `.github/workflows/test.yml`을 dependency/config 유형으로 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** dependency와 config 변경이 `chore` type 그룹으로 묶입니다.

### O-T-5: too-small test group 병합

- **준비:** source 그룹 1개와 test 단일 파일 그룹 1개가 생기도록 입력합니다.
- **실행:** `minGroupFileCount: 2` 옵션으로 grouping을 수행합니다.
- **예상 결과:** test 단일 그룹이 같은 basename 또는 같은 디렉터리 source 그룹에 병합됩니다.

### O-T-6: too-small orphan group 처리

- **준비:** 관련 그룹을 찾을 수 없는 단일 파일 `scripts/migrate.js`를 `intent: null`, `fileType: "source"`로 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** 파일은 누락되지 않고 `chore-misc` 또는 동등한 fallback 그룹에 포함됩니다.

### O-T-7: group type 동률 처리

- **준비:** 한 그룹 후보 안에 `feat` 1개, `fix` 1개, `test` 1개 intent가 있도록 입력합니다.
- **실행:** grouping 또는 `selectGroupType()`을 호출합니다.
- **예상 결과:** 정의된 type 우선순위에 따라 `feat`가 선택됩니다.

### O-T-8: 알 수 없는 intent 정규화

- **준비:** `intent: "perf"` 또는 `intent: "unknown"`인 파일을 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** 허용되지 않는 intent는 `chore` 또는 관련 허용 type으로 정규화되고 오류 없이 처리됩니다.

### O-T-9: 입력 순서와 무관한 결정적 결과

- **준비:** 같은 파일 metadata 배열을 정방향과 역방향으로 준비합니다.
- **실행:** 각각 `groupFilesByIntent()`를 호출합니다.
- **예상 결과:** 두 결과의 group 순서, groupName, type, files 순서가 동일합니다.

### O-T-10: Windows 경로 구분자 정규화

- **준비:** `src\\auth\\login.js`와 `src/auth/login.test.js`를 섞어 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** 비교와 groupName 생성에는 `/` 기준 normalized path가 사용되고, 관련 파일이 같은 그룹으로 묶입니다.

### O-T-11: 중복 파일 입력 처리

- **준비:** 같은 파일 경로가 두 번 들어가되 metadata가 일부 다르게 입력됩니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** 출력 `files`에는 해당 파일이 한 번만 포함되고 결과 순서가 안정적입니다.

### O-T-12: 빈 입력 처리

- **준비:** 빈 배열 또는 `null` 입력을 전달합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** 빈 배열을 반환하거나 명확한 validation 오류를 던지며, Git 작업이나 provider 호출은 발생하지 않습니다.

### O-T-13: 민감 파일 입력 차단 또는 분리

- **준비:** `.env`, `credentials.json`, `private.key` 같은 민감 파일 후보를 metadata로 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** 파일 내용을 읽지 않고 상위 보안 gate가 차단할 수 있는 결과 또는 명확한 오류를 반환합니다. 파일 내용은 출력하지 않습니다.

### O-T-14: diff 원문 로그 노출 방지

- **준비:** item에 `diff: "SECRET_SENTINEL=do-not-print"` 필드를 포함하고 logger를 spy 처리합니다.
- **실행:** 성공 및 실패 케이스로 grouping을 수행합니다.
- **예상 결과:** stdout, stderr, logger 인자에 `SECRET_SENTINEL`이 포함되지 않습니다.

### O-T-15: generated 파일 분리

- **준비:** `src/index.js`는 source, `dist/index.js`는 generated로 입력합니다.
- **실행:** grouping을 수행합니다.
- **예상 결과:** generated 파일은 기본적으로 `chore` 그룹으로 분리되며 source 기능 그룹의 type을 오염시키지 않습니다.

## 3. 통합 테스트 항목

### O-I-1: Phase M/N 결과와 연결

- **준비:** `classifyChangedFiles()`와 `analyzeDiffIntent()`의 mock 결과를 결합한 metadata 배열을 만듭니다.
- **실행:** `groupFilesByIntent()`에 전달합니다.
- **예상 결과:** fileType과 intent가 모두 반영된 grouping 결과가 생성됩니다.

### O-I-2: Grouping Preview 입력 호환성

- **준비:** grouping 결과를 Phase P preview가 기대하는 `{ groupName, type, files }` 형태로 전달합니다.
- **실행:** preview mock 함수에 전달합니다.
- **예상 결과:** 추가 변환 없이 groupName, type, files를 사용할 수 있습니다.

### O-I-3: Grouped Commit Flow 입력 호환성

- **준비:** grouping 결과의 각 group files를 `getFileDiffs(files)`에 전달하는 mock flow를 구성합니다.
- **실행:** 각 그룹을 순회합니다.
- **예상 결과:** 모든 changed file이 정확히 한 그룹에만 포함되어 그룹별 commit flow가 중복 없이 실행될 수 있습니다.

## 4. 테스트 절차

1. grouping 단위 테스트에서는 Git 저장소를 직접 변경하지 않고 순수 배열 입력을 사용합니다.
2. Git wrapper가 필요한 통합 검증은 `fixtures/test-repo` 또는 임시 테스트 저장소에서만 수행합니다.
3. logger spy에 secret sentinel을 넣어 diff 원문 출력 여부를 확인합니다.
4. 같은 입력을 여러 순서로 섞어 결과가 동일한지 확인합니다.
5. 기존 회귀 테스트인 `npm test`를 함께 실행해 commit flow와 provider routing에 영향이 없는지 확인합니다.

## 5. 검증 결과 요약

- **모든 항목 통과 시:** grouping은 파일 유형과 intent를 안정적으로 반영하며, too-small group 병합과 대표 type 선택이 예측 가능하게 동작합니다.
- **실패 항목 존재 시:** 파일 누락, 중복 그룹 포함, type 오염, 비결정적 정렬, diff 원문 노출 여부를 우선 수정합니다.
