import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const id = process.argv[2];
if (!/^ai-(?:xl-)?\d{2}$/.test(id ?? "")) throw new Error("Usage: node tools/compare-answers.mjs <ai-id>");
const source = readFileSync("web/data/" + id + ".js", "utf8");
const sandbox = {};
runInNewContext("var banks = []; function addBank(bank) { banks.push(bank); }\n" + source, sandbox, {
  timeout: 1000, contextCodeGeneration: { strings: false, wasm: false }
});
const [bank] = sandbox.banks;
const rows = JSON.parse(readFileSync("tmp/" + id + ".verify.json", "utf8"));
const byNumber = new Map(rows.map(row => [row.n, row]));
if (sandbox.banks.length !== 1 || bank?.id !== id || bank.questions?.length !== 60 || rows.length !== 60 || byNumber.size !== 60) {
  throw new Error("Expected 60 authored and 60 independently reviewed questions");
}

const issues = [];
let mismatch = 0;
let low = 0;
for (const { n, answer } of bank.questions) {
  const review = byNumber.get(n);
  if (![0, 1, 2, 3].includes(review?.answer) || !["high", "low"].includes(review?.confidence) ||
      typeof review?.reason !== "string" || !review.reason.trim()) throw new Error("Invalid review for question " + n);
  const different = review.answer !== answer;
  const uncertain = review.confidence === "low";
  mismatch += Number(different);
  low += Number(uncertain);
  if (different || uncertain) issues.push({ n, authored: answer + 1, reviewed: review.answer + 1, ...review });
}
if (issues.length) console.table(issues, ["n", "authored", "reviewed", "confidence", "reason"]);
console.log("mismatch=" + mismatch + " low=" + low);
