## 1차 MVP 내용

1. gemini-3.1-flash-lite-preview 모델 4개를 활용해서 research-A.md, agents.md, gemini.md의 내용을 파악해서 각 작업을 진행해주고, gemini-3.1-pro-preview 모델을 통해서 전체적인 작업에 대해 문제가 없는지 확인해줘

1-1. .gitignore/README.md/convention.js 총 3개의 파일들에 대해서 각 파일마다 하나씩 gemini-3.1-flash-lite-preview 모델을 통해서 총 3개의 agent들로 한국어로 파일 내의 코드들에 대해 주석 자세하게 써주고, 전체적인 점검은 gemini-3.1-pro-preview 모델로 확인해줘

1-2. @work_process/mvp-1/research-A.md 에서 실제로 조건을 충족했는지 알기 위한 필수  
 테스트 내용에 대한 마크다운 파일도 만들어줄래? @work_process/mvp-1/에서
test-A.md라는 파일을 한국어로 적어줘

2. @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 B 단계 참고해서 B단계가 잘  
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 B폴더 만들면서 그 폴더 내에 test-B.md로
   만들어서 정리해줘 @work_process/mvp-1/A/test-A.md 의 양식을 참고해서  
   만들어도 좋아

3. @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 C 단계 참고해서 C단계가 잘  
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 C폴더 만들면서 그 폴더 내에 test-C.md로
   만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/C에 research-C.md 파일로 정리해줘

4. @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 D 단계 참고해서 D단계가 잘  
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 D폴더 만들면서 그 폴더 내에 test-D.md로
   만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/D에 research-D.md 파일로 정리해줘

5. @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 E 단계 참고해서 E단계가 잘  
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 E폴더 만들면서 그 폴더 내에 test-E.md로
   만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/E에 research-E.md 파일로 정리해줘

5-1. @work_process/mvp-1/E/test-E.md 내용의 각 테스트 내용들 agent들 모델 gemini 3.1 flash  
 lite 2개로 v-2,v-3 작업 해보고 gemini 3.1 pro preview 모델로 각 테스트 잘 동작하는지  
 검증해서 검증상 이상있는 부분 수정 작업까지 해

6. @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 F 단계 참고해서 F단계가 잘  
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 F폴더 만들면서 그 폴더 내에 test-F.md로
   만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/F에 research-F.md 파일로 정리해줘

6-1. @work_process/mvp-1/F/research-F.md 내용의 각 세부 구현 내용들에 해당하는 작업목표들을 파악을 해서 각 목표들을 세부 구현계획에 맞추어서 4개의 gemini-3.1-flash-lite agent를 사용해서 순차적으로 작업해주고, 최종점검은 gemini-3.1-pro-preview 모델로 각 테스트 잘 동작하는지 검증해서 검증상 이상있는 부분 수정 작업까지 해(현재 @work_process/mvp-1/test-F.md의 양식 참고해서 test상으로 이상없는지도 파악해주면 돼)

6-2. init/prompt.md의 6번 내용을 기반으로 mvp 1차에서 할 전반적인 내용들에 대해 각 단계에서 test관련 md파일 및 research 관련 md파일을 만드는 것에 대한 프롬프트용 내용 작성을 gpt 5.5 low 모델 agent를 통해 G단계부터 X단계까지 각 단계마다 agent를 하나씩 배정하는 식으로 다수 배치해서 init/prompt.md 파일에서 쭉 이어서 진행해주었으면 좋겠어 6-2 부분의 밑에서부터 7번으로 시작해서 쭉 작성을 해주면 좋겠고 예를 들어서 7번의 경우에는 6번의 내용을 대부분 복사하되, 6번에 있는 F 부분을 G로 수정해주면 돼, 그리고 8번의 경우에는 F대신 H로 바꿔주면 되고,이런식으로 X까지 반복해주면 돼 최종적으로 gpt 5.5 high 모델로 init/prompt.md의 7번부터 쭉 검증해서 내용에 오류가 있는지 파악 한번만 더 진행해

7. gpt-5.5 low 모델 agent 1개를 G 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 G 단계 참고해서 G단계가 잘
   진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 G폴더 만들면서 그 폴더 내에 test-G.md로
   만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/G에 research-G.md 파일로 정리해줘

7-1. G 단계는 설정 파일 읽기 Agent이므로 @work_process/mvp-1/G/research-G.md 내용에는 loadConfig() 구현 목표, config.json 존재 여부 확인, 파일이 없을 때 DEFAULT_CONFIG 반환, JSON parse 실패 처리, 저장된 설정 병합 기준을 정리해줘. @work_process/mvp-1/G/test-G.md 내용에는 설정 파일이 없는 경우, 정상 JSON이 있는 경우, 깨진 JSON이 있는 경우, DEFAULT_CONFIG 필드가 유지되는 경우를 테스트하는 항목을 한국어로 정리해줘.

8. gpt-5.5 low 모델 agent 1개를 H 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 H 단계 참고해서 H단계가 잘
   진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 H폴더 만들면서 그 폴더 내에 test-H.md로
   만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/H에 research-H.md 파일로 정리해줘

8-1. H 단계는 설정 파일 쓰기 Agent이므로 @work_process/mvp-1/H/research-H.md 내용에는 ensureConfigDir(), saveConfig(config), ~/.config/convention/config.json 생성, JSON pretty format 저장, path.join()과 os.homedir() 사용 기준을 정리해줘. @work_process/mvp-1/H/test-H.md 내용에는 config 디렉터리 자동 생성, 저장 후 재로드, 기존 값 덮어쓰기, Windows/macOS/Linux 경로 안전성을 테스트하는 항목을 한국어로 정리해줘.

9. gpt-5.5 low 모델 agent 1개를 I 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 I 단계 참고해서 I단계가 잘
   진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
   @work_process/mvp-1/에 I폴더 만들면서 그 폴더 내에 test-I.md로
   만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/I에 research-I.md 파일로 정리해줘

9-1. I 단계는 --set-mode Agent이므로 @work_process/mvp-1/I/research-I.md 내용에는 setMode(mode), step/batch 검증, 기존 config 로드, mode 변경 후 저장, 실패 메시지 처리 기준을 정리해줘. @work_process/mvp-1/I/test-I.md 내용에는 convention --set-mode step, convention --set-mode batch, 잘못된 값 fast 입력, 저장값 유지 여부를 테스트하는 항목을 한국어로 정리해줘.

10. gpt-5.5 low 모델 agent 1개를 J 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 J 단계 참고해서 J단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 J폴더 만들면서 그 폴더 내에 test-J.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/J에 research-J.md 파일로 정리해줘

10-1. J 단계는 --language Agent이므로 @work_process/mvp-1/J/research-J.md 내용에는 setLanguage(language), ko/en/jp/cn 검증, 기존 config 로드, language 변경 후 저장, prompt 생성 단계와의 연결 기준을 정리해줘. @work_process/mvp-1/J/test-J.md 내용에는 convention --language ko/en/jp/cn, 잘못된 언어값 입력, 저장 후 loadConfig 반영 여부를 테스트하는 항목을 한국어로 정리해줘.

11. gpt-5.5 low 모델 agent 1개를 K 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 K 단계 참고해서 K단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 K폴더 만들면서 그 폴더 내에 test-K.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/K에 research-K.md 파일로 정리해줘

11-1. K 단계는 Validator Agent이므로 @work_process/mvp-1/K/research-K.md 내용에는 isValidMode(mode), isValidLanguage(language), 빈 값 검증, 추후 provider 검증 확장 가능성을 정리해줘. @work_process/mvp-1/K/test-K.md 내용에는 유효 mode, 무효 mode, 유효 language, 무효 language, null/undefined/빈 문자열 입력을 테스트하는 항목을 한국어로 정리해줘.

12. gpt-5.5 low 모델 agent 1개를 L 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 L 단계 참고해서 L단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 L폴더 만들면서 그 폴더 내에 test-L.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/L에 research-L.md 파일로 정리해줘

12-1. L 단계는 Logger Agent이므로 @work_process/mvp-1/L/research-L.md 내용에는 success(), error(), warn(), info() 함수, 직접 console.log 남발 방지, 메시지 스타일 통일 기준을 정리해줘. @work_process/mvp-1/L/test-L.md 내용에는 각 logger 함수 호출, 메시지 prefix 확인, config/commit command에서 재사용 가능한지 확인하는 테스트 항목을 한국어로 정리해줘.

13. gpt-5.5 low 모델 agent 1개를 M 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 M 단계 참고해서 M단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 M폴더 만들면서 그 폴더 내에 test-M.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/M에 research-M.md 파일로 정리해줘

13-1. M 단계는 Git 저장소 확인 Agent이므로 @work_process/mvp-1/M/research-M.md 내용에는 isGitRepository(), git rev-parse --is-inside-work-tree, execFileSync 또는 spawnSync 인자 배열 사용, Git 저장소 밖 에러 처리 기준을 정리해줘. @work_process/mvp-1/M/test-M.md 내용에는 격리된 Git 저장소 내부 실행, Git 저장소 밖 실행, git 명령 실패 상황을 테스트하는 항목을 한국어로 정리해줘.

14. gpt-5.5 low 모델 agent 1개를 N 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 N 단계 참고해서 N단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 N폴더 만들면서 그 폴더 내에 test-N.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/N에 research-N.md 파일로 정리해줘

14-1. N 단계는 Git 변경 파일 목록 Agent이므로 @work_process/mvp-1/N/research-N.md 내용에는 getChangedFiles(), git -c core.quotepath=false status --porcelain, 변경 파일 목록 파싱, 한글 파일명 처리, 빈 목록 처리 기준을 정리해줘. @work_process/mvp-1/N/test-N.md 내용에는 수정 파일, 신규 파일, 삭제 파일, 공백/한글 파일명, 변경사항 없음 케이스를 테스트하는 항목을 한국어로 정리해줘.

