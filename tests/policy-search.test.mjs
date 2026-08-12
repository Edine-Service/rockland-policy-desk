import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { answerQuestion, searchPolicy } from "../public/retrieval.js";

const corpus = JSON.parse(await readFile(new URL("../public/policy.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../evals/manifest.json", import.meta.url), "utf8"));

test("the complete draft corpus is indexed", () => {
  assert.equal(corpus.document.status, "Draft");
  assert.equal(corpus.document.pages, 82);
  assert.equal(corpus.policies.length, 24);
  assert.equal(corpus.controls.length, 1202);
  assert.equal(corpus.policies[0].id, "ISMSP01");
  assert.equal(corpus.policies.at(-1).id, "ISMSP24");
});

test("personal USB questions find the Removable Media prohibition", () => {
  const result = answerQuestion("Can I use my personal USB drive?", corpus.controls);
  assert.equal(result.grounded, true);
  assert.equal(result.sources[0].policyId, "ISMSP05");
  assert.match(result.answer, /prohibited/i);
});

test("password questions find the 12-character minimum", () => {
  const result = answerQuestion("What is the minimum password length?", corpus.controls);
  assert.equal(result.sources[0].policyId, "ISMSP01");
  assert.match(result.answer, /12 characters/i);
});

test("explicit policy IDs keep retrieval inside that policy", () => {
  const results = searchPolicy("Under ISMSP23, how are backup restoration tests handled?", corpus.controls);
  assert.ok(results.length > 0);
  assert.ok(results.every((result) => result.policyId === "ISMSP23"));
});

test("unknown business topics fail closed", () => {
  const result = answerQuestion("What is my annual leave allowance?", corpus.controls);
  assert.equal(result.grounded, false);
  assert.equal(result.sources.length, 0);
});

test("the evaluation bank contains 500 unique questions per policy", () => {
  assert.equal(manifest.totalQuestions, 12000);
  assert.equal(manifest.questionsPerPolicy, 500);
  assert.equal(manifest.policies.length, 24);
  for (const policy of manifest.policies) {
    assert.equal(policy.questions, 500);
    assert.equal(policy.uniqueQuestions, 500);
  }
});

test("every control points to a valid policy page", () => {
  const ranges = new Map(corpus.policies.map((policy) => [policy.id, policy]));
  for (const control of corpus.controls) {
    const policy = ranges.get(control.policyId);
    assert.ok(policy, `Unknown policy for ${control.id}`);
    assert.ok(control.page >= policy.pageStart && control.page <= policy.pageEnd, `Invalid page for ${control.id}`);
    assert.ok(control.text.length >= 8, `Empty control ${control.id}`);
  }
});
