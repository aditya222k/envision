/* global Phaser */
// Runs inside each generated game. Everything on screen is drawn by this code,
// so a game has no image files and needs no network access.
(function () {
  var W = 1280;
  var H = 720;
  var GROUND_Y = 590;
  var TILE_W = 1280;

  function seededRandom(text) {
    var seed = 2166136261;
    for (var i = 0; i < text.length; i++) {
      seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
    }
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function range(random, low, high) {
    return low + random() * (high - low);
  }

  function vertical(ctx, top, bottom, stops) {
    var gradient = ctx.createLinearGradient(0, top, 0, bottom);
    stops.forEach(function (stop, index) {
      gradient.addColorStop(index / (stops.length - 1), stop);
    });
    return gradient;
  }

  function glow(ctx, x, y, radius, color) {
    var gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // Draws an item twice when it crosses the edge so the layer scrolls seamlessly.
  function wrapped(x, width, draw) {
    draw(x);
    if (x + width > TILE_W) draw(x - TILE_W);
    if (x - width < 0) draw(x + TILE_W);
  }

  function shadedSphere(ctx, x, y, radius, light, dark) {
    var gradient = ctx.createRadialGradient(
      x - radius * 0.4,
      y - radius * 0.4,
      radius * 0.1,
      x,
      y,
      radius,
    );
    gradient.addColorStop(0, light);
    gradient.addColorStop(1, dark);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintTree(ctx, random, x, base, height, trunk, leaves) {
    ctx.fillStyle = trunk;
    ctx.beginPath();
    ctx.moveTo(x - height * 0.05, base);
    ctx.quadraticCurveTo(x, base - height * 0.5, x - height * 0.02, base - height * 0.8);
    ctx.lineTo(x + height * 0.03, base - height * 0.8);
    ctx.quadraticCurveTo(x + height * 0.04, base - height * 0.5, x + height * 0.07, base);
    ctx.fill();

    for (var i = 0; i < 9; i++) {
      var size = height * range(random, 0.14, 0.26);
      shadedSphere(
        ctx,
        x + height * range(random, -0.26, 0.26),
        base - height * range(random, 0.68, 1),
        size,
        leaves[0],
        leaves[1],
      );
    }
  }

  var THEMES = {
    jungle: {
      sky: ["#0f4d3f", "#2f8f5b", "#c7e27a"],
      ambient: { tint: [0xf4ffb0, 0xffffff], rise: -18, alpha: 0.7, count: 90 },
      ground: ["#3f7a2e", "#23491c", "#14301a"],
      paintSky: function (ctx) {
        glow(ctx, 840, 170, 420, "rgba(255,250,190,0.75)");
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < 6; i++) {
          ctx.fillStyle = "rgba(255,255,200,0.05)";
          ctx.beginPath();
          ctx.moveTo(760 + i * 60, 0);
          ctx.lineTo(880 + i * 60, 0);
          ctx.lineTo(420 + i * 150, H);
          ctx.lineTo(180 + i * 150, H);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      },
      paintLayer: function (ctx, random, depth) {
        var trunk = ["#2c6a57", "#1d4a35", "#10301f"][depth];
        var leaves = [
          ["#5aa877", "#2f7a5b"],
          ["#4f9a4a", "#1f5a33"],
          ["#3a8a34", "#123d1f"],
        ][depth];
        var count = [12, 8, 5][depth];
        var height = [300, 420, 560][depth];
        for (var i = 0; i < count; i++) {
          var x = ((i + random() * 0.8) / count) * TILE_W;
          var tall = height * range(random, 0.8, 1.15);
          wrapped(x, tall * 0.4, function (px) {
            paintTree(ctx, seededRandom("tree" + i + depth), px, GROUND_Y + 12, tall, trunk, leaves);
          });
        }
      },
    },
    space: {
      sky: ["#05061f", "#141346", "#3b1f6e"],
      ambient: { tint: [0xbfd4ff, 0xffffff], rise: 0, alpha: 0.9, count: 70 },
      ground: ["#8a86a8", "#54507a", "#2a2750"],
      paintSky: function (ctx, random) {
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, 300, 200, 480, "rgba(120,60,220,0.4)");
        glow(ctx, 960, 340, 520, "rgba(30,130,230,0.34)");
        glow(ctx, 640, 90, 360, "rgba(230,70,170,0.2)");
        for (var i = 0; i < 520; i++) {
          ctx.fillStyle = "rgba(255,255,255," + range(random, 0.2, 1) + ")";
          var size = random() < 0.08 ? 2.4 : 1.2;
          ctx.fillRect(random() * W, random() * H * 0.86, size, size);
        }
        ctx.globalCompositeOperation = "source-over";
        var x = range(random, 880, 1060);
        shadedSphere(ctx, x, 190, 112, "#ffc48a", "#6a2a6e");
        ctx.strokeStyle = "rgba(255,225,190,0.6)";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.ellipse(x, 190, 182, 42, -0.3, 0, Math.PI * 2);
        ctx.stroke();
      },
      paintLayer: function (ctx, random, depth) {
        var count = [12, 7, 4][depth];
        var size = [16, 30, 52][depth];
        var colors = [
          ["#6a6a9a", "#2a2a55"],
          ["#7f7aa8", "#2a2650"],
          ["#9a95bd", "#2e2a55"],
        ][depth];
        for (var i = 0; i < count; i++) {
          var radius = size * range(random, 0.7, 1.4);
          var x = random() * TILE_W;
          var y = range(random, 90, GROUND_Y - 110);
          wrapped(x, radius, function (px) {
            shadedSphere(ctx, px, y, radius, colors[0], colors[1]);
          });
        }
      },
    },
    ocean: {
      sky: ["#2fb8d8", "#0d7196", "#062f55"],
      ambient: { tint: [0xd8f8ff, 0xffffff], rise: -46, alpha: 0.55, count: 80 },
      ground: ["#e0c98c", "#a8884e", "#6a5532"],
      paintSky: function (ctx) {
        glow(ctx, 560, -60, 620, "rgba(230,255,255,0.72)");
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < 9; i++) {
          ctx.fillStyle = "rgba(210,250,255,0.05)";
          ctx.beginPath();
          ctx.moveTo(440 + i * 34, 0);
          ctx.lineTo(490 + i * 34, 0);
          ctx.lineTo(120 + i * 150, H);
          ctx.lineTo(10 + i * 150, H);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      },
      paintLayer: function (ctx, random, depth) {
        var rock = ["#2a7c97", "#1c5a78", "#123f5a"][depth];
        var weed = ["#3fa893", "#2c9a6e", "#2a8c4a"][depth];
        var count = [9, 7, 6][depth];
        for (var i = 0; i < count; i++) {
          var x = ((i + random() * 0.7) / count) * TILE_W;
          var width = range(random, 90, 200) + depth * 40;
          var height = range(random, 60, 150) + depth * 50;
          wrapped(x, width + 60, function (px) {
            ctx.fillStyle = rock;
            ctx.beginPath();
            ctx.ellipse(px, GROUND_Y + 12, width, height, 0, Math.PI, 0);
            ctx.fill();
          });
          for (var blade = 0; blade < 5; blade++) {
            var bladeX = x + range(random, -width * 0.7, width * 0.7);
            var bladeHeight = range(random, 90, 200) + depth * 40;
            var sway = range(random, -46, 46);
            wrapped(bladeX, 60, function (px) {
              ctx.strokeStyle = weed;
              ctx.lineWidth = 8 + depth * 3;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(px, GROUND_Y + 8);
              ctx.bezierCurveTo(px + sway, GROUND_Y - bladeHeight * 0.4, px - sway, GROUND_Y - bladeHeight * 0.7, px + sway * 0.6, GROUND_Y - bladeHeight);
              ctx.stroke();
            });
          }
        }
      },
    },
    city: {
      sky: ["#1b1c4d", "#7a3b8f", "#ff9a62"],
      ambient: { tint: [0xffe9b0, 0xffffff], rise: -6, alpha: 0.4, count: 40 },
      ground: ["#51535e", "#30323b", "#1a1b21"],
      paintSky: function (ctx) {
        glow(ctx, 640, 560, 620, "rgba(255,210,130,0.75)");
        shadedSphere(ctx, 640, 500, 112, "#fff0c0", "#ffa860");
      },
      paintLayer: function (ctx, random, depth) {
        var wall = ["#6a4a8c", "#3b3268", "#1d1c3f"][depth];
        var windowColor = ["#e6b1d0", "#ffd98a", "#ffe9a8"][depth];
        var x = 0;
        while (x < TILE_W) {
          var width = range(random, 76, 150) + depth * 28;
          width = Math.min(width, TILE_W - x);
          var height = range(random, 150, 330) + (2 - depth) * 86 - depth * 26;
          var top = GROUND_Y + 12 - height;
          ctx.fillStyle = vertical(ctx, top, GROUND_Y, [wall, "#0f1028"]);
          ctx.fillRect(x, top, width, height);
          for (var row = top + 16; row < GROUND_Y - 16; row += 26) {
            for (var column = x + 10; column < x + width - 14; column += 22) {
              if (random() < 0.42) {
                ctx.fillStyle = windowColor;
                ctx.globalAlpha = range(random, 0.5, 1);
                ctx.fillRect(column, row, 11, 15);
                ctx.globalAlpha = 1;
              }
            }
          }
          x += width + range(random, 0, 16);
        }
      },
    },
    castle: {
      sky: ["#1b1138", "#54256e", "#e0704f"],
      ambient: { tint: [0xffb56a, 0xffe8b0], rise: -30, alpha: 0.75, count: 70 },
      ground: ["#6e6a7c", "#403c52", "#231f33"],
      paintSky: function (ctx, random) {
        glow(ctx, 980, 170, 340, "rgba(255,235,190,0.6)");
        shadedSphere(ctx, 980, 170, 84, "#fff6da", "#e8c992");
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        for (var i = 0; i < 140; i++) {
          ctx.fillRect(random() * W, random() * 300, 1.6, 1.6);
        }
      },
      paintLayer: function (ctx, random, depth) {
        var stone = ["#59407c", "#3b2c5e", "#221a3f"][depth];
        if (depth === 0) {
          ctx.fillStyle = stone;
          ctx.beginPath();
          ctx.moveTo(0, GROUND_Y);
          var peaks = 7;
          for (var p = 0; p <= peaks; p++) {
            var peakHeight = p === 0 || p === peaks ? 240 : range(random, 170, 340);
            ctx.lineTo((p / peaks) * TILE_W, GROUND_Y - peakHeight);
            if (p < peaks) {
              ctx.lineTo(((p + 0.5) / peaks) * TILE_W, GROUND_Y - range(random, 60, 140));
            }
          }
          ctx.lineTo(TILE_W, GROUND_Y);
          ctx.fill();
          return;
        }
        var count = depth === 1 ? 4 : 3;
        for (var i = 0; i < count; i++) {
          var x = ((i + random() * 0.6) / count) * TILE_W;
          var towerWidth = range(random, 84, 132) + depth * 26;
          var towerHeight = range(random, 240, 380);
          var top = GROUND_Y + 12 - towerHeight;
          wrapped(x, towerWidth * 2, function (px) {
            ctx.fillStyle = vertical(ctx, top, GROUND_Y, [stone, "#120d22"]);
            ctx.fillRect(px, top, towerWidth, towerHeight);
            for (var c = 0; c < 4; c += 2) {
              ctx.fillRect(px + (towerWidth / 4) * c, top - 20, towerWidth / 4, 22);
            }
            ctx.fillStyle = "#ffcf74";
            ctx.fillRect(px + towerWidth / 2 - 8, top + 62, 16, 32);
            ctx.fillStyle = stone;
            ctx.fillRect(px + towerWidth, GROUND_Y - towerHeight * 0.34, TILE_W / count - towerWidth - 40, towerHeight * 0.34 + 12);
          });
        }
      },
    },
    lab: {
      sky: ["#0a2f3a", "#10575f", "#1a8a88"],
      ambient: { tint: [0x8afff0, 0xd0fff8], rise: -14, alpha: 0.6, count: 60 },
      ground: ["#c8dcdc", "#7da2a4", "#3f6266"],
      paintSky: function (ctx) {
        ctx.strokeStyle = "rgba(190,255,250,0.08)";
        ctx.lineWidth = 2;
        for (var x = 0; x < W; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
        for (var y = 0; y < H; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        glow(ctx, 640, 60, 560, "rgba(190,255,250,0.5)");
      },
      paintLayer: function (ctx, random, depth) {
        var colors = ["#ff5fa0", "#65f2c4", "#ffd34f", "#6db4ff"];
        if (depth === 0) {
          ctx.strokeStyle = "#1c6b70";
          ctx.lineWidth = 22;
          for (var pipe = 0; pipe < 3; pipe++) {
            var pipeY = 110 + pipe * 92;
            ctx.beginPath();
            ctx.moveTo(0, pipeY);
            ctx.lineTo(TILE_W, pipeY);
            ctx.stroke();
          }
          return;
        }
        if (depth === 1) {
          for (var i = 0; i < 5; i++) {
            var screenX = ((i + 0.2) / 5) * TILE_W;
            ctx.fillStyle = "#0b3d44";
            ctx.fillRect(screenX, 240, 170, 110);
            ctx.strokeStyle = colors[i % 4];
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (var step = 0; step <= 15; step++) {
              ctx.lineTo(screenX + 8 + step * 10.4, 295 + Math.sin(step + i) * range(random, 8, 32));
            }
            ctx.stroke();
          }
          return;
        }
        ctx.fillStyle = "#0e4a50";
        ctx.fillRect(0, GROUND_Y - 88, TILE_W, 100);
        for (var flask = 0; flask < 9; flask++) {
          var x = ((flask + 0.3) / 9) * TILE_W;
          var color = colors[flask % 4];
          glow(ctx, x, GROUND_Y - 130, 72, "rgba(190,255,250,0.28)");
          ctx.fillStyle = "rgba(220,255,255,0.32)";
          ctx.fillRect(x - 8, GROUND_Y - 180, 16, 44);
          shadedSphere(ctx, x, GROUND_Y - 118, 32, "#ffffff", color);
        }
      },
    },
  };

  function paintGround(ctx, theme, random) {
    ctx.fillStyle = vertical(ctx, 0, H - GROUND_Y, theme.ground);
    ctx.fillRect(0, 0, TILE_W, H - GROUND_Y);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(0, 0, TILE_W, 5);
    for (var i = 0; i < 80; i++) {
      ctx.fillStyle = "rgba(0,0,0," + range(random, 0.05, 0.2) + ")";
      ctx.beginPath();
      ctx.ellipse(random() * TILE_W, range(random, 18, H - GROUND_Y), range(random, 10, 54), range(random, 2, 7), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function makeWorld(parent, spec) {
    var theme = THEMES[spec.theme];
    var random = seededRandom(spec.title + spec.player.name);
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scene = null;
    var pending = [];
    var layers = [];
    var ground, player, challenger, playerShadow, challengerShadow, sparks;
    var scrollSpeed = 0;
    var idleSpeed = spec.mechanic === "beat-the-clock" ? 3.2 : 0.3;
    var playerHome = spec.mechanic === "boss-battle" ? 270 : spec.mechanic === "beat-the-clock" ? 820 : 270;
    var challengerHome = spec.mechanic === "beat-the-clock" ? 120 : 1040;
    var challengerSize = spec.mechanic === "boss-battle" ? 210 : 130;

    function canvasTexture(key, width, height, paint) {
      var texture = scene.textures.createCanvas(key, width, height);
      paint(texture.getContext());
      texture.refresh();
    }

    function shout(text, color) {
      var label = scene.add
        .text(W / 2, 180, text, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "76px",
          fontStyle: "900",
          color: color,
          stroke: "#10121f",
          strokeThickness: 12,
        })
        .setOrigin(0.5)
        .setDepth(30);
      scene.tweens.add({
        targets: label,
        scale: { from: 0.7, to: 1 },
        duration: 220,
        ease: "Back.easeOut",
      });
      scene.tweens.add({
        targets: label,
        y: 130,
        alpha: 0,
        delay: 900,
        duration: 350,
        ease: "Cubic.easeIn",
        onComplete: function () {
          label.destroy();
        },
      });
    }

    function burst(x, y, tint, count) {
      sparks.setParticleTint(tint);
      sparks.explode(count, x, y);
    }

    function shake(duration, strength) {
      if (!reducedMotion) scene.cameras.main.shake(duration, strength);
    }

    function hop(target, baseY, height) {
      scene.tweens.add({
        targets: target,
        y: baseY - height,
        duration: 180,
        yoyo: true,
        repeat: 1,
        ease: "Sine.easeOut",
      });
    }

    function run(duration) {
      if (reducedMotion) return;
      scrollSpeed = 11;
      scene.tweens.add({
        targets: { value: 0 },
        value: 1,
        duration: duration,
        onComplete: function () {
          scrollSpeed = 0;
        },
      });
      hop(player, GROUND_Y - 52, 26);
    }

    var setbackLabel = "Not quite";

    function hurtPlayer() {
      player.setTint(0xff5a5a);
      scene.time.delayedCall(420, function () {
        player.clearTint();
      });
      burst(player.x, player.y, 0xff6a4f, 26);
      scene.cameras.main.flash(180, 160, 20, 20);
      shake(260, 0.012);
      shout(setbackLabel, "#ffb4a8");
    }

    function fireAtChallenger() {
      var bolt = scene.add
        .image(player.x + 60, player.y - 20, "spark")
        .setScale(1.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffe58a)
        .setDepth(20);
      scene.tweens.add({
        targets: bolt,
        x: challenger.x,
        y: challenger.y,
        duration: 340,
        ease: "Quad.easeIn",
        onComplete: function () {
          bolt.destroy();
          burst(challenger.x, challenger.y, 0xffd54f, 46);
          challenger.setTint(0xffffff);
          shake(220, 0.01);
          scene.tweens.add({
            targets: challenger,
            x: challengerHome + 46,
            duration: 110,
            yoyo: true,
          });
          scene.time.delayedCall(240, function () {
            challenger.clearTint();
          });
        },
      });
    }

    function lungeAtPlayer() {
      scene.tweens.add({
        targets: challenger,
        x: player.x + 150,
        duration: 220,
        yoyo: true,
        ease: "Back.easeIn",
        onYoyo: hurtPlayer,
      });
    }

    function handlers() {
      return {
        correct: function (detail) {
          shout(detail.label || "Correct!", "#b8ffb0");
          burst(player.x, player.y - 30, 0x8affa0, 30);
          if (spec.mechanic === "boss-battle") {
            fireAtChallenger();
          } else {
            run(900);
          }
          if (spec.mechanic === "journey") {
            scene.tweens.add({
              targets: challenger,
              x: challengerHome + (1 - detail.progress) * 280 - 90,
              duration: 900,
              ease: "Sine.easeOut",
            });
          }
        },
        wrong: function (detail) {
          setbackLabel = detail.label || "Not quite";
          if (spec.mechanic === "boss-battle") {
            lungeAtPlayer();
          } else {
            hurtPlayer();
          }
        },
        time: function (detail) {
          var distance = (1 - detail.remaining) * (playerHome - 170 - 120);
          challenger.x = challengerHome + distance;
        },
        finish: function (detail) {
          scrollSpeed = 0;
          idleSpeed = 0;
          if (detail.won) {
            hop(player, GROUND_Y - 52, 80);
            shout("You did it!", "#ffe58a");
            [0xffd54f, 0x7ad7ff, 0xff7ab8, 0x9affa0].forEach(function (tint, index) {
              scene.time.delayedCall(index * 170, function () {
                burst(range(random, 200, 1080), range(random, 120, 340), tint, 60);
              });
            });
            if (spec.mechanic === "boss-battle") {
              scene.tweens.add({
                targets: challenger,
                angle: 90,
                alpha: 0,
                y: GROUND_Y,
                duration: 700,
                ease: "Quad.easeIn",
              });
              challengerShadow.setVisible(false);
            }
          } else {
            shake(420, 0.016);
            scene.tweens.add({
              targets: player,
              angle: -90,
              y: GROUND_Y - 34,
              duration: 500,
              ease: "Bounce.easeOut",
            });
            scene.cameras.main.fadeOut(1100, 20, 8, 30);
            scene.time.delayedCall(1100, function () {
              scene.cameras.main.fadeIn(450, 20, 8, 30);
            });
          }
        },
        reset: function () {
          idleSpeed = spec.mechanic === "beat-the-clock" ? 3.2 : 0.3;
          player.setAngle(0).setPosition(playerHome, GROUND_Y - 52).setAlpha(1);
          challenger.setAngle(0).setAlpha(1).setPosition(challengerHome, GROUND_Y - challengerSize * 0.42);
          challengerShadow.setVisible(true);
        },
      };
    }

    function create() {
      // Phaser passes the scene only as `this`.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      scene = this;
      // A slight zoom keeps the edges of the world covered during screen shake.
      scene.cameras.main.setZoom(1.03);
      canvasTexture("sky", W, H, function (ctx) {
        ctx.fillStyle = vertical(ctx, 0, H, theme.sky);
        ctx.fillRect(0, 0, W, H);
        theme.paintSky(ctx, random);
      });
      scene.add.image(0, 0, "sky").setOrigin(0);

      [0, 1, 2].forEach(function (depth) {
        var key = "layer" + depth;
        canvasTexture(key, TILE_W, H, function (ctx) {
          theme.paintLayer(ctx, random, depth);
        });
        layers.push({
          sprite: scene.add.tileSprite(0, 0, W, H, key).setOrigin(0),
          speed: [0.18, 0.42, 0.72][depth],
        });
      });

      canvasTexture("ground", TILE_W, H - GROUND_Y, function (ctx) {
        paintGround(ctx, theme, random);
      });
      ground = scene.add.tileSprite(0, GROUND_Y, W, H - GROUND_Y, "ground").setOrigin(0);

      canvasTexture("spark", 64, 64, function (ctx) {
        glow(ctx, 32, 32, 32, "rgba(255,255,255,1)");
      });
      canvasTexture("shadow", 200, 40, function (ctx) {
        var gradient = ctx.createRadialGradient(100, 100, 0, 100, 100, 100);
        gradient.addColorStop(0, "rgba(0,0,0,0.55)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.setTransform(1, 0, 0, 0.2, 0, 0);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 200, 200);
      });

      var ambient = theme.ambient;
      if (!reducedMotion) {
        scene.add
          .particles(0, 0, "spark", {
            x: { min: 0, max: W },
            y: { min: 0, max: GROUND_Y },
            lifespan: 7000,
            frequency: 7000 / ambient.count,
            scale: { min: 0.05, max: 0.24 },
            alpha: { start: ambient.alpha, end: 0 },
            speedX: { min: -14, max: 14 },
            speedY: { min: ambient.rise - 8, max: ambient.rise + 8 },
            tint: ambient.tint,
            blendMode: Phaser.BlendModes.ADD,
          })
          .setDepth(12);
      }

      playerShadow = scene.add.image(playerHome, GROUND_Y + 14, "shadow").setDepth(8);
      challengerShadow = scene.add
        .image(challengerHome, GROUND_Y + 14, "shadow")
        .setDepth(8)
        .setScale(challengerSize / 130);

      player = scene.add
        .text(playerHome, GROUND_Y - 52, spec.player.emoji, { fontSize: "118px", padding: { x: 14, y: 14 } })
        .setOrigin(0.5)
        .setFlipX(true)
        .setDepth(10);
      challenger = scene.add
        .text(challengerHome, GROUND_Y - challengerSize * 0.42, spec.challenger.emoji, {
          fontSize: challengerSize + "px",
          padding: { x: 14, y: 14 },
        })
        .setOrigin(0.5)
        .setDepth(10);

      if (!reducedMotion) {
        scene.tweens.add({
          targets: [player, challenger],
          scaleY: 1.04,
          scaleX: 0.97,
          duration: 620,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      sparks = scene.add
        .particles(0, 0, "spark", {
          emitting: false,
          lifespan: 800,
          speed: { min: 110, max: 420 },
          scale: { start: 0.5, end: 0 },
          gravityY: 280,
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(25);

      var ready = pending;
      pending = null;
      ready.forEach(function (call) {
        call();
      });
    }

    function update(time, delta) {
      var speed = (scrollSpeed + (reducedMotion ? 0 : idleSpeed)) * (delta / 16.67);
      layers.forEach(function (layer) {
        layer.sprite.tilePositionX += speed * layer.speed;
      });
      ground.tilePositionX += speed;
      playerShadow.x = player.x;
      challengerShadow.x = challenger.x;
    }

    var game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent,
      width: W,
      height: H,
      backgroundColor: theme.sky[0],
      banner: false,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: { create: create, update: update },
    });

    return {
      game: game,
      send: function (name, detail) {
        function deliver() {
          handlers()[name](detail || {});
        }
        if (pending) {
          pending.push(deliver);
        } else {
          deliver();
        }
      },
    };
  }

  window.createWorld = makeWorld;
})();
