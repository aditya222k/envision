/* global THREE */
// The stage for every 3D game. The model writes only what is in the world, and
// this handles the camera, light, controls, selection and resizing.
(function () {
  var stage = document.getElementById("stage");
  var panel = document.getElementById("panel");
  var body = document.getElementById("controls");
  var info = document.getElementById("info");
  var goals = document.getElementById("goals");

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  stage.append(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b1020");
  var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  scene.add(new THREE.HemisphereLight("#ffffff", "#334466", 1.4));
  var sun = new THREE.DirectionalLight("#ffffff", 2);
  sun.position.set(6, 10, 8);
  scene.add(sun);

  var orbit = { yaw: 0.6, pitch: 0.45, distance: 14, target: new THREE.Vector3() };
  var frameHandlers = [];
  var pickable = [];
  var objectCount = 0;
  var controlCount = 0;
  var missions = [];
  var finished = false;
  var clock = new THREE.Clock();
  var raycaster = new THREE.Raycaster();

  function placeCamera() {
    var flat = Math.cos(orbit.pitch) * orbit.distance;
    camera.position.set(
      orbit.target.x + Math.sin(orbit.yaw) * flat,
      orbit.target.y + Math.sin(orbit.pitch) * orbit.distance,
      orbit.target.z + Math.cos(orbit.yaw) * flat,
    );
    camera.lookAt(orbit.target);
  }

  function resize() {
    var box = stage.getBoundingClientRect();
    var width = Math.max(box.width, 200);
    var height = Math.max(box.height, 200);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  var drag = null;
  var canvas = renderer.domElement;
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", function (event) {
    drag = { x: event.clientX, y: event.clientY, moved: 0 };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!drag) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    orbit.yaw -= dx * 0.008;
    orbit.pitch = Math.min(Math.max(orbit.pitch + dy * 0.008, -1.4), 1.4);
    placeCamera();
  });

  canvas.addEventListener("pointerup", function (event) {
    var wasClick = drag && drag.moved < 6;
    drag = null;
    if (!wasClick) return;
    var box = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        -((event.clientY - box.top) / box.height) * 2 + 1,
      ),
      camera,
    );
    var hit = raycaster.intersectObjects(pickable, true)[0];
    if (!hit) return;
    var object = hit.object;
    while (object && !object.userData.onPick) object = object.parent;
    if (object) object.userData.onPick(object);
  });

  canvas.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      orbit.distance = Math.min(Math.max(orbit.distance * (1 + event.deltaY * 0.001), 2), 400);
      placeCamera();
    },
    { passive: false },
  );

  function make(tag, text) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderMissions() {
    goals.replaceChildren.apply(
      goals,
      missions.map(function (mission) {
        var item = make("li", (mission.done ? "Done: " : "") + mission.text);
        if (mission.done) item.className = "done";
        return item;
      }),
    );
  }

  var env = {
    THREE: THREE,
    scene: scene,
    camera: camera,
    add: function (object, options) {
      var settings = options || {};
      scene.add(object);
      objectCount += 1;
      if (settings.onPick) {
        object.userData.onPick = settings.onPick;
        pickable.push(object);
      }
      return object;
    },
    remove: function (object) {
      scene.remove(object);
      pickable = pickable.filter(function (item) {
        return item !== object;
      });
    },
    view: function (distance, target) {
      orbit.distance = distance;
      if (target) orbit.target.set(target.x || 0, target.y || 0, target.z || 0);
      placeCamera();
    },
    sky: function (color) {
      scene.background = new THREE.Color(color);
    },
    onFrame: function (handler) {
      frameHandlers.push(handler);
    },
    title: function (text) {
      document.getElementById("title").textContent = text;
    },
    say: function (text) {
      info.textContent = text;
    },
    slider: function (label, min, max, value, onChange) {
      var wrap = make("label");
      var name = make("span", label + ": " + value);
      var input = make("input");
      input.type = "range";
      input.min = min;
      input.max = max;
      input.step = (max - min) / 100;
      input.value = value;
      input.addEventListener("input", function () {
        var next = Number(input.value);
        name.textContent = label + ": " + Math.round(next * 100) / 100;
        onChange(next);
      });
      wrap.append(name, input);
      body.append(wrap);
      controlCount += 1;
    },
    button: function (label, onClick) {
      var node = make("button", label);
      node.type = "button";
      node.addEventListener("click", onClick);
      body.append(node);
      controlCount += 1;
    },
    mission: function (text) {
      var mission = { text: text, done: false };
      missions.push(mission);
      renderMissions();
      return function complete() {
        if (mission.done) return;
        mission.done = true;
        renderMissions();
        if (!finished && missions.every(function (item) { return item.done; })) {
          finished = true;
          info.textContent = "You finished every mission!";
          window.parent.postMessage({ type: "envision-finished", won: true }, "*");
        }
      };
    },
  };

  window.Envision3D = {
    start: function (build) {
      resize();
      placeCamera();
      build(env);
      renderer.setAnimationLoop(function () {
        var delta = Math.min(clock.getDelta(), 0.05);
        var time = clock.elapsedTime;
        frameHandlers.forEach(function (handler) {
          handler(delta, time);
        });
        renderer.render(scene, camera);
      });
    },
  };

  window.envision3d = {
    objects: function () {
      return objectCount;
    },
    controls: function () {
      return controlCount + pickable.length;
    },
  };

  void panel;
})();