15. gpt-5.5 low 모델 agent 1개를 O 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 O 단계 참고해서 O단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 O폴더 만들면서 그 폴더 내에 test-O.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/O에 research-O.md 파일로 정리해줘

15-1. O 단계는 Git diff 전체 추출 Agent이므로 @work_process/mvp-1/O/research-O.md 내용에는 getFullDiff(), git -c core.quotepath=false diff HEAD, staged/unstaged 포함 기준, UTF-8 출력 처리, diff 원문 로그 출력 금지 기준을 정리해줘. @work_process/mvp-1/O/test-O.md 내용에는 unstaged 변경, staged 변경, 신규 파일, 한글 파일명, 변경사항 없음 케이스를 테스트하는 항목을 한국어로 정리해줘.

16. gpt-5.5 low 모델 agent 1개를 P 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 P 단계 참고해서 P단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 P폴더 만들면서 그 폴더 내에 test-P.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/P에 research-P.md 파일로 정리해줘

16-1. P 단계는 Git diff 파일별 추출 Agent이므로 @work_process/mvp-1/P/research-P.md 내용에는 getFileDiffs(files), 파일별 git diff HEAD -- file 실행, 공백/한글 파일명 안전 처리, diff가 없는 파일 제외 기준을 정리해줘. @work_process/mvp-1/P/test-P.md 내용에는 여러 파일 변경, 파일별 diff 분리, 공백 포함 파일명, 한글 파일명, diff 없는 파일 제외를 테스트하는 항목을 한국어로 정리해줘.

17. gpt-5.5 low 모델 agent 1개를 Q 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 Q 단계 참고해서 Q단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 Q폴더 만들면서 그 폴더 내에 test-Q.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/Q에 research-Q.md 파일로 정리해줘

17-1. Q 단계는 Git add Agent이므로 @work_process/mvp-1/Q/research-Q.md 내용에는 addAll(), addFile(file), batch 모드 git add -A, step 모드 파일별 git add, shell 문자열 삽입 금지, 실패 시 에러 처리 기준을 정리해줘. @work_process/mvp-1/Q/test-Q.md 내용에는 격리 테스트 저장소에서 전체 staging, 파일별 staging, 공백/한글 파일명 staging, 실패 케이스를 테스트하는 항목을 한국어로 정리해줘.

18. gpt-5.5 low 모델 agent 1개를 R 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 R 단계 참고해서 R단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 R폴더 만들면서 그 폴더 내에 test-R.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/R에 research-R.md 파일로 정리해줘

18-1. R 단계는 Git commit Agent이므로 @work_process/mvp-1/R/research-R.md 내용에는 commit(message), git commit -m 실행, Conventional Commits 메시지 사용, UTF-8 메시지 처리, 사용자 confirm 이후에만 호출되는 구조를 정리해줘. @work_process/mvp-1/R/test-R.md 내용에는 격리 테스트 저장소에서 정상 커밋, 한글 메시지, 빈 메시지 거부, staged 파일 없음 실패를 테스트하는 항목을 한국어로 정리해줘.

19. gpt-5.5 low 모델 agent 1개를 S 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 S 단계 참고해서 S단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 S폴더 만들면서 그 폴더 내에 test-S.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/S에 research-S.md 파일로 정리해줘

19-1. S 단계는 Prompt 생성 Agent이므로 @work_process/mvp-1/S/research-S.md 내용에는 buildCommitPrompt({ diff, language, mode }), Conventional Commits 규칙, 허용 type, 설정 언어 반영, 커밋 메시지만 반환 조건, 민감 diff 취급 주의사항을 정리해줘. @work_process/mvp-1/S/test-S.md 내용에는 ko/en/jp/cn 언어별 prompt, step/batch mode별 prompt, 빈 diff, Conventional Commits 조건 포함 여부를 테스트하는 항목을 한국어로 정리해줘.

20. gpt-5.5 low 모델 agent 1개를 T 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 T 단계 참고해서 T단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 T폴더 만들면서 그 폴더 내에 test-T.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/T에 research-T.md 파일로 정리해줘

20-1. T 단계는 AI 호출 Agent이지만 1차 MVP에서는 외부 AI API보다 Mock Provider를 우선하므로 @work_process/mvp-1/T/research-T.md 내용에는 generateCommitMessage(prompt, config), provider routing, src/providers/mock.js, 기본 반환값 chore: update project files, 외부 API 전송 전 사용자 확인 필요 조건을 정리해줘. @work_process/mvp-1/T/test-T.md 내용에는 mock provider 기본 응답, provider가 null인 경우, prompt 입력 전달, 외부 네트워크 호출이 발생하지 않는지 확인하는 테스트 항목을 한국어로 정리해줘.

21. gpt-5.5 low 모델 agent 1개를 U 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 U 단계 참고해서 U단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 U폴더 만들면서 그 폴더 내에 test-U.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/U에 research-U.md 파일로 정리해줘

21-1. U 단계는 AI 응답 정리 Agent이므로 @work_process/mvp-1/U/research-U.md 내용에는 cleanAIResponse(response), 앞뒤 공백 제거, markdown 코드블록 제거, 불필요한 따옴표 제거, 첫 번째 유효 라인 선택 기준, 빈 응답 에러 처리를 정리해줘. @work_process/mvp-1/U/test-U.md 내용에는 일반 응답, 코드블록 응답, 따옴표 포함 응답, 여러 줄 응답, 빈 응답을 테스트하는 항목을 한국어로 정리해줘.

22. gpt-5.5 low 모델 agent 1개를 V 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 V 단계 참고해서 V단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 V폴더 만들면서 그 폴더 내에 test-V.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/V에 research-V.md 파일로 정리해줘

22-1. V 단계는 Batch 모드 Agent이므로 @work_process/mvp-1/V/research-V.md 내용에는 runBatchCommit(), Git 저장소 확인, 변경사항 확인, 전체 diff 추출, prompt 생성, mock AI 메시지 생성, 사용자 confirm, git add -A, git commit 순서를 정리해줘. @work_process/mvp-1/V/test-V.md 내용에는 Git 저장소 아님, 변경사항 없음, batch 커밋 정상 흐름, confirm 거부 시 커밋하지 않음, 민감 파일 제외 조건을 테스트하는 항목을 한국어로 정리해줘.

23. gpt-5.5 low 모델 agent 1개를 W 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 W 단계 참고해서 W단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 W폴더 만들면서 그 폴더 내에 test-W.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/W에 research-W.md 파일로 정리해줘

23-1. W 단계는 Step 모드 Agent이므로 @work_process/mvp-1/W/research-W.md 내용에는 runStepCommit(), 변경 파일 목록 확인, 파일별 diff 추출, 파일별 prompt 생성, 파일별 mock AI 메시지 생성, 파일별 confirm, 파일별 git add와 commit 순서를 정리해줘. @work_process/mvp-1/W/test-W.md 내용에는 여러 파일 각각 커밋, 파일별 confirm 거부, diff 없는 파일 제외, 일부 파일 실패 시 처리, 민감 파일 제외 조건을 테스트하는 항목을 한국어로 정리해줘.

24. gpt-5.5 low 모델 agent 1개를 X 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/01_mvp-1.md 의 X 단계 참고해서 X단계가 잘
    진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해
    @work_process/mvp-1/에 X폴더 만들면서 그 폴더 내에 test-X.md로
    만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-1/X에 research-X.md 파일로 정리해줘

24-1. X 단계는 기본 convention 실행 Agent이므로 @work_process/mvp-1/X/research-X.md 내용에는 runDefaultCommit(), config 로드, mode가 step이면 runStepCommit 호출, mode가 batch이면 runBatchCommit 호출, mode가 없거나 잘못되면 step 기본값 사용, bin/convention.js 라우팅 연결을 정리해줘. @work_process/mvp-1/X/test-X.md 내용에는 config.mode step, config.mode batch, config 없음, 잘못된 mode, convention 명령 기본 실행 흐름을 테스트하는 항목을 한국어로 정리해줘.

=============================================================================

## 2차 MVP 내용

1. AGENTS.md, GEMINI.md, init/00_rule.md, ** init/02_mvp-2.md ** 의 내용들을 참고해서 init/prompt.md의 내용을 2차 MVP 내용의 1번 아래에서부터 작성해서, 2번부터 시작해서 B단계부터 X단계까지 쭉 만들어줘 B~X단계까지의 각 단계는 gemini 3.0 flash 모델로 prompt.md의 각 단계를 하나씩 작성하도록 하고, 양식은 1차 MVP 내용에 있는 24번을 참고해서 2단계부터 작성하면 좋겠어 그리고 prompt의 B~X단계까지 작성할 프롬프트가 모두 작성이 완료되면 gemini 3.1 pro 모델로 init/02_mvp-2.md의 내용을 기반으로 prompt.md의 2차 MVP 내용에 있는 전반적인 내용들을 분석해서 2차 mvp 내용에 부합하는 내용들인지 파악을 해보면 좋겠어

### Phase 1. Provider 구조 기반 만들기

2. gemini 3.0 flash 모델 agent 1개를 B 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 B 단계 참고해서 B단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 B폴더 만들면서 그 폴더 내에 test-B.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/B에 research-B.md 파일로 정리해줘

2-1. B 단계는 Provider 인터페이스 정의 Agent이므로 @work_process/mvp-2/B/research-B.md 내용에는 Provider 공통 함수명 정의, generateCommitMessage/listModels/validateConfig 인터페이스 정의, Provider 라우팅 구조 초안 작성을 정리해줘. @work_process/mvp-2/B/test-B.md 내용에는 Provider가 변경되어도 core/ai.js에서 동일한 방식으로 호출 가능한지 확인하는 테스트 항목을 한국어로 정리해줘.

