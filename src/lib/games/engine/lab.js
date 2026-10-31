// Runs inside each generated lab. Students change the simulation directly, and
// missions are checked from what actually happens in it.
(function () {
  var spec = JSON.parse(document.getElementById("game-data").textContent);
  var lab = spec.lab;
  var canvas = document.getElementById("lab");
  var ctx = canvas.getContext("2d");
  var panel = document.getElementById("panel");
  var W = canvas.width;
  var H = canvas.height;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var missions = lab.missions.map(function (mission) {
    return { data: mission, done: false, held: 0 };
  });
  var finished = false;

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, onClick, className) {
    var node = make("button", className, text);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function slider(label, value, min, max, step, onInput) {
    var wrap = make("label", "control");
    var name = make("span", "", label + ": " + value);
    var input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.addEventListener("input", function () {
      var next = Number(input.value);
      name.textContent = label + ": " + next;
      onInput(next);
    });
    wrap.append(name, input);
    return wrap;
  }

  var missionList = make("ol", "missions");

  function renderMissions() {
    missionList.replaceChildren.apply(
      missionList,
      missions.map(function (mission) {
        return make(
          "li",
          mission.done ? "done" : "",
          (mission.done ? "Done: " : "") + mission.data.text,
        );
      }),
    );
  }

  function complete(mission) {
    if (mission.done) return;
    mission.done = true;
    renderMissions();
    if (!finished && missions.every(function (item) { return item.done; })) {
      finished = true;
      panel.append(make("p", "win end", spec.story.win));
      panel.querySelector(".end").dataset.result = "win";
      window.parent.postMessage({ type: "envision-finished", won: true }, "*");
    }
  }

  function header() {
    panel.append(make("h1", "", spec.title), make("p", "", spec.story.intro));
  }

  function footer() {
    panel.append(make("h2", "", "Missions"), missionList);
    if (lab.tips.length) {
      panel.append(make("h2", "", "Try this"));
      var tips = make("ul", "tips");
      lab.tips.forEach(function (tip) {
        tips.append(make("li", "", tip));
      });
      panel.append(tips);
    }
    renderMissions();
  }

  // ---- Bodies kit ----
  function runBodies() {
    var isGravity = lab.force === "gravity";
    var strength = 1;
    var bodies = [];
    var selectedType = lab.bodyTypes[1] || lab.bodyTypes[0];
    var selected = null;
    var press = null;
    var collided = false;
    var escaped = false;
    var resizedAt = null;
    var paused = false;
    var nextId = 1;
    var stars = [];
    for (var i = 0; i < 160; i++) {
      stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.6 + 0.3]);
    }

    function radius(mass) {
      return 5 + Math.cbrt(mass) * 2.6;
    }

    function heaviest() {
      return bodies.reduce(function (top, body) {
        return !top || body.mass > top.mass ? body : top;
      }, null);
    }

    function addBody(type, x, y, vx, vy) {
      var body = {
        id: nextId++,
        name: type.name,
        color: type.color,
        mass: type.mass,
        charge: type.charge,
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        trail: [],
        orbitTime: 0,
      };
      bodies.push(body);
      return body;
    }

    function orbitVelocity(x, y) {
      var center = heaviest();
      if (!center) return [0, 0];
      var dx = x - center.x;
      var dy = y - center.y;
      var distance = Math.max(Math.hypot(dx, dy), 1);
      var speed = Math.sqrt((strength * 40 * center.mass) / distance);
      return [center.vx + (-dy / distance) * speed, center.vy + (dx / distance) * speed];
    }

    function reset() {
      bodies = [];
      collided = false;
      var sorted = lab.bodyTypes.slice().sort(function (a, b) {
        return b.mass - a.mass;
      });
      if (isGravity) {
        addBody(sorted[0], W / 2, H / 2, 0, 0);
        var velocity = orbitVelocity(W / 2 + 190, H / 2);
        addBody(sorted[1], W / 2 + 190, H / 2, velocity[0], velocity[1]);
      } else {
        addBody(sorted[0], W / 2 - 130, H / 2, 0, 18);
        addBody(sorted[1], W / 2 + 130, H / 2, 0, -18);
      }
    }

    function step(dt) {
      bodies.forEach(function (body) {
        var ax = 0;
        var ay = 0;
        bodies.forEach(function (other) {
          if (other === body) return;
          var dx = other.x - body.x;
          var dy = other.y - body.y;
          var squared = dx * dx + dy * dy + 36;
          var distance = Math.sqrt(squared);
          var pull = isGravity
            ? (strength * 40 * other.mass) / squared
            : (-strength * 90000 * body.charge * other.charge) / (body.mass * squared);
          ax += (pull * dx) / distance;
          ay += (pull * dy) / distance;
        });
        body.vx += ax * dt;
        body.vy += ay * dt;
      });

      bodies.forEach(function (body) {
        body.x += body.vx * dt;
        body.y += body.vy * dt;
      });

      for (var a = 0; a < bodies.length; a++) {
        for (var b = a + 1; b < bodies.length; b++) {
          var first = bodies[a];
          var second = bodies[b];
          var repels = !isGravity && first.charge * second.charge > 0;
          if (
            !repels &&
            Math.hypot(first.x - second.x, first.y - second.y) <
              (radius(first.mass) + radius(second.mass)) * 0.8
          ) {
            var total = first.mass + second.mass;
            var big = first.mass >= second.mass ? first : second;
            var small = big === first ? second : first;
            big.vx = (first.vx * first.mass + second.vx * second.mass) / total;
            big.vy = (first.vy * first.mass + second.vy * second.mass) / total;
            big.mass = total;
            big.charge = first.charge + second.charge;
            bodies.splice(bodies.indexOf(small), 1);
            if (selected === small) selected = big;
            collided = true;
            b = bodies.length;
            a = bodies.length;
          }
        }
      }
    }

    function isOrbiting(body, center) {
      var distance = Math.hypot(body.x - center.x, body.y - center.y);
      var speed = Math.hypot(body.vx - center.vx, body.vy - center.vy);
      return (
        speed * speed < (2 * strength * 40 * center.mass) / Math.max(distance, 1) &&
        distance < Math.max(W, H)
      );
    }

    function checkMissions(dt) {
      var center = heaviest();
      var orbiting = 0;
      bodies = bodies.filter(function (body) {
        var inside =
          body.x > -500 && body.x < W + 500 && body.y > -500 && body.y < H + 500;
        if (!inside) escaped = true;
        return inside;
      });
      bodies.forEach(function (body) {
        if (body === center || !center) return;
        if (isOrbiting(body, center)) {
          body.orbitTime += dt;
          if (body.orbitTime >= 8) orbiting += 1;
        } else {
          body.orbitTime = 0;
        }
      });

      missions.forEach(function (mission) {
        var goal = mission.data.goal;
        if (
          (goal === "orbit" && orbiting >= 1) ||
          (goal === "two_orbits" && orbiting >= 2) ||
          (goal === "collide" && collided) ||
          (goal === "escape" && escaped) ||
          (goal === "resize_keep_orbit" &&
            resizedAt !== null &&
            orbiting >= 1 &&
            performance.now() - resizedAt > 5000)
        ) {
          complete(mission);
        }
      });
    }

    function draw() {
      ctx.fillStyle = "#070a1f";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      stars.forEach(function (star) {
        ctx.fillRect(star[0], star[1], star[2], star[2]);
      });

      bodies.forEach(function (body) {
        ctx.strokeStyle = body.color;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2;
        ctx.beginPath();
        body.trail.forEach(function (point, index) {
          if (index === 0) ctx.moveTo(point[0], point[1]);
          else ctx.lineTo(point[0], point[1]);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      bodies.forEach(function (body) {
        var size = radius(body.mass);
        var glow = ctx.createRadialGradient(body.x, body.y, size * 0.2, body.x, body.y, size * 2.6);
        glow.addColorStop(0, body.color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(body.x, body.y, size * 2.6, 0, Math.PI * 2);
        ctx.fill();
        var shade = ctx.createRadialGradient(body.x - size / 3, body.y - size / 3, 1, body.x, body.y, size);
        shade.addColorStop(0, "#ffffff");
        shade.addColorStop(0.3, body.color);
        shade.addColorStop(1, "#0b0b16");
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(body.x, body.y, size, 0, Math.PI * 2);
        ctx.fill();
        if (!isGravity) {
          ctx.fillStyle = "#fff";
          ctx.font = "bold 18px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(body.charge > 0 ? "+" : body.charge < 0 ? "−" : "", body.x, body.y + 6);
        }
        ctx.fillStyle = "#fff";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(body.name, body.x, body.y - size - 8);
        if (body === selected) {
          ctx.strokeStyle = "#ffd54f";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(body.x, body.y, size + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      if (press) {
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(press.x, press.y);
        ctx.lineTo(press.nowX, press.nowY);
        ctx.stroke();
      }
    }

    function point(event) {
      var box = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - box.left) / box.width) * W,
        y: ((event.clientY - box.top) / box.height) * H,
      };
    }

    canvas.addEventListener("pointerdown", function (event) {
      var spot = point(event);
      var hit = bodies.filter(function (body) {
        return Math.hypot(body.x - spot.x, body.y - spot.y) < radius(body.mass) + 8;
      })[0];
      if (hit) {
        selected = hit;
        renderSelection();
        return;
      }
      press = { x: spot.x, y: spot.y, nowX: spot.x, nowY: spot.y };
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!press) return;
      var spot = point(event);
      press.nowX = spot.x;
      press.nowY = spot.y;
    });

    canvas.addEventListener("pointerup", function () {
      if (!press) return;
      var dx = press.nowX - press.x;
      var dy = press.nowY - press.y;
      var velocity =
        Math.hypot(dx, dy) < 8
          ? isGravity
            ? orbitVelocity(press.x, press.y)
            : [0, 0]
          : [dx * 0.8, dy * 0.8];
      selected = addBody(selectedType, press.x, press.y, velocity[0], velocity[1]);
      press = null;
      renderSelection();
    });

    var selectionBox = make("div", "selection");

    function renderSelection() {
      if (!selected) {
        selectionBox.replaceChildren(make("p", "", "Click an object to change it."));
        return;
      }
      var body = selected;
      selectionBox.replaceChildren(
        slider("Size of " + body.name, Math.round(body.mass), 1, 1000, 1, function (next) {
          body.mass = next;
          resizedAt = performance.now();
        }),
        button("Remove " + body.name, function () {
          bodies.splice(bodies.indexOf(body), 1);
          selected = null;
          renderSelection();
        }),
      );
    }

    header();
    panel.append(make("h2", "", "Add to your " + (isGravity ? "system" : "field")));
    var palette = make("div", "palette");
    lab.bodyTypes.forEach(function (type) {
      var choice = button(type.name, function () {
        selectedType = type;
        Array.prototype.forEach.call(palette.children, function (item) {
          item.setAttribute("aria-pressed", String(item === choice));
        });
      });
      choice.setAttribute("aria-pressed", String(type === selectedType));
      palette.append(choice);
    });
    panel.append(
      palette,
      make("p", "hint", "Click empty space to add it. Drag to launch it in a direction."),
      selectionBox,
      slider(isGravity ? "Gravity strength" : "Force strength", 1, 0.2, 3, 0.1, function (next) {
        strength = next;
      }),
    );
    var controls = make("div", "palette");
    controls.append(
      button("Pause", function (event) {
        paused = !paused;
        event.currentTarget.textContent = paused ? "Play" : "Pause";
      }),
      button("Reset", function () {
        selected = null;
        renderSelection();
        reset();
      }),
    );
    panel.append(controls);
    footer();
    renderSelection();
    reset();

    var last = performance.now();
    function frame(now) {
      var elapsed = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!paused) {
        for (var substep = 0; substep < 6; substep++) step(elapsed / 6);
        bodies.forEach(function (body) {
          body.trail.push([body.x, body.y]);
          if (body.trail.length > (reducedMotion ? 60 : 220)) body.trail.shift();
        });
        checkMissions(elapsed);
      }
      draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    window.envisionLab = {
      bodies: function () {
        return bodies;
      },
    };
  }

  // ---- Systems kit ----
  // A small parser, because generated formulas must never run as code.
  function compile(text) {
    var tokens = text.match(/[a-z_]+|\d+\.?\d*|[+\-*/()]/g) || [];
    var position = 0;

    function primary(values) {
      var token = tokens[position++];
      if (token === "(") {
        var inner = expression(values);
        position++;
        return inner;
      }
      if (token === "-") return -primary(values);
      if (/^\d/.test(token)) return Number(token);
      return values[token] || 0;
    }

    function term(values) {
      var result = primary(values);
      while (tokens[position] === "*" || tokens[position] === "/") {
        var operator = tokens[position++];
        var next = primary(values);
        result = operator === "*" ? result * next : next ? result / next : 0;
      }
      return result;
    }

    function expression(values) {
      var result = term(values);
      while (tokens[position] === "+" || tokens[position] === "-") {
        var operator = tokens[position++];
        var next = term(values);
        result = operator === "+" ? result + next : result - next;
      }
      return result;
    }

    return function (values) {
      position = 0;
      var result = expression(values);
      return Number.isFinite(result) ? result : 0;
    };
  }

  function runSystems() {
    var COLORS = ["#ffd54f", "#7ad7ff", "#ff7ab8"];
    var values = {};
    var history = {};
    var paused = false;
    var rules = lab.rules.map(function (rule) {
      return { variable: rule.variable, change: compile(rule.change) };
    });

    function reset() {
      lab.variables.forEach(function (variable) {
        values[variable.id] = variable.start;
        history[variable.id] = [];
      });
      missions.forEach(function (mission) {
        mission.held = 0;
      });
    }

    header();
    panel.append(make("h2", "", "Change the system"));
    lab.controls.forEach(function (control) {
      values[control.id] = control.value;
      panel.append(
        slider(
          control.label,
          control.value,
          control.min,
          control.max,
          (control.max - control.min) / 100,
          function (next) {
            values[control.id] = next;
          },
        ),
      );
    });
    var buttons = make("div", "palette");
    buttons.append(
      button("Pause", function (event) {
        paused = !paused;
        event.currentTarget.textContent = paused ? "Play" : "Pause";
      }),
      button("Reset", reset),
    );
    panel.append(buttons);
    footer();
    reset();

    function tick(dt) {
      var changes = rules.map(function (rule) {
        return rule.change(values);
      });
      rules.forEach(function (rule, index) {
        var variable = lab.variables.filter(function (item) {
          return item.id === rule.variable;
        })[0];
        values[rule.variable] = Math.min(
          Math.max(values[rule.variable] + changes[index] * dt, 0),
          variable.max,
        );
      });
      lab.variables.forEach(function (variable) {
        var points = history[variable.id];
        points.push(values[variable.id]);
        if (points.length > 700) points.shift();
      });
      missions.forEach(function (mission) {
        var value = values[mission.data.variable];
        mission.held =
          value >= mission.data.atLeast && value <= mission.data.atMost
            ? mission.held + dt
            : 0;
        if (mission.held >= mission.data.holdSeconds) complete(mission);
      });
    }

    function draw() {
      ctx.fillStyle = "#0b1a24";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      for (var line = 1; line < 8; line++) {
        ctx.beginPath();
        ctx.moveTo(0, (line / 8) * (H - 90));
        ctx.lineTo(W, (line / 8) * (H - 90));
        ctx.stroke();
      }
      lab.variables.forEach(function (variable, index) {
        var points = history[variable.id];
        ctx.strokeStyle = COLORS[index];
        ctx.lineWidth = 3;
        ctx.beginPath();
        points.forEach(function (value, position) {
          var x = (position / 700) * W;
          var y = (H - 90) * (1 - value / variable.max);
          if (position === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.fillStyle = COLORS[index];
        ctx.font = "bold 15px system-ui";
        ctx.textAlign = "left";
        ctx.fillText(
          variable.label + ": " + Math.round(values[variable.id]),
          24 + (index * W) / 3,
          H - 34,
        );
      });
    }

    window.envisionLab = {
      values: function () {
        return values;
      },
    };

    var last = performance.now();
    function frame(now) {
      var elapsed = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!paused) tick(elapsed);
      draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (lab.kit === "bodies") runBodies();
  else runSystems();
})();
