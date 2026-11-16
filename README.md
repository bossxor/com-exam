# 컴활 1급 필기 CBT

컴퓨터활용능력 1급 필기 개인 학습 앱. 한 문항씩 풀고 정답과 해설을 확인한다.

## 실행

- PC 로컬: `serve.cmd` 실행 후 [localhost:8080](http://localhost:8080) 접속.
- 웹: [GitHub Pages](https://bossxor.github.io/com-exam/)에서 AI 문제집으로 연습.
- Android: 로컬에서 빌드한 APK를 기기에 설치.

## 문제집 추가

[설계 문서](docs/superpowers/specs/2026-11-16-com1-cbt-design.md)의 5.1절에 따라 `web/data/`에 문제집 JS 파일을 만든다. `addBank({...})`로 등록하며 문제집 ID와 문항 번호를 유지한다.

기출과 참고 사이트 문항의 저작권은 각 권리자에게 있다.
원본 PDF, 변환 파일, 이미지는 로컬에서 개인 학습에 사용한다.
공개 저장소에는 AI 문제집만 올린다.
