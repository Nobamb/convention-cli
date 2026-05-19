# V. Template Command Agent 테스트 계획

## 테스트 목표

`--template` 계열 CLI 라우팅이 정상 동작하고, 템플릿 초기화/조회/검증 명령이 commit flow와 분리되어 실행되는지 확인한다.

대상 명령은 다음과 같다.

- `convention --template`
- `convention --template init`
- `convention --template show`
- `convention --template validate`

## CLI 라우팅 테스트

| 케이스 | 명령 | 기대 결과 |
| --- | --- | --- |
| 기본 template 명령 | `node bin/convention.js --template` | 템플릿 안내 또는 현재 템플릿 상태를 출력하고 commit flow를 실행하지 않는다. |
| init 라우팅 | `node bin/convention.js --template init` | `src/commands/template.js`의 init 흐름으로 분기한다. |
| show 라우팅 | `node bin/convention.js --template show` | show 흐름으로 분기한다. |
| validate 라우팅 | `node bin/convention.js --template validate` | validate 흐름으로 분기한다. |
| 알 수 없는 action | `node bin/convention.js --template unknown` | 지원하지 않는 template action 오류를 출력하고 commit flow로 fallback하지 않는다. |
| 기존 설정 명령 우선순위 | `node bin/convention.js --set-mode batch --template show` | 설정 명령 우선순위 정책에 맞게 commit flow 없이 처리한다. |

## Init 동작 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 템플릿 파일이 없음 | 격리된 Git 테스트 저장소에 `.convention/template.json`이 없음 | 기본 템플릿 파일을 생성한다. |
| 템플릿 디렉터리가 없음 | `.convention` 디렉터리 없음 | 필요한 디렉터리를 생성하고 템플릿을 저장한다. |
| 기존 템플릿 파일 존재 | `.convention/template.json`이 이미 있음 | 사용자 데이터 보호를 위해 자동 overwrite하지 않는다. |
| Git 저장소 밖 실행 | 임시 일반 디렉터리에서 실행 | 프로젝트 템플릿 생성 불가 메시지를 출력하거나 안전하게 중단한다. |
| 경로 안전성 | Windows/macOS/Linux 경로 mock | `path.join()` 기반 경로가 사용되는지 확인한다. |

## Show 동작 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 프로젝트 템플릿 존재 | `.convention/template.json` 존재 | 프로젝트 템플릿 내용을 요약 출력하고 출처를 표시한다. |
| 사용자 템플릿만 존재 | 프로젝트 템플릿 없음, 사용자 템플릿 존재 | 사용자 템플릿을 출력하고 출처를 표시한다. |
| 템플릿 없음 | 프로젝트/사용자 템플릿 없음 | 기본 템플릿을 출력하거나 기본 템플릿 사용 사실을 안내한다. |
| invalid template 존재 | schema가 틀린 템플릿 존재 | 경고 후 기본 템플릿 fallback 결과를 출력한다. |
| 민감 문자열 포함 | 템플릿에 `TOKEN=` 등 민감 패턴 포함 | raw template 전체를 dump하지 않고 원문 secret을 `[REDACTED]`로 마스킹하거나 경고 처리한다. |

## Validate 동작 테스트

| 케이스 | 준비 | 기대 결과 |
| --- | --- | --- |
| 정상 템플릿 | 필수 필드와 rules가 모두 올바름 | 검증 성공 메시지를 출력한다. |
| 필수 필드 누락 | `format` 또는 `types` 누락 | 실패 필드와 사유를 요약 출력한다. |
| 잘못된 type | `types`에 `feature`, `bug` 포함 | 허용되지 않는 type 오류를 출력한다. |
| 잘못된 language | `language: "kr"` | 지원하지 않는 언어 오류를 출력한다. |
| 잘못된 maxLength | `rules.maxLength`가 문자열 | 타입 오류를 출력한다. |
| 깨진 JSON | 템플릿 파일이 JSON parse 불가 | 파일 내용 전체를 출력하지 않고 parse 실패만 알린다. |
| invalid fallback | invalid template 존재 | CLI가 중단되지 않고 기본 템플릿 fallback 가능 상태를 표시한다. |

## Invalid Template Fallback 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| 프로젝트 템플릿 invalid, 사용자 템플릿 valid | 사용자 템플릿 또는 정의된 fallback 우선순위에 따라 안전한 템플릿을 선택한다. |
| 프로젝트/사용자 템플릿 모두 invalid | 기본 템플릿으로 fallback한다. |
| fallback 발생 | 경고 메시지에 fallback 발생 사실과 선택된 출처가 포함된다. |
| fallback 중 오류 발생 | commit flow로 넘어가지 않고 명확한 오류로 종료한다. |

## Commit Flow 미실행 테스트

`--template` 계열 명령에서는 다음 함수 또는 Git 명령이 호출되지 않아야 한다.

- `runDefaultCommit()`
- `runStepCommit()`
- `runBatchCommit()`
- `getChangedFiles()`
- `getFullDiff()`
- `getFileDiffs()`
- `generateCommitMessage()`
- `addAll()`
- `addFile()`
- `commit()`
- `push()`
- `resetLastCommit()`

권장 테스트 방식은 commit command와 git wrapper를 mock 처리한 뒤 호출 횟수가 0인지 확인하는 것이다.

확인 명령 후보:

```bash
node bin/convention.js --template
node bin/convention.js --template init
node bin/convention.js --template show
node bin/convention.js --template validate
```

각 명령 실행 후 격리된 테스트 저장소에서 다음을 확인한다.

- 새 commit이 생성되지 않는다.
- staging 상태가 변경되지 않는다.
- remote push가 발생하지 않는다.
- reset이 발생하지 않는다.
- diff 원문이 로그에 출력되지 않는다.

## 보안 및 로깅 테스트

| 케이스 | 기대 결과 |
| --- | --- |
| 템플릿 파일에 `API_KEY=` 포함 | 출력에 secret 원문이 나타나지 않는다. |
| 템플릿 파일에 `PASSWORD=` 포함 | 출력에 secret 원문이 나타나지 않는다. |
| 템플릿 파일에 `-----BEGIN PRIVATE KEY-----` 포함 | 민감정보 경고 또는 마스킹 처리된다. |
| credentials 파일 존재 | `credentials.json` 내용을 읽거나 출력하지 않는다. |
| `.env` 파일 존재 | template command가 `.env` 내용을 출력하지 않는다. |
| JSON parse 실패 | 파일 전체 원문을 로그에 출력하지 않는다. |
| 오류 출력 | token, remote URL 인증 정보, diff 원문이 포함되지 않는다. |

## 격리 원칙

- 테스트는 실제 사용자 저장소에서 자동 commit, reset, push를 수행하지 않는다.
- Git 관련 확인은 `fixtures/test-repo` 또는 임시 테스트 디렉터리를 사용한다.
- 외부 네트워크 호출은 발생하지 않아야 한다.
- 실제 credentials 파일을 읽는 테스트를 만들지 않는다.

## 완료 기준

- 네 가지 template command가 모두 올바른 command handler로 라우팅된다.
- init/show/validate가 각각 기대 동작을 수행한다.
- invalid template fallback이 명확히 동작한다.
- `--template` 계열 명령이 commit flow를 실행하지 않는다.
- 민감정보와 diff 원문이 로그에 노출되지 않는다.
