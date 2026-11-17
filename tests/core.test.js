const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../web/core.js");

const pool = Array.from({ length: 75 }, (_, i) => ({
  id: "bank-" + (i + 1), bankId: "bank", n: i + 1, subject: Math.floor(i / 25),
  topic: ["hardware", "xl-func", "db-query"][Math.floor(i / 25)], answer: 0
}));

for (const [counts, scores, average, passed] of [
  [[15, 7, 13], [75, 35, 65], 58.3, false],
  [[18, 7, 16], [90, 35, 80], 68.3, false],
  [[12, 12, 12], [60, 60, 60], 60, true],
  [[12, 12], [60, 60], 60, null]
]) {
  test("score " + counts.join("/"), () => {
    const questions = counts.flatMap((_, subject) => pool.filter(q => q.subject === subject).slice(0, 20));
    const answers = counts.flatMap(count => Array.from({ length: 20 }, (_, i) => i < count ? 0 : null));
    const result = core.score(questions, answers);
    assert.deepEqual(result.perSubject.map(row => row.score), scores);
    assert.equal(result.average, average);
    assert.equal(result.passed, passed);
  });
}
test("score rounds and counts blanks as wrong", () => {
  assert.equal(core.score(pool.slice(0, 3), [0, null]).average, 33.3);
});
test("wrong note tracks streak, counts, and last answer", () => {
  const record = core.emptyRecord();
  [false, true, true, false].forEach((correct, i) => {
    core.applyAnswer(record, "bank-1", i, correct, i);
    assert.equal(core.isInWrongNote(record.q["bank-1"]), i !== 2);
  });
  assert.deepEqual(record.q["bank-1"], { tries: 4, wrong: 2, streak: 0, star: false, lastChoice: 3, lastAt: 3 });
});
const options = { bankIds: ["bank"], subjects: [0, 1, 2], count: 60, filter: "all", order: "original" };
for (const [count, expected] of [[60, [20, 20, 20]], [20, [7, 7, 6]]]) {
  test("random selection apportions " + count, () => {
    let seed = 17;
    const questions = core.selectQuestions(pool, { ...options, count, order: "random" }, core.emptyRecord(),
      () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    assert.deepEqual(questions.map(q => q.subject), expected.flatMap((n, s) => Array(n).fill(s)));
    assert.equal(new Set(questions.map(q => q.id)).size, count);
  });
}
test("selection keeps original order and handles sparse wrong and unseen filters", () => {
  const record = core.emptyRecord();
  const subset = pool.slice(25, 28);
  subset.forEach(q => core.applyAnswer(record, q.id, 1, false, 1));
  assert.deepEqual(core.selectQuestions(pool, { ...options, filter: "wrong" }, record), subset);
  assert.deepEqual(core.selectQuestions(pool, { ...options, subjects: [1], count: 3, filter: "unseen" }, record), pool.slice(28, 31));
});
test("topic statistics sort by rate and flag small samples", () => {
  const record = core.emptyRecord();
  record.q["bank-1"] = { tries: 5, wrong: 1 };
  record.q["bank-26"] = { tries: 2, wrong: 2 };
  assert.deepEqual(core.topicStats(pool, record).map(row => [row.correctRate, row.lowSample]), [[0, true], [0.8, false]]);
});
test("bank validation rejects malformed questions and unverified AI", () => {
  const bank = { id: "ai-test", title: "Test", source: "ai", verified: true, questions: [{
    n: 1, subject: 0, topic: "hardware", text: "Question", choices: ["a", "b", "c", "d"], answer: 0, explanation: "Reason"
  }] };
  assert.deepEqual(core.validateBank(bank), []);
  assert.equal(core.buildPool([bank])[0].id, "ai-test-1");
  for (const patch of [{ choices: ["a", "b", "c"] }, { answer: 4 }, { topic: "unknown" }, { visual: "<script></script>" }, { visual: '<img src="x" onerror="alert(1)">' }]) {
    assert.ok(core.validateBank({ ...bank, questions: [{ ...bank.questions[0], ...patch }] }).length);
  }
  assert.ok(core.validateBank({ ...bank, verified: false }).length);
});
for (const mode of ["study", "exam"]) {
  test(mode + " answer overwrite", () => {
    const current = core.newSession(mode, pool.slice(0, 3), 1);
    assert.equal(core.answer(current, 0), true);
    assert.equal(core.answer(current, 1), mode === "exam");
  });
}
test("restore removes missing questions and their answers", () => {
  const current = core.newSession("study", pool.slice(0, 3), 1);
  current.answers = [0, 1, 2];
  current.idx = 2;
  assert.deepEqual(core.restoreCurrent(current, new Map([[pool[2].id, pool[2]]])),
    { ...current, ids: [pool[2].id], answers: [2], idx: 0 });
  assert.equal(core.restoreCurrent(current, new Map()), null);
});
for (const json of ["{", '{"version":2}']) {
  test("record falls back for " + json, () => {
    assert.deepEqual(core.loadRecord({ getItem: () => json }), core.emptyRecord());
  });
}
test("storage failure returns false", () => {
  assert.equal(core.saveRecord({ setItem() { throw Error("full"); } }, core.emptyRecord()), false);
});
test("session history retains 50 most recent", () => {
  const record = core.emptyRecord();
  for (let i = 0; i < 51; i++) core.addSession(record, i);
  assert.equal(record.sessions.length, 50);
  assert.equal(record.sessions[0], 50);
  assert.equal(record.sessions.at(-1), 1);
});

test("mixed practice limits AI to four per subject with standard questions available", () => {
  const mixed = ["ref", "kcci", "ai"].flatMap(source => pool.map(q => ({
    ...q, source, id: source + q.id, bankId: source
  })));
  const opts = { ...options, bankIds: ["ref", "kcci", "ai"], order: "random", aiLimit: 4 };
  const result = core.selectQuestions(mixed, opts, core.emptyRecord(), () => 0.37);
  for (const subject of [0, 1, 2]) {
    const questions = result.filter(q => q.subject === subject);
    assert.equal(questions.length, 20);
    assert.equal(questions.filter(q => q.source === "ai").length, 4);
  }
  assert.equal(new Set(result.map(q => q.id)).size, 60);
  assert.equal(core.selectQuestions(mixed, { ...opts, count: "all" }, core.emptyRecord()).length, 225);
});

test("mixed practice fills shortages without duplicates", () => {
  const mixed = [
    ...pool.map(q => ({ ...q, source: "ai" })),
    ...pool.slice(0, 3).map(q => ({ ...q, source: "ref", id: "ref-" + q.id }))
  ];
  const opts = { ...options, aiLimit: 4 };
  const result = core.selectQuestions(mixed, opts, core.emptyRecord());
  assert.equal(result.length, 60);
  assert.equal(result.filter(q => q.subject === 0 && q.source === "ref").length, 3);
  assert.equal(new Set(result.map(q => q.id)).size, 60);
  const standardOnly = pool.map(q => ({ ...q, source: "ref" }));
  assert.equal(core.selectQuestions(standardOnly, opts, core.emptyRecord()).length, 60);
});
