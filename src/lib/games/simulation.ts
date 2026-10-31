import type { SystemsLab } from "./lab";

const SIMULATED_SECONDS = 30;
const STEP_SECONDS = 0.05;
const TOO_FAST_SECONDS = 4;
const SMALLEST_CHANGE = 0.02;

type Values = Record<string, number>;

// Matches the game's own formula reader, so the check tests what students get.
function compile(text: string) {
  const tokens = text.match(/[a-z_]+|\d+\.?\d*|[+\-*/()]/g) ?? [];
  let position = 0;

  function primary(values: Values): number {
    const token = tokens[position++];
    if (token === "(") {
      const inner = expression(values);
      position++;
      return inner;
    }
    if (token === "-") {
      return -primary(values);
    }
    return /^\d/.test(token ?? "") ? Number(token) : (values[token] ?? 0);
  }

  function term(values: Values) {
    let result = primary(values);
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const next = primary(values);
      result = operator === "*" ? result * next : next ? result / next : 0;
    }
    return result;
  }

  function expression(values: Values): number {
    let result = term(values);
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const next = term(values);
      result = operator === "+" ? result + next : result - next;
    }
    return result;
  }

  return (values: Values) => {
    position = 0;
    const result = expression(values);
    return Number.isFinite(result) ? result : 0;
  };
}

function simulate(lab: SystemsLab, overrides: Values = {}) {
  const values: Values = {};
  const firstLimit: Record<string, number | null> = {};
  const lowest: Values = {};
  const highest: Values = {};
  lab.controls.forEach((control) => {
    values[control.id] = overrides[control.id] ?? control.value;
  });
  lab.variables.forEach((variable) => {
    values[variable.id] = variable.start;
    firstLimit[variable.id] = null;
    lowest[variable.id] = variable.start;
    highest[variable.id] = variable.start;
  });

  const rules = lab.rules.map((rule) => ({
    variable: lab.variables.find((item) => item.id === rule.variable)!,
    change: compile(rule.change),
  }));

  for (let time = 0; time < SIMULATED_SECONDS; time += STEP_SECONDS) {
    const changes = rules.map((rule) => rule.change(values));
    rules.forEach(({ variable }, index) => {
      const next = values[variable.id] + changes[index] * STEP_SECONDS;
      values[variable.id] = Math.min(Math.max(next, 0), variable.max);
      lowest[variable.id] = Math.min(lowest[variable.id], values[variable.id]);
      highest[variable.id] = Math.max(highest[variable.id], values[variable.id]);
      if (
        firstLimit[variable.id] === null &&
        (values[variable.id] <= 0 || values[variable.id] >= variable.max)
      ) {
        firstLimit[variable.id] = time;
      }
    });
  }

  return { values, firstLimit, lowest, highest };
}

// Runs the model's formulas, because a formula can be valid and still be useless.
export function checkSystems(lab: SystemsLab) {
  const problems: string[] = [];
  const normal = simulate(lab);

  lab.variables.forEach((variable) => {
    const limit = normal.firstLimit[variable.id];
    const range = normal.highest[variable.id] - normal.lowest[variable.id];
    if (limit !== null && limit < TOO_FAST_SECONDS && variable.start > 0) {
      problems.push(
        `${variable.id} reaches its limit after only ${limit.toFixed(1)} seconds. Use smaller numbers in the rules, so it changes over about 30 seconds.`,
      );
    }
    if (range < variable.max * SMALLEST_CHANGE) {
      problems.push(
        `${variable.id} barely changes. Use larger numbers in its rule, or give it a rule.`,
      );
    }
  });

  lab.controls.forEach((control) => {
    const moved = control.value === control.max ? control.min : control.max;
    const changed = simulate(lab, { [control.id]: moved });
    const hasEffect = lab.variables.some(
      (variable) =>
        Math.abs(changed.values[variable.id] - normal.values[variable.id]) >
        variable.max * 0.01,
    );
    if (!hasEffect) {
      problems.push(
        `The ${control.id} slider has no effect. Use it in a rule so that moving it changes the graph.`,
      );
    }
    if (control.value < control.min || control.value > control.max) {
      problems.push(`${control.id} must start between its min and max.`);
    }
  });

  return problems;
}

const SPEEDS = [1, 0.5, 2, 0.25, 4, 0.1, 10, 0.05, 20, 0.02, 50, 0.01];
const RANGE_MARGIN = 1.25;
const RUNAWAY_FACTOR = 1000;

function atSpeed(lab: SystemsLab, speed: number): SystemsLab {
  return speed === 1
    ? lab
    : {
        ...lab,
        rules: lab.rules.map((rule) => ({
          ...rule,
          change: `(${rule.change}) * ${speed}`,
        })),
      };
}

// Fits each graph to what the simulation actually does.
function withFittedRange(lab: SystemsLab): SystemsLab {
  const unlimited = {
    ...lab,
    variables: lab.variables.map((item) => ({
      ...item,
      max: Math.max(item.max, item.start) * RUNAWAY_FACTOR,
    })),
  };
  const { highest } = simulate(unlimited);

  return {
    ...lab,
    variables: lab.variables.map((item) => {
      const needed = lab.missions
        .filter((mission) => mission.variable === item.id)
        .map((mission) => mission.atLeast);
      const top = Math.max(highest[item.id], item.start, ...needed);
      return { ...item, max: Math.ceil(top * RANGE_MARGIN) || item.max };
    }),
  };
}

// Small models get the relationships right more often than the exact numbers.
// Speeding every rule up or down together keeps those relationships intact.
export function tuneSystems(lab: SystemsLab) {
  for (const speed of SPEEDS) {
    const tuned = withFittedRange(atSpeed(lab, speed));
    if (checkSystems(tuned).length === 0) {
      return tuned;
    }
  }
  return lab;
}