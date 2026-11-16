// Usage: node tools/assemble-ai.mjs <ai-NN | ai-xl-NN>
// Reads tmp/<id>-subject-<0|1|2>.txt (ai-NN: 20 rows each; ai-xl-NN: only subject 1, 60 rows) and writes
// web/data/<id>.js with verified:false. Row: topic¦answerKey(1-4)¦text¦c1¦c2¦c3¦c4¦e1¦e2¦e3¦e4
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Core from "../web/core.js";

const id = process.argv[2];
const xl = /^ai-xl-\d{2}$/.test(id ?? "");
if (!xl && !/^ai-\d{2}$/.test(id ?? "")) throw Error("Usage: node tools/assemble-ai.mjs <ai-NN | ai-xl-NN>");
const plan = xl ? [[1, 60]] : [[0, 20], [1, 20], [2, 20]];
const questions = [];
for (const [subject, count] of plan) {
  const file = "tmp/" + id + "-subject-" + subject + ".txt";
  if (!existsSync(file)) throw Error("missing " + file);
  const rows = readFileSync(file, "utf8").trim().split(/\r?\n/);
  if (rows.length !== count) throw Error(file + ": expected " + count + " rows, got " + rows.length);
  for (const row of rows) {
    const [topic, key, text, ...parts] = row.split("¦");
    if (parts.length !== 8 || !/^[1-4]$/.test(key)) throw Error("bad row: " + row.slice(0, 60));
    questions.push({
      n: questions.length + 1, subject, topic, text, choices: parts.slice(0, 4), answer: Number(key) - 1,
      explanation: parts.slice(4).map((line, i) => "①②③④"[i] + " " + line).join("\n")
    });
  }
}
const num = id.slice(-2).replace(/^0/, "");
const bank = { id, title: xl ? "AI 스프레드시트 " + num + "회" : "AI 고난도 " + num + "회", source: "ai", verified: false, questions };
const errors = Core.validateBank({ ...bank, verified: true });
if (errors.length) throw Error(errors.join("\n"));
const answers = [0, 1, 2, 3].map(k => questions.filter(q => q.answer === k).length);
writeFileSync("web/data/" + id + ".js", "addBank(" + JSON.stringify(bank, null, 2) + ");\n");
console.log(id + ": " + questions.length + " questions, answer positions 1-4 = " + answers.join("/"));
