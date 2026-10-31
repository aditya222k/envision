import * as THREE from "three";

// Read from the installed library, so the model sees what really exists instead
// of relying on what it remembers.
const REFERENCE_CLASSES = [
  "Object3D",
  "Mesh",
  "Group",
  "Vector3",
  "Color",
  "ArrowHelper",
  "BufferGeometry",
  "Line",
  "Points",
] as const;

const INTERNAL = new Set(["constructor", "toJSON", "isObject3D"]);

function methodsOf(target: object) {
  return Object.getOwnPropertyNames(target).filter(
    (name) =>
      !name.startsWith("_") &&
      !INTERNAL.has(name) &&
      !name.startsWith("is") &&
      typeof Object.getOwnPropertyDescriptor(target, name)?.value === "function",
  );
}

function classes() {
  return Object.entries(THREE).filter(
    ([, value]) =>
      typeof value === "function" && Boolean((value as { prototype?: object }).prototype),
  ) as [string, { prototype: object }][];
}

export function threeReference() {
  const lines = REFERENCE_CLASSES.map((name) => {
    const prototype = (THREE as unknown as Record<string, { prototype: object }>)[
      name
    ].prototype;
    return `${name}: ${methodsOf(prototype).join(", ")}`;
  });
  const geometries = classes()
    .map(([name]) => name)
    .filter((name) => name.endsWith("Geometry"))
    .join(", ");
  const materials = classes()
    .map(([name]) => name)
    .filter((name) => name.endsWith("Material"))
    .join(", ");

  return `Real Three.js names. Use only these, spelled exactly:
${lines.join("\n")}
Geometries: ${geometries}
Materials: ${materials}`;
}

function normalize(name: string) {
  return name.replace(/_/g, "").toLowerCase();
}

let knownNames: Map<string, string> | null = null;

function allNames() {
  if (!knownNames) {
    knownNames = new Map();
    for (const [, value] of classes()) {
      for (const name of methodsOf(value.prototype)) {
        knownNames.set(normalize(name), name);
      }
    }
  }
  return knownNames;
}

// Fixes wrong spellings such as set_length with no model call. It only changes
// a name that doesn't exist but matches a real one apart from case or underscores.
export function correctThreeNames(code: string) {
  const known = allNames();
  const realNames = new Set(known.values());
  const corrections: string[] = [];

  const corrected = code.replace(/\.([A-Za-z_][\w]*)\(/g, (match, name: string) => {
    const real = known.get(normalize(name));
    if (!real || real === name || realNames.has(name)) {
      return match;
    }
    corrections.push(`${name} to ${real}`);
    return `.${real}(`;
  });

  return { corrected, corrections };
}

// Gives a repair the real options for the name that failed.
export function explainMissingMethods(problems: string[]) {
  const known = [...allNames().values()];
  return problems.flatMap((problem) => {
    const name = problem.match(/\.(\w+) is not a function/)?.[1];
    if (!name) {
      return [];
    }
    const start = normalize(name).slice(0, 3);
    const similar = known.filter((item) => normalize(item).startsWith(start));
    return similar.length > 0
      ? [`${name} does not exist. Similar real names: ${similar.slice(0, 15).join(", ")}`]
      : [`${name} does not exist in Three.js. Use a different approach.`];
  });
}
