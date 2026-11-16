const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

function validate(fixture) {
  return spawnSync(process.execPath, ["tools/validate.mjs", "tests/fixtures/" + fixture], { encoding: "utf8" });
}

test("validator reports valid bank counts", () => {
  const result = validate("good");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fixture-good.*20\/20\/20/);
});

test("validator identifies invalid bank and question", () => {
  const result = validate("bad");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixture-bad.*Question 1/);
});