3. gemini 3.0 flash 모델 agent 1개를 C 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 C 단계 참고해서 C단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 C폴더 만들면서 그 폴더 내에 test-C.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/C에 research-C.md 파일로 정리해줘

3-1. C 단계는 Mock Provider 이전 Agent이므로 @work_process/mvp-2/C/research-C.md 내용에는 mock.js 생성, 항상 고정 커밋 메시지 반환, providers/index.js에서 mock 라우팅, core/ai.js가 mock Provider를 호출하도록 변경 로직을 정리해줘. @work_process/mvp-2/C/test-C.md 내용에는 provider가 mock일 때 기존 1차 MVP 커밋 흐름이 정상 동작하는지 확인하는 테스트 항목을 한국어로 정리해줘.

4. gemini 3.0 flash 모델 agent 1개를 D 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 D 단계 참고해서 D단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 D폴더 만들면서 그 폴더 내에 test-D.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/D에 research-D.md 파일로 정리해줘

4-1. D 단계는 Provider 목록 정의 Agent이므로 @work_process/mvp-2/D/research-D.md 내용에는 Stable/Experimental Provider 목록 정의, 2차 MVP 지원 Provider(mock, localLLM, gemini/openaiCompatible) 정의, isValidProvider(provider) 유효성 검증 함수 추가 로직을 정리해줘. @work_process/mvp-2/D/test-D.md 내용에는 isValidProvider(provider) 함수가 정상 동작하는지 확인하는 테스트 항목을 한국어로 정리해줘.

### Phase 2. localLLM 연동

5. gemini 3.0 flash 모델 agent 1개를 E 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 E 단계 참고해서 E단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 E폴더 만들면서 그 폴더 내에 test-E.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/E에 research-E.md 파일로 정리해줘

5-1. E 단계는 localLLM 기본 설정 Agent이므로 @work_process/mvp-2/E/research-E.md 내용에는 localLLM 기본 baseURL 정의, authType none 처리, localLLM config 검증, baseURL 누락 시 기본값 적용 로직을 정리해줘. @work_process/mvp-2/E/test-E.md 내용에는 localLLM 선택 시 기본 endpoint가 자동 적용되는지 확인하는 테스트 항목을 한국어로 정리해줘.

6. gemini 3.0 flash 모델 agent 1개를 F 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 F 단계 참고해서 F단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 F폴더 만들면서 그 폴더 내에 test-F.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/F에 research-F.md 파일로 정리해줘

6-1. F 단계는 localLLM 연결 확인 Agent이므로 @work_process/mvp-2/F/research-F.md 내용에는 baseURL 입력받기, /models 또는 /v1/models 요청, 연결 실패 및 timeout 처리, 사용자 안내 메시지 반환 로직을 정리해줘. @work_process/mvp-2/F/test-F.md 내용에는 로컬 LLM 서버가 켜져 있으면 연결 성공, 꺼져 있으면 안전하게 실패하는지 확인하는 테스트 항목을 한국어로 정리해줘.

7. gemini 3.0 flash 모델 agent 1개를 G 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 G 단계 참고해서 G단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 G폴더 만들면서 그 폴더 내에 test-G.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/G에 research-G.md 파일로 정리해줘

7-1. G 단계는 localLLM 모델 목록 조회 Agent이므로 @work_process/mvp-2/G/research-G.md 내용에는 /v1/models 호출, 응답 JSON 파싱, model.id 목록 추출, 빈 목록 및 오류 응답 처리 로직을 정리해줘. @work_process/mvp-2/G/test-G.md 내용에는 listModels(config)가 로컬 모델명 배열을 반환하는지 확인하는 테스트 항목을 한국어로 정리해줘.

8. gemini 3.0 flash 모델 agent 1개를 H 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 H 단계 참고해서 H단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 H폴더 만들면서 그 폴더 내에 test-H.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/H에 research-H.md 파일로 정리해줘

8-1. H 단계는 로컬 모델 선택 UI Agent이므로 @work_process/mvp-2/H/research-H.md 내용에는 prompts select UI 구현, 모델 목록을 choices로 변환, 방향키 선택, 선택한 모델명을 config에 저장하는 로직을 정리해줘. @work_process/mvp-2/H/test-H.md 내용에는 사용자가 localLLM 모델을 선택하면 modelVersion에 저장되는지 확인하는 테스트 항목을 한국어로 정리해줘.

8-2. localLLM을 연동하여 실행을 해보았을 때, 기존에 바뀐 문서에 대해서는 convention을 실행하면 스테이징을 따로 하지 않은 상태에서도 바로 적용이 되는데 새로 문서를 만들게 될 때에는 깃 스테이징을 안한 상태에서는 이에 대해서 동작이 되지 않아 새로 만든 파일에 대해서는 수동으로 스테이징을 해야 동작이 되는 상태거든 일단 새로운 문서를 만들었을 때에도 이에 대한 깃 컨벤션을 스테이징 및 커밋까지 한번에 적용하는 코드에 대해 문서와 테스트 코드를 작성해줘. 기존에 코드가 변경된 파일 외에도 새로 생성된 파일에 대해서도 convention이 적용되어야 해 새로 문서를 만든 파일에 대해서는 그 파일에 대한 전체적인 내용을 파악해서 그 내용에 대한 깃 컨벤션을 적용하게 하면 돼

8-3. 이번에는 깃 컨벤션에 대한 메시지를 생성할 때 이에 대해 이 메시지로 커밋할 것인지 물어보는 것을 설정으로 제어할 수 있었으면 좋겠어 우선 커밋에 대해 물어보는 것을 기본 설정값으로 하고, convention --question 또는 convention -q를 터미널에 입력하게 되면 메시지에 대해 물어볼 것인지 설정을 바꿀 수 있도록 해야 돼 각각의 값은 윗방향키, 아랫 방향키로 설정해서 엔터를 입력하면 각 설정값으로 변경할 수 있도록 해야 해 true와 false로 설정할 수 있으며 true는 커밋에 대해 물어보는 것이고, false는 물어보지 않는 형태로 하면 돼 그리고 false일 때에는 convention을 실행하면 메시지를 알아서 작성해서 커밋하는 형태로 작업을 해야 돼 이 작업 내용에 대해서 init/02_mvp-2.md 및 init/prd.md에 추가해주고, convention --help를 했을 때에도 이 내용이 추가되어야 하고, README.md에서도 사용법 부분에 해당 내용이 추가로 들어가야 돼

### Phase 3. API Key 인증과 클라우드 Provider

9. gemini 3.0 flash 모델 agent 1개를 I 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 I 단계 참고해서 I단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 I폴더 만들면서 그 폴더 내에 test-I.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/I에 research-I.md 파일로 정리해줘

9-1. I 단계는 API Key 입력 Agent이므로 @work_process/mvp-2/I/research-I.md 내용에는 비밀번호 입력 형태로 API Key 입력, 입력값 빈 값 검증, 화면 및 로그 출력 금지, credentials 저장 함수와의 연결 로직을 정리해줘. @work_process/mvp-2/I/test-I.md 내용에는 API Key가 화면과 로그에 노출되지 않고 안전하게 입력되는지 확인하는 테스트 항목을 한국어로 정리해줘.

10. gemini 3.0 flash 모델 agent 1개를 J 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 J 단계 참고해서 J단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 J폴더 만들면서 그 폴더 내에 test-J.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/J에 research-J.md 파일로 정리해줘

10-1. J 단계는 Credentials 저장 Agent이므로 @work_process/mvp-2/J/research-J.md 내용에는 ~/.config/convention/credentials.json 경로 정의, 파일 읽기/쓰기, 파일 권한 제한(600), config.json과 분리 저장 로직을 정리해줘. @work_process/mvp-2/J/test-J.md 내용에는 API Key가 config.json이 아니라 credentials.json에 저장되는지 확인하는 테스트 항목을 한국어로 정리해줘.

11. gemini 3.0 flash 모델 agent 1개를 K 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 K 단계 참고해서 K단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 K폴더 만들면서 그 폴더 내에 test-K.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/K에 research-K.md 파일로 정리해줘

11-1. K 단계는 API Key 보안 Agent이므로 @work_process/mvp-2/K/research-K.md 내용에는 로그 출력 시 API Key 마스킹, credentials 내용 출력 금지, JSON stringify 제한, 에러 메시지 키 포함 방지 로직을 정리해줘. @work_process/mvp-2/K/test-K.md 내용에는 어떤 성공/실패 메시지에도 API Key 원문이 출력되지 않는지 확인하는 테스트 항목을 한국어로 정리해줘.

12. gemini 3.0 flash 모델 agent 1개를 L 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 L 단계 참고해서 L단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 L폴더 만들면서 그 폴더 내에 test-L.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/L에 research-L.md 파일로 정리해줘

12-1. L 단계는 Gemini Provider Agent이므로 @work_process/mvp-2/L/research-L.md 내용에는 Gemini Provider 구현, API Key 기반 요청, prompt 전송, 텍스트 추출, 에러 및 timeout 처리 로직을 정리해줘. @work_process/mvp-2/L/test-L.md 내용에는 provider가 gemini이고 API Key가 있을 때 실제 Gemini API로 커밋 메시지를 생성하는지 확인하는 테스트 항목을 한국어로 정리해줘.

13. gemini 3.0 flash 모델 agent 1개를 M 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 M 단계 참고해서 M단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 M폴더 만들면서 그 폴더 내에 test-M.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/M에 research-M.md 파일로 정리해줘

13-1. M 단계는 OpenAI-compatible Provider Agent이므로 @work_process/mvp-2/M/research-M.md 내용에는 baseURL 기반 /chat/completions 호출, Authorization Bearer 처리, modelVersion 전달, messages 형식 구성 및 응답 추출 로직을 정리해줘. @work_process/mvp-2/M/test-M.md 내용에는 OpenAI-compatible endpoint를 사용하는 Provider가 공통 모듈로 호출되는지 확인하는 테스트 항목을 한국어로 정리해줘.

