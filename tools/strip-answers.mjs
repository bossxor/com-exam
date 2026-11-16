import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const id = process.argv[2];
if (!/^ai-(?:xl-)?\d{2}$/.test(id ?? "")) throw new Error("Usage: node tools/strip-answers.mjs <ai-id>");
const source = readFileSync("web/data/" + id + ".js", "utf8");
const sandbox = {};
runInNewContext("var banks = []; function addBank(bank) { banks.push(bank); }\n" + source, sandbox, {
  timeout: 1000, contextCodeGeneration: { strings: false, wasm: false }
});
const [bank] = sandbox.banks;
if (sandbox.banks.length !== 1 || bank?.id !== id || bank.source !== "ai" || bank.questions?.length !== 60) {
  throw new Error("Expected one AI bank with 60 questions");
}
const blind = bank.questions.map(({ n, subject, text, choices, visual }) => ({ n, subject, text, choices, visual }));
mkdirSync("tmp", { recursive: true });
writeFileSync("tmp/" + id + ".blind.json", JSON.stringify(blind, null, 2) + "\n");
