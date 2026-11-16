(() => {
  const root = document.querySelector("#app");
  const storageStatus = document.querySelector("#storage-status");
  const banks = window.BANKS = [];
  const sources = { kcci: "기출", "kcci-old": "구 기출", ref: "참고", ai: "AI" };
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
  const rate = value => (value * 100).toFixed(1) + "%";
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
    root.innerHTML = html;
    if (changed) {
      window.scrollTo(0, 0);
      root.querySelector("h1")?.focus({ preventScroll: true });
    }
  }

  function option(name, value, label, selected = false) {
    return '<label class="chip"><input type="radio" name="' + name + '" value="' + value + '"' +
      (selected ? " checked" : "") + '><span>' + label + '</span></label>';
  }

  function home() {
    clearInterval(timer);
    const counts = {
      wrong: pool.filter(q => Core.isInWrongNote(record.q[q.id])).length,
      star: pool.filter(q => record.q[q.id]?.star).length,
      unseen: pool.filter(q => !record.q[q.id]?.tries).length
    };
    const groups = Object.entries(sources).map(([source, label]) => {
      const matches = banks.filter(bank => bank.source === source);
      if (!matches.length) return "";
      return '<div class="group"><span class="group-head">' + label + ' · ' + matches.length + '회분</span><div class="chips">' +
        '<label class="chip"><input type="checkbox" data-group="' + source + '" checked><span>전체</span></label>' +
        matches.map(bank => '<label class="chip"><input type="checkbox" name="bank" data-source="' + source + '" value="' +
          escape(bank.id) + '" checked><span>' + escape(bank.title) + '</span></label>').join("") + '</div></div>';
    }).join("");
    const cur = current();
    render("home", '<header class="top"><div><h1 tabindex="-1">컴활 1급 필기 CBT</h1><p class="sub">총 ' + pool.length +
      '문항 · 오답노트 ' + counts.wrong + ' · 별표 ' + counts.star + '</p></div>' + button("통계", "stats", 'class="ghost"') + '</header>' +
      (!pool.length ? '<p class="empty">문제 데이터를 찾을 수 없습니다. 문제집 파일을 추가한 뒤 다시 여세요.</p>' : "") +
      (cur ? '<section class="resume"><div><strong>풀던 세트가 있어요</strong><span>' +
        escape(byId.get(cur.ids[cur.idx]).bankTitle) + ' · ' + (cur.idx + 1) + '/' + cur.ids.length + '</span></div>' +
        button("이어서 풀기", "resume", 'class="primary"') + '</section>' : "") +
      '<form id="settings"><fieldset><legend>모드</legend><div class="chips seg">' + option("mode", "study", "학습 모드", true) +
      option("mode", "exam", "실전 모드 (60분)") + '</div></fieldset><fieldset><legend>문제집</legend>' + groups +
      '</fieldset><fieldset><legend>과목</legend><div class="chips">' + Core.SUBJECTS.map((name, i) =>
        '<label class="chip"><input type="checkbox" name="subject" value="' + i + '" checked><span>' + name + '</span></label>').join("") +
      '</div></fieldset><fieldset><legend>필터</legend><div class="chips">' + option("filter", "all", "전체", true) +
      option("filter", "wrong", "오답노트 (" + counts.wrong + ")") +
      option("filter", "star", "별표 (" + counts.star + ")") +
      option("filter", "unseen", "안 푼 문제 (" + counts.unseen + ")") +
      '</div></fieldset><fieldset><legend>문항 수</legend><div class="chips">' + option("count", "all", "전체") +
      option("count", "20", "20") + option("count", "60", "60", true) + option("count", "custom", "직접") +
      '<input class="num" aria-label="직접 입력 문항 수" name="custom" type="number" inputmode="numeric" min="1" max="' +
      Math.max(1, pool.length) + '" value="60" disabled></div></fieldset><fieldset><legend>순서</legend><div class="chips seg">' +
      option("order", "original", "원래 순서") + option("order", "random", "무작위", true) +
      '</div></fieldset><div class="dock"><p id="set-status" role="status"></p><button class="primary" id="start">시작</button></div></form>');
    updateSettings();
  }

  function settings() {
    const form = document.querySelector("#settings");
    const data = new FormData(form);
    const count = data.get("count");
    return {
      mode: data.get("mode"), bankIds: data.getAll("bank"), subjects: data.getAll("subject").map(Number),
      filter: data.get("filter"), count: count === "all" ? count : Number(count === "custom" ? data.get("custom") : count),
      order: data.get("order")
    };
  }

  function updateSettings() {
    const form = document.querySelector("#settings");
    form.elements.custom.disabled = form.elements.count.value !== "custom";
    const opts = settings();
    const length = Core.selectQuestions(pool, { ...opts, order: "original" }, record).length;
    document.querySelector("#start").disabled = !length || !form.checkValidity();
    document.querySelector("#set-status").textContent = length ? length + "문항 출제" :
      opts.filter === "wrong" && !pool.some(q => Core.isInWrongNote(record.q[q.id])) ?
        "오답노트가 비었습니다. 문제를 풀면 틀린 문제가 여기 모입니다." : "조건에 맞는 문제가 없습니다.";
    for (const all of root.querySelectorAll("[data-group]")) {
      const members = [...root.querySelectorAll('[data-source="' + all.dataset.group + '"]')];
      all.checked = members.every(item => item.checked);
      all.indeterminate = !all.checked && members.some(item => item.checked);
    }
  }

  function start(mode, questions) {
    if (!questions.length || (current() && !confirm("이어서 풀 수 있는 세트가 있습니다. 새 세트를 시작할까요?"))) return;
    record.current = Core.newSession(mode, questions, Date.now());
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
    const exam = cur.mode === "exam";
    const selected = cur.answers[cur.idx];
    if (enter) {
      prior = !exam && selected == null ? { ...record.q[q.id] } : null;
    }
    const reviewed = !exam && selected != null;
    const star = !!record.q[q.id]?.star;
    const pct = Math.round((cur.idx + 1) * 100 / cur.ids.length);
    const choices = q.choices.map((choice, i) => {
      const correct = reviewed && q.answer === i;
      const wrong = reviewed && selected === i && !correct;
      const tags = [correct ? "정답" : "", wrong ? "내 답" : "",
        reviewed && prior?.lastChoice === i && selected !== i ? "지난번 내 답" : ""].filter(Boolean).join(" · ");
      const circle = correct ? '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M25 5C14-1 3 9 3 19s7 15 16 14c10-1 16-8 14-17C32 9 26 4 19 5"/></svg>' : "";
      return button('<span class="mark">' + (i + 1) + circle + '</span><span class="ctext">' + escape(choice) +
        (tags ? '<small>' + tags + '</small>' : "") + '</span>', "choice",
        'class="choice' + (wrong ? " wrong" : "") + (correct ? " correct" : "") + '" data-index="' + i + '" aria-pressed="' +
        (selected === i) + '"' + (reviewed ? " disabled" : ""));
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
    render("question", '<div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div><div class="qhead"><div class="qmeta"><span class="count">' +
      (cur.idx + 1) + '<small>/' + cur.ids.length + '</small></span><span class="src">' + escape(q.bankTitle) + ' · ' +
      Core.SUBJECTS[q.subject] + '</span></div>' +
      (exam ? '<time id="timer" aria-label="남은 시간">' + clock(cur.secondsLeft) + '</time>' : "") +
      '<div class="actions">' + button(star ? "★ 별표" : "☆ 별표", "star", 'aria-pressed="' + star + '"') +
      button("그만 풀기", "back") + '</div></div>' +
      (!exam && prior?.wrong ? '<p><span class="badge">이전 오답 ' + prior.wrong + '회</span></p>' : "") +
      '<h1 class="question" tabindex="-1">' + escape(q.text) + '</h1>' + visual(q) + choices +
      '<div id="feedback" aria-live="polite">' + (reviewed ? '<section class="explanation"><p class="verdict">' +
        (selected === q.answer ? "정답" : "오답") + ' · 정답 ' + (q.answer + 1) + '번</p>' + escape(q.explanation) +
        '</section>' : "") + '</div>' + grid + '<div class="dock"><div class="actions">' + controls + '</div></div>');
    if (enter) {
      window.scrollTo(0, 0);
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
    const review = cur.mode === "exam" ? '<h2>문항별 해설</h2><label><input type="checkbox" id="wrong-only"' +
      (wrongOnly ? " checked" : "") + '> 틀린 것만 보기</label>' + questions.map((q, i) => {
        const answer = cur.answers[i];
        if (wrongOnly && q.answer === answer) return "";
        return '<details><summary>' + (i + 1) + '. ' + escape(q.text) + '</summary>' + visual(q) +
          '<ol>' + q.choices.map(choice => '<li>' + escape(choice) + '</li>').join("") + '</ol><p>내 답 ' +
          (answer == null ? "미응답" : answer + 1 + "번") + ' · 정답 ' + (q.answer + 1) +
          '번</p><p class="explanation">' + escape(q.explanation) + '</p></details>';
      }).join("") : "";
    render("result", '<h1 tabindex="-1">채점 결과</h1><section class="scorecard"><p class="label">총점 평균</p><p class="score">' +
      average + '<small>점</small></p>' + (passed == null ? "" : '<p class="verdict-pill ' + (passed ? "pass" : "fail") + '">' +
      (passed ? "합격" : "불합격") + '</p>') + '</section>' + perSubject.map(row => '<div class="subj"><div class="srow"><span>' +
      Core.SUBJECTS[row.subject] + '</span><b>' + row.score + '점</b></div><div class="bar" aria-hidden="true"><i' +
      (row.score < 40 ? ' class="low"' : "") + ' style="width:' + row.score + '%"></i></div><small>' + row.correct + '/' +
      row.total + (row.score < 40 ? ' · 과락' : "") + '</small></div>').join("") +
      '<p>이번에 틀린 문제 ' + wrong.length + '개</p><div class="actions">' +
      (wrong.length ? button("틀린 문제 다시 풀기", "retry") : "") + button("홈", "back") + '</div>' + review);
  }

  function stats() {
    const rows = Core.topicStats(pool, record);
    const totals = Core.SUBJECTS.map((name, subject) => {
      const recs = pool.filter(q => q.subject === subject).map(q => record.q[q.id]).filter(Boolean);
      const tries = recs.reduce((sum, r) => sum + r.tries, 0);
      const wrong = recs.reduce((sum, r) => sum + r.wrong, 0);
      return '<li>' + name + ' ' + (tries ? rate((tries - wrong) / tries) : "기록 없음") + '</li>';
    });
    render("stats", '<h1 tabindex="-1">통계</h1>' + button("홈", "back") + '<h2>주제별 정답률</h2>' +
      (rows.length ? '<table class="stats"><thead><tr><th scope="col">주제</th><th scope="col">푼 횟수</th><th scope="col">정답률</th></tr></thead><tbody>' +
        rows.map(row => '<tr><th scope="row">' + button(escape(row.name), "topic", 'data-topic="' + row.topic +
          '" data-index="' + row.subject + '"') + '</th><td>' + row.tries + '</td><td>' + rate(row.correctRate) +
          (row.lowSample ? '<br><small>표본 적음</small>' : "") + '</td></tr>').join("") + '</tbody></table>' :
        '<p>문제를 풀면 주제별 정답률이 표시됩니다.</p>') + '<h2>과목별 누적 정답률</h2><ul>' +
      totals.join("") + '</ul><h2>최근 세트</h2><ul>' + record.sessions.slice(0, 10).map(session =>
        '<li>' + new Date(session.at).toLocaleDateString("ko-KR") + ' · ' + escape(session.bankIds.map(bankTitle).join(", ")) +
        ' · ' + (session.mode === "study" ? "학습" : "실전") + ' · ' +
        session.scores.map((score, i) => score == null ? "" : Core.SUBJECTS[i] + " " + score + "점").filter(Boolean).join(", ") +
        (session.passed == null ? "" : session.passed ? " · 합격" : " · 불합격") + '</li>').join("") + '</ul>');
  }

  window.appBack = () => {
    if (page === "home") return false;
    if (page === "question" && !confirm("그만 풀까요? 홈에서 이어서 풀 수 있습니다.")) return true;
    if (page === "question") save();
    home();
    return true;
  };

  root.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const i = Number(target.dataset.index);
    switch (target.dataset.action) {
      case "back": window.appBack(); break;
      case "resume": resume(); break;
      case "stats": stats(); break;
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
      case "retry": start(result.cur.mode, result.wrong); break;
      case "topic": start("study", pool.filter(q => q.subject === i && q.topic === target.dataset.topic)); break;
    }
  });
  root.addEventListener("submit", event => {
    if (event.target.id !== "settings") return;
    event.preventDefault();
    const opts = settings();
    start(opts.mode, Core.selectQuestions(pool, opts, record));
  });
  root.addEventListener("input", event => {
    if (page !== "home" || !event.target.closest("#settings")) return;
    const group = event.target.dataset.group;
    if (group) for (const input of root.querySelectorAll('[data-source="' + group + '"]')) input.checked = event.target.checked;
    updateSettings();
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