14. gemini 3.0 flash 모델 agent 1개를 N 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 N 단계 참고해서 N단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 N폴더 만들면서 그 폴더 내에 test-N.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/N에 research-N.md 파일로 정리해줘

14-1. N 단계는 Provider 라우터 Agent이므로 @work_process/mvp-2/N/research-N.md 내용에는 provider 값에 따른 mock/localLLM/gemini/openaiCompatible 분기, Provider별 generateCommitMessage 및 listModels 호출 로직을 정리해줘. @work_process/mvp-2/N/test-N.md 내용에는 core/ai.js가 Provider 세부 구현을 몰라도 커밋 메시지를 생성할 수 있는지 확인하는 테스트 항목을 한국어로 정리해줘.

14-2. dangeroud/dangeroud1.md 파일의 보안 위험성을 참고해서 각각의 보안 이슈를 해결할 수 있도록 추가적인 작업 절차를 진행해주면 좋겠어 각각의 위험 1~6을 확인하면서 보안 문제가 발생하지 않도록 우선순위 권장 조치에 적힌 내용에 따라서 우선적으로 처리를 해줘

### Phase 4. --model 명령어

15. gemini 3.0 flash 모델 agent 1개를 O 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 O 단계 참고해서 O단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 O폴더 만들면서 그 폴더 내에 test-O.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/O에 research-O.md 파일로 정리해줘

15-1. O 단계는 --model CLI 라우팅 Agent이므로 @work_process/mvp-2/O/research-O.md 내용에는 commander에 --model 옵션 추가, 인자 optional 처리, provider/authType/modelVersion 수집, src/commands/model.js로 라우팅하는 로직을 정리해줘. @work_process/mvp-2/O/test-O.md 내용에는 --model 입력 시 model command로 정상 라우팅되는지 확인하는 테스트 항목을 한국어로 정리해줘.

16. gemini 3.0 flash 모델 agent 1개를 P 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 P 단계 참고해서 P단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 P폴더 만들면서 그 폴더 내에 test-P.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/P에 research-P.md 파일로 정리해줘

16-1. P 단계는 --model 전체 대화형 설정 Agent이므로 @work_process/mvp-2/P/research-P.md 내용에는 Provider/인증 방식/모델 버전 선택 UI 실행, 설정 저장, 완료 메시지 출력 로직을 정리해줘. @work_process/mvp-2/P/test-P.md 내용에는 convention --model 실행만으로 설정이 완료되는지 확인하는 테스트 항목을 한국어로 정리해줘.

17. gemini 3.0 flash 모델 agent 1개를 Q 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 Q 단계 참고해서 Q단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 Q폴더 만들면서 그 폴더 내에 test-Q.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/Q에 research-Q.md 파일로 정리해줘

17-1. Q 단계는 --model provider 부분 지정 Agent이므로 @work_process/mvp-2/Q/research-Q.md 내용에는 지정된 provider 유효성 검증, 인증 방식/모델 버전 선택 UI 실행 및 설정 저장 로직을 정리해줘. @work_process/mvp-2/Q/test-Q.md 내용에는 convention --model gemini 등 실행 시 Provider 선택 단계를 건너뛰는지 확인하는 테스트 항목을 한국어로 정리해줘.

18. gemini 3.0 flash 모델 agent 1개를 R 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 R 단계 참고해서 R단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 R폴더 만들면서 그 폴더 내에 test-R.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/R에 research-R.md 파일로 정리해줘

18-1. R 단계는 --model provider authType 부분 지정 Agent이므로 @work_process/mvp-2/R/research-R.md 내용에는 provider/authType 검증, API Key 필요 시 입력 확인, 모델 버전 선택 UI 실행 및 설정 저장 로직을 정리해줘. @work_process/mvp-2/R/test-R.md 내용에는 convention --model gemini api 실행 시 모델 버전 선택만 대화형으로 진행되는지 확인하는 테스트 항목을 한국어로 정리해줘.

19. gemini 3.0 flash 모델 agent 1개를 S 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 S 단계 참고해서 S단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 S폴더 만들면서 그 폴더 내에 test-S.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/S에 research-S.md 파일로 정리해줘

19-1. S 단계는 --model provider authType modelVersion 직접 지정 Agent이므로 @work_process/mvp-2/S/research-S.md 내용에는 모든 인자 검증, 인증 정보 확인, 대화형 UI 없이 직접 config 저장 로직을 정리해줘. @work_process/mvp-2/S/test-S.md 내용에는 모든 인자가 제공되면 interactive UI 없이 즉시 설정 저장되는지 확인하는 테스트 항목을 한국어로 정리해줘.

20. gemini 3.0 flash 모델 agent 1개를 T 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 T 단계 참고해서 T단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 T폴더 만들면서 그 폴더 내에 test-T.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/T에 research-T.md 파일로 정리해줘

20-1. T 단계는 Model Config 저장 Agent이므로 @work_process/mvp-2/T/research-T.md 내용에는 --model 명령의 결과를 config.json에 저장(mode, provider, authType, modelDisplayName, modelVersion, baseURL 등)하는 로직을 정리해줘. @work_process/mvp-2/T/test-T.md 내용에는 설정 후 convention 실행 시 해당 Provider를 정상 사용하는지 확인하는 테스트 항목을 한국어로 정리해줘.

### Phase 5. Push/Reset

21. gemini 3.0 flash 모델 agent 1개를 U 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 U 단계 참고해서 U단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 U폴더 만들면서 그 폴더 내에 test-U.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/U에 research-U.md 파일로 정리해줘

21-1. U 단계는 --push Agent이므로 @work_process/mvp-2/U/research-U.md 내용에는 commander --push 옵션, 커밋 후 git push 안전 실행, 실패 처리 및 확인 정책 결정 로직을 정리해줘. @work_process/mvp-2/U/test-U.md 내용에는 convention --push 실행 시 커밋 후 원격 저장소로 push되는지 확인하는 테스트 항목을 한국어로 정리해줘.

22. gemini 3.0 flash 모델 agent 1개를 V 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 V 단계 참고해서 V단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 V폴더 만들면서 그 폴더 내에 test-V.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/V에 research-V.md 파일로 정리해줘

22-1. V 단계는 --reset Agent이므로 @work_process/mvp-2/V/research-V.md 내용에는 commander --reset 옵션, git reset HEAD~1 실행, 사용자 confirm, 변경 사항 보존 여부 안내 로직을 정리해줘. @work_process/mvp-2/V/test-V.md 내용에는 convention --reset 실행 시 최근 커밋이 취소되고 변경 사항은 working tree에 남는지 확인하는 테스트 항목을 한국어로 정리해줘.

23. gemini 3.0 flash 모델 agent 1개를 W 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 W 단계 참고해서 W단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 W폴더 만들면서 그 폴더 내에 test-W.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/W에 research-W.md 파일로 정리해줘

23-1. W 단계는 Push/Reset 안전 확인 Agent이므로 @work_process/mvp-2/W/research-W.md 내용에는 명령어 실행 전 confirm 필수 적용, 취소 시 안전 종료 처리 로직을 정리해줘. @work_process/mvp-2/W/test-W.md 내용에는 reset 등 위험 명령이 사용자 확인 없이 실행되지 않는지 확인하는 테스트 항목을 한국어로 정리해줘.

23-2. 지금 model을 바꾸게 될 때, api를 한번만 입력하게 되면 다시 model을 바꾸려고 하면 api를 고정해서 사용해야 되는 상황이 오거든 예를 들어서 convention --model로 gemini api키를 입력해서 gemini-3.0-flash 버전을 사용하게 된다면 그 이후에는 --model을 입력하면 버전만 바꿀 수 있고 api는 바꿀 수 없는 형태야 그래서 만약에 convention --model을 입력해서 모델을 선택하게 된다면 버전만 바꿀 수 있는 것이 아닌 먼저 api 키를 바꿀 것인지도 미리 물어보게 수정해줘 그리고 convention에서도 status 429 오류로 중간에 동작이 끊기게 될 때, api를 사용하여 convention을 실행하였다면 다른 api 키를 입력할 것인지, 아니면 다른 모델들을 사용할 것인지나(예를 들어 gemini api를 사용하였다면 openai또는 localLLM을 사용할 것인지 여부) 중단할 것인지를 터미널로 물어보게 하면 좋겠어 다른 api 키를 사용하였다면 그 api로 계속 진행하는거고 다른 모델을 사용하기로 하였다면 그 모델을 사용하도록 하는거야 중단을 할 것이면 그대로 convention을 종료하도록 하면 되겠어, 해당 내용에 대해서 추가적으로 init/02_mvp-2.md, init/prd.md, README.md에 관련 내용들을 정리해줘

### Phase 6. 통합 검증

24. gemini 3.0 flash 모델 agent 1개를 X 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/02_mvp-2.md 의 X 단계 참고해서 X단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/mvp-2/에 X폴더 만들면서 그 폴더 내에 test-X.md로 만들어서 정리해주고, 현재 작업 상황에 대해 어떻게 구체적으로 작업하면 좋을 지 @work_process/mvp-2/X에 research-X.md 파일로 정리해줘

24-1. X 단계는 2차 MVP 통합 테스트 Agent이므로 @work_process/mvp-2/X/research-X.md 내용에는 1차 MVP 회귀 테스트, --model 명령 검증, API Key 저장, Provider 라우팅, push/reset 통합 테스트 외에도 ① 신규 생성 파일(untracked) 자동 스테이징, ② --question (-q) 플래그를 통한 커밋 확인 제어 동작, ③ dangerous1.md 기반 보안 조치 적용 여부 검증, ④ --model 재입력 시 API 키 변경 여부 확인 및 429 에러 발생 시 fallback(대체 모델 선택/중단) 로직에 대한 통합 테스트 계획을 정리해줘. @work_process/mvp-2/X/test-X.md 내용에는 1차/2차 MVP의 모든 기능이 정상 동작하는지 검증하는 테스트 항목을 한국어로 정리해줘.

