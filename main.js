const TILE_SIZE = 32;
const WORLD_W = 64;
const WORLD_H = 64;
const MAX_UNITS = 100;
const MAX_STRUCTURES = 20;

class Entity {
  constructor(x, y, radius, faction) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.faction = faction;
    this.hp = 100;
    this.maxHp = 100;
    this.damage = 5;
    this.range = 64;
    this.speed = 40;
    this.cooldown = 0.8;
    this.attackTimer = 0;
    this.dead = false;
  }

  distTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.hypot(dx, dy);
  }

  moveToward(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return;
    const nx = dx / d;
    const ny = dy / d;
    this.x += nx * this.speed * dt;
    this.y += ny * this.speed * dt;
  }

  takeDamage(v) {
    this.hp -= v;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }
}

class Unit extends Entity {
  constructor(x, y, blueprint, type = "drone") {
    super(x, y, 10, "player");
    this.type = type;
    this.blueprint = cloneGrid(blueprint.grid);
    this.stats = computeStatsFromGrid(this.blueprint);
    this.hp = this.stats.hp;
    this.maxHp = this.stats.hp;
    this.damage = this.stats.damage;
    this.range = this.stats.range;
    this.speed = type === "vehicle" ? 34 : 58;
    this.cooldown = type === "vehicle" ? 0.7 : 0.45;
    if (type === "vehicle") {
      this.hp *= 2;
      this.maxHp *= 2;
      this.damage *= 1.4;
      this.radius = 14;
    }
    this.controlled = false;
    this.capacity = type === "vehicle" ? 3 : 0;
    this.cargo = [];
    this.commandTarget = null;
  }

  update(dt, game) {
    this.attackTimer -= dt;
    const target = game.findNearestEnemy(this.x, this.y);
    if (this.controlled) {
      let mx = 0;
      let my = 0;
      if (game.keys["ArrowUp"]) my -= 1;
      if (game.keys["ArrowDown"]) my += 1;
      if (game.keys["ArrowLeft"]) mx -= 1;
      if (game.keys["ArrowRight"]) mx += 1;
      if (mx !== 0 || my !== 0) {
        const m = Math.hypot(mx, my);
        this.x += (mx / m) * this.speed * dt;
        this.y += (my / m) * this.speed * dt;
      } else if (target) {
        const d = this.distTo(target);
        if (d > this.range * 0.8) this.moveToward(target.x, target.y, dt);
      }
    } else if (this.commandTarget) {
      const dx = this.commandTarget.x - this.x;
      const dy = this.commandTarget.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 5) {
        this.moveToward(this.commandTarget.x, this.commandTarget.y, dt);
      } else {
        this.commandTarget = null;
      }
    } else if (target) {
      const d = this.distTo(target);
      if (d > this.range * 0.85) this.moveToward(target.x, target.y, dt);
    }

    this.x = Math.max(0, Math.min(WORLD_W * TILE_SIZE, this.x));
    this.y = Math.max(0, Math.min(WORLD_H * TILE_SIZE, this.y));

    if (target && this.attackTimer <= 0 && this.distTo(target) <= this.range) {
      target.takeDamage(this.damage);
      this.attackTimer = this.cooldown;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.controlled ? "#7fe8ff" : this.type === "vehicle" ? "#6fc26f" : "#8be08b";
    drawGridShape(ctx, this.blueprint, 4, this.type === "vehicle" ? 1.3 : 1.45);
    drawHpBar(ctx, this.hp, this.maxHp, 24, -22);
    ctx.restore();
  }
}

class Turret extends Entity {
  constructor(x, y, blueprint) {
    super(x, y, 12, "player");
    this.blueprint = cloneGrid(blueprint.grid);
    this.stats = computeStatsFromGrid(this.blueprint);
    this.hp = this.stats.hp * 1.6;
    this.maxHp = this.hp;
    this.damage = this.stats.damage * 1.1;
    this.range = this.stats.range + 28;
    this.cooldown = 0.45;
    this.shotCostCopper = 1;
    this.speed = 0;
  }

  update(dt, game) {
    this.attackTimer -= dt;
    const target = game.findNearestEnemy(this.x, this.y);
    if (!target) return;
    if (this.attackTimer <= 0 && this.distTo(target) <= this.range && game.resources.copper >= this.shotCostCopper) {
      game.resources.copper -= this.shotCostCopper;
      target.takeDamage(this.damage);
      this.attackTimer = this.cooldown;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "#7aa4ff";
    drawGridShape(ctx, this.blueprint, 4, 1.1);
    drawHpBar(ctx, this.hp, this.maxHp, 24, -22);
    ctx.restore();
  }
}

class Enemy extends Entity {
  constructor(x, y, archetype) {
    super(x, y, 10, "enemy");
    this.archetype = archetype;
    if (archetype === "fast") {
      this.maxHp = 35;
      this.hp = 35;
      this.speed = 72;
      this.damage = 5;
      this.cooldown = 0.7;
      this.radius = 9;
      this.color = "#ff8a66";
    } else if (archetype === "tank") {
      this.maxHp = 130;
      this.hp = 130;
      this.speed = 28;
      this.damage = 12;
      this.cooldown = 1.1;
      this.radius = 14;
      this.color = "#c95a5a";
    } else {
      this.maxHp = 70;
      this.hp = 70;
      this.speed = 45;
      this.damage = 8;
      this.cooldown = 0.9;
      this.radius = 11;
      this.color = "#e07a5f";
    }
    this.range = 24;
  }

  update(dt, game) {
    this.attackTimer -= dt;
    const target = game.findEnemyTarget(this);
    if (!target) return;
    const d = this.distTo(target);
    if (d > this.range * 0.95) {
      this.moveToward(target.x, target.y, dt);
    } else if (this.attackTimer <= 0) {
      target.takeDamage(this.damage);
      this.attackTimer = this.cooldown;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.color;
    if (this.archetype === "fast") {
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, this.radius);
      ctx.lineTo(-this.radius, this.radius);
      ctx.closePath();
      ctx.fill();
    } else if (this.archetype === "tank") {
      ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    drawHpBar(ctx, this.hp, this.maxHp, 22, -20);
    ctx.restore();
  }
}

class Structure extends Entity {
  constructor(x, y, type) {
    super(x, y, 14, "player");
    this.type = type;
    this.blueprint = defaultBlueprint();
    this.productionProgress = 0;
    this.baseSpeed = type === "Assembler" ? 1 : type === "TurretFoundry" ? 0.7 : 0.6;
    this.hp = type === "MiniCore" ? 180 : 220;
    this.maxHp = this.hp;
    this.running = false;
    this.resourceType = null;
    this.resourceRate = 0;
  }

