"use client";

import dynamic from "next/dynamic";

// The explorer needs the browser's WebGL, so it loads only on the page.
const SolarSystemActivities = dynamic(() => import("./SolarSystemActivities"), {
  ssr: false,
  loading: () => (
    <div className="explorer-stage">
      <p role="status" className="explorer-status text-lg font-bold">
        Loading the solar system...
      </p>
    </div>
  ),
});

export function SolarSystemLoader() {
  return <SolarSystemActivities />;
}