25. gemini 3.1 pro 모델 agent 1개를 배정해서, prompt의 B~X단계까지 작성된 프롬프트가 모두 작성이 완료된 이후에, init/02_mvp-2.md 뿐만 아니라 추가로 업데이트된 init/prd.md, README.md의 내용을 기반으로 prompt.md의 2차 MVP 내용에 있는 전반적인 내용들을 분석해서 2차 MVP 핵심 목표(신규 파일 스테이징, --question 설정, 429 에러 fallback, 보안 조치 등)에 부합하는 내용들인지 최종적으로 파악하고 점검해줘.

=============================================================================

## 3차 고도화 내용

1. AGENTS.md, GEMINI.md, init/00_rule.md, ** init/03_advanced.md ** 의 내용들을 참고해서 init/prompt.md의 내용을 3차 고도화 내용의 1번 아래에서부터 작성해서, 2번부터 시작해서 B단계부터 AV단계까지 쭉 만들어줘 B~AV단계까지의 각 단계는 gpt 5.5 midium 모델로 prompt.md의 각 단계를 하나씩 작성하도록 하고, 양식은 1차 MVP 내용에 있는 24번을 참고해서 2단계부터 작성하면 좋겠어 그리고 각 번호의 하위 번호(2번에는 2-1, 3번에는 3-1과 같이)에는 작성한 단계 내용과 관련해서 생성된 test, research 파일을 확인하면서 각 단계에 맞는 작업을 지시하는 내용을 담아서 작성했으면 해, 해당 하위 번호는 각 번호를 작성한 모델이 추가적으로 작성을 해주면 돼(예를 들어서 2번을 작성한 모델이 2-1에 해당하는 프롬프트를 작성해서 해당 test, research 파일을 확인해서 해당 단계에 해당하는 작업을 해달라는 식으로 지시하는 프롬프트를 작성해주면 돼) 그리고 prompt의 B~AV단계까지 작성할 프롬프트가 모두 작성이 완료되면 gpt 5.5 high 모델로 init/03_advanced.md의 내용을 기반으로 prompt.md의 3차 고도화 내용에 있는 전반적인 내용들을 분석해서 3차 고도화 내용에 부합하는 내용들인지 파악을 해보면 좋겠어

### Phase 1. 사용자 검토 UX 고도화

2. gpt-5.5 medium 모델 agent 1개를 B 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 B 단계 참고해서 B단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/B 폴더를 만들고 그 안에 test-B.md로 정리해줘. 그리고 현재 작업 상황에서 Config Versioning을 어떻게 구현하면 좋을지 @work_process/advanced/B/research-B.md 파일로 정리해줘.

2-1. B 단계는 Config Versioning Agent이므로 @work_process/advanced/B/research-B.md와 @work_process/advanced/B/test-B.md를 확인한 뒤, configVersion 필드 추가, src/config/migration.js 작성, 기존 config 자동 migration, 누락 필드 기본값 보정, migration 실패 시 안전한 에러 출력까지 구현해줘. 테스트는 기존 1차/2차 config가 3차 schema로 보정되는지와 기존 설정값이 보존되는지를 중심으로 진행해줘.

3. gpt-5.5 medium 모델 agent 1개를 C 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 C 단계 참고해서 C단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/C 폴더를 만들고 그 안에 test-C.md로 정리해줘. 그리고 Commit Preview 구현 계획을 @work_process/advanced/C/research-C.md 파일로 정리해줘.

3-1. C 단계는 Commit Preview Agent이므로 @work_process/advanced/C/research-C.md와 @work_process/advanced/C/test-C.md를 기반으로 생성된 커밋 메시지, 변경 파일 요약, mode, provider 정보를 커밋 전에 출력하도록 구현해줘. step/batch 모두에서 preview가 동작해야 하며 diff 원문이나 secret은 출력하지 않도록 보안 규칙을 지켜줘.

4. gpt-5.5 medium 모델 agent 1개를 D 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 D 단계 참고해서 D단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/D 폴더를 만들고 그 안에 test-D.md로 정리해줘. 그리고 Confirm UX 고도화 구현 계획을 @work_process/advanced/D/research-D.md 파일로 정리해줘.

4-1. D 단계는 Confirm UX Agent이므로 @work_process/advanced/D/research-D.md와 @work_process/advanced/D/test-D.md를 확인하고, 기존 Yes/No confirm을 Commit, Regenerate, Edit manually, Cancel 선택 흐름으로 확장해줘. 선택 결과가 commit flow로 명확히 전달되도록 src/utils/ui.js와 src/commands/commit.js를 중심으로 구현해줘.

5. gpt-5.5 medium 모델 agent 1개를 E 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 E 단계 참고해서 E단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/E 폴더를 만들고 그 안에 test-E.md로 정리해줘. 그리고 Regenerate 기능 구현 계획을 @work_process/advanced/E/research-E.md 파일로 정리해줘.

5-1. E 단계는 Regenerate Agent이므로 @work_process/advanced/E/research-E.md와 @work_process/advanced/E/test-E.md를 기반으로 기존 diff를 유지한 채 이전 메시지와 다른 표현으로 AI 메시지를 재생성하는 흐름을 구현해줘. maxRegenerateCount 기본값은 3으로 두고, 재생성 후 다시 preview와 decision UI로 돌아오도록 작업해줘.

6. gpt-5.5 medium 모델 agent 1개를 F 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 F 단계 참고해서 F단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/F 폴더를 만들고 그 안에 test-F.md로 정리해줘. 그리고 Manual Edit 기능 구현 계획을 @work_process/advanced/F/research-F.md 파일로 정리해줘.

6-1. F 단계는 Manual Edit Agent이므로 @work_process/advanced/F/research-F.md와 @work_process/advanced/F/test-F.md를 확인하고, AI가 생성한 커밋 메시지를 기본값으로 보여준 뒤 사용자가 직접 수정할 수 있게 구현해줘. 빈 메시지는 거부하고, 수정된 메시지가 git commit에 전달되는지 테스트해줘.

7. gpt-5.5 medium 모델 agent 1개를 G 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 G 단계 참고해서 G단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/G 폴더를 만들고 그 안에 test-G.md로 정리해줘. 그리고 Commit Decision Flow 통합 계획을 @work_process/advanced/G/research-G.md 파일로 정리해줘.

7-1. G 단계는 Commit Decision Flow Agent이므로 @work_process/advanced/G/research-G.md와 @work_process/advanced/G/test-G.md를 기반으로 AI 메시지 생성, preview 출력, Commit/Regenerate/Edit/Cancel 선택, git add/commit 실행까지 하나의 공통 흐름으로 연결해줘. batch와 step이 같은 decision flow를 재사용하도록 정리해줘.

### Phase 2. 대용량 diff 처리

8. gpt-5.5 medium 모델 agent 1개를 H 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 H 단계 참고해서 H단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/H 폴더를 만들고 그 안에 test-H.md로 정리해줘. 그리고 Large Diff Detector 구현 계획을 @work_process/advanced/H/research-H.md 파일로 정리해줘.

8-1. H 단계는 Large Diff Detector Agent이므로 @work_process/advanced/H/research-H.md와 @work_process/advanced/H/test-H.md를 확인하고, diff 문자 수, 파일 수, line count 기준으로 대용량 diff 여부를 판단하는 detectLargeDiff() 흐름을 구현해줘. 기준값은 config default에 두고 일반 AI 호출 대신 large diff flow로 전환할 수 있게 반환 구조를 설계해줘.

9. gpt-5.5 medium 모델 agent 1개를 I 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 I 단계 참고해서 I단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/I 폴더를 만들고 그 안에 test-I.md로 정리해줘. 그리고 Diff Chunking 구현 계획을 @work_process/advanced/I/research-I.md 파일로 정리해줘.

9-1. I 단계는 Diff Chunking Agent이므로 @work_process/advanced/I/research-I.md와 @work_process/advanced/I/test-I.md를 기반으로 파일 단위 chunk 생성, 큰 파일 diff의 line 기준 분할, chunk index와 file metadata 부여, 빈 chunk 제거를 구현해줘. 한글/공백 파일명과 대용량 diff에서도 안정적으로 동작하는지 확인해줘.

10. gpt-5.5 medium 모델 agent 1개를 J 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 J 단계 참고해서 J단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/J 폴더를 만들고 그 안에 test-J.md로 정리해줘. 그리고 Chunk Summary 구현 계획을 @work_process/advanced/J/research-J.md 파일로 정리해줘.

10-1. J 단계는 Chunk Summary Agent이므로 @work_process/advanced/J/research-J.md와 @work_process/advanced/J/test-J.md를 확인하고, chunk summary prompt 생성, chunk별 AI 호출, 요약 결과 저장, 실패 chunk 재시도 및 fallback 처리를 구현해줘. 커밋 메시지는 이 단계에서 생성하지 말고 변경 목적과 주요 내용 요약만 생성하도록 해줘.

11. gpt-5.5 medium 모델 agent 1개를 K 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 K 단계 참고해서 K단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/K 폴더를 만들고 그 안에 test-K.md로 정리해줘. 그리고 Summary Merge 구현 계획을 @work_process/advanced/K/research-K.md 파일로 정리해줘.

11-1. K 단계는 Summary Merge Agent이므로 @work_process/advanced/K/research-K.md와 @work_process/advanced/K/test-K.md를 기반으로 chunk summary 목록을 입력받아 중복을 제거하고 파일별/기능별 변경 의도를 병합하는 로직을 구현해줘. 최종 commit prompt에 넣을 수 있는 요약 문자열을 반환하도록 해줘.

