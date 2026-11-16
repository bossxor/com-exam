addBank({
  id: "fixture-good", title: "Example", source: "ref",
  questions: Array.from({ length: 60 }, (_, i) => ({
    n: i + 1, subject: Math.floor(i / 20),
    topic: ["hardware", "xl-func", "db-query"][Math.floor(i / 20)],
    text: "Question " + i, choices: ["a" + i, "b", "c", "d"], answer: 0, explanation: "Explanation"
  }))
});
