const Core = (() => {
  const SUBJECTS = ["컴퓨터 일반", "스프레드시트 일반", "데이터베이스 일반"];
  const TOPICS = {
    0: { windows: "Windows/운영체제", hardware: "하드웨어·CPU·기억장치", software: "소프트웨어·자료표현", network: "네트워크·인터넷", security: "정보보안", multimedia: "멀티미디어", trend: "최신 IT 용어" },
    1: { "xl-basic": "입력·서식·셀참조", "xl-func": "함수·수식", "xl-chart": "차트", "xl-data": "데이터 관리(정렬·필터·부분합·피벗)", "xl-analysis": "데이터 분석(목표값·시나리오·데이터표)", "xl-macro": "매크로·VBA", "xl-print": "인쇄·페이지 설정" },
    2: { "db-theory": "DB 개념·설계·정규화", "db-table": "테이블·필드·관계", "db-query": "쿼리·SQL", "db-form": "폼", "db-report": "보고서", "db-macro": "매크로·VBA·기타" }
  };
  const VISUAL_TAGS = ["table", "tr", "th", "td", "div", "span", "b", "i", "br", "code", "pre", "img"];
  const KEY = "com1.v1";
  const hasText = value => typeof value === "string" && Boolean(value.trim());
  const hasTopic = (subject, topic) => Object.prototype.hasOwnProperty.call(TOPICS[subject] || {}, topic);
  const round = value => Math.round(value * 10) / 10;

  function validateBank(bank) {
    const errors = [];
    if (!bank || !Array.isArray(bank.questions)) return ["Invalid questions array"];
    if (!hasText(bank.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(bank.id)) errors.push("Invalid bank id");
    if (!hasText(bank.title)) errors.push("Missing bank title");
    if (!["kcci", "kcci-old", "ref", "ai"].includes(bank.source)) errors.push("Invalid bank source");
    if (bank.source === "ai" && bank.verified !== true) errors.push("AI bank requires verified: true");
    const numbers = new Set();
    const choiceSets = new Set();
    for (const q of bank.questions) {
      if (!q || typeof q !== "object") {
        errors.push("Invalid question");
        continue;
      }
      const fail = message => errors.push("Question " + q.n + ": " + message);
      if (!Number.isInteger(q.n) || q.n < 1 || numbers.has(q.n)) fail("invalid or duplicate number");
      numbers.add(q.n);
      if (![0, 1, 2].includes(q.subject)) fail("invalid subject");
      if (!hasTopic(q.subject, q.topic)) fail("invalid topic");
      if (!Array.isArray(q.choices) || q.choices.length !== 4 || !Array.from(q.choices).every(hasText)) {
        fail("expected four nonempty choices");
      } else {
        const key = JSON.stringify(q.choices.map(choice => choice.trim()).sort());
        if (choiceSets.has(key)) fail("duplicate choice set");
        choiceSets.add(key);
      }
      if (![0, 1, 2, 3].includes(q.answer)) fail("invalid answer");
      if (!hasText(q.text) || !hasText(q.explanation)) fail("missing text or explanation");
      if (q.visual != null && !validVisual(q.visual)) fail("unsafe visual markup");
    }
    return errors;
  }

  function validVisual(visual) {
    // Limit attributes to inert formatting and local image paths.
    return typeof visual === "string" && !visual.replace(/<\/?([a-z]+)((?:[^<>"']|"[^"]*"|'[^']*')*)>/gi, (tag, name, attrs) => {
      if (!VISUAL_TAGS.includes(name.toLowerCase())) return tag;
      const leftover = attrs.replace(/\s+([a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (attr, key, double, single) => {
        const value = double ?? single;
        if (["class", "alt", "width", "height", "colspan", "rowspan"].includes(key.toLowerCase())) return "";
        if (name.toLowerCase() === "img" && key.toLowerCase() === "src" && /^img\/[\w.-]+$/i.test(value)) return "";
        return attr;
      }).trim();
      return leftover === "" || leftover === "/" ? "" : tag;
    }).includes("<");
  }

  function buildPool(banks) {
    return banks.flatMap(bank => bank.questions.map(q => ({
      ...q, id: bank.id + "-" + q.n, bankId: bank.id, bankTitle: bank.title, source: bank.source
    })));
  }

  function isInWrongNote(r) {
    return !!r && r.wrong > 0 && r.streak < 2;
  }

  function selectQuestions(pool, opts, rec, rng = Math.random) {
    const subjects = [0, 1, 2].filter(subject => opts.subjects.includes(subject));
    return subjects.flatMap((subject, index) => {
      const questions = pool.filter(q => {
        if (q.subject !== subject || !opts.bankIds.includes(q.bankId)) return false;
        const r = rec.q[q.id];
        if (opts.filter === "wrong") return isInWrongNote(r);
        if (opts.filter === "star") return !!r?.star;
        if (opts.filter === "unseen") return !r || r.tries === 0;
        return true;
      });
      if (opts.order === "random") {
        for (let i = questions.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
      }
      if (opts.count === "all") return questions;
      const quota = Math.floor(opts.count / subjects.length) + Number(index < opts.count % subjects.length);
      if (opts.aiLimit != null) {
        const standard = questions.filter(q => q.source !== "ai");
        const ai = questions.filter(q => q.source === "ai");
        const standardCount = Math.min(standard.length, Math.max(quota - opts.aiLimit, quota - ai.length));
        const selected = new Set([
          ...standard.slice(0, standardCount),
          ...ai.slice(0, quota - standardCount)
        ]);
        return questions.filter(q => selected.has(q));
      }
      return questions.slice(0, quota);
    });
  }

  function applyAnswer(rec, id, choice, correct, now) {
    const r = rec.q[id] ??= { tries: 0, wrong: 0, streak: 0, star: false };
    r.tries++;
    r.wrong += Number(!correct);
    r.streak = correct ? r.streak + 1 : 0;
    r.lastChoice = choice;
    r.lastAt = now;
  }

  function score(questions, answers) {
    const rows = SUBJECTS.map((_, subject) => ({ subject, correct: 0, total: 0 }));
    questions.forEach((q, index) => {
      rows[q.subject].total++;
      rows[q.subject].correct += Number(q.answer === answers[index]);
    });
    const active = rows.filter(row => row.total);
    const rates = active.map(row => row.correct * 100 / row.total);
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / (rates.length || 1);
    return {
      perSubject: active.map((row, index) => ({ ...row, score: round(rates[index]) })),
      average: round(mean),
      passed: active.length === 3 ? mean >= 60 && rates.every(rate => rate >= 40) : null
    };
  }

  function topicStats(pool, rec) {
    const topics = new Map();
    for (const q of pool) {
      const r = rec.q[q.id];
      if (!r?.tries || !hasTopic(q.subject, q.topic)) continue;
      const key = q.subject + ":" + q.topic;
      if (!topics.has(key)) topics.set(key, { subject: q.subject, topic: q.topic, tries: 0, wrong: 0 });
      const row = topics.get(key);
      row.tries += r.tries;
      row.wrong += r.wrong;
    }
    return Array.from(topics.values(), ({ subject, topic, tries, wrong }) => ({
      subject, topic, name: TOPICS[subject][topic], tries, correctRate: (tries - wrong) / tries, lowSample: tries < 5
    })).sort((a, b) => a.correctRate - b.correctRate);
  }

  function newSession(mode, questions, now) {
    return { mode, ids: questions.map(q => q.id), answers: Array(questions.length).fill(null),
      idx: 0, secondsLeft: mode === "exam" ? 3600 : null, startedAt: now };
  }

  function answer(cur, choice) {
    if (cur.mode === "study" && cur.answers[cur.idx] != null) return false;
    cur.answers[cur.idx] = choice;
    return true;
  }

  function restoreCurrent(cur, poolById) {
    if (!cur) return null;
    const ids = [];
    const answers = [];
    let idx = 0;
    cur.ids.forEach((id, index) => {
      if (!poolById.has(id)) return;
      ids.push(id);
      answers.push(cur.answers[index] ?? null);
      if (index < cur.idx) idx++;
    });
    return ids.length ? { ...cur, ids, answers, idx: Math.min(idx, ids.length - 1) } : null;
  }

  const emptyRecord = () => ({ version: 1, q: {}, sessions: [], current: null });

  function loadRecord(storage) {
    try {
      const rec = JSON.parse(storage.getItem(KEY));
      if (rec?.version === 1 && rec.q && typeof rec.q === "object" && !Array.isArray(rec.q) && Array.isArray(rec.sessions)) return rec;
    } catch {
      // Storage can be disabled or contain damaged JSON.
    }
    return emptyRecord();
  }

  function saveRecord(storage, rec) {
    try {
      storage.setItem(KEY, JSON.stringify(rec));
      return true;
    } catch {
      return false;
    }
  }

  function addSession(rec, session) {
    rec.sessions.unshift(session);
    rec.sessions.splice(50);
  }

  return { SUBJECTS, TOPICS, VISUAL_TAGS, validateBank, buildPool, selectQuestions, isInWrongNote,
    applyAnswer, score, topicStats, newSession, answer, restoreCurrent, emptyRecord, loadRecord, saveRecord, addSession };
})();

if (typeof module !== "undefined") module.exports = Core;
else window.Core = Core;