12. gpt-5.5 medium 모델 agent 1개를 L 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 L 단계 참고해서 L단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/L 폴더를 만들고 그 안에 test-L.md로 정리해줘. 그리고 Large Diff Commit Message 구현 계획을 @work_process/advanced/L/research-L.md 파일로 정리해줘.

12-1. L 단계는 Large Diff Commit Message Agent이므로 @work_process/advanced/L/research-L.md와 @work_process/advanced/L/test-L.md를 확인하고, large diff 감지, chunk 요약, summary merge, summary 기반 commit message prompt 생성, AI 커밋 메시지 생성까지 연결해줘. 원본 대용량 diff를 로그에 출력하지 않는지 반드시 확인해줘.

12-2. 지금 localLLM으로 convention을 실행했을 때 localLLM이 끝까지 diff를 다 읽지 못할 정도로 큰 코드의 경우에는 다 읽지 못한 상태에서 오류가 발생함과 동시에 convention이 중단되면서 이어지지 않는 문제가 발생을 해 그래서 일단 localLLM이 응답을 하지 못하였을 경우에는 다른 저수준 LLM을 사용할 것인지, 또는 gemini나 openai등의 api를 사용할 것인지, 아니면 이대로 중단할 것인지에 대한 선택지를 사용자에게 제공해서 진행한 이후에 다시 convention을 진행할 수 있도록 하면 좋겠어 이전 고추론 localLLM을 쓸 지 아니면 이미 설정한 api 또는 저추론 모델을 쓸 지 사용자에게 선택지를 제공할 수 있도록 해주면서 앞으로도 비슷한 상황을 겪을 때 계속 고추론 LLM => 기본 저추론 모델 또는 api => 고추론 LLM 순으로 사용하게 할 지, 아니면 기존에 선택한 저추론 모델 또는 api를 그대로 사용할 것인지 묻도록 설정하게 해줘

[AI Provider 장애 극복 및 자동 Fallback 구현] localLLM 실행 중 타임아웃이나 fetch failed 등 응답 불능 상태가 발생할 경우, 전체 프로세스를 중단하지 않고 사용자에게 장애 복구 선택지를 제공하는 로직을 구현해줘.

선택지 제공: ① 다른 로컬 모델로 변경, ② 설정된 Cloud API로 전환, ③ 현재 파일 건너뛰기, ④ 전체 중단 중 선택 가능하게 할 것.
세션 정책 설정: 모델 전환 시, "이후의 모든 파일에도 이 설정을 적용할지(고정)" 아니면 "다음 파일에서는 다시 원래의 고성능 모델로 시도할지(유동)"를 사용자에게 물어보고 세션 동안 유지할 것.
이어서 진행: 모델 교체 후, 작업 중이던 diff 정보를 그대로 유지한 채 즉시 다시 생성을 시도하여 사용자 경험이 끊기지 않게 할 것.

### Phase 3. 파일 변경 사항 자동 그룹핑

13. gpt-5.5 medium 모델 agent 1개를 M 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 M 단계 참고해서 M단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/M 폴더를 만들고 그 안에 test-M.md로 정리해줘. 그리고 Changed File Classifier 구현 계획을 @work_process/advanced/M/research-M.md 파일로 정리해줘.

13-1. M 단계는 Changed File Classifier Agent이므로 @work_process/advanced/M/research-M.md와 @work_process/advanced/M/test-M.md를 기반으로 변경 파일을 source, test, docs, config, style, dependency, generated 같은 유형으로 분류하는 classifyChangedFiles()를 구현해줘. 경로, 확장자, 특수 파일 규칙을 모두 반영해줘.

14. gpt-5.5 medium 모델 agent 1개를 N 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 N 단계 참고해서 N단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/N 폴더를 만들고 그 안에 test-N.md로 정리해줘. 그리고 Diff Intent Analyzer 구현 계획을 @work_process/advanced/N/research-N.md 파일로 정리해줘.

14-1. N 단계는 Diff Intent Analyzer Agent이므로 @work_process/advanced/N/research-N.md와 @work_process/advanced/N/test-N.md를 확인하고, 파일별 diff의 변경 의도를 분석해서 feat/fix/refactor/docs/test/chore 후보와 요약을 반환하는 구조를 구현해줘. AI 호출이 필요한 경우 provider routing을 사용하고, 외부 전송 보안 gate를 유지해줘.

15. gpt-5.5 medium 모델 agent 1개를 O 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 O 단계 참고해서 O단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/O 폴더를 만들고 그 안에 test-O.md로 정리해줘. 그리고 File Grouping 구현 계획을 @work_process/advanced/O/research-O.md 파일로 정리해줘.

15-1. O 단계는 File Grouping Agent이므로 @work_process/advanced/O/research-O.md와 @work_process/advanced/O/test-O.md를 기반으로 파일 유형과 intent를 조합해 관련 파일을 그룹으로 묶는 groupFilesByIntent() 흐름을 구현해줘. 너무 작은 그룹 병합, 대표 type 추정, 빈 그룹 방지를 포함해줘.

16. gpt-5.5 medium 모델 agent 1개를 P 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 P 단계 참고해서 P단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/P 폴더를 만들고 그 안에 test-P.md로 정리해줘. 그리고 Grouping Preview 구현 계획을 @work_process/advanced/P/research-P.md 파일로 정리해줘.

16-1. P 단계는 Grouping Preview Agent이므로 @work_process/advanced/P/research-P.md와 @work_process/advanced/P/test-P.md를 확인하고, AI 또는 rule 기반 그룹핑 결과를 사용자에게 보여주는 preview UI를 구현해줘. Yes, Edit manually, Use batch instead, Cancel 선택지를 제공하고 그룹 파일 목록은 diff 원문 없이 표시해줘.

17. gpt-5.5 medium 모델 agent 1개를 Q 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 Q 단계 참고해서 Q단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/Q 폴더를 만들고 그 안에 test-Q.md로 정리해줘. 그리고 Grouped Commit Flow 구현 계획을 @work_process/advanced/Q/research-Q.md 파일로 정리해줘.

17-1. Q 단계는 Grouped Commit Flow Agent이므로 @work_process/advanced/Q/research-Q.md와 @work_process/advanced/Q/test-Q.md를 기반으로 그룹별 파일 목록 확인, 그룹별 diff 생성, 그룹별 prompt/AI 메시지 생성, preview/confirm, git add, git commit 흐름을 구현해줘. 사용자 confirm 없이 여러 커밋이 자동 생성되지 않도록 안전 장치를 유지해줘.

### Phase 4. 팀 컨벤션 템플릿

18. gpt-5.5 medium 모델 agent 1개를 R 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 R 단계 참고해서 R단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/R 폴더를 만들고 그 안에 test-R.md로 정리해줘. 그리고 Template Schema 구현 계획을 @work_process/advanced/R/research-R.md 파일로 정리해줘.

18-1. R 단계는 Template Schema Agent이므로 @work_process/advanced/R/research-R.md와 @work_process/advanced/R/test-R.md를 확인하고, src/templates/schema.js와 기본 템플릿 구조를 구현해줘. name, language, format, types, rules.maxLength, rules.requireScope, rules.allowEmoji 같은 필드를 명확히 정의해줘.

19. gpt-5.5 medium 모델 agent 1개를 S 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 S 단계 참고해서 S단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/S 폴더를 만들고 그 안에 test-S.md로 정리해줘. 그리고 Template Load 구현 계획을 @work_process/advanced/S/research-S.md 파일로 정리해줘.

19-1. S 단계는 Template Load Agent이므로 @work_process/advanced/S/research-S.md와 @work_process/advanced/S/test-S.md를 기반으로 프로젝트 루트 .convention/template.json, .conventionrc, 사용자 홈 template.json, 기본 템플릿 순서로 로드하는 loadTemplate()을 구현해줘. 경로 처리는 path.join()과 os.homedir() 기준을 지켜줘.

20. gpt-5.5 medium 모델 agent 1개를 T 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 T 단계 참고해서 T단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/T 폴더를 만들고 그 안에 test-T.md로 정리해줘. 그리고 Template Validation 구현 계획을 @work_process/advanced/T/research-T.md 파일로 정리해줘.

20-1. T 단계는 Template Validation Agent이므로 @work_process/advanced/T/research-T.md와 @work_process/advanced/T/test-T.md를 확인하고, 필수 필드, types 배열, format 문자열, language, maxLength를 검증하는 validateTemplate()을 구현해줘. 잘못된 템플릿은 CLI를 죽이지 않고 기본 템플릿으로 fallback하도록 해줘.

21. gpt-5.5 medium 모델 agent 1개를 U 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 U 단계 참고해서 U단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/U 폴더를 만들고 그 안에 test-U.md로 정리해줘. 그리고 Template Apply 구현 계획을 @work_process/advanced/U/research-U.md 파일로 정리해줘.

21-1. U 단계는 Template Apply Agent이므로 @work_process/advanced/U/research-U.md와 @work_process/advanced/U/test-U.md를 기반으로 커밋 prompt 생성 시 template의 허용 type, format, language, maxLength 규칙을 반영하도록 구현해줘. 기존 language 설정과 template language가 충돌할 때의 우선순위도 명확히 정리해줘.

22. gpt-5.5 medium 모델 agent 1개를 V 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 V 단계 참고해서 V단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/V 폴더를 만들고 그 안에 test-V.md로 정리해줘. 그리고 Template Command 구현 계획을 @work_process/advanced/V/research-V.md 파일로 정리해줘.

22-1. V 단계는 Template Command Agent이므로 @work_process/advanced/V/research-V.md와 @work_process/advanced/V/test-V.md를 확인하고, convention --template, --template init, --template show, --template validate 라우팅과 src/commands/template.js를 구현해줘. 설정 명령은 commit flow를 실행하지 않아야 해.

