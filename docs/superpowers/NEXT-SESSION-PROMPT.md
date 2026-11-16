# 다음 세션에 붙여 넣을 프롬프트

아래 코드 블록 전체를 새 세션에 붙여 넣는다.

```text
컴활 1급 필기 CBT 프로젝트를 U:\ 에서 이어서 진행해. 너는 팀장 세션이다. 한국어로 짧게 소통해.

먼저 읽어 (이미 승인된 설계라서 다시 브레인스토밍하거나 되묻지 말 것):
1. U:\docs\superpowers\HANDOFF.md  ← 현재 상태, 남은 일, 규칙, 함정이 전부 여기 있다
2. U:\docs\superpowers\specs\2026-11-16-com1-cbt-design.md  (HANDOFF 6장에 적힌 부분은 오래됨)
3. U:\docs\superpowers\plans\2026-11-16-com1-cbt.md
그리고 `git status`, `git log --oneline -5`로 실제 상태를 확인해. 문서와 다르면 실제 상태를 우선하고, 끝난 작업은 반복하지 마.

할 일 (HANDOFF 4장 순서):
A. 스프레드시트 추가 3회분(ai-xl-01~03, 초안은 U:\tmp 에 있음)을 마무리해 등록·푸시해.
   - 먼저 HANDOFF 3장의 "겹치는 문제 7건"을 새 문제로 교체하고 각 회차 subject-1.txt를 다시 합쳐.
   - 이후 assemble → strip-answers → 정답 가린 검수(작성과 다른 세션/에이전트) → compare-answers → 팀장이 불일치·낮은 확신·모든 계산 문항을 직접 계산해 판정 → verified:true, index.js 등록 → 테스트·validate → 커밋·푸시. 회차마다 한 번에 하나씩 끝내.
   - 검수 에이전트 프롬프트에는 "풀이 과정 필수, 보기 번호는 0부터 센 값, 쓰기 전에 번호 재확인"을 반드시 넣어.
B. GitHub Pages 켜기는 내가 승인한 뒤에만 해. 필요한 시점에 `gh api -X POST repos/bossxor/com-exam/pages -f build_type=workflow` 실행 허락을 물어봐. 배포 실패 원인은 Pages가 꺼져 있는 것뿐이다(HANDOFF 4장 B).
C. 문제집을 등록할 때마다 앱을 다시 빌드해 폰에 설치(tools\build-apk.cmd, adb devices로 기기 확인)하고, HANDOFF 4장 C의 미확인 항목(하나 풀고 해설 모드, 홈에서 뒤로 가기 종료, 새 회차 풀이)을 실제로 확인한 만큼만 보고해. 폰이 안 잡히면 못 한 항목으로 보고해.

반드시 지킬 것:
- 공개 저장소(github.com/bossxor/com-exam)에는 코드·문서·AI 문제집(verified:true)만 올린다. pdf/, tools/src/, tmp/, dist/, kcci-*·ref-* 데이터·이미지, 미검수 초안은 절대 올리지 마. 푸시 전에 HANDOFF 5장의 확인 명령을 실행해 출력이 없는지 확인하고, git add -A 말고 파일을 명시해서 stage해.
- 정답·해설이 틀린 문제를 넣는 것이 최악이다. 불확실하면 버리고 새로 만들어.
- 폰트·공개 기출 PDF 다운로드, 설정 변경은 내가 허락한 뒤에만.
- U:\ 가 네트워크 드라이브라 파일 편집이 EBUSY로 실패하면 Write로 새로 쓰거나 Python 스크립트(py -I -X utf8)·bash heredoc을 써. PowerShell 멀티라인 커밋 메시지는 쓰지 말고 bash의 git commit -F - <<'EOF' 를 써. (HANDOFF 9장)
- 테스트·검증 명령을 실제로 돌려 통과를 확인한 뒤에만 다음으로 넘어가. 확인 안 한 것을 "됐다"고 하지 마.
- 기록 남기기: 작업 단위별로 커밋하고, 끝나면 구현·검수 결과, 테스트 결과, 기기 확인 결과, 푸시 여부, 남은 일을 간결하게 보고해.

팀 구조: 문제 제작과 검수는 서브에이전트/별도 세션으로 나눠서 병렬로 돌리고(작성자와 검수자는 반드시 다른 세션), 커밋·푸시와 정답 판정은 팀장(너)만 한다. 사용량 제한이 걱정되면 한 번에 에이전트를 6개 이하로 돌려.
```
