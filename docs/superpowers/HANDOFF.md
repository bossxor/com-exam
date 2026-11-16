# 컴활 1급 필기 CBT — 인수인계 (2026-11-16 기준)

다른 세션에서 이어서 작업하기 위한 현재 상태, 남은 일, 주의점 정리. 이 문서와 함께 읽을 것:
- 설계: `docs/superpowers/specs/2026-11-16-com1-cbt-design.md` (**일부 오래됨** — 아래 "설계와 달라진 점" 참고)
- 구현 계획: `docs/superpowers/plans/2026-11-16-com1-cbt.md` (Task 1~7 완료, 8 진행 중, 9~11 남음)
- 붙여 넣을 프롬프트: `docs/superpowers/NEXT-SESSION-PROMPT.md`
- (참고) `docs/superpowers/kickoff-prompt.md`는 맨 처음 구현 시작용이라 지금은 쓰지 않는다.

## 1. 무엇인가
컴활 1급 필기 문제은행 연습 앱. 웹앱 1벌(`web/`)을 PC 로컬 서버, GitHub Pages, 안드로이드 WebView 앱이 함께 쓴다. 빌드 도구 없음(HTML/CSS/vanilla JS). 사용자 1명이 개인 학습용으로 쓴다.
- 작업 폴더 `U:\` (네트워크 드라이브). 원격: https://github.com/bossxor/com-exam (**공개 저장소**, 브랜치 `main`).
- 마지막 커밋 `82fba5f`, `origin/main`과 동일. 작업 트리에 커밋 안 된 것은 `docs/superpowers/kickoff-prompt.md`(오래된 문서)와 이 문서 두 개뿐.

## 2. 지금 되는 것 (사용자 폰에서 확인함)
- 홈: "문제 고르기"(전체 섞어서 + 문제집별 2열 선택) → "풀이 방식" 3개: **실전처럼 풀기**(60분, 끝나고 채점+해설) / **하나 풀고 해설** / **해설 보며 풀기**(처음부터 정답·해설 표시).
- 이어서 풀기(앱을 껐다 켜도 복구), 별표, 이전 오답 배지, 채점 결과(과목별 막대·합격/과락), 뒤로 가기 확인창.
- 테스트 20개 통과(`node --test 'tests/*.test.js'`), 데이터 검증 통과(`node tools/validate.mjs`).
- 마지막으로 설치한 APK에는 AI 1~7회가 들어 있다(`U:\dist\com1cbt.apk`, git 제외).

## 3. 문제 데이터 현황
| 묶음 | 파일 | 문항 | git | 상태 |
|---|---|---|---|---|
| 2024 상시 기출 01·02회 | `web/data/kcci-2024-0{1,2}.js` | 120 | 제외(저작권) | 완료 |
| 참고 사이트 1~7회 | `web/data/ref-0{1..7}.js` | 420 | 제외(저작권) | 완료 |
| AI 고난도 1~7회 | `web/data/ai-0{1..7}.js` | 420 | **포함** | 검수·등록·푸시 완료 |
| AI 스프레드시트 1~3회 | (아직 `web/data`에 없음) | 180 | 포함 예정 | **초안만 완성, 검수 전** |

스프레드시트 3회 초안 위치: `tmp/ai-xl-0N-partA.txt`, `partB.txt`(각 30줄)와 이를 합친 `tmp/ai-xl-0N-subject-1.txt`(N=01,02,03, 각 60줄). `tmp/`는 git 제외 폴더라 **이 PC의 `U:\tmp`에만 있다.** 지우지 말 것.
- 줄 형식: `topic¦정답번호(1-4)¦문제¦보기1¦보기2¦보기3¦보기4¦해설1¦해설2¦해설3¦해설4` (구분자 `¦` = U+00A6).
- 주제 배분: xl-01 함수 종합 / xl-02 데이터 관리·분석 / xl-03 VBA·서식·차트·인쇄. 정답 위치는 1~4번이 14~16개씩.
- 기존 AI 7회 목록(문제 시작 140줄)은 `tmp/xl-existing.txt`.

### 초안에서 찾은 문제 (먼저 고칠 것)
`tools/assemble-ai.mjs`로 합친 뒤 다른 문제집과 비교한 결과 아래 7건이 겹친다. 새 문제로 바꾸거나 보기를 고쳐서 해소할 것(정답이 같은 문제는 보기만 바꾸면 안 되고 내용이 달라져야 함).
- `ai-xl-01` Q30 — 보기 묶음이 `ai-01` Q25와 같음
- `ai-xl-01` Q57 — 문제 문장이 `ai-xl-01` Q27과 같음
- `ai-xl-02` Q15 — 보기 묶음이 `ai-01` Q26과 같음
- `ai-xl-02` Q30 — 보기 묶음이 `ai-xl-01` Q35와 같음
- `ai-xl-02` Q47 — 보기 묶음이 `ai-04` Q23과 같음
- `ai-xl-03` Q33 — 보기 묶음이 `ai-03` Q27과 같음 (COUNTIFS 문제, 정답 2)
- `ai-xl-03` Q45 — 문제 문장이 `ai-xl-02` Q52와 같음
이미 고친 것: `ai-xl-03` Q33(보기에 "건" 추가했으나 아직 겹침), `ai-xl-01` Q50(목표값 찾기 문제를 숫자·보기 바꿔 교체).
수정은 `tmp/ai-xl-0N-partA/B.txt`에서 한 뒤, 합친 `subject-1.txt`를 다시 만들어야 한다(파트 A 30줄 + 파트 B 30줄 이어 붙이기).

## 4. 남은 일 (순서대로)

### A. 스프레드시트 3회 마무리 (계획 Task 8 이어서, 회차마다 반복)
1. 위 7건 해소 후 `subject-1.txt` 재생성(파트 A + 파트 B).
2. `node tools/assemble-ai.mjs ai-xl-0N` → `web/data/ai-xl-0N.js`(verified:false 초안) 생성. 제목은 자동으로 "AI 스프레드시트 N회".
3. `node tools/strip-answers.mjs ai-xl-0N` → `tmp/ai-xl-0N.blind.json`(정답·해설 없음). **이 파일만** 검수 에이전트(작성자와 다른 세션)에게 준다.
4. 검수 에이전트가 `tmp/ai-xl-0N.verify.json`을 쓴다: `[{n, answer(0~3 **0부터 센 번호**), confidence("high"/"low"), reason}]` 60개.
5. `node tools/compare-answers.mjs ai-xl-0N` → 불일치·낮은 확신 문항 표 + 마지막 줄 `mismatch=K low=L`.
6. **팀장이 불일치·낮은 확신 문항을 직접 푼다.** 그리고 계산형 문항(함수·VBA·데이터 표·인쇄 쪽 수 등)은 전부 직접 계산한다(아래 "검수 교훈").
7. 통과하면 `web/data/ai-xl-0N.js`의 `"verified": false` → `true`로 고치고 `web/data/index.js`의 `BANK_FILES`에 `"ai-xl-0N.js"` 추가.
8. `node --test 'tests/*.test.js'`, `node tools/validate.mjs`(종료 코드 0), 푸시 전 제외 확인(아래 5장), 명시적 `git add`(대상 파일만) → 커밋 → `git push origin main`. 커밋 메시지 예: `data: add ai-xl-01 (verified, mismatch=K fixed=X replaced=Y)`.

### B. GitHub Pages 켜기 (계획 Task 9) — **사용자 확인 필요**
- 현재 `.github/workflows/pages.yml`은 있고, 테스트·검증 단계는 CI에서 통과하지만 **배포 단계가 매번 404로 실패**한다. 저장소 Pages가 아직 꺼져 있어서다(`gh api repos/bossxor/com-exam/pages` → 404).
- 사용자 승인 후: `gh api -X POST repos/bossxor/com-exam/pages -f build_type=workflow` → 워크플로 재실행(`gh run rerun <id>` 또는 새 푸시) → `https://bossxor.github.io/com-exam/` 확인(AI 문제집만 보이고 콘솔 오류 없어야 함. 없는 `kcci-*`/`ref-*` 파일 404는 정상).

