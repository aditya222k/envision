// Runs Decide and Arrange games beside the code-drawn world.
(function () {
  var spec = JSON.parse(document.getElementById("game-data").textContent);
  var lab = spec.lab;
  var root = document.getElementById("game");
  var world;

  try {
    world = window.createWorld("world", spec);
  } catch (error) {
    console.warn("World graphics are unavailable.", error);
    world = { send: function () {} };
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, className, onClick) {
    var node = make("button", className, text);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function shuffle(items) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var held = result[i];
      result[i] = result[j];
      result[j] = held;
    }
    return result;
  }

  // Follows the pointer for mouse, touch and pen. A small move starts the drag,
  // so a plain click still works.
  function dragWith(node, handlers) {
    node.addEventListener("pointerdown", function (down) {
      if (down.button !== 0 || (handlers.ignore && down.target.closest(handlers.ignore))) return;
      var active = false;

      function move(event) {
        var x = event.clientX - down.clientX;
        var y = event.clientY - down.clientY;
        if (!active) {
          if (Math.hypot(x, y) < 6) return;
          active = true;
          node.classList.add("dragging");
          if (handlers.start) handlers.start();
        }
        node.style.transform = "translate(" + x + "px, " + y + "px)";
        handlers.move(event, x, y);
      }

      function up(event) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        if (!active) return;
        node.classList.remove("dragging");
        node.style.transform = "";
        handlers.drop(event);
      }

      function cancel() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        node.classList.remove("dragging");
        node.style.transform = "";
        if (handlers.cancel) handlers.cancel();
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    });
  }

  function show() {
    root.replaceChildren.apply(root, arguments);
    window.scrollTo(0, 0);
  }

  function finish(title, text, onAgain) {
    world.send("finish", { won: true });
    var end = make("h1", "end", title);
    end.dataset.result = "win";
    show(end, make("p", "", text), button("Play again", "primary again", onAgain));
    window.parent.postMessage({ type: "envision-finished", won: true }, "*");
  }

  function intro(onStart) {
    var characters = make("div", "characters");
    characters.append(
      make("span", "", spec.player.emoji + " " + spec.player.name),
      make("span", "", spec.challenger.emoji + " " + spec.challenger.name),
    );
    show(
      make("h1", "", spec.title),
      make("p", "", spec.story.intro),
      characters,
      button("Start game", "primary start feedback", onStart),
    );
  }

  // ---- Decide ----
  function runDecide() {
    var scenes = {};
    var meters;
    var visited;

    lab.scenes.forEach(function (scene) {
      scenes[scene.id] = scene;
    });

    function meterBars() {
      var box = make("div", "stack");
      lab.meters.forEach(function (meter) {
        var row = make("div");
        row.append(make("div", "", meter.label + ": " + meters[meter.id]));
        var bar = make("div", "meter");
        var fill = make("span");
        fill.style.width = meters[meter.id] + "%";
        bar.append(fill);
        row.append(bar);
        box.append(row);
      });
      return box;
    }

    function showEnding() {
      var ending = lab.endings.filter(function (item) {
        return meters[item.meter] >= item.atLeast;
      })[0];
      finish("Your story ends", ending ? ending.text : lab.defaultEnding, start);
    }

    function showScene(id) {
      var scene = scenes[id];
      if (!scene) return showEnding();
      visited += 1;

      var choices = make("div", "stack");
      scene.choices.forEach(function (choice) {
        choices.append(
          button(choice.text, "choice", function () {
            meters[choice.meterId] = Math.min(
              Math.max(meters[choice.meterId] + choice.meterChange, 0),
              100,
            );
            world.send(choice.meterChange >= 0 ? "correct" : "wrong", {
              progress: Math.min(visited / lab.scenes.length, 1),
              label: choice.meterChange >= 0 ? "Good move" : "A setback",
            });
            show(
              meterBars(),
              make("p", "feedback", choice.consequence),
              button("Continue", "primary next", function () {
                showScene(choice.next);
              }),
            );
          }),
        );
      });
      show(meterBars(), make("h2", "", scene.text), choices);
    }

    function start() {
      meters = {};
      visited = 0;
      lab.meters.forEach(function (meter) {
        meters[meter.id] = meter.start;
      });
      world.send("reset");
      showScene(lab.scenes[0].id);
    }

    intro(start);
  }

  // ---- Arrange ----
  function runArrange() {
    var index = 0;

    function passed(activity) {
      world.send("correct", {
        progress: (index + 1) / lab.activities.length,
        label: "Nice work",
      });
      root.append(
        make("p", "feedback", activity.explanation),
        button(
          index + 1 < lab.activities.length ? "Next challenge" : "See results",
          "primary next",
          function () {
            index += 1;
            if (index < lab.activities.length) showActivity();
            else finish("You did it!", spec.story.win, start);
          },
        ),
      );
    }

    function orderActivity(activity) {
      var answer = activity.items.map(function (item) {
        return item.text;
      });
      var items = shuffle(answer);
      if (items.join() === answer.join()) items.reverse();
      var result = make("p", "feedback");
      var list = make("ol", "stack order-list");
      var dragged = null;

      function move(from, to) {
        var moved = items.splice(from, 1)[0];
        items.splice(to, 0, moved);
        draw();
      }

      function draw() {
        list.replaceChildren();
        items.forEach(function (text, position) {
          var row = make("li", "order-item");
          dragWith(row, {
            ignore: "button",
            start: function () {
              var rows = Array.prototype.slice.call(list.children);
              dragged = {
                rows: rows,
                height: row.offsetHeight + 10,
                tops: rows.map(function (item) {
                  var box = item.getBoundingClientRect();
                  return box.top + box.height / 2;
                }),
                to: position,
              };
            },
            move: function (event) {
              var to = dragged.tops.filter(function (middle) {
                return event.clientY > middle;
              }).length;
              to = Math.min(Math.max(to, 0), items.length - 1);
              dragged.to = to;
              dragged.rows.forEach(function (item, index) {
                if (index === position) return;
                var shift = 0;
                if (position < to && index > position && index <= to) shift = -dragged.height;
                if (position > to && index < position && index >= to) shift = dragged.height;
                item.style.transform = shift ? "translateY(" + shift + "px)" : "";
              });
            },
            drop: function () {
              move(position, dragged.to);
            },
            cancel: draw,
          });
          var earlier = button("Up", "small", function () {
            move(position, position - 1);
          });
          earlier.disabled = position === 0;
          earlier.setAttribute("aria-label", "Move " + text + " up");
          var later = button("Down", "small", function () {
            move(position, position + 1);
          });
          later.disabled = position === items.length - 1;
          later.setAttribute("aria-label", "Move " + text + " down");
          row.append(make("span", "order-text", text), earlier, later);
          list.append(row);
        });
      }

      draw();
      var check = button("Check my order", "primary check", function () {
        var right = items.filter(function (text, position) {
          return text === answer[position];
        }).length;
        if (right === answer.length) {
          check.disabled = true;
          result.textContent = "";
          passed(activity);
        } else {
          result.textContent = right + " of " + answer.length + " are in the right place. Keep going.";
          world.send("wrong", { label: "Not yet" });
        }
      });
      show(make("h2", "", activity.instruction), list, check, result);
    }

    function sortActivity(activity) {
      var placed = {};
      var selected = null;
      var suppressClick = false;
      var result = make("p", "feedback");
      var tray = make("div", "palette tray");
      var bins = make("div", "columns");

      function draw() {
        tray.replaceChildren();
        bins.replaceChildren();
        activity.items.forEach(function (item) {
          if (placed[item.text]) return;
          var token = button(item.text, "token", function () {
            if (suppressClick) {
              suppressClick = false;
              return;
            }
            selected = selected === item.text ? null : item.text;
            draw();
          });
          token.setAttribute("aria-pressed", String(selected === item.text));
          dragWith(token, {
            move: function (event) {
              Array.prototype.forEach.call(bins.children, function (bin) {
                var box = bin.getBoundingClientRect();
                bin.classList.toggle(
                  "drop-target",
                  event.clientX >= box.left &&
                    event.clientX <= box.right &&
                    event.clientY >= box.top &&
                    event.clientY <= box.bottom,
                );
              });
            },
            drop: function () {
              suppressClick = true;
              var bin = bins.querySelector(".drop-target");
              if (bin) {
                placed[item.text] = bin.dataset.group;
                selected = null;
              }
              draw();
            },
            cancel: draw,
          });
          tray.append(token);
        });
        activity.groups.forEach(function (group) {
          var bin = button("", "bin", function () {
            suppressClick = false;
            if (!selected) return;
            placed[selected] = group;
            selected = null;
            draw();
          });
          bin.dataset.group = group;
          bin.append(make("strong", "", group));
          activity.items.forEach(function (item) {
            if (placed[item.text] === group) {
              bin.append(make("span", "placed", item.text));
            }
          });
          bins.append(bin);
        });
      }

      draw();
      var check = button("Check my groups", "primary check", function () {
        var right = activity.items.filter(function (item) {
          return placed[item.text] === item.group;
        }).length;
        if (right === activity.items.length) {
          check.disabled = true;
          result.textContent = "";
          passed(activity);
        } else {
          activity.items.forEach(function (item) {
            if (placed[item.text] !== item.group) delete placed[item.text];
          });
          draw();
          result.textContent =
            right + " of " + activity.items.length + " are right. Try the others again.";
          world.send("wrong", { label: "Not yet" });
        }
      });
      show(make("h2", "", activity.instruction), tray, bins, check, result);
    }

    function showActivity() {
      var activity = lab.activities[index];
      if (activity.kind === "sort") sortActivity(activity);
      else orderActivity(activity);
    }

    function start() {
      index = 0;
      world.send("reset");
      showActivity();
    }

    intro(start);
  }

  if (lab.kit === "decide") runDecide();
  else runArrange();
})();
