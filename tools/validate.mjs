import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import Core from "../web/core.js";

const dir = process.argv[2] ?? "web/data";
const names = readdirSync(dir).filter(name => name.endsWith(".js")).sort();
const bankNames = names.filter(name => name !== "index.js");
const ids = new Set();
const texts = new Map();

function fail(label, message) {
  console.error(label + ": " + message);
  process.exitCode = 1;
}

function readScript(name, input, prefix = "") {
  try {
    const context = { ...input };
    runInNewContext(prefix + readFileSync(join(dir, name), "utf8"), context, {
      filename: name, timeout: 1000, contextCodeGeneration: { strings: false, wasm: false }
    });
    return context;
  } catch (error) {
    fail(name, error.message);
    return {};
  }
}

if (names.includes("index.js")) {
  const { window } = readScript("index.js", { window: {} });
  if (window && !Array.isArray(window.BANK_FILES)) fail("index.js", "expected BANK_FILES array");
  for (const name of window?.BANK_FILES ?? []) {
    if (!bankNames.includes(name)) console.warn("Missing listed bank: " + name);
  }
}

for (const name of bankNames) {
  const { banks } = readScript(name, {}, "var banks = []; function addBank(bank) { banks.push(bank); }\n");
  if (!banks) continue;
  if (banks.length !== 1) {
    fail(name, "expected one addBank call");
    continue;
  }
  const [bank] = banks;
  const label = bank?.id ?? name;
  for (const error of Core.validateBank(bank)) fail(label, error);
  if (ids.has(label)) fail(label, "duplicate bank id");
  ids.add(label);
  if (!Array.isArray(bank?.questions)) continue;
  const counts = [0, 0, 0];
  for (const q of bank.questions) {
    if (!q) continue;
    if ([0, 1, 2].includes(q.subject)) counts[q.subject]++;
    if (typeof q.text === "string") {
      const key = q.text.trim();
      const previous = texts.get(key);
      if (previous && previous !== label) console.warn(label + " Question " + q.n + ": same text in " + previous);
      texts.set(key, label);
    }
    if (q.image != null && q.image !== "") {
      const validPath = typeof q.image === "string" && /^img\/[\w.-]+$/i.test(q.image);
      if (!validPath || !statSync(join(dir, q.image), { throwIfNoEntry: false })?.isFile()) {
        fail(label, "Question " + q.n + ": missing or invalid image");
      }
    }
  }
  console.log(label + " " + counts.join("/"));
  if (bank.questions.length === 60 && counts.some(count => count !== 20)) {
    console.warn(label + ": expected 20 questions per subject");
  }
}
console.log("Banks: " + bankNames.length);