  update(dt, game) {
    if (this.type === "MiniCore") {
      if (this.resourceType) {
        game.resources[this.resourceType] += this.resourceRate * dt;
      }
      return;
    }

    const stats = computeStatsFromGrid(this.blueprint.grid);
    const buildTime = Math.max(0.35, stats.buildTime);
    const speedBoost = 1 + Math.min(2, game.resources.coal / 300);
    const rate = this.baseSpeed * speedBoost;
    const perSecondCopper = stats.costCopper / buildTime;
    const perSecondGold = stats.costGold / buildTime;
    const needCopper = perSecondCopper * dt;
    const needGold = perSecondGold * dt;
    const canRun = game.resources.copper >= needCopper && game.resources.gold >= needGold;

    this.running = canRun;
    if (!canRun) return;

    game.resources.copper -= needCopper;
    game.resources.gold -= needGold;
    this.productionProgress += dt * rate;

    if (this.productionProgress >= buildTime) {
      this.productionProgress = 0;
      if (this.type === "Assembler") {
        if (game.units.length < MAX_UNITS) {
          game.units.push(new Unit(this.x + randRange(-8, 8), this.y + randRange(-8, 8), this.blueprint, "drone"));
        }
      } else if (this.type === "TurretFoundry") {
        if (game.turrets.length < MAX_UNITS) {
          game.turrets.push(new Turret(this.x + randRange(-16, 16), this.y + randRange(-16, 16), this.blueprint));
        }
      } else if (this.type === "VehicleBay") {
        if (game.units.length < MAX_UNITS) {
          game.units.push(new Unit(this.x + randRange(-10, 10), this.y + randRange(-10, 10), this.blueprint, "vehicle"));
        }
      }
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.type === "Assembler") ctx.fillStyle = "#63c7a2";
    else if (this.type === "TurretFoundry") ctx.fillStyle = "#7f9fe8";
    else if (this.type === "VehicleBay") ctx.fillStyle = "#d7b06a";
    else if (this.type === "MiniCore") ctx.fillStyle = "#56c1ff";
    ctx.fillRect(-14, -14, 28, 28);
    if (this.type !== "MiniCore") {
      const p = Math.min(1, this.productionProgress / Math.max(0.35, computeStatsFromGrid(this.blueprint.grid).buildTime));
      ctx.fillStyle = this.running ? "#8aff8a" : "#ff6e6e";
      ctx.fillRect(-14, 16, 28 * p, 4);
    }
    drawHpBar(ctx, this.hp, this.maxHp, 28, -24);
    ctx.restore();
  }
}

class Core extends Structure {
  constructor(x, y, main = true) {
    super(x, y, main ? "MainCore" : "MiniCore");
    this.main = main;
    this.hp = main ? 1000 : 200;
    this.maxHp = this.hp;
    this.radius = main ? 20 : 14;
    this.resourceType = null;
    this.resourceRate = 0;
  }

  update(dt, game) {
    if (this.main) return;
    if (this.resourceType) {
      game.resources[this.resourceType] += this.resourceRate * dt;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.main) {
      ctx.fillStyle = "#5ad1ff";
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f6b84";
      ctx.fillRect(-6, -6, 12, 12);
    } else {
      ctx.fillStyle = "#56c1ff";
      ctx.fillRect(-12, -12, 24, 24);
    }
    drawHpBar(ctx, this.hp, this.maxHp, 34, -28);
    ctx.restore();
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.keys = {};
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.camera = { x: 0, y: 0 };
    this.cameraSpeed = 320;

    this.resources = { copper: 180, coal: 80, gold: 80 };
    this.mainCore = new Core((WORLD_W * TILE_SIZE) / 2, (WORLD_H * TILE_SIZE) / 2, true);

    this.structures = [];
    this.units = [];
    this.turrets = [];
    this.enemies = [];

    this.wave = 1;
    this.waveTimer = this.getWaveInterval(this.wave);
    this.gameOver = false;
    this.started = false;
    this.paused = false;
    this.menuMode = "main";
    this.lastNonOptionsMenuMode = "main";
    this.isSandbox = false;
    this.infiniteCoreHealth = false;
    this.infiniteResources = false;
    this.autoSaveInterval = 60;
    this.autoSaveTimer = 0;
    this.saveStorageKey = "geometron_saves_v1";
    this.maxSaveSlots = 3;

    this.buildMode = null;
    this.selectedStructure = null;
    this.selectedUnit = null;
    this.selectedUnits = [];

    this.leftMouseDown = false;
    this.dragSelecting = false;
    this.dragStart = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.dragCurrent = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.moveCommandMode = false;

    this.designGridSize = 3;
    this.designGrid = createGrid(this.designGridSize, 0);
    this.designGrid[1][1] = 1;

    this.resourceNodes = this.createResourceNodes();
    this.centerCameraOnCore();

    this.bindEvents();
    this.showMainMenu();
    this.renderSaveList();
    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  createResourceNodes() {
    const cx = this.mainCore.x;
    const cy = this.mainCore.y;
    return [
      { x: cx - 320, y: cy - 160, type: "coal", occupied: false },
      { x: cx + 320, y: cy + 120, type: "copper", occupied: false },
      { x: cx - 350, y: cy + 250, type: "gold", occupied: false },
      { x: cx + 260, y: cy - 280, type: "coal", occupied: false },
      { x: cx + 420, y: cy - 80, type: "copper", occupied: false },
      { x: cx - 120, y: cy + 360, type: "gold", occupied: false }
    ];
  }

  bindEvents() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Escape") {
        e.preventDefault();
        this.handleEscapeToggle();
        return;
      }
      if (e.code === "KeyQ") this.pickNextControllableUnit();
      if (e.code === "KeyM" && this.selectedUnits.length > 0) {
        this.moveCommandMode = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    this.canvas.addEventListener("mousemove", (e) => {
      this.updateMouseFromEvent(e);
      if (this.leftMouseDown) {
        this.dragCurrent.x = this.mouse.x;
        this.dragCurrent.y = this.mouse.y;
        this.dragCurrent.worldX = this.mouse.worldX;
        this.dragCurrent.worldY = this.mouse.worldY;
        const dx = this.dragCurrent.x - this.dragStart.x;
        const dy = this.dragCurrent.y - this.dragStart.y;
        if (Math.hypot(dx, dy) > 6) this.dragSelecting = true;
      }
    });

    this.canvas.addEventListener("mousedown", (e) => {
      this.updateMouseFromEvent(e);
      if (e.button === 2) {
        this.handleRemoveClick();
        return;
      }
      if (e.button !== 0) return;
      this.leftMouseDown = true;
      this.dragSelecting = false;
      this.dragStart.x = this.mouse.x;
      this.dragStart.y = this.mouse.y;
      this.dragStart.worldX = this.mouse.worldX;
      this.dragStart.worldY = this.mouse.worldY;
      this.dragCurrent.x = this.mouse.x;
      this.dragCurrent.y = this.mouse.y;
      this.dragCurrent.worldX = this.mouse.worldX;
      this.dragCurrent.worldY = this.mouse.worldY;
    });

    this.canvas.addEventListener("mouseup", (e) => {
      this.updateMouseFromEvent(e);
      if (e.button !== 0) return;
      if (!this.leftMouseDown) return;
      this.leftMouseDown = false;
      if (this.dragSelecting) {
        this.selectUnitsInDrag();
      } else if (this.moveCommandMode && this.selectedUnits.length > 0) {
        this.issueMoveCommand(this.mouse.worldX, this.mouse.worldY);
        this.moveCommandMode = false;
      } else {
        this.handleWorldClick();
      }
      this.dragSelecting = false;
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    document.querySelectorAll("#buildButtons button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-build");
        this.buildMode = v === "Cancel" ? null : v;
        this.syncButtons();
      });
    });

