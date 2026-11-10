import test from "node:test";
import assert from "node:assert/strict";
import { shuffleOptions, isCompound } from "../src/lib/exam/shuffle.ts";
import { normalizeExam, parseBank } from "../src/lib/exam/data.ts";

const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test("Compound options stay last and their numbers follow the new order", () => {
  const options = ["Как отчет", "Как обработка", "Варианты 1 и 2", "Верны все варианты"];
  const { options: shown, order } = shuffleOptions(options, seq(0));
  assert.deepEqual(order, [1, 0, 2, 3]);
  assert.deepEqual(shown, ["Как обработка", "Как отчет", "Варианты 1 и 2", "Верны все варианты"]);
  const three = ["А", "Б", "В", "Варианты 1 и 3", "Варианты 2 и 3"];
  for (let k = 0; k < 20; k++) {
    const r = shuffleOptions(three);
    const pos = (orig) => r.order.indexOf(orig) + 1;
    assert.equal(r.options[3], `Варианты ${[pos(0), pos(2)].sort().join(" и ")}`);
    assert.equal(r.options[4], `Варианты ${[pos(1), pos(2)].sort().join(" и ")}`);
  }
});
test("Questions with mixed or numeric options keep their order", () => {
  const mixed = ["Варианты 2 и 3", "А", "Б"];
  assert.deepEqual(shuffleOptions(mixed).order, [0, 1, 2]);
  const numbers = ["1", "2", "3", "4"];
  assert.deepEqual(shuffleOptions(numbers).order, [0, 1, 2, 3]);
  assert.equal(isCompound("Только в режиме 1С:Предприятие"), false);
  assert.equal(isCompound("Нет правильного ответа"), true);
});
test("Broken exam progress is cleaned up record by record", () => {
  const s = normalizeExam({
    cards: { "1.1": { due: 1, s: 1, d: 5, ed: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2 }, "x": { due: 1 }, "1.2": { due: "soon" } },
    log: [{ q: "1.1", t: 1, r: 3, ok: true, ms: 100, m: "r" }, { q: "1.1", t: 1, r: 9, ok: true, ms: 1, m: "r" }],
    settings: { newPerDay: 9999, retention: 2, examDate: "завтра" },
    notes: { "1.1": "подсказка", "1.2": "" },
  });
  assert.deepEqual(Object.keys(s.cards), ["1.1"]);
  assert.equal(s.log.length, 1);
  assert.equal(s.settings.newPerDay, 200);
  assert.equal(s.settings.retention, 0.99);
  assert.equal(s.settings.examDate, null);
  assert.deepEqual(s.notes, { "1.1": "подсказка" });
  assert.equal(normalizeExam(null), null);
});
test("Only a valid question bank is accepted", () => {
  const q = { id: "1.1", topic: 1, text: "?", options: ["a", "b"], answer: 1, images: [] };
  assert.equal(parseBank({ app: "re-1c-exam", version: 1, topics: [], questions: [q] }).questions.length, 1);
  for (const bad of [{}, { app: "re-1c", version: 1, topics: [], questions: [] }, { app: "re-1c-exam", version: 1, topics: [], questions: [{ ...q, answer: 5 }] },
    { app: "re-1c-exam", version: 1, topics: [], questions: [{ ...q, images: ["https://example.com/x.png"] }] }]) {
    assert.throws(() => parseBank(bad));
  }
});
