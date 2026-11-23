(() => {
  const root = document.querySelector("#app");
  const storageStatus = document.querySelector("#storage-status");
  const homeButton = document.querySelector("#home");
  const banks = window.BANKS = [];
  const modes = {
    exam: ["실전처럼 풀기", "60분 · 다 풀고 나서 채점과 문항별 해설", "실전 모드"],
    study: ["하나 풀고 해설", "한 문제씩 풀고 바로 정답과 해설 확인", "하나 풀고 해설"],
    guide: ["해설 보며 풀기", "문제와 함께 정답·해설을 보면서 풀이", "해설 보며 풀기"]
  };
  const modeKey = cur => cur.mode === "exam" ? "exam" : cur.guide ? "guide" : "study";
  let storage;
  try { storage = window.localStorage; } catch { storageStatus.hidden = false; }
  const record = Core.loadRecord(storage);
  let pool = [];
  let byId = new Map();
  let page = "home";
  let timer;
  let prior;
  let result;

  const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const button = (label, action, attrs = "") => '<button type="button" data-action="' + action + '" ' + attrs + ">" + label + "</button>";
  const current = () => record.current;
  const question = () => byId.get(current()?.ids[current()?.idx]);
  const save = () => { storageStatus.hidden = Core.saveRecord(storage, record); };
  const clock = seconds => [Math.floor(seconds / 60), seconds % 60].map(x => String(x).padStart(2, "0")).join(":");
  const bankTitle = id => banks.find(bank => bank.id === id)?.title ?? id;

  window.addBank = bank => {
    const errors = Core.validateBank(bank);
    if (banks.some(item => item.id === bank?.id)) errors.push("duplicate bank id");
    if (errors.length) console.warn("문제집 등록 실패", bank?.id, errors);
    else banks.push(bank);
  };

  function render(name, html) {
    const changed = page !== name;
    page = name;
    homeButton.hidden = name === "home";
    root.innerHTML = html;
    if (changed) {
      root.scrollTo(0, 0);
      root.querySelector("h1")?.focus({ preventScroll: true });
    }
  }

  function home() {
    clearInterval(timer);
    const cur = current();
    const roundRow = (id, title, meta, checked = false) =>
      '<label class="row"><input type="radio" name="round" value="' + escape(id) + '"' + (checked ? " checked" : "") +
      '><span class="rbox"><span class="rt">' + escape(title) + '</span><span class="rm">' + escape(meta) + '</span></span></label>';
    const mixed = roundRow("all", "전체 섞어서",
      pool.some(q => q.source !== "ai") ? "기출·참고 중심 · 60문항" : "AI 문제 · 60문항", true);
    const groups = new Map();
    const sourceLabels = { kcci: "기출", "kcci-old": "구 기출", ref: "참고 문제", ai: "AI 문제" };
    for (const bank of banks) {
      const match = /^ref-youngjin-(\d{4})-(\d{2})$/.exec(bank.id);
      const group = match ? "영진닷컴 " + match[1] + "년" : sourceLabels[bank.source];
      const title = match ? match[2] + "회" : bank.title;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(roundRow(bank.id, title, bank.questions.length + "문항"));
    }
    const groupedRounds = [...groups].map(([label, rounds]) =>
      '<details class="round-year"><summary>' + escape(label) + '</summary><div class="rows">' +
      rounds.join("") + '</div></details>').join("");
    render("home",
      (cur ? '<section class="resume"><div><strong>풀던 세트가 있어요</strong><span>' + escape(modes[modeKey(cur)][0]) +
        ' · ' + (cur.idx + 1) + '/' + cur.ids.length + '</span></div>' + button("이어서 풀기", "resume", 'class="primary"') + '</section>' : "") +
      '<section class="card"><h1 class="home-title" tabindex="-1">문제 고르기</h1>' +
      (!pool.length ? '<p class="empty">문제 데이터를 찾을 수 없습니다. 문제집 파일을 추가한 뒤 다시 여세요.</p></section>' :
        '<div class="rows">' + mixed + '</div>' + groupedRounds +
        '</section><section class="card"><h2>풀이 방식</h2>' + Object.entries(modes).map(([key, [title, desc]]) =>
          button('<strong>' + title + '</strong><span>' + desc + '</span>', "mode", 'class="mode" data-mode="' + key + '"')).join("") + '</section>'));
  }

  function start(key, questions) {
    if (!questions.length || (current() && !confirm("이어서 풀 수 있는 세트가 있습니다. 새 세트를 시작할까요?"))) return;
    record.current = Core.newSession(key === "exam" ? "exam" : "study", questions, Date.now());
    if (key === "guide") record.current.guide = true;
    save();
    resume();
  }

  function resume() {
    if (!current()) return;
    showQuestion(true);
    clearInterval(timer);
    if (current().mode === "exam") {
      if (!current().secondsLeft) return finish();
      timer = setInterval(() => {
        const cur = current();
        if (document.hidden) return;
        cur.secondsLeft--;
        if (cur.secondsLeft <= 0) return finish();
        root.querySelector("#timer").textContent = clock(cur.secondsLeft);
        if (cur.secondsLeft % 10 === 0) save();
      }, 1000);
    }
  }

  function visual(q) {
    const image = typeof q.image === "string" && /^img\/[\w.-]+$/i.test(q.image) ?
      '<img src="data/' + escape(q.image) + '" alt="문항 ' + q.n + ' 그림">' : "";
    const html = (q.visual ?? "").replace(/(<img\s+[^>]*?\bsrc\s*=\s*["'])(img\/)/gi, "$1data/$2");
    return image || html ? '<div class="visual">' + html + image + '</div>' : "";
  }

  function showQuestion(enter = false) {
    const cur = current();
    const q = question();
    const key = modeKey(cur);
    const exam = key === "exam";
    const selected = cur.answers[cur.idx];
    if (enter) prior = !exam && selected == null ? { ...record.q[q.id] } : null;
    const reviewed = !exam && (key === "guide" || selected != null);
    const answered = !exam && selected != null;
    const star = !!record.q[q.id]?.star;
    const pct = Math.round((cur.idx + 1) * 100 / cur.ids.length);
    const choices = q.choices.map((choice, i) => {
      const correct = reviewed && q.answer === i;
      const wrong = reviewed && selected === i && !correct;
      const tags = [correct ? "정답" : "", wrong ? "내 답" : "",
        reviewed && prior?.lastChoice === i && selected !== i ? "지난번 내 답" : ""].filter(Boolean).join(" · ");
      return button('<span class="mark">' + (i + 1) + '</span><span class="ctext">' + escape(choice) + visual({ visual: q.choiceVisuals?.[i] }) +
        (tags ? '<small>' + tags + '</small>' : "") + '</span>', "choice",
        'class="choice' + (wrong ? " wrong" : "") + (correct ? " correct" : "") + '" data-index="' + i +
        '" aria-pressed="' + (selected === i) + '"' + (answered ? " disabled" : ""));
    }).join("");
    const controls = exam ?
      button("이전", "prev", cur.idx === 0 ? "disabled" : "") +
      button("다음", "next", cur.idx + 1 === cur.ids.length ? "disabled" : "") +
      button("제출", "submit", 'class="primary"') :
      button(cur.idx + 1 === cur.ids.length ? "결과 보기" : "다음 문제", "next",
        'class="primary"' + (reviewed ? "" : " disabled"));
    const grid = exam ? '<details><summary>문항 이동</summary><div class="grid">' + cur.ids.map((_, i) =>
      button(i + 1, "jump", 'data-index="' + i + '" aria-label="' + (i + 1) + "번 " +
        (cur.answers[i] == null ? "미응답" : "응답") + '" class="' + (cur.answers[i] == null ? "" : "answered") +
        '"' + (i === cur.idx ? ' aria-current="step"' : ""))).join("") + '</div></details>' : "";
    const verdict = selected == null ? "정답 " + (q.answer + 1) + "번" :
      (selected === q.answer ? "정답" : "오답") + " · 정답 " + (q.answer + 1) + "번";
    render("question", '<section class="card question-card"><div class="qtop"><span class="pill">' + Core.SUBJECTS[q.subject] + '</span>' +
      (exam ? '<time id="timer" aria-label="남은 시간">' + clock(cur.secondsLeft) + '</time>' :
        '<span class="mtag">' + modes[key][2] + '</span>') + '</div><div class="qhead"><span class="count">문제 ' +
      (cur.idx + 1) + ' / ' + cur.ids.length + '</span>' + button(star ? "★ 별표" : "☆ 별표", "star", 'aria-pressed="' + star + '"') +
      '</div><div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      (!exam && prior?.wrong ? '<span class="badge">이전 오답 ' + prior.wrong + '회</span>' : "") +
      '<h1 class="question" tabindex="-1">' + escape(q.text) + '</h1>' + visual(q) + choices +
      '<div id="feedback" aria-live="polite">' + (reviewed ? '<section class="explanation"><p class="verdict ' +
        (selected == null ? "" : selected === q.answer ? "ok" : "no") + '">' + verdict + '</p>' + escape(q.explanation) + visual({ visual: q.explanationVisual }) +
        '</section>' : "") + '</div>' + grid + '</section><div class="dock"><div class="actions">' + controls + '</div></div>');
    if (enter) {
      root.scrollTo(0, 0);
      root.querySelector("h1").focus({ preventScroll: true });
    }
  }

  function choose(i) {
    const cur = current();
    const q = question();
    if (!Core.answer(cur, i)) return;
    if (cur.mode === "study") Core.applyAnswer(record, q.id, i, i === q.answer, Date.now());
    save();
    showQuestion();
    if (cur.mode === "study") root.querySelector("#feedback").scrollIntoView({ block: "nearest" });
    root.querySelector(cur.mode === "study" ? '[data-action="next"]' : '[data-action="choice"][data-index="' + i + '"]').focus({ preventScroll: true });
  }

  function move(index) {
    if (index < 0 || index >= current().ids.length) return;
    current().idx = index;
    save();
    showQuestion(true);
  }

  function finish() {
    clearInterval(timer);
    const cur = current();
    const questions = cur.ids.map(id => byId.get(id));
    const at = Date.now();
    if (cur.mode === "exam") questions.forEach((q, i) =>
      Core.applyAnswer(record, q.id, cur.answers[i], cur.answers[i] === q.answer, at));
    const grade = Core.score(questions, cur.answers);
    Core.addSession(record, { at, mode: cur.mode, bankIds: [...new Set(questions.map(q => q.bankId))],
      scores: Core.SUBJECTS.map((_, i) => grade.perSubject.find(row => row.subject === i)?.score ?? null),
      counts: Core.SUBJECTS.map((_, i) => grade.perSubject.find(row => row.subject === i)?.total ?? 0), passed: grade.passed });
    result = { ...grade, cur, questions, wrong: questions.filter((q, i) => cur.answers[i] !== q.answer) };
    record.current = null;
    save();
    showResult();
  }

  function showResult(wrongOnly = false) {
    const { cur, questions, wrong, average, passed, perSubject } = result;
    const review = cur.mode === "exam" ? '<section class="card"><h2>문항별 해설</h2><label><input type="checkbox" id="wrong-only"' +
      (wrongOnly ? " checked" : "") + '> 틀린 것만 보기</label>' + questions.map((q, i) => {
        const answer = cur.answers[i];
        if (wrongOnly && q.answer === answer) return "";
        return '<details><summary>' + (i + 1) + '. ' + escape(q.text) + '</summary>' + visual(q) +
          '<ol>' + q.choices.map((choice, i) => '<li>' + escape(choice) + visual({ visual: q.choiceVisuals?.[i] }) + '</li>').join("") + '</ol><p>내 답 ' +
          (answer == null ? "미응답" : answer + 1 + "번") + ' · 정답 ' + (q.answer + 1) +
          '번</p><div class="explanation">' + escape(q.explanation) + visual({ visual: q.explanationVisual }) + '</div></details>';
      }).join("") + '</section>' : "";
    render("result", '<section class="scorecard"><h1 tabindex="-1">채점 결과</h1><p class="label">총점 평균</p><p class="score">' +
      average + '<small>점</small></p>' + (passed == null ? "" : '<p class="verdict-pill ' + (passed ? "pass" : "fail") + '">' +
      (passed ? "합격" : "불합격") + '</p>') + '</section><section class="card">' + perSubject.map(row => '<div class="subj"><div class="srow"><span>' +
      Core.SUBJECTS[row.subject] + '</span><b>' + row.score + '점</b></div><div class="bar" aria-hidden="true"><i' +
      (row.score < 40 ? ' class="low"' : "") + ' style="width:' + row.score + '%"></i></div><small>' + row.correct + '/' +
      row.total + (row.score < 40 ? ' · 과락' : "") + '</small></div>').join("") +
      '<p>이번에 틀린 문제 ' + wrong.length + '개</p><div class="actions">' +
      (wrong.length ? button("틀린 문제 다시 풀기", "retry", 'class="primary"') : "") + button("홈", "back") + '</div></section>' + review);
  }

  window.appBack = () => {
    if (page === "home") return false;
    if (page === "question" && !confirm("그만 풀까요? 홈에서 이어서 풀 수 있습니다.")) return true;
    if (page === "question") save();
    home();
    return true;
  };

  homeButton.addEventListener("click", () => window.appBack());
  root.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const i = Number(target.dataset.index);
    switch (target.dataset.action) {
      case "back": window.appBack(); break;
      case "resume": resume(); break;
      case "mode": {
        const id = root.querySelector('input[name="round"]:checked').value;
        start(target.dataset.mode, Core.selectQuestions(pool, id === "all" ?
          { bankIds: banks.map(bank => bank.id), subjects: [0, 1, 2], filter: "all", count: 60, order: "random", aiLimit: 4 } :
          { bankIds: [id], subjects: [0, 1, 2], filter: "all", count: "all", order: "original" }, record));
        break;
      }
      case "choice": choose(i); break;
      case "prev": move(current().idx - 1); break;
      case "jump": move(i); break;
      case "next":
        if (current().idx + 1 === current().ids.length) finish();
        else move(current().idx + 1);
        break;
      case "submit": if (confirm("제출하고 채점할까요?")) finish(); break;
      case "star": {
        const q = question();
        const entry = record.q[q.id] ??= { tries: 0, wrong: 0, streak: 0, star: false };
        entry.star = !entry.star;
        save();
        target.setAttribute("aria-pressed", entry.star);
        target.textContent = entry.star ? "★ 별표" : "☆ 별표";
        break;
      }
      case "retry": start(result.cur.guide ? "guide" : result.cur.mode, result.wrong); break;
    }
  });
  root.addEventListener("change", event => {
    if (event.target.id === "wrong-only") {
      showResult(event.target.checked);
      root.querySelector("#wrong-only").focus();
    }
  });
  document.addEventListener("keydown", event => {
    if (page !== "question" || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      root.querySelector('[data-action="choice"][data-index="' + (Number(event.key) - 1) + '"]')?.click();
    } else if (event.key === "Enter" && !event.target.closest("button,summary,input")) {
      event.preventDefault();
      root.querySelector('[data-action="next"]')?.click();
    }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && page === "question") save(); });

  async function load() {
    for (const name of window.BANK_FILES ?? []) {
      if (!/^[\w-]+\.js$/.test(name)) continue;
      await new Promise(resolve => {
        const script = document.createElement("script");
        script.src = "data/" + name;
        script.onload = script.onerror = resolve;
        document.head.append(script);
      });
    }
    pool = Core.buildPool(banks);
    byId = new Map(pool.map(q => [q.id, q]));
    if (current()) {
      record.current = Core.restoreCurrent(current(), byId);
      save();
    }
    home();
  }
  load();
})();
