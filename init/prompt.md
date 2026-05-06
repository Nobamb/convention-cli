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