    document.getElementById("assignBlueprintBtn").addEventListener("click", () => {
      if (!this.selectedStructure) return;
      if (this.selectedStructure.type === "MiniCore" || this.selectedStructure.type === "MainCore") return;
      this.selectedStructure.blueprint = { grid: cloneGrid(this.designGrid) };
    });

    const shapeCanvas = document.getElementById("shapeCanvas");
    shapeCanvas.addEventListener("mousedown", (e) => {
      const rect = shapeCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cellW = shapeCanvas.width / this.designGridSize;
      const cellH = shapeCanvas.height / this.designGridSize;
      const gx = Math.floor(x / cellW);
      const gy = Math.floor(y / cellH);
      if (gx < 0 || gy < 0 || gx >= this.designGridSize || gy >= this.designGridSize) return;
      const next = cloneGrid(this.designGrid);
      next[gy][gx] = next[gy][gx] ? 0 : 1;
      if (countCells(next) === 0) {
        next[gy][gx] = 1;
      }
      if (isConnected(next)) {
        this.designGrid = next;
      }
      this.drawShapeEditor();
    });

    document.getElementById("upgradeGridBtn").addEventListener("click", () => {
      if (this.designGridSize >= 6) return;
      const cost = 40 + this.designGridSize * 30;
      if (this.resources.gold < cost) return;
      this.resources.gold -= cost;
      this.designGridSize += 1;
      const g = createGrid(this.designGridSize, 0);
      for (let y = 0; y < this.designGrid.length; y++) {
        for (let x = 0; x < this.designGrid[y].length; x++) {
          g[y][x] = this.designGrid[y][x];
        }
      }
      this.designGrid = g;
      if (countCells(this.designGrid) === 0) {
        this.designGrid[Math.floor(this.designGridSize / 2)][Math.floor(this.designGridSize / 2)] = 1;
      }
      this.drawShapeEditor();
    });

    document.getElementById("clearShapeBtn").addEventListener("click", () => {
      this.designGrid = createGrid(this.designGridSize, 0);
      this.designGrid[Math.floor(this.designGridSize / 2)][Math.floor(this.designGridSize / 2)] = 1;
      this.drawShapeEditor();
    });

    document.getElementById("startGameBtn").addEventListener("click", () => {
      this.loadLatestSave();
    });

    document.getElementById("startSandboxBtn").addEventListener("click", () => {
      this.startSandboxGame();
    });

    document.getElementById("restartGameBtn").addEventListener("click", () => {
      this.resetGame();
      this.started = true;
      this.paused = false;
      this.setMenu(false);
    });

    document.getElementById("resumeGameBtn").addEventListener("click", () => {
      this.resumeFromPause();
    });

    document.getElementById("menuHomeBtn").addEventListener("click", () => {
      this.returnToMenu();
    });

    document.getElementById("optionsBtn").addEventListener("click", () => {
      this.showOptionsMenu();
    });

    document.getElementById("backBtn").addEventListener("click", () => {
      if (this.lastNonOptionsMenuMode === "pause") this.showPauseMenu();
      else if (this.lastNonOptionsMenuMode === "gameover") this.showGameOverMenu();
      else this.showMainMenu();
    });

    document.getElementById("startWaveBtn").addEventListener("click", () => {
      if (!this.isSandbox || !this.started || this.paused || this.gameOver) return;
      this.spawnWave(this.wave);
      this.wave += 1;
      this.waveTimer = this.getWaveInterval(this.wave);
    });

    document.getElementById("toggleInfiniteHealthBtn").addEventListener("click", () => {
      if (!this.isSandbox) return;
      this.infiniteCoreHealth = !this.infiniteCoreHealth;
      this.syncSandboxUi();
    });

    document.getElementById("toggleInfiniteResourcesBtn").addEventListener("click", () => {
      if (!this.isSandbox) return;
      this.infiniteResources = !this.infiniteResources;
      this.syncSandboxUi();
    });

