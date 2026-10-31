import * as THREE from "three";
import type { PlanetSurface } from "@/lib/explorer/solarSystem";

const WIDTH = 512;
const HEIGHT = 256;

// Seeded, so a planet looks the same on every visit.
export function seededRandom(text: string) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blobs(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  color: string,
  count: number,
  size: number,
) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = random() * WIDTH;
    const y = HEIGHT * 0.12 + random() * HEIGHT * 0.76;
    const radius = size * (0.4 + random());
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.6, radius, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bands(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  colors: string[],
) {
  let y = 0;
  while (y < HEIGHT) {
    const height = 6 + random() * 22;
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    ctx.fillRect(0, y, WIDTH, height);
    y += height;
  }
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(0, random() * HEIGHT, WIDTH, 1 + random() * 3);
  }
  ctx.globalAlpha = 1;
}

export function makePlanetTexture(
  id: string,
  surface: PlanetSurface,
  colors: string[],
) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const random = seededRandom(id);
  const [base, second = base, third = second] = colors;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (surface === "rocky") {
    blobs(ctx, random, second, 70, 7);
    blobs(ctx, random, third, 40, 4);
  } else if (surface === "dusty") {
    blobs(ctx, random, second, 28, 18);
    blobs(ctx, random, third, 30, 9);
    ctx.fillStyle = "#f3e9e2";
    ctx.fillRect(0, 0, WIDTH, 10);
    ctx.fillRect(0, HEIGHT - 10, WIDTH, 10);
  } else if (surface === "clouds") {
    ctx.globalAlpha = 0.5;
    bands(ctx, random, colors);
    ctx.globalAlpha = 1;
  } else if (surface === "earth") {
    blobs(ctx, random, second, 18, 26);
    ctx.globalAlpha = 0.7;
    blobs(ctx, random, third, 26, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = third;
    ctx.fillRect(0, 0, WIDTH, 14);
    ctx.fillRect(0, HEIGHT - 14, WIDTH, 14);
  } else if (surface === "banded") {
    bands(ctx, random, colors);
    if (id === "jupiter") {
      ctx.fillStyle = "#b5523b";
      ctx.beginPath();
      ctx.ellipse(WIDTH * 0.62, HEIGHT * 0.64, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.globalAlpha = 0.35;
    bands(ctx, random, colors);
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function makeGlowTexture(color: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.35, `${color}aa`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeRingTexture(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  const random = seededRandom("saturn-ring");
  for (let x = 0; x < 256; x++) {
    ctx.globalAlpha = 0.35 + random() * 0.6;
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, 1, 8);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