### C. 폰·앱 마무리
- 폰에서 아직 안 눌러 본 것: "하나 풀고 해설" 모드, 홈에서 뒤로 가기 시 앱 종료, 새 AI 회차 문제 실제 풀이. 하단 버튼 아래 여백이 조금 남는 것(내용은 안 가림)도 필요하면 손볼 것.
- 새 문제집을 등록한 뒤에는 앱을 다시 빌드해 설치: `tools\build-apk.cmd` → `adb install -r dist\com1cbt.apk`.

### D. 선택 사항
- 공개 구 기출(2014~2020 정기) 추가(계획 Task 10): 사용자가 PDF를 `U:\pdf\`에 넣거나, 받을 파일 목록(이름·출처·크기)을 사용자에게 보여 주고 허락받은 뒤에만 받는다. 자동 크롤링 금지.
- 폰트 다운로드(계획의 Gowun Batang/SUIT)는 **불필요해졌다.** 지금 UI는 시스템 고딕체(`Pretendard`→`Noto Sans KR`→시스템) 폴백만 쓴다.
- 설계 문서와 README를 현재 구현에 맞게 고치기(아래 6장).

## 5. 반드시 지킬 규칙
- **공개 저장소에 올리면 안 되는 것**(`.gitignore`로 제외됨): `pdf/`, `tools/src/`, `tmp/`, `dist/`, `web/data/kcci-*.js`, `web/data/ref-*.js`, `web/data/img/kcci-*`, `web/data/img/ref-*`, 미검수 AI 초안(`verified:false`). 푸시 전 매번: `git ls-files | grep -E '^(pdf/|tools/src/|tmp/|dist/|web/data/(kcci|ref)-|web/data/img/(kcci|ref)-)'` → **출력이 없어야 한다.** `git add -A` 금지, 파일을 명시해서 stage.
- 사용자 허락이 필요한 것: Pages 설정 변경, 파일 다운로드(폰트·공개 기출), 설정 변경. 폰/계정 개인 정보(전화 알림 등)는 건드리지 않는다.
- 정답·해설이 틀린 문제를 넣는 것이 최악이다. 확신이 없으면 버리고 새로 만든다.
- 커밋은 팀장 세션만. 푸시 전 테스트·검증 명령을 실제로 돌려 통과를 확인한다. 확인 안 한 것을 "됐다"고 하지 않는다.
- 커밋 메시지 끝 공동 작성자 줄은 세션이 쓰는 모델에 맞게(이전 세션은 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).

## 6. 설계 문서와 달라진 점 (사용자 요청으로 바뀜)
- **풀이 방식 3개만**: 실전처럼 풀기 / 하나 풀고 해설 / 해설 보며 풀기. 참고 사이트 방식 그대로 회차를 고르고 시작.
- **삭제**: 홈의 필터·문항 수·순서 옵션, 문제집 출처별 그룹 표시, 통계 화면과 오답노트 진입, 다크 모드. (오답·별표 기록은 계속 저장되지만 볼 화면이 없다. 필요하면 다시 만든다.)
- **디자인**: 남색 상단 막대 + 흰 카드 + 파란 선택색, 정답 초록/오답 빨강, 고딕체. 스펙 10.1의 "OMR 답안지/명조체" 콘셉트는 폐기.
- **레이아웃**: 화면이 가려지는 문제 때문에 flex 열 구조(상단 막대 / 스크롤 영역 / 하단 고정 버튼). 안드로이드는 상태 표시줄 밑에 남색 블록을 두고 나머지 시스템 바 여백은 부모 레이아웃에 padding으로 준다. CSS의 `env(safe-area-inset-*)`와 `viewport-fit=cover`는 이중 여백 문제로 제거.
- 안드로이드 뒤로 가기 확인창은 `onJsConfirm`을 직접 구현("그만 풀까요?" 한 줄).

## 7. 도구와 실행
- 웹 로컬 실행: `serve.cmd`(= `py -m http.server 8080 -d web`) → `http://localhost:8080`
- APK 빌드: `tools\build-apk.cmd` (소스는 `U:\android`, 빌드 출력은 로컬 `%LOCALAPPDATA%\com1cbt-build`, 결과 `U:\dist\com1cbt.apk`). 스크립트 안에서 `call .\gradlew.bat`로 호출해야 한다(그냥 `gradlew.bat`는 이 PC에서 못 찾음 — 이미 고침).
- 폰: 기기 ID는 `adb devices`로 확인(USB 디버깅). 패키지 `com.songwol.com1cbt`. `adb -s <기기ID> install -r dist\com1cbt.apk`, 실행 `adb shell monkey -p com.songwol.com1cbt -c android.intent.category.LAUNCHER 1`, 화면 `adb exec-out screencap -p > tmp\x.png`. WebView 안은 `uiautomator dump`로 안 보이고, 앱이 띄운 확인창은 보인다. 테스트 때 `cmd uimode night yes`를 썼으면 반드시 `night no`로 되돌린다.
- 문제 제작 보조: `tools/assemble-ai.mjs`(txt→draft), `tools/strip-answers.mjs`, `tools/compare-answers.mjs`, `tools/validate.mjs`.
- 문제집 형식·등록 방식은 스펙 5.1·6장, 검증 규칙은 스펙 9.4.