    document.getElementById("saveList").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.getAttribute("data-save-action");
      const id = btn.getAttribute("data-save-id");
      if (!action || !id) return;
      if (action === "load") {
        this.loadSaveById(id);
      } else if (action === "delete") {
        this.deleteSaveById(id);
      }
    });

    this.drawShapeEditor();
    this.syncButtons();
  }

  updateMouseFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.mouse.worldX = this.mouse.x + this.camera.x;
    this.mouse.worldY = this.mouse.y + this.camera.y;
  }

  setMenu(open, title = "GEOMETRON", sub = "", showStart = true, showRestart = false, bgMode = "menu") {
    const menu = document.getElementById("menuScreen");
    const titleEl = document.getElementById("menuTitle");
    const subEl = document.getElementById("menuSub");
    const startBtn = document.getElementById("startGameBtn");
    const startSandboxBtn = document.getElementById("startSandboxBtn");
    const restartBtn = document.getElementById("restartGameBtn");
    const resumeBtn = document.getElementById("resumeGameBtn");
    const menuHomeBtn = document.getElementById("menuHomeBtn");
    const optionsBtn = document.getElementById("optionsBtn");
    const backBtn = document.getElementById("backBtn");
    const saveListPanel = document.getElementById("saveListPanel");
    menu.style.display = open ? "flex" : "none";
    menu.setAttribute("data-bg", bgMode);
    titleEl.textContent = title;
    subEl.textContent = sub;
    startBtn.style.display = showStart ? "inline-block" : "none";
    startSandboxBtn.style.display = "none";
    restartBtn.style.display = showRestart ? "inline-block" : "none";
    resumeBtn.style.display = "none";
    menuHomeBtn.style.display = "none";
    optionsBtn.style.display = "none";
    backBtn.style.display = "none";
    saveListPanel.style.display = "none";
  }

  setMenuButtons(showStart, showSandboxStart, showRestart, showResume, showMenuHome, showOptions, showBack) {
    const startBtn = document.getElementById("startGameBtn");
    const sandboxBtn = document.getElementById("startSandboxBtn");
    const restartBtn = document.getElementById("restartGameBtn");
    const resumeBtn = document.getElementById("resumeGameBtn");
    const menuHomeBtn = document.getElementById("menuHomeBtn");
    const optionsBtn = document.getElementById("optionsBtn");
    const backBtn = document.getElementById("backBtn");

    startBtn.style.display = showStart ? "inline-block" : "none";
    sandboxBtn.style.display = showSandboxStart ? "inline-block" : "none";
    restartBtn.style.display = showRestart ? "inline-block" : "none";
    resumeBtn.style.display = showResume ? "inline-block" : "none";
    menuHomeBtn.style.display = showMenuHome ? "inline-block" : "none";
    optionsBtn.style.display = showOptions ? "inline-block" : "none";
    backBtn.style.display = showBack ? "inline-block" : "none";

    startBtn.style.order = "0";
    sandboxBtn.style.order = "0";
    restartBtn.style.order = "0";
    resumeBtn.style.order = "0";
    menuHomeBtn.style.order = "0";
    optionsBtn.style.order = "0";
    backBtn.style.order = "0";
  }

  showMainMenu() {
    this.menuMode = "main";
    this.lastNonOptionsMenuMode = "main";
    document.getElementById("restartGameBtn").textContent = "New Game";
    this.setMenu(true, "GEOMETRON", "Build. Produce. Defend.\nSurvive incoming waves.", false, false, "menu");
    this.setMenuButtons(true, true, true, false, false, true, false);
    document.getElementById("saveListPanel").style.display = "block";
    this.renderSaveList();
  }

  showPauseMenu() {
    this.menuMode = "pause";
    this.lastNonOptionsMenuMode = "pause";
    document.getElementById("restartGameBtn").textContent = "Restart";
    this.setMenu(true, "PAUSED", "Press ESC to continue.", false, false, "game");
    this.setMenuButtons(false, false, true, true, true, true, false);
    document.getElementById("resumeGameBtn").style.order = "-2";
    document.getElementById("restartGameBtn").style.order = "-1";
  }

  showOptionsMenu() {
    this.menuMode = "options";
    const source = this.lastNonOptionsMenuMode === "pause" ? "Paused Game" : "Main Menu";
    this.setMenu(true, "OPTIONS", "ESC continues game when paused.\nCurrent source: " + source, false, false, this.lastNonOptionsMenuMode === "pause" ? "game" : "menu");
    this.setMenuButtons(false, false, false, false, false, false, true);
  }

  showGameOverMenu() {
    this.menuMode = "gameover";
    this.lastNonOptionsMenuMode = "gameover";
    document.getElementById("restartGameBtn").textContent = "Restart";
    this.setMenu(true, "CORE DESTROYED", "Waves Survived: " + (this.wave - 1), false, false, "game");
    this.setMenuButtons(false, false, true, false, true, true, false);
  }

  startNormalGame() {
    this.resetGame(false);
    this.started = true;
    this.gameOver = false;
    this.paused = false;
    this.autoSaveTimer = 0;
    this.setMenu(false);
    this.updateSandboxUiVisibility();
  }

  startSandboxGame() {
    this.resetGame(true);
    this.infiniteCoreHealth = true;
    this.infiniteResources = true;
    this.started = true;
    this.gameOver = false;
    this.paused = false;
    this.autoSaveTimer = 0;
    this.setMenu(false);
    this.syncSandboxUi();
    this.updateSandboxUiVisibility();
  }

  handleEscapeToggle() {
    if (this.gameOver) return;
    if (this.started && !this.paused) {
      this.paused = true;
      this.showPauseMenu();
      return;
    }
    if (this.started && this.paused) {
      this.resumeFromPause();
      return;
    }
    if (!this.started && this.menuMode === "options") {
      this.showMainMenu();
    }
  }

  resumeFromPause() {
    if (!this.started) return;
    this.paused = false;
    this.menuMode = "none";
    this.setMenu(false);
  }

  returnToMenu() {
    this.paused = false;
    this.started = false;
    this.moveCommandMode = false;
    this.showMainMenu();
    this.updateSandboxUiVisibility();
  }

  resetGame(sandboxMode = this.isSandbox) {
    this.isSandbox = sandboxMode;
    this.resources = { copper: 180, coal: 80, gold: 80 };
    this.mainCore = new Core((WORLD_W * TILE_SIZE) / 2, (WORLD_H * TILE_SIZE) / 2, true);
    this.structures = [];
    this.units = [];
    this.turrets = [];
    this.enemies = [];
    this.wave = 1;
    this.waveTimer = this.getWaveInterval(this.wave);
    this.buildMode = null;
    this.selectedStructure = null;
    if (this.selectedUnit) this.selectedUnit.controlled = false;
    this.selectedUnit = null;
    this.selectedUnits = [];
    this.gameOver = false;
    this.paused = false;
    this.menuMode = "main";
    this.lastNonOptionsMenuMode = "main";
    this.resourceNodes = this.createResourceNodes();
    this.autoSaveTimer = 0;
    this.centerCameraOnCore();
    this.syncButtons();
    this.syncSandboxUi();
    this.updateSandboxUiVisibility();
  }

  getSaveSlots() {
    try {
      const raw = localStorage.getItem(this.saveStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  setSaveSlots(slots) {
    localStorage.setItem(this.saveStorageKey, JSON.stringify(slots));
  }

  formatSaveTime(timestamp) {
    const dt = new Date(timestamp);
    return dt.toLocaleString();
  }

  captureState() {
    const cloneBlueprint = (bp) => ({ grid: cloneGrid(bp.grid) });
    return {
      resources: { ...this.resources },
      mainCore: {
        x: this.mainCore.x,
        y: this.mainCore.y,
        hp: this.mainCore.hp,
        maxHp: this.mainCore.maxHp,
        dead: this.mainCore.dead
      },
      structures: this.structures.map((s) => ({
        classType: s instanceof Core ? "Core" : "Structure",
        type: s.type,
        x: s.x,
        y: s.y,
        hp: s.hp,
        maxHp: s.maxHp,
        dead: s.dead,
        productionProgress: s.productionProgress,
        resourceType: s.resourceType,
        resourceRate: s.resourceRate,
        blueprint: cloneBlueprint(s.blueprint)
      })),
      units: this.units.map((u) => ({
        type: u.type,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHp: u.maxHp,
        dead: u.dead,
        attackTimer: u.attackTimer,
        blueprint: cloneBlueprint({ grid: u.blueprint })
      })),
      turrets: this.turrets.map((t) => ({
        x: t.x,
        y: t.y,
        hp: t.hp,
        maxHp: t.maxHp,
        dead: t.dead,
        attackTimer: t.attackTimer,
        blueprint: cloneBlueprint({ grid: t.blueprint })
      })),
      enemies: this.enemies.map((e) => ({
        archetype: e.archetype,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp,
        damage: e.damage,
        speed: e.speed,
        cooldown: e.cooldown,
        dead: e.dead,
        attackTimer: e.attackTimer
      })),
      resourceNodes: this.resourceNodes.map((n) => ({ ...n })),
      wave: this.wave,
      waveTimer: this.waveTimer,
      camera: { ...this.camera },
      isSandbox: this.isSandbox,
      infiniteCoreHealth: this.infiniteCoreHealth,
      infiniteResources: this.infiniteResources,
      designGridSize: this.designGridSize,
      designGrid: cloneGrid(this.designGrid)
    };
  }

  applyState(state) {
    if (!state) return false;
    this.resources = { ...state.resources };

    this.mainCore = new Core(state.mainCore.x, state.mainCore.y, true);
    this.mainCore.hp = state.mainCore.hp;
    this.mainCore.maxHp = state.mainCore.maxHp;
    this.mainCore.dead = state.mainCore.dead;

    this.structures = state.structures.map((s) => {
      if (s.classType === "Core" || s.type === "MiniCore") {
        const mini = new Core(s.x, s.y, false);
        mini.type = "MiniCore";
        mini.hp = s.hp;
        mini.maxHp = s.maxHp;
        mini.dead = s.dead;
        mini.resourceType = s.resourceType;
        mini.resourceRate = s.resourceRate;
        mini.productionProgress = s.productionProgress || 0;
        mini.blueprint = { grid: cloneGrid(s.blueprint.grid) };
        return mini;
      }
      const structure = new Structure(s.x, s.y, s.type);
      structure.hp = s.hp;
      structure.maxHp = s.maxHp;
      structure.dead = s.dead;
      structure.productionProgress = s.productionProgress || 0;
      structure.resourceType = s.resourceType;
      structure.resourceRate = s.resourceRate;
      structure.blueprint = { grid: cloneGrid(s.blueprint.grid) };
      return structure;
    });

    this.units = state.units.map((u) => {
      const unit = new Unit(u.x, u.y, { grid: cloneGrid(u.blueprint.grid) }, u.type);
      unit.hp = u.hp;
      unit.maxHp = u.maxHp;
      unit.dead = u.dead;
      unit.attackTimer = u.attackTimer || 0;
      return unit;
    });

    this.turrets = state.turrets.map((t) => {
      const turret = new Turret(t.x, t.y, { grid: cloneGrid(t.blueprint.grid) });
      turret.hp = t.hp;
      turret.maxHp = t.maxHp;
      turret.dead = t.dead;
      turret.attackTimer = t.attackTimer || 0;
      return turret;
    });

    this.enemies = state.enemies.map((e) => {
      const enemy = new Enemy(e.x, e.y, e.archetype);
      enemy.hp = e.hp;
      enemy.maxHp = e.maxHp;
      enemy.damage = e.damage;
      enemy.speed = e.speed;
      enemy.cooldown = e.cooldown;
      enemy.dead = e.dead;
      enemy.attackTimer = e.attackTimer || 0;
      return enemy;
    });

    this.resourceNodes = state.resourceNodes.map((n) => ({ ...n }));
    this.wave = state.wave;
    this.waveTimer = state.waveTimer;
    this.camera = { ...state.camera };
    this.isSandbox = !!state.isSandbox;
    this.infiniteCoreHealth = !!state.infiniteCoreHealth;
    this.infiniteResources = !!state.infiniteResources;
    this.designGridSize = state.designGridSize;
    this.designGrid = cloneGrid(state.designGrid);

    this.selectedStructure = null;
    if (this.selectedUnit) this.selectedUnit.controlled = false;
    this.selectedUnit = null;
    this.selectedUnits = [];
    this.moveCommandMode = false;
    this.buildMode = null;

    this.started = true;
    this.paused = false;
    this.gameOver = false;
    this.autoSaveTimer = 0;
    this.menuMode = "none";
    this.lastNonOptionsMenuMode = "main";
    this.setMenu(false);
    this.syncButtons();
    this.syncSandboxUi();
    this.updateSandboxUiVisibility();
    this.clampCamera();
    return true;
  }

  saveCurrentGame() {
    if (!this.started || this.gameOver) return;
    const now = Date.now();
    const nextSave = {
      id: String(now),
      timestamp: now,
      state: this.captureState()
    };
    const slots = this.getSaveSlots();
    slots.unshift(nextSave);
    slots.sort((a, b) => b.timestamp - a.timestamp);
    this.setSaveSlots(slots.slice(0, this.maxSaveSlots));
    this.renderSaveList();
  }

  loadLatestSave() {
    const slots = this.getSaveSlots();
    if (slots.length === 0) {
      document.getElementById("menuSub").textContent = "No save found.\nUse New Game first.";
      return;
    }
    slots.sort((a, b) => b.timestamp - a.timestamp);
    this.applyState(slots[0].state);
  }

  loadSaveById(id) {
    const slot = this.getSaveSlots().find((s) => s.id === id);
    if (!slot) return;
    this.applyState(slot.state);
  }

  deleteSaveById(id) {
    const slots = this.getSaveSlots().filter((s) => s.id !== id);
    this.setSaveSlots(slots);
    this.renderSaveList();
  }

  renderSaveList() {
    const saveList = document.getElementById("saveList");
    if (!saveList) return;
    const slots = this.getSaveSlots().sort((a, b) => b.timestamp - a.timestamp).slice(0, this.maxSaveSlots);
    if (slots.length === 0) {
      saveList.innerHTML = '<div class="save-empty">No saves yet.</div>';
      return;
    }
    saveList.innerHTML = slots
      .map((slot, i) => {
        const label = i === 0 ? "Latest" : `Save ${i + 1}`;
        return `
          <div class="save-row">
            <div class="save-meta">${label}: ${this.formatSaveTime(slot.timestamp)}</div>
            <div class="save-actions">
              <button data-save-action="load" data-save-id="${slot.id}">Load</button>
              <button data-save-action="delete" data-save-id="${slot.id}">Delete</button>
            </div>
          </div>`;
      })
      .join("");
  }

  updateSandboxUiVisibility() {
    document.getElementById("sandboxPanel").style.display = this.isSandbox ? "block" : "none";
  }

  syncSandboxUi() {
    const healthBtn = document.getElementById("toggleInfiniteHealthBtn");
    const resourceBtn = document.getElementById("toggleInfiniteResourcesBtn");
    healthBtn.textContent = "Infinite Core HP: " + (this.infiniteCoreHealth ? "ON" : "OFF");
    resourceBtn.textContent = "Infinite Resources: " + (this.infiniteResources ? "ON" : "OFF");
    healthBtn.classList.toggle("active", this.infiniteCoreHealth);
    resourceBtn.classList.toggle("active", this.infiniteResources);
  }

  centerCameraOnCore() {
    this.camera.x = this.mainCore.x - this.canvas.width / 2;
    this.camera.y = this.mainCore.y - this.canvas.height / 2;
    this.clampCamera();
  }

  clampCamera() {
    const maxX = WORLD_W * TILE_SIZE - this.canvas.width;
    const maxY = WORLD_H * TILE_SIZE - this.canvas.height;
    this.camera.x = Math.max(0, Math.min(Math.max(0, maxX), this.camera.x));
    this.camera.y = Math.max(0, Math.min(Math.max(0, maxY), this.camera.y));
  }

  updateCameraFromInput(dt) {
    let mx = 0;
    let my = 0;
    if (this.keys["KeyW"]) my -= 1;
    if (this.keys["KeyS"]) my += 1;
    if (this.keys["KeyA"]) mx -= 1;
    if (this.keys["KeyD"]) mx += 1;
    if (mx !== 0 || my !== 0) {
      const m = Math.hypot(mx, my);
      this.camera.x += (mx / m) * this.cameraSpeed * dt;
      this.camera.y += (my / m) * this.cameraSpeed * dt;
      this.clampCamera();
    }
  }

  getWaveInterval(waveNumber) {
    if (waveNumber <= 10) return 120;
    return Math.max(60, 120 - (waveNumber - 10) * 5);
  }

  syncButtons() {
    document.querySelectorAll("#buildButtons button").forEach((btn) => {
      const v = btn.getAttribute("data-build");
      btn.classList.toggle("active", this.buildMode && this.buildMode === v);
    });
  }

  pickNextControllableUnit() {
    if (this.units.length === 0) return;
    let idx = this.selectedUnit ? this.units.indexOf(this.selectedUnit) : -1;
    if (idx < 0) idx = -1;
    if (this.selectedUnit) this.selectedUnit.controlled = false;
    const next = this.units[(idx + 1) % this.units.length];
    this.selectedUnit = next;
    if (this.selectedUnit) this.selectedUnit.controlled = true;
    this.selectedUnits = this.selectedUnit ? [this.selectedUnit] : [];
  }

  selectUnitsInDrag() {
    const minX = Math.min(this.dragStart.worldX, this.dragCurrent.worldX);
    const maxX = Math.max(this.dragStart.worldX, this.dragCurrent.worldX);
    const minY = Math.min(this.dragStart.worldY, this.dragCurrent.worldY);
    const maxY = Math.max(this.dragStart.worldY, this.dragCurrent.worldY);

    this.selectedUnits = this.units.filter((u) => u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY);
    if (this.selectedUnit && !this.selectedUnits.includes(this.selectedUnit)) {
      this.selectedUnit.controlled = false;
      this.selectedUnit = null;
    }
  }

  issueMoveCommand(x, y) {
    const n = this.selectedUnits.length;
    if (n === 0) return;
    const cols = Math.ceil(Math.sqrt(n));
    const spacing = 18;
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ox = (col - (cols - 1) / 2) * spacing;
      const oy = (row - (Math.ceil(n / cols) - 1) / 2) * spacing;
      this.selectedUnits[i].commandTarget = {
        x: Math.max(0, Math.min(WORLD_W * TILE_SIZE, x + ox)),
        y: Math.max(0, Math.min(WORLD_H * TILE_SIZE, y + oy))
      };
    }
  }

  handleWorldClick() {
    const wx = this.mouse.worldX;
    const wy = this.mouse.worldY;

    const clickedUnit = this.findUnitAt(wx, wy);
    if (clickedUnit) {
      if (this.selectedUnit) this.selectedUnit.controlled = false;
      this.selectedUnit = clickedUnit;
      this.selectedUnit.controlled = true;
      this.selectedUnits = [clickedUnit];
      return;
    }

    const clickedStructure = this.findStructureAt(wx, wy);
    if (clickedStructure) {
      this.selectedStructure = clickedStructure;
      return;
    }

    if (!this.buildMode) {
      this.selectedStructure = null;
      return;
    }

    const gx = Math.floor(wx / TILE_SIZE);
    const gy = Math.floor(wy / TILE_SIZE);
    const x = gx * TILE_SIZE + TILE_SIZE / 2;
    const y = gy * TILE_SIZE + TILE_SIZE / 2;

    if (this.structures.length >= MAX_STRUCTURES) return;

    if (this.buildMode === "MiniCore") {
      const node = this.findNodeNear(x, y, 20);
      if (!node || node.occupied) return;
      const cost = { copper: 50, coal: 0, gold: 20 };
      if (!this.canAfford(cost)) return;
      this.pay(cost);
      const mini = new Core(node.x, node.y, false);
      mini.resourceType = node.type;
      mini.resourceRate = node.type === "copper" ? 2.4 : node.type === "coal" ? 2.0 : 1.3;
      mini.type = "MiniCore";
      this.structures.push(mini);
      node.occupied = true;
      this.selectedStructure = mini;
      return;
    }

    if (this.isBlockedPlacement(x, y, 24)) return;

    let cost;
    if (this.buildMode === "Assembler") cost = { copper: 40, coal: 10, gold: 8 };
    else if (this.buildMode === "TurretFoundry") cost = { copper: 60, coal: 8, gold: 18 };
    else cost = { copper: 80, coal: 20, gold: 28 };

    if (!this.canAfford(cost)) return;
    this.pay(cost);

    const s = new Structure(x, y, this.buildMode);
    s.blueprint = { grid: cloneGrid(this.designGrid) };
    this.structures.push(s);
    this.selectedStructure = s;
  }

  handleRemoveClick() {
    const wx = this.mouse.worldX;
    const wy = this.mouse.worldY;
    let removed = false;

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (Math.hypot(wx - u.x, wy - u.y) <= u.radius + 4) {
        if (this.selectedUnit === u) this.selectedUnit = null;
        this.selectedUnits = this.selectedUnits.filter((v) => v !== u);
        this.units.splice(i, 1);
        removed = true;
        break;
      }
    }

    if (removed) return;

    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      if (Math.hypot(wx - t.x, wy - t.y) <= t.radius + 4) {
        this.turrets.splice(i, 1);
        removed = true;
        break;
      }
    }

    if (removed) return;

    for (let i = this.structures.length - 1; i >= 0; i--) {
      const s = this.structures[i];
      if (Math.hypot(wx - s.x, wy - s.y) > 20) continue;
      if (s.type === "MiniCore") {
        const node = this.findNodeNear(s.x, s.y, 2);
        if (node) node.occupied = false;
      }
      if (this.selectedStructure === s) this.selectedStructure = null;
      this.structures.splice(i, 1);
      removed = true;
      break;
    }

    if (!removed) {
      if (this.selectedUnit) this.selectedUnit.controlled = false;
      this.selectedUnit = null;
      this.selectedUnits = [];
      this.selectedStructure = null;
      this.moveCommandMode = false;
      this.buildMode = null;
      this.syncButtons();
    }
  }

  isBlockedPlacement(x, y, dist) {
    if (Math.hypot(x - this.mainCore.x, y - this.mainCore.y) < 80) return true;
    for (const s of this.structures) {
      if (Math.hypot(x - s.x, y - s.y) < dist + 18) return true;
    }
    return false;
  }

  findNodeNear(x, y, dist) {
    for (const n of this.resourceNodes) {
      if (Math.hypot(x - n.x, y - n.y) <= dist) return n;
    }
    return null;
  }

  findStructureAt(x, y) {
    if (Math.hypot(x - this.mainCore.x, y - this.mainCore.y) <= 24) return this.mainCore;
    for (const s of this.structures) {
      if (Math.hypot(x - s.x, y - s.y) <= 20) return s;
    }
    return null;
  }

  findUnitAt(x, y) {
    for (const u of this.units) {
      if (Math.hypot(x - u.x, y - u.y) <= u.radius + 4) return u;
    }
    return null;
  }

  canAfford(cost) {
    return this.resources.copper >= cost.copper && this.resources.coal >= cost.coal && this.resources.gold >= cost.gold;
  }

  pay(cost) {
    this.resources.copper -= cost.copper;
    this.resources.coal -= cost.coal;
    this.resources.gold -= cost.gold;
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000);
    this.lastTime = t;

    this.update(dt);
    this.render();
    requestAnimationFrame((nt) => this.loop(nt));
  }

  update(dt) {
    if (!this.started || this.paused || this.gameOver) {
      this.updateUi();
      return;
    }

    if (this.isSandbox) {
      if (this.infiniteResources) {
        this.resources.copper = 999999;
        this.resources.coal = 999999;
        this.resources.gold = 999999;
      }
      if (this.infiniteCoreHealth) {
        this.mainCore.hp = this.mainCore.maxHp;
      }
    }

    this.updateCameraFromInput(dt);
    this.mouse.worldX = this.mouse.x + this.camera.x;
    this.mouse.worldY = this.mouse.y + this.camera.y;

    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= this.autoSaveInterval) {
      this.autoSaveTimer = 0;
      this.saveCurrentGame();
    }

    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.spawnWave(this.wave);
      this.wave += 1;
      this.waveTimer = this.getWaveInterval(this.wave);
    }

    this.mainCore.update(dt, this);
    for (const s of this.structures) s.update(dt, this);
    for (const u of this.units) u.update(dt, this);
    for (const t of this.turrets) t.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);

    this.cleanupDead();
    this.updateUi();

    if (this.mainCore.dead) {
      if (this.isSandbox && this.infiniteCoreHealth) {
        this.mainCore.dead = false;
        this.mainCore.hp = this.mainCore.maxHp;
        return;
      }
      this.gameOver = true;
      this.started = false;
      this.paused = false;
      this.showGameOverMenu();
    }
  }

  cleanupDead() {
    const removedStructs = this.structures.filter((s) => s.dead && s.type === "MiniCore");
    for (const s of removedStructs) {
      const node = this.findNodeNear(s.x, s.y, 2);
      if (node) node.occupied = false;
    }

    this.structures = this.structures.filter((s) => !s.dead);
    this.units = this.units.filter((u) => !u.dead);
    this.turrets = this.turrets.filter((t) => !t.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);

    if (this.selectedUnit && this.selectedUnit.dead) this.selectedUnit = null;
    if (this.selectedStructure && this.selectedStructure.dead) this.selectedStructure = null;
  }

  spawnWave(waveIndex) {
    const count = Math.min(30, 6 + waveIndex * 2);
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (side === 0) {
        x = randRange(0, WORLD_W * TILE_SIZE);
        y = 0;
      } else if (side === 1) {
        x = WORLD_W * TILE_SIZE;
        y = randRange(0, WORLD_H * TILE_SIZE);
      } else if (side === 2) {
        x = randRange(0, WORLD_W * TILE_SIZE);
        y = WORLD_H * TILE_SIZE;
      } else {
        x = 0;
        y = randRange(0, WORLD_H * TILE_SIZE);
      }
      const r = Math.random();
      const type = r < 0.33 ? "fast" : r < 0.66 ? "balanced" : "tank";
      const enemy = new Enemy(x, y, type);
      enemy.maxHp += waveIndex * 4;
      enemy.hp = enemy.maxHp;
      enemy.damage += waveIndex * 0.35;
      this.enemies.push(enemy);
    }
  }

  findEnemyTarget(enemy) {
    let best = this.mainCore;
    let bestDist = enemy.distTo(this.mainCore);
    for (const s of this.structures) {
      const d = enemy.distTo(s);
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    for (const t of this.turrets) {
      const d = enemy.distTo(t);
      if (d < bestDist) {
        best = t;
        bestDist = d;
      }
    }
    for (const u of this.units) {
      const d = enemy.distTo(u);
      if (d < bestDist) {
        best = u;
        bestDist = d;
      }
    }
    return best;
  }

  findNearestEnemy(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  updateUi() {
    document.getElementById("resourceText").textContent =
      "Copper: " + Math.floor(this.resources.copper) +
      " | Coal: " + Math.floor(this.resources.coal) +
      " | Gold: " + Math.floor(this.resources.gold);

    document.getElementById("waveText").textContent = "Wave: " + this.wave + " | Next: " + this.waveTimer.toFixed(1) + "s";
    document.getElementById("statusText").textContent =
      "Build: " + (this.buildMode || "None") +
      " | Units: " + (this.units.length + this.turrets.length) +
      " | Sel: " + this.selectedUnits.length +
      " | Mode: " + (this.isSandbox ? "Sandbox" : "Normal") +
      (this.moveCommandMode ? " | Command: Click destination" : "");

    const selTitle = document.getElementById("selectedTitle");
    const info = document.getElementById("infoText");

    if (!this.selectedStructure) {
      selTitle.textContent = "Selected: None";
      info.textContent = "No structure selected.";
    } else {
      selTitle.textContent = "Selected: " + this.selectedStructure.type;
      if (this.selectedStructure.type === "MiniCore") {
        info.textContent = "Resource: " + this.selectedStructure.resourceType +
          "\nRate: " + this.selectedStructure.resourceRate.toFixed(2) + "/s" +
          "\nHP: " + Math.floor(this.selectedStructure.hp) + "/" + Math.floor(this.selectedStructure.maxHp);
      } else if (this.selectedStructure.type === "MainCore") {
        info.textContent = "Main Core" +
          "\nHP: " + Math.floor(this.mainCore.hp) + "/" + Math.floor(this.mainCore.maxHp) +
          "\nDefend to survive.";
      } else {
        const st = computeStatsFromGrid(this.selectedStructure.blueprint.grid);
        info.textContent = "HP: " + Math.floor(this.selectedStructure.hp) + "/" + Math.floor(this.selectedStructure.maxHp) +
          "\nBlueprint Cells: " + st.cellCount +
          "\nDmg: " + st.damage.toFixed(1) + " Range: " + st.range.toFixed(1) +
          "\nCost C:" + st.costCopper.toFixed(1) + " G:" + st.costGold.toFixed(1);
      }
    }

    document.getElementById("shapeMeta").textContent = "Grid: " + this.designGridSize + "x" + this.designGridSize +
      " | Cells: " + countCells(this.designGrid);

    this.drawShapeEditor();
  }

  drawShapeEditor() {
    const canvas = document.getElementById("shapeCanvas");
    const ctx = canvas.getContext("2d");
    const n = this.designGridSize;
    const cw = canvas.width / n;
    const ch = canvas.height / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = this.designGrid[y][x] ? "#84d885" : "#222";
        ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2);
      }
    }

    ctx.strokeStyle = "#444";
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cw, 0);
      ctx.lineTo(i * cw, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * ch);
      ctx.lineTo(canvas.width, i * ch);
      ctx.stroke();
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    this.renderGrid(ctx);
    this.renderNodes(ctx);

    this.mainCore.render(ctx);
    for (const s of this.structures) s.render(ctx);
    for (const t of this.turrets) t.render(ctx);
    for (const u of this.units) u.render(ctx);
    for (const e of this.enemies) e.render(ctx);

    if (this.selectedUnits.length > 0) {
      ctx.strokeStyle = "#6de3ff";
      for (const u of this.selectedUnits) {
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (this.buildMode) {
      const gx = Math.floor(this.mouse.worldX / TILE_SIZE);
      const gy = Math.floor(this.mouse.worldY / TILE_SIZE);
      const px = gx * TILE_SIZE + TILE_SIZE / 2;
      const py = gy * TILE_SIZE + TILE_SIZE / 2;
      ctx.strokeStyle = "#8fd3ff";
      ctx.strokeRect(px - 16, py - 16, 32, 32);
    }

    ctx.restore();

    if (this.leftMouseDown && this.dragSelecting) {
      const x = Math.min(this.dragStart.x, this.dragCurrent.x);
      const y = Math.min(this.dragStart.y, this.dragCurrent.y);
      const w = Math.abs(this.dragCurrent.x - this.dragStart.x);
      const h = Math.abs(this.dragCurrent.y - this.dragStart.y);
      ctx.fillStyle = "rgba(109, 227, 255, 0.12)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#6de3ff";
      ctx.strokeRect(x, y, w, h);
    }

    if (this.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#ff7c7c";
      ctx.font = "48px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("CORE DESTROYED", this.canvas.width / 2, this.canvas.height / 2 - 12);
      ctx.fillStyle = "#ddd";
      ctx.font = "20px Segoe UI";
      ctx.fillText("Waves Survived: " + (this.wave - 1), this.canvas.width / 2, this.canvas.height / 2 + 24);
    }
  }

  renderGrid(ctx) {
    const startX = Math.floor(this.camera.x / TILE_SIZE) * TILE_SIZE;
    const endX = this.camera.x + this.canvas.width + TILE_SIZE;
    const startY = Math.floor(this.camera.y / TILE_SIZE) * TILE_SIZE;
    const endY = this.camera.y + this.canvas.height + TILE_SIZE;

    ctx.strokeStyle = "#232323";
    ctx.lineWidth = 1;

    for (let x = startX; x <= endX; x += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }

  renderNodes(ctx) {
    for (const n of this.resourceNodes) {
      if (n.type === "coal") ctx.fillStyle = "#444";
      if (n.type === "copper") ctx.fillStyle = "#b87333";
      if (n.type === "gold") ctx.fillStyle = "#d4af37";
      ctx.beginPath();
      ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
      ctx.fill();
      if (n.occupied) {
        ctx.strokeStyle = "#7fd0ff";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.clampCamera();
  }
}

function createGrid(n, val) {
  const g = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) row.push(val);
    g.push(row);
  }
  return g;
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function countCells(grid) {
  let c = 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) c += grid[y][x] ? 1 : 0;
  }
  return c;
}