### Phase 5. OAuth 인증

23. gpt-5.5 medium 모델 agent 1개를 W 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 W 단계 참고해서 W단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/W 폴더를 만들고 그 안에 test-W.md로 정리해줘. 그리고 OAuth Architecture 구현 계획을 @work_process/advanced/W/research-W.md 파일로 정리해줘.

23-1. W 단계는 OAuth Architecture Agent이므로 @work_process/advanced/W/research-W.md와 @work_process/advanced/W/test-W.md를 기반으로 src/auth/oauth.js, src/auth/oauthProviders.js의 공통 구조를 설계하고 authorization URL 생성, callback 처리, token 저장, refresh 구조를 분리해줘. OAuth token은 credentials 계층으로만 저장되게 해줘.

24. gpt-5.5 medium 모델 agent 1개를 X 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 X 단계 참고해서 X단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/X 폴더를 만들고 그 안에 test-X.md로 정리해줘. 그리고 OAuth Provider Config 구현 계획을 @work_process/advanced/X/research-X.md 파일로 정리해줘.

24-1. X 단계는 OAuth Provider Config Agent이므로 @work_process/advanced/X/research-X.md와 @work_process/advanced/X/test-X.md를 확인하고, provider별 authUrl, tokenUrl, scopes, client 설정을 src/auth/oauthProviders.js에서 분리 관리하도록 구현해줘. 지원하지 않는 provider는 mock fallback 없이 명확한 오류로 중단해줘.

25. gpt-5.5 medium 모델 agent 1개를 Y 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 Y 단계 참고해서 Y단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/Y 폴더를 만들고 그 안에 test-Y.md로 정리해줘. 그리고 OAuth Local Callback 구현 계획을 @work_process/advanced/Y/research-Y.md 파일로 정리해줘.

25-1. Y 단계는 OAuth Local Callback Agent이므로 @work_process/advanced/Y/research-Y.md와 @work_process/advanced/Y/test-Y.md를 기반으로 임시 localhost callback 서버, 랜덤 port, callback path 처리, authorization code 수신, timeout, 서버 종료 처리를 구현해줘. 브라우저 실행이 필요한 경우 사용자 승인/환경 제약을 고려하고 테스트에서는 mock server를 우선 사용해줘.

26. gpt-5.5 medium 모델 agent 1개를 Z 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 Z 단계 참고해서 Z단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/Z 폴더를 만들고 그 안에 test-Z.md로 정리해줘. 그리고 OAuth PKCE State 구현 계획을 @work_process/advanced/Z/research-Z.md 파일로 정리해줘.

26-1. Z 단계는 OAuth PKCE State Agent이므로 @work_process/advanced/Z/research-Z.md와 @work_process/advanced/Z/test-Z.md를 확인하고, code_verifier, code_challenge, state 생성과 callback state 검증을 구현해줘. state 검증 실패 시 token 요청을 차단하고 민감값을 로그에 출력하지 않도록 해줘.

27. gpt-5.5 medium 모델 agent 1개를 AA 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AA 단계 참고해서 AA단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AA 폴더를 만들고 그 안에 test-AA.md로 정리해줘. 그리고 OAuth Token Store 구현 계획을 @work_process/advanced/AA/research-AA.md 파일로 정리해줘.

27-1. AA 단계는 OAuth Token Store Agent이므로 @work_process/advanced/AA/research-AA.md와 @work_process/advanced/AA/test-AA.md를 기반으로 access token, refresh token, 만료 시간을 credentials.json에 provider별로 저장하도록 구현해줘. 파일 권한 제한, token 출력 금지, config.json과 분리 저장을 반드시 검증해줘.

28. gpt-5.5 medium 모델 agent 1개를 AB 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AB 단계 참고해서 AB단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AB 폴더를 만들고 그 안에 test-AB.md로 정리해줘. 그리고 OAuth Refresh 구현 계획을 @work_process/advanced/AB/research-AB.md 파일로 정리해줘.

28-1. AB 단계는 OAuth Refresh Agent이므로 @work_process/advanced/AB/research-AB.md와 @work_process/advanced/AB/test-AB.md를 확인하고, token 만료 여부 확인, refresh token 존재 확인, token refresh 요청, 새 token 저장, refresh 실패 시 재로그인 안내를 구현해줘. refresh 실패 메시지에 token 원문이 포함되지 않도록 해줘.

29. gpt-5.5 medium 모델 agent 1개를 AC 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AC 단계 참고해서 AC단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AC 폴더를 만들고 그 안에 test-AC.md로 정리해줘. 그리고 OAuth Provider Integration 구현 계획을 @work_process/advanced/AC/research-AC.md 파일로 정리해줘.

29-1. AC 단계는 OAuth Provider Integration Agent이므로 @work_process/advanced/AC/research-AC.md와 @work_process/advanced/AC/test-AC.md를 기반으로 authType이 oauth일 때 token 로드, Authorization header 구성, 만료 시 refresh 호출, 인증 실패 처리를 provider routing에 연결해줘. API Key 방식과 OAuth 방식이 서로 설정을 오염시키지 않도록 해줘.

### Phase 6. PR 자동화

30. gpt-5.5 medium 모델 agent 1개를 AD 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AD 단계 참고해서 AD단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AD 폴더를 만들고 그 안에 test-AD.md로 정리해줘. 그리고 PR Prompt 구현 계획을 @work_process/advanced/AD/research-AD.md 파일로 정리해줘.

30-1. AD 단계는 PR Prompt Agent이므로 @work_process/advanced/AD/research-AD.md와 @work_process/advanced/AD/test-AD.md를 확인하고, 현재 브랜치명, base branch, commit log, diff summary, 변경 파일 목록을 기반으로 PR 제목/본문 생성용 prompt를 만드는 buildPrPrompt()를 구현해줘. secret scan과 diff 원문 출력 금지 정책을 재사용해줘.

31. gpt-5.5 medium 모델 agent 1개를 AE 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AE 단계 참고해서 AE단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AE 폴더를 만들고 그 안에 test-AE.md로 정리해줘. 그리고 PR Title Generator 구현 계획을 @work_process/advanced/AE/research-AE.md 파일로 정리해줘.

31-1. AE 단계는 PR Title Generator Agent이므로 @work_process/advanced/AE/research-AE.md와 @work_process/advanced/AE/test-AE.md를 기반으로 현재 변경사항 또는 commit history 기반 PR 제목을 생성하는 generatePrTitle()을 구현해줘. 제목은 Conventional Commits 스타일에 맞추고 빈 응답/과도한 길이/markdown 코드블록을 정리해줘.

32. gpt-5.5 medium 모델 agent 1개를 AF 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AF 단계 참고해서 AF단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AF 폴더를 만들고 그 안에 test-AF.md로 정리해줘. 그리고 PR Body Generator 구현 계획을 @work_process/advanced/AF/research-AF.md 파일로 정리해줘.

32-1. AF 단계는 PR Body Generator Agent이므로 @work_process/advanced/AF/research-AF.md와 @work_process/advanced/AF/test-AF.md를 확인하고, Summary, Changes, Test 섹션을 포함하는 markdown PR 본문 생성 흐름을 구현해줘. PR 본문에 secret이나 token이 포함되지 않도록 보안 scan 결과를 반영해줘.

33. gpt-5.5 medium 모델 agent 1개를 AG 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AG 단계 참고해서 AG단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AG 폴더를 만들고 그 안에 test-AG.md로 정리해줘. 그리고 GitHub Remote Detector 구현 계획을 @work_process/advanced/AG/research-AG.md 파일로 정리해줘.

33-1. AG 단계는 GitHub Remote Detector Agent이므로 @work_process/advanced/AG/research-AG.md와 @work_process/advanced/AG/test-AG.md를 기반으로 git remote -v 결과에서 GitHub owner/repo를 안전하게 추출하는 로직을 구현해줘. HTTPS/SSH remote 모두 처리하고 GitHub가 아니면 PR 생성 대신 문서 출력 흐름으로 넘겨줘.

34. gpt-5.5 medium 모델 agent 1개를 AH 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AH 단계 참고해서 AH단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AH 폴더를 만들고 그 안에 test-AH.md로 정리해줘. 그리고 GitHub PR Integration 구현 계획을 @work_process/advanced/AH/research-AH.md 파일로 정리해줘.

34-1. AH 단계는 GitHub PR Integration Agent이므로 @work_process/advanced/AH/research-AH.md와 @work_process/advanced/AH/test-AH.md를 확인하고, 우선 PR 제목/본문 출력, gh CLI 설치 여부 확인, 사용자 동의 시 gh pr create 실행 흐름을 구현해줘. 명령 실행은 인자 배열 방식으로 하고 인증 정보나 remote token을 출력하지 않도록 해줘.

35. gpt-5.5 medium 모델 agent 1개를 AI 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AI 단계 참고해서 AI단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AI 폴더를 만들고 그 안에 test-AI.md로 정리해줘. 그리고 PR Preview 구현 계획을 @work_process/advanced/AI/research-AI.md 파일로 정리해줘.

35-1. AI 단계는 PR Preview Agent이므로 @work_process/advanced/AI/research-AI.md와 @work_process/advanced/AI/test-AI.md를 기반으로 생성된 PR 제목과 본문을 보여주고 Create PR, Edit manually, Print only, Cancel 선택지를 제공해줘. Create PR은 사용자 확인 또는 --yes 정책이 있을 때만 실행되도록 해줘.

### Phase 7. npm 업데이트 알림

36. gpt-5.5 medium 모델 agent 1개를 AJ 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AJ 단계 참고해서 AJ단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AJ 폴더를 만들고 그 안에 test-AJ.md로 정리해줘. 그리고 Package Version 구현 계획을 @work_process/advanced/AJ/research-AJ.md 파일로 정리해줘.

