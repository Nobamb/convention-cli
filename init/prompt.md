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
