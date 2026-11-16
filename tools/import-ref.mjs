import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import Core from "../web/core.js";

const input = "tools/src/ref-index.html";
const output = "web/data";
const html = readFileSync(input, "utf8");
const topics = JSON.parse(readFileSync("tools/src/ref-topics.json", "utf8"));
const start = html.indexOf("const subjects=");
const end = html.indexOf("const esc=", start);
if (start < 0 || end < 0) throw Error("Reference data markers not found");

const data = html.slice(start, end) + "\nJSON.stringify(questionSets);";
const sets = JSON.parse(runInNewContext(data, Object.create(null), {
  filename: input,
  timeout: 1000,
  contextCodeGeneration: { strings: false, wasm: false }
}));
if (Object.keys(sets).join(",") !== "1,2,3,4,5,6,7") throw Error("Expected reference sets 1–7");

const figures = new Map();
const classes = new Set();
const banks = Object.entries(sets).map(([round, questions]) => {
  const id = "ref-" + round.padStart(2, "0");
  const counts = [0, 1, 2].map(subject => questions.filter(q => q.s === subject).length);
  if (questions.length !== 60 || counts.some(count => count !== 20)) {
    throw Error(id + ": expected 20/20/20 questions");
  }

  const bank = {
    id, title: "참고 " + round + "회", source: "ref",
    questions: questions.map(({ s, text, choices, answer, explanation, visual }, i) => {
      const n = i + 1;
      const key = id + "-" + n;
      return {
        n, subject: s, topic: topics[key], text, choices, answer, explanation,
        ...(visual ? { visual: adaptVisual(visual, key) } : {})
      };
    })
  };
  const errors = Core.validateBank(bank);
  if (errors.length) throw Error(id + ": " + errors.join("\n"));
  console.log(id + " " + counts.join("/"));
  return bank;
});

mkdirSync(output + "/img", { recursive: true });
for (const [path, svg] of figures) writeFileSync(output + "/" + path, svg);
for (const bank of banks) {
  writeFileSync(output + "/" + bank.id + ".js", "addBank(" + JSON.stringify(bank, null, 2) + ");\n");
}
console.log("Visual classes: " + [...classes].sort().join(", "));

function adaptVisual(visual, key) {
  const alt = visual.match(/\saria-label="([^"]*)"/)?.[1] ?? "";
  return visual.replace(/<svg\b[\s\S]*?<\/svg>/g, svg => {
    const path = "img/" + key + ".svg";
    if (figures.has(path)) throw Error(key + ": multiple SVG figures");
    figures.set(path, standaloneSvg(svg, key));
    return '<img class="ref-chart-image" src="' + path + '" alt="' + alt + '">';
  }).replace(/<([a-z][a-z0-9]*)\b([^<>]*)>/gi, (_, tag, attrs) => {
    const oldClasses = attrs.match(/\sclass="([^"]*)"/)?.[1].split(/\s+/) ?? [];
    const style = attrs.match(/\sstyle="([^"]*)"/)?.[1] ?? "";
    const chartClasses = Array.from(style.matchAll(/(?:^|;)(height|bottom|margin-bottom):(\d{1,3})%(?=;|$)/g),
      ([, property, value]) => "ref-" + property + "-" + value);
    const names = [...oldClasses, ...chartClasses];
    if (names.some(name => !/^[a-z][a-z0-9-]*$/i.test(name))) throw Error(key + ": invalid visual class");
    names.forEach(name => classes.add(name));
    // The source highlights answer cues after grading. Keep those cues out of the question.
    const safeAttrs = attrs.replace(/\s(?:class|style|role|aria-label|aria-hidden|data-answer-cue|data-answer-row)="[^"]*"/g, "");
    return "<" + tag + (names.length ? ' class="' + names.join(" ") + '"' : "") + safeAttrs + ">";
  });
}

function standaloneSvg(svg, key) {
  const safeTags = /<\/?(?:svg|path|g|circle|text|rect)\b([^<>]*)>/g;
  const safeAttributes = /\s(?:viewBox|d|fill|stroke|stroke-width|cx|cy|r|stroke-dasharray|x|y|font-size|width|height)="[a-zA-Z0-9 ,#.+-]*"/g;
  const clean = svg.replace(/\s(?:style="width:100%;height:auto;background:#fff"|aria-hidden="true")/g, "");
  const remainder = clean.replace(safeTags, (tag, attrs) =>
    /^[\s/]*$/.test(attrs.replace(safeAttributes, "")) ? "" : tag);
  if (/[<&]/.test(remainder)) throw Error(key + ": unsupported SVG markup");
  return clean.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ') + "\n";
}
