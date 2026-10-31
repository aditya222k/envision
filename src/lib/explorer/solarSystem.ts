// Facts and scene settings for the Solar System explorer. The facts are
// reviewed static values (NASA planetary fact sheets), so no AI is involved.
// Scene sizes, distances and speeds are simplified so everything fits on screen.

export type PlanetSurface =
  | "rocky"
  | "clouds"
  | "earth"
  | "dusty"
  | "banded"
  | "smooth";

export type Planet = {
  id: string;
  name: string;
  order: number;
  description: string;
  distanceFromSun: string;
  orbitalPeriod: string;
  scene: {
    radius: number;
    orbitRadius: number;
    // Seconds for one orbit in the explorer, not real time.
    orbitSeconds: number;
    startAngle: number;
    surface: PlanetSurface;
    colors: string[];
    tilt: number;
    ring?: { inner: number; outer: number; color: string };
  };
};

export const PLANETS: Planet[] = [
  {
    id: "mercury",
    name: "Mercury",
    order: 1,
    description:
      "The smallest planet and the closest to the Sun. It has almost no air to hold in heat, so its days are scorching and its nights are freezing.",
    distanceFromSun: "About 58 million km",
    orbitalPeriod: "88 Earth days",
    scene: {
      radius: 0.45,
      orbitRadius: 7,
      orbitSeconds: 8,
      startAngle: 0.6,
      surface: "rocky",
      colors: ["#9c9a97", "#6f6c69", "#bdbab5"],
      tilt: 0,
    },
  },
  {
    id: "venus",
    name: "Venus",
    order: 2,
    description:
      "The hottest planet. Thick clouds of carbon dioxide trap the Sun's heat, so its surface is hot enough to melt lead.",
    distanceFromSun: "About 108 million km",
    orbitalPeriod: "225 Earth days",
    scene: {
      radius: 0.85,
      orbitRadius: 10,
      orbitSeconds: 13,
      startAngle: 2.3,
      surface: "clouds",
      colors: ["#e3c58b", "#c9a66b", "#f2dfb4"],
      tilt: 3,
    },
  },
  {
    id: "earth",
    name: "Earth",
    order: 3,
    description:
      "Our home, and the only planet known to have life. Liquid water covers about 71% of its surface.",
    distanceFromSun: "About 150 million km",
    orbitalPeriod: "365 days, or 1 year",
    scene: {
      radius: 0.9,
      orbitRadius: 13.5,
      orbitSeconds: 20,
      startAngle: 4.2,
      surface: "earth",
      colors: ["#2f6fd0", "#3f9b4b", "#f4f7f5"],
      tilt: 23,
    },
  },
  {
    id: "mars",
    name: "Mars",
    order: 4,
    description:
      "A cold, dusty desert world. Rust in its soil makes it look red, and it has Olympus Mons, the tallest volcano in the solar system.",
    distanceFromSun: "About 228 million km",
    orbitalPeriod: "687 Earth days, about 1.9 years",
    scene: {
      radius: 0.6,
      orbitRadius: 17,
      orbitSeconds: 28,
      startAngle: 5.6,
      surface: "dusty",
      colors: ["#c1502e", "#8e3a22", "#e07a4f"],
      tilt: 25,
    },
  },
  {
    id: "jupiter",
    name: "Jupiter",
    order: 5,
    description:
      "The largest planet, a gas giant about 11 times wider than Earth. Its Great Red Spot is a storm bigger than our whole planet.",
    distanceFromSun: "About 778 million km",
    orbitalPeriod: "About 12 Earth years",
    scene: {
      radius: 2.2,
      orbitRadius: 24,
      orbitSeconds: 55,
      startAngle: 1.2,
      surface: "banded",
      colors: ["#e8d2b0", "#b9875b", "#f3e6cf", "#9c6a44"],
      tilt: 3,
    },
  },
  {
    id: "saturn",
    name: "Saturn",
    order: 6,
    description:
      "A gas giant with bright rings made of billions of pieces of ice and rock. On average, it is less dense than water.",
    distanceFromSun: "About 1.4 billion km",
    orbitalPeriod: "About 29 Earth years",
    scene: {
      radius: 1.9,
      orbitRadius: 32,
      orbitSeconds: 80,
      startAngle: 3.4,
      surface: "banded",
      colors: ["#e8d7a8", "#c9ae74", "#f2e6c4", "#b8975e"],
      tilt: 27,
      ring: { inner: 2.4, outer: 3.8, color: "#d9c79a" },
    },
  },
  {
    id: "uranus",
    name: "Uranus",
    order: 7,
    description:
      "An ice giant that spins tipped on its side, so each pole gets about 42 years of sunlight followed by 42 years of darkness. Methane gas makes it blue-green.",
    distanceFromSun: "About 2.9 billion km",
    orbitalPeriod: "84 Earth years",
    scene: {
      radius: 1.3,
      orbitRadius: 39,
      orbitSeconds: 115,
      startAngle: 5.1,
      surface: "smooth",
      colors: ["#9fd8de", "#86c4cc"],
      tilt: 98,
    },
  },
  {
    id: "neptune",
    name: "Neptune",
    order: 8,
    description:
      "The farthest planet, a cold, dark ice giant. It has the fastest winds in the solar system, at more than 2,000 km per hour.",
    distanceFromSun: "About 4.5 billion km",
    orbitalPeriod: "165 Earth years",
    scene: {
      radius: 1.25,
      orbitRadius: 45,
      orbitSeconds: 150,
      startAngle: 2.8,
      surface: "smooth",
      colors: ["#3f63d8", "#2f4fb8"],
      tilt: 28,
    },
  },
];

export const SUN = {
  radius: 4,
  color: "#ffc94d",
  glow: "#ffb02e",
};

export const SCENE = {
  background: "#070d1f",
  fov: 45,
  // The camera looks down on the orbits from this angle above them.
  elevationDegrees: 30,
  distance: 82,
  // How far out the starting view must show, so Neptune's orbit fits.
  fitRadius: 48,
  minDistance: 12,
  maxDistance: 170,
  stars: 1200,
};

export function ordinal(order: number) {
  const suffix = ["th", "st", "nd", "rd"][order] ?? "th";
  return `${order}${suffix}`;
}

// Moves the starting camera back on narrow screens so every orbit fits.
export function cameraPositionFor(aspect: number): [number, number, number] {
  const halfHeight = Math.tan(((SCENE.fov / 2) * Math.PI) / 180);
  const fitDistance = SCENE.fitRadius / (halfHeight * Math.max(aspect, 0.1));
  const distance = Math.min(
    Math.max(SCENE.distance, fitDistance),
    SCENE.maxDistance - 10,
  );
  const elevation = (SCENE.elevationDegrees * Math.PI) / 180;
  return [0, distance * Math.sin(elevation), distance * Math.cos(elevation)];
}

export function planetPosition(
  orbitRadius: number,
  angle: number,
): [number, number, number] {
  return [Math.cos(angle) * orbitRadius, 0, -Math.sin(angle) * orbitRadius];
}
