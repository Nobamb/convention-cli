# Template 사용 가이드

이 문서는 팀별 커밋 컨벤션 템플릿을 만들고 적용하는 방법을 정리합니다.

## 검색 순서

Convention CLI는 다음 순서로 template을 찾습니다.

1. 프로젝트 루트 `.convention/template.json`
2. 프로젝트 루트 `.conventionrc`
3. 사용자 홈 `~/.config/convention/template.json`
4. 기본 template

프로젝트 template이 있으면 사용자 template보다 우선합니다.

## 명령

```bash
convention --template
convention --template init
convention --template show
convention --template validate
```

## Template Schema

```json
{
  "name": "default",
  "language": "ko",
  "format": "{type}: {message}",
  "types": ["feat", "fix", "refactor", "docs", "style", "test", "chore"],
  "rules": {
    "maxLength": 72,
    "requireScope": false,
    "allowEmoji": false
  }
}
```

## 필드 설명

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `name` | string | template 이름입니다. |
| `language` | string | `ko`, `en`, `jp`, `cn` 중 하나입니다. |
| `format` | string | `{type}`, `{message}` placeholder를 포함해야 합니다. |
| `types` | string[] | 허용할 Conventional Commit type 목록입니다. |
| `rules.maxLength` | number | 권장 최대 제목 길이입니다. |
| `rules.requireScope` | boolean | scope 필수 여부입니다. |
| `rules.allowEmoji` | boolean | emoji 허용 여부입니다. |

## 적용 방식

template은 commit prompt에 반영됩니다.

반영 항목:

- 허용 type
- 메시지 format
- language
- maxLength
- scope 필수 여부
- emoji 허용 여부

## 잘못된 Template 처리

template JSON이 깨졌거나 schema가 맞지 않으면 raw 파일 내용을 출력하지 않습니다.

이 처리는 안전한 fallback 정책으로 동작합니다.

처리 기준:

- 가능한 경우 다음 후보 template으로 넘어갑니다.
- 모든 후보가 invalid이면 기본 template을 사용합니다.
- 오류 메시지에는 secret 의심 값을 마스킹합니다.

## 보안 주의사항

- template show는 secret처럼 보이는 값을 마스킹해서 출력합니다.
- template 파일에 API Key나 token을 저장하지 않습니다.
- `.convention/template.json` 생성 전 기존 파일이 있으면 덮어쓰기 여부를 확인합니다.
