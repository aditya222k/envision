# Planet model credits

Educational visualizations adapted from NASA models. No NASA endorsement is implied.

| File | Source | Credit |
| --- | --- | --- |
| mercury.glb | https://science.nasa.gov/resource/mercury-3d-model/ | NASA VTAD |
| venus.glb | https://science.nasa.gov/resource/venus-3d-model/ | NASA VTAD |
| earth.glb | https://science.nasa.gov/learn/heat/resource/earth-3d-model/ | NASA/JPL-Caltech |
| mars.glb | https://science.nasa.gov/resource/planet-mars-3d-model/ | NASA/JPL-Caltech |
| jupiter.glb | https://science.nasa.gov/resource/jupiter-3d-model/ | NASA Visualization Technology Applications and Development (VTAD) |
| saturn.glb | https://science.nasa.gov/resource/saturn-3d-model/ | NASA VTAD |
| uranus.glb | https://science.nasa.gov/resource/uranus-3d-model/ | NASA VTAD |
| neptune.glb | https://science.nasa.gov/resource/neptune-3d-model/ | NASA VTAD |
| sun.glb | https://science.nasa.gov/learn/heat/resource/sun-3d-model/ | NASA VTAD |

Usage guidance: https://www.nasa.gov/nasa-brand-center/images-and-media/

The original geometry, UVs and materials are retained. Embedded textures are
resized to fit 1536 pixels; opaque color maps are JPEG-compressed. Normal maps
and transparent ring maps remain PNG. Geometry, UVs and source material maps
are retained; runtime adjusts metalness and normal strength for readability.
Models are centered and scaled at runtime to fit Envision's simplified solar
system. Saturn is scaled using its body rather than its ring bounds. The Sun
retains the source emissive surface. A switch restores the procedural visuals.
The complete nine-model set is 3,092,240 bytes (about 3.1 MB).

Original downloads:

- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/e/Earth_1_12756.glb
- https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24881_Mars_1_6792.glb
- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/j/Jupiter_1_142984.glb
- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/m/Mercury_1_4878.glb
- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/Venus_1_12103.glb
- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/s/Saturn_1_120536.glb
- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/u/Uranus_1_51118.glb
- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/n/Neptune_1_49528.glb
- https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/s/Sun_1_1391000.glb

Run `scripts/optimize-planet-models.py` with the downloaded source files to
reproduce the optimized assets. These files are served locally; the explorer
does not contact NASA or a third-party model viewer.
