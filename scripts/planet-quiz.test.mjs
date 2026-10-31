import assert from "node:assert/strict";
import test from "node:test";
import { initialQuiz, PLANET_QUIZ, quizReducer, shuffledPlanetIds } from "../src/lib/explorer/planetQuiz.ts";

const ids = Object.keys(PLANET_QUIZ);

test("a complete perfect game scores 160 and covers every planet once", () => {
  const order = shuffledPlanetIds();
  assert.equal(new Set(order).size, 8);
  assert.deepEqual([...order].sort(), [...ids].sort());
  let state = initialQuiz(order);
  for (const id of order) {
    state = quizReducer(state, { type: "guess", value: `  PLANET ${id.toUpperCase()}  ` });
    assert.equal(state.phase, "reveal");
    state = quizReducer(state, { type: "continue" });
    for (const question of PLANET_QUIZ[id].questions) {
      state = quizReducer(state, { type: "answer", choice: question.answer });
      const score = state.score;
      state = quizReducer(state, { type: "answer", choice: question.answer });
      assert.equal(state.score, score, "double clicks cannot earn extra points");
      state = quizReducer(state, { type: "continue" });
    }
  }
  assert.equal(state.phase, "complete");
  assert.equal(state.score, 160);
  assert.equal(state.planetsGuessed, 8);
  assert.equal(state.answersCorrect, 16);
});

test("hints are capped, wrong guesses don't reveal, and early advancement is blocked", () => {
  let state = initialQuiz(ids);
  state = quizReducer(state, { type: "guess", value: "Pluto" });
  assert.equal(state.phase, "guess");
  assert.equal(state.score, 0);
  for (let i = 0; i < 10; i++) state = quizReducer(state, { type: "hint" });
  assert.equal(state.clues, 3);
  state = quizReducer(state, { type: "guess", value: ids[0] });
  assert.equal(state.score, 6);
  state = quizReducer(state, { type: "continue" });
  assert.deepEqual(quizReducer(state, { type: "continue" }), state);
  assert.deepEqual(quizReducer(state, { type: "answer", choice: -1 }), state);
});

test("revealing every planet and answering incorrectly still finishes with zero", () => {
  let state = initialQuiz(ids);
  for (const id of ids) {
    state = quizReducer(state, { type: "reveal" });
    assert.equal(state.identified, false);
    state = quizReducer(state, { type: "continue" });
    for (const question of PLANET_QUIZ[id].questions) {
      state = quizReducer(state, { type: "answer", choice: (question.answer + 1) % question.choices.length });
      state = quizReducer(state, { type: "continue" });
    }
  }
  assert.equal(state.phase, "complete");
  assert.equal(state.score, 0);
  assert.equal(state.planetsGuessed, 0);
  assert.equal(state.answersCorrect, 0);
  assert.equal(quizReducer(state, { type: "guess", value: "Earth" }), state);
  assert.deepEqual(quizReducer(state, { type: "restart", order: ids }), initialQuiz(ids));
});

test("all rounds have usable clues and distinct answer options", () => {
  for (const activity of Object.values(PLANET_QUIZ)) {
    assert.equal(activity.clues.length, 3);
    assert.equal(activity.questions.length, 2);
    for (const question of activity.questions) {
      assert.equal(new Set(question.choices).size, question.choices.length);
      assert.ok(question.choices[question.answer]);
      assert.ok(question.explanation.length > 0);
    }
  }
});
