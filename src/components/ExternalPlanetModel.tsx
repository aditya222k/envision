"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const NASA_PLANETS = new Set([
  "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
]);

// NASA Saturn's rings extend 2.331 times the equatorial body radius.
export function modelReach(id: string, radius: number) {
  return id === "saturn" ? radius * 2.34 : radius;
}

function disposeModel(model: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    meshMaterials.forEach((material: THREE.Material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    // GLTFLoader owns these image bitmaps; release their CPU memory too.
    const source = texture.source.data;
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
    texture.dispose();
  });
}

// Each asset loads independently. The original planet remains visible while
// loading, or if an asset fails, so one download cannot blank the solar system.
export function ExternalPlanetModel({
  id,
  radius,
  fallback,
}: {
  id: string;
  radius: number;
  fallback: ReactNode;
}) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let disposed = false;
    let owned: THREE.Group | null = null;
    const controller = new AbortController();

    async function load() {
      const response = await fetch(`/solar-system/models/${id}.glb`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Model returned ${response.status}`);
      const gltf = await new GLTFLoader().parseAsync(
        await response.arrayBuffer(),
        "",
      );
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      owned = gltf.scene;
      owned.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material : [object.material];
        materials.forEach((material: THREE.Material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.metalness = 0;
            material.normalScale.setScalar(0.35);
            if (material.map) material.map.anisotropy = 4;
          }
        });
      });
      // Scale Saturn by the planet body, not by the surrounding rings. The
      // other sources contain only a single body. Box3 includes node transforms.
      let body: THREE.Object3D = owned;
      if (id === "saturn") {
        owned.traverse((object) => {
          // GLTFLoader strips punctuation from node names; userData retains
          // NASA's original name, while mesh names also identify the body.
          const name = String(object.userData.name ?? object.name);
          if (object instanceof THREE.Mesh && /^saturn/i.test(name)) body = object;
        });
      }
      const box = new THREE.Box3().setFromObject(body);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const diameter = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(diameter) || diameter <= 0) {
        throw new Error("Model has invalid dimensions");
      }
      owned.position.sub(center);
      const normalized = new THREE.Group();
      normalized.add(owned);
      normalized.scale.setScalar((radius * 2) / diameter);
      setModel(normalized);
      invalidate();
    }

    load().catch((error) => {
      if (!disposed) console.warn(`Using original visuals for ${id}.`, error);
    });
    return () => {
      disposed = true;
      controller.abort();
      if (owned) disposeModel(owned);
    };
  }, [id, radius, invalidate]);

  return model ? <primitive object={model} dispose={null} /> : fallback;
}