## 8. 검수에서 얻은 교훈
- 정답을 가린 검수 에이전트는 **풀이를 대충 하는 경향**이 있다(60문항에 30~90초, "개념 기준으로 판단" 같은 근거, 보기 번호를 잘못 적음). 그래서 불일치·낮은 확신 문항은 반드시 팀장이 직접 풀고, 스프레드시트 함수·VBA·계산 문항은 전부 직접 계산해서 확인했다. 검수 프롬프트에 "풀이 과정 필수, 보기 번호는 0부터 센 값, 쓰기 전에 번호 재확인"을 넣으면 정확도가 올라갔다.
- 문제 작성 에이전트는 과목별(컴퓨터 20 / 스프레드시트 20 / DB 20) 또는 파트별(30)로 나눠 병렬로 돌렸고, 서로 안 겹치도록 회차별 출제 각도를 지정했다. 합친 뒤 **문제 문장·보기 묶음 중복 검사**는 필수(`assemble`이 같은 문제집 안의 보기 중복을 막고, 회차 간 중복은 따로 스크립트로 확인했다).
- 코드 문제(VBA)는 한 줄 If처럼 해석이 갈리는 표기를 피하고 "N줄: … / N줄: …"로 줄 구분을 명시한다.
- 사용량 제한에 걸려 에이전트가 "실패"로 끝나도 파일은 이미 완성돼 있을 수 있다. 결과 파일 줄 수(`py -X utf8 -c "..."`)로 직접 확인할 것.

## 9. 이 PC에서 겪은 함정
- `U:\`가 네트워크 드라이브라 Edit 도구가 `EBUSY: resource busy or locked, fchmod`로 실패한다. 새 파일은 Write로, 기존 파일 수정은 Python 스크립트(`py -I -X utf8`)나 bash heredoc으로 한다.
- PowerShell에서 `git commit -m @'...'@`는 멀티라인 메시지를 인자로 쪼개 실패한다. bash의 `git commit -F - <<'EOF' ... EOF`를 쓴다.
- Windows 기본 인코딩(cp949) 때문에 Python은 `-X utf8` 필수.
- Python 문자열에 `\2713` 같은 CSS 이스케이프를 넣을 때 백슬래시가 망가지기 쉽다. 넣은 뒤 반드시 결과를 확인한다.