36-1. AJ 단계는 Package Version Agent이므로 @work_process/advanced/AJ/research-AJ.md와 @work_process/advanced/AJ/test-AJ.md를 확인하고, package.json의 version을 읽는 getCurrentVersion()과 convention --version 라우팅을 구현해줘. package.json 경로 탐색은 안전하게 처리하고 commit flow와 분리해줘.

37. gpt-5.5 medium 모델 agent 1개를 AK 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AK 단계 참고해서 AK단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AK 폴더를 만들고 그 안에 test-AK.md로 정리해줘. 그리고 npm Registry Check 구현 계획을 @work_process/advanced/AK/research-AK.md 파일로 정리해줘.

37-1. AK 단계는 npm Registry Check Agent이므로 @work_process/advanced/AK/research-AK.md와 @work_process/advanced/AK/test-AK.md를 기반으로 npm registry API에서 latest version을 확인하고 현재 version과 비교하는 checkLatestVersion()을 구현해줘. 네트워크 실패는 기능 실패로 처리하지 말고 조용히 무시하며, unit test에서는 네트워크를 mock 처리해줘.

38. gpt-5.5 medium 모델 agent 1개를 AL 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AL 단계 참고해서 AL단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AL 폴더를 만들고 그 안에 test-AL.md로 정리해줘. 그리고 Update Notification 구현 계획을 @work_process/advanced/AL/research-AL.md 파일로 정리해줘.

38-1. AL 단계는 Update Notification Agent이므로 @work_process/advanced/AL/research-AL.md와 @work_process/advanced/AL/test-AL.md를 확인하고, 새 버전이 있을 때 현재 버전, 최신 버전, 업데이트 명령을 사용자 작업을 방해하지 않는 방식으로 안내하도록 구현해줘. npm publish나 자동 업데이트 실행은 하지 마.

39. gpt-5.5 medium 모델 agent 1개를 AM 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AM 단계 참고해서 AM단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AM 폴더를 만들고 그 안에 test-AM.md로 정리해줘. 그리고 Update Policy 구현 계획을 @work_process/advanced/AM/research-AM.md 파일로 정리해줘.

39-1. AM 단계는 Update Policy Agent이므로 @work_process/advanced/AM/research-AM.md와 @work_process/advanced/AM/test-AM.md를 기반으로 updateCheck와 lastUpdateCheckAt 설정을 추가하고 하루 1회 이하로 registry check가 실행되게 구현해줘. updateCheck가 false이면 네트워크 호출이 발생하지 않아야 해.

### Phase 8. GitHub Actions / CI 연동

40. gpt-5.5 medium 모델 agent 1개를 AN 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AN 단계 참고해서 AN단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AN 폴더를 만들고 그 안에 test-AN.md로 정리해줘. 그리고 CI Mode 구현 계획을 @work_process/advanced/AN/research-AN.md 파일로 정리해줘.

40-1. AN 단계는 CI Mode Agent이므로 @work_process/advanced/AN/research-AN.md와 @work_process/advanced/AN/test-AN.md를 확인하고, CI=true 또는 GITHUB_ACTIONS=true 환경에서 CI mode를 감지하는 isCI(), isGitHubActions()를 구현해줘. CI 환경에서는 interactive prompt가 자동 비활성화되도록 commit/pr flow와 연결해줘.

41. gpt-5.5 medium 모델 agent 1개를 AO 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AO 단계 참고해서 AO단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AO 폴더를 만들고 그 안에 test-AO.md로 정리해줘. 그리고 Non-interactive Mode 구현 계획을 @work_process/advanced/AO/research-AO.md 파일로 정리해줘.

41-1. AO 단계는 Non-interactive Mode Agent이므로 @work_process/advanced/AO/research-AO.md와 @work_process/advanced/AO/test-AO.md를 기반으로 --yes, --no-interactive 옵션을 구현하고 prompt 호출 없이 실행되거나 필요한 값이 없으면 명확한 에러로 실패하게 해줘. 로컬에서 --yes 사용 시에도 confirmBeforeCommit 정책과 보안 gate가 무시되지 않게 해줘.

42. gpt-5.5 medium 모델 agent 1개를 AP 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AP 단계 참고해서 AP단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AP 폴더를 만들고 그 안에 test-AP.md로 정리해줘. 그리고 GitHub Actions Output 구현 계획을 @work_process/advanced/AP/research-AP.md 파일로 정리해줘.

42-1. AP 단계는 GitHub Actions Output Agent이므로 @work_process/advanced/AP/research-AP.md와 @work_process/advanced/AP/test-AP.md를 확인하고, GitHub Actions에서 사용할 수 있는 commit_message, pr_title, pr_body output을 생성하는 유틸을 구현해줘. multiline output 처리와 secret masking 주의사항을 반영해줘.

43. gpt-5.5 medium 모델 agent 1개를 AQ 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AQ 단계 참고해서 AQ단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AQ 폴더를 만들고 그 안에 test-AQ.md로 정리해줘. 그리고 Workflow Example 문서화 계획을 @work_process/advanced/AQ/research-AQ.md 파일로 정리해줘.

43-1. AQ 단계는 Workflow Example Agent이므로 @work_process/advanced/AQ/research-AQ.md와 @work_process/advanced/AQ/test-AQ.md를 기반으로 docs/github-actions.md와 README.md에 GitHub Actions 사용 예시를 추가해줘. 예시는 --pr --print-only --no-interactive 같은 안전한 흐름을 중심으로 작성하고 secret 노출 주의사항을 포함해줘.

44. gpt-5.5 medium 모델 agent 1개를 AR 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AR 단계 참고해서 AR단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AR 폴더를 만들고 그 안에 test-AR.md로 정리해줘. 그리고 CI Security 구현 계획을 @work_process/advanced/AR/research-AR.md 파일로 정리해줘.

44-1. AR 단계는 CI Security Agent이므로 @work_process/advanced/AR/research-AR.md와 @work_process/advanced/AR/test-AR.md를 확인하고, CI 로그에 token/API Key가 출력되지 않도록 logger redaction, auth 계층 마스킹, 환경변수 기반 API Key 지원 검토, PR from fork 주의 안내를 구현 또는 문서화해줘.

### Phase 9. 통합 검증

45. gpt-5.5 medium 모델 agent 1개를 AS 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AS 단계 참고해서 AS단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AS 폴더를 만들고 그 안에 test-AS.md로 정리해줘. 그리고 3차 통합 테스트 계획을 @work_process/advanced/AS/research-AS.md 파일로 정리해줘.

45-1. AS 단계는 3차 통합 테스트 Agent이므로 @work_process/advanced/AS/research-AS.md와 @work_process/advanced/AS/test-AS.md를 기반으로 preview, regenerate, manual edit, large diff, grouping, template, OAuth mock, PR 생성, update check, CI mode가 기존 commit flow와 함께 정상 동작하는지 통합 검증해줘.

46. gpt-5.5 medium 모델 agent 1개를 AT 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AT 단계 참고해서 AT단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AT 폴더를 만들고 그 안에 test-AT.md로 정리해줘. 그리고 Regression Test 계획을 @work_process/advanced/AT/research-AT.md 파일로 정리해줘.

46-1. AT 단계는 Regression Test Agent이므로 @work_process/advanced/AT/research-AT.md와 @work_process/advanced/AT/test-AT.md를 확인하고, convention, --step, --batch, --set-mode, --language, --model, localLLM, API Key Provider, --push, --reset이 3차 변경 이후에도 이전과 동일하게 동작하는지 검증해줘.

47. gpt-5.5 medium 모델 agent 1개를 AU 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AU 단계 참고해서 AU단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AU 폴더를 만들고 그 안에 test-AU.md로 정리해줘. 그리고 Security Review 계획을 @work_process/advanced/AU/research-AU.md 파일로 정리해줘.

47-1. AU 단계는 Security Review Agent이므로 @work_process/advanced/AU/research-AU.md와 @work_process/advanced/AU/test-AU.md를 기반으로 OAuth state/PKCE, token 로그 출력 여부, credentials 저장 위치, diff 외부 전송 확인, large diff chunk 로그 출력, PR body secret 포함 가능성, CI secret 노출, reset/push confirm 정책을 검토하고 필요한 수정까지 진행해줘.

48. gpt-5.5 medium 모델 agent 1개를 AV 단계 전담 agent로 배정해서 @AGENTS.md @GEMINI.md @init/00_rule.md @init/03_advanced.md 의 AV 단계 참고해서 AV단계가 잘 진행되었는지 확인하고자 테스트해서 작업해야 될 부분에 대해 @work_process/advanced/AV 폴더를 만들고 그 안에 test-AV.md로 정리해줘. 그리고 Documentation Update 계획을 @work_process/advanced/AV/research-AV.md 파일로 정리해줘.

48-1. AV 단계는 Documentation Update Agent이므로 @work_process/advanced/AV/research-AV.md와 @work_process/advanced/AV/test-AV.md를 확인하고, README.md, docs/model.md, docs/oauth.md, docs/templates.md, docs/pr.md, docs/github-actions.md에 3차 고도화 기능 사용법을 반영해줘. preview/regenerate/edit, large diff, grouping, template, OAuth, PR, GitHub Actions 내용을 사용자가 문서만 보고 실행할 수 있게 정리해줘.

49. gpt-5.5 high 모델 agent 1개를 배정해서, prompt.md의 3차 고도화 내용 2번부터 48번까지 작성된 B~AV 단계 프롬프트와 각 하위 번호가 init/03_advanced.md의 3차 고도화 범위에 부합하는지 최종 검토해줘. 누락된 단계, 잘못된 파일 경로, test/research 파일 지시 누락, 보안 규칙 위반 가능성, 1차·2차 MVP 회귀를 깨뜨릴 수 있는 지시가 있는지 확인하고 문제가 있으면 prompt.md에 수정안을 반영해줘.