function isConnected(grid) {
  const n = grid.length;
  let sx = -1;
  let sy = -1;
  let filled = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (grid[y][x]) {
        filled++;
        if (sx < 0) {
          sx = x;
          sy = y;
        }
      }
    }
  }
  if (filled === 0) return false;
  const q = [[sx, sy]];
  const seen = createGrid(n, 0);
  seen[sy][sx] = 1;
  let count = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length) {
    const [x, y] = q.shift();
    count++;
    for (const d of dirs) {
      const nx = x + d[0];
      const ny = y + d[1];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      if (!grid[ny][nx] || seen[ny][nx]) continue;
      seen[ny][nx] = 1;
      q.push([nx, ny]);
    }
  }
  return count === filled;
}

function computeStatsFromGrid(grid) {
  const n = grid.length;
  let cellCount = 0;
  let perimeter = 0;
  let edgeCells = 0;
  let minX = n;
  let minY = n;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!grid[y][x]) continue;
      cellCount++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      let exposed = 0;
      if (x === 0 || !grid[y][x - 1]) exposed++;
      if (x === n - 1 || !grid[y][x + 1]) exposed++;
      if (y === 0 || !grid[y - 1][x]) exposed++;
      if (y === n - 1 || !grid[y + 1][x]) exposed++;
      perimeter += exposed;
      if (exposed > 0) edgeCells++;
    }
  }

  if (cellCount === 0) {
    cellCount = 1;
    perimeter = 4;
    edgeCells = 1;
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const bbox = Math.max(bw, bh);
  const baseRange = 48;

  return {
    cellCount,
    perimeter,
    edgeCells,
    bbox,
    hp: cellCount * 10,
    damage: edgeCells * 2,
    costCopper: perimeter * 2,
    costGold: cellCount / 2,
    buildTime: cellCount * 0.5,
    range: baseRange + bbox * 10
  };
}

function defaultBlueprint() {
  const g = createGrid(3, 0);
  g[1][1] = 1;
  return { grid: g };
}

function drawGridShape(ctx, grid, cellPx, scale) {
  const n = grid.length;
  let minX = n;
  let minY = n;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!grid[y][x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return;
  const w = (maxX - minX + 1) * cellPx * scale;
  const h = (maxY - minY + 1) * cellPx * scale;
  const ox = -w / 2;
  const oy = -h / 2;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!grid[y][x]) continue;
      const px = ox + (x - minX) * cellPx * scale;
      const py = oy + (y - minY) * cellPx * scale;
      ctx.fillRect(px, py, cellPx * scale - 1, cellPx * scale - 1);
    }
  }
}

function drawHpBar(ctx, hp, maxHp, w, y) {
  const p = Math.max(0, Math.min(1, hp / maxHp));
  ctx.fillStyle = "#1f1f1f";
  ctx.fillRect(-w / 2, y, w, 4);
  ctx.fillStyle = p > 0.5 ? "#63db63" : p > 0.2 ? "#e0c35b" : "#ff6f6f";
  ctx.fillRect(-w / 2, y, w * p, 4);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

new Game(document.getElementById("gameCanvas"));
