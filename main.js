const TILE_SIZE = 32;
const WORLD_W = 64;
const WORLD_H = 64;
const MAX_UNITS = 100;
const MAX_STRUCTURES = 20;
const MAX_BLUEPRINT_GRID = 8;
const MINER_SNAP_RADIUS = 24;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const BOSS_SLAM_WINDUP = 1.15;
const BOSS_SLAM_RADIUS = 72;
const CELL_ROLES = { 1: "armor", 2: "weapon", 3: "sensor", 4: "engine" };
const SOCKET_MODULES = ["weapon", "shield", "support"];
const KEYBIND_ACTIONS = [
  { id: "panUp", label: "Pan camera up", code: "KeyW" },
  { id: "panLeft", label: "Pan camera left", code: "KeyA" },
  { id: "panDown", label: "Pan camera down", code: "KeyS" },
  { id: "panRight", label: "Pan camera right", code: "KeyD" },
  { id: "steerUp", label: "Steer unit up", code: "ArrowUp" },
  { id: "steerLeft", label: "Steer unit left", code: "ArrowLeft" },
  { id: "steerDown", label: "Steer unit down", code: "ArrowDown" },
  { id: "steerRight", label: "Steer unit right", code: "ArrowRight" },
  { id: "cycleUnit", label: "Cycle controllable unit", code: "KeyQ" },
  { id: "moveCommand", label: "Order squad to move", code: "KeyE" },
  { id: "zoomIn", label: "Zoom in", code: "Equal" },
  { id: "zoomOut", label: "Zoom out", code: "Minus" },
  { id: "resetZoom", label: "Reset zoom", code: "Digit0" },
  { id: "pause", label: "Pause / resume", code: "Escape" }
];
const DEFAULT_KEYBINDS = Object.fromEntries(KEYBIND_ACTIONS.map(({ id, code }) => [id, code]));
const UPGRADE_CARDS = {
  plating: { title: "Plating", icon: "⛨", description: "+120 Core HP" },
  fabrication: { title: "Fabrication", icon: "⚙", description: "+12% build speed" },
  survey: { title: "Survey", icon: "⌖", description: "+15% mining" },
  overclock: { title: "Overclock", icon: "ϟ", description: "+10% weapon damage" }
};
const SCENARIOS = {
  frontier: "Balanced start.",
  shattered: "720 HP · +35% rewards.",
  rich: "Extra deposits · tougher foes.",
  ion: "Ion zones damage units."
};
const TUTORIAL_STEPS = [
  {
    title: "Welcome, Commander",
    copy: "Gather copper, coal, and gold. Build a Miner, design a Blueprint, then defend the Core through Wave 1.",
    terms: ["copper", "coal", "gold", "Miner", "Blueprint", "Core", "Wave 1"],
    target: "#tutorialPrimaryBtn",
    action: "start"
  },
  {
    title: "Secure a mineral deposit",
    copy: "Choose the highlighted Miner tool, then place it on a glowing deposit. It harvests that resource over time.",
    terms: ["Miner", "deposit", "resource"],
    iconFrom: '#buildButtons [data-build="MiniCore"] .build-icon',
    target: '#buildButtons [data-build="MiniCore"]',
    action: "miner"
  },
  {
    title: "Start drone production",
    copy: "Choose the highlighted Assembler and place it on open ground. It prints drones from your current Blueprint.",
    terms: ["Assembler", "drones", "Blueprint"],
    iconFrom: '#buildButtons [data-build="Assembler"] .build-icon',
    target: '#buildButtons [data-build="Assembler"]',
    action: "assembler"
  },
  {
    title: "Shape your machine",
    copy: "In the Workshop, pick Armor, Weapon, Sensor, or Engine, then add a connected cell to tune your Blueprint.",
    terms: ["Workshop", "Armor", "Weapon", "Sensor", "Engine", "Blueprint"],
    target: "#shapePanel",
    action: "shape"
  },
  {
    title: "Apply the blueprint",
    copy: "With your Assembler selected, press the glowing ⇪ button to apply this Blueprint. New factories inherit future designs automatically.",
    terms: ["Assembler", "Blueprint"],
    target: "#assignBlueprintBtn",
    action: "blueprint"
  },
  {
    title: "Select a drone",
    copy: "Wait for the Assembler to print a drone, then click its glowing ring. Press {cycleUnit} to cycle drones; arrow keys steer the selected unit.",
    terms: ["Assembler", "drone", "{cycleUnit}", "arrow keys"],
    target: "#selectedPanel",
    action: "unit"
  },
  {
    title: "Send your squad",
    copy: "Select your drone, press {moveCommand} or the glowing ➤ button, then click a destination to order the squad.",
    terms: ["drone", "{moveCommand}", "destination", "squad"],
    target: "#moveCommandBtn",
    action: "command"
  },
  {
    title: "Hold the first assault",
    copy: "Hold the Core and survive Wave 1. Clear the assault to earn resources and choose an Upgrade.",
    terms: ["Core", "Wave 1", "Upgrade"],
    action: "wave"
  }
];

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
    this.armor = 0;
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
    this.hp -= Math.max(0.05, v - this.armor);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }
}

class Projectile {
  constructor(x, y, target, damage, color, speed = 330) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.color = color;
    this.speed = speed;
    this.dead = false;
  }

  update(dt) {
    if (!this.target || this.target.dead) {
      this.dead = true;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (distance <= step + this.target.radius) {
      this.target.takeDamage(this.damage);
      this.dead = true;
      return;
    }
    if (distance > 0) {
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }
  }

  render(ctx) {
    if (this.dead) return;
    const dx = this.target ? this.target.x - this.x : 0;
    const dy = this.target ? this.target.y - this.y : 0;
    const d = Math.hypot(dx, dy) || 1;
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - (dx / d) * 9, this.y - (dy / d) * 9);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#efffff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class TargetDummy extends Entity {
  constructor(x, y) {
    super(x, y, 12, "test");
    this.hp = 5000;
    this.maxHp = 5000;
    this.armor = 0;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = "#f0c779";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#1c3437";
    ctx.strokeStyle = "#f0c779";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(17, 0); ctx.moveTo(0, -17); ctx.lineTo(0, 17); ctx.stroke();
    drawHpBar(ctx, this.hp, this.maxHp, 28, -23);
    ctx.restore();
  }
}

class Unit extends Entity {
  constructor(x, y, blueprint, type = "drone") {
    super(x, y, 10, "player");
    this.type = type;
    this.blueprint = cloneGrid(blueprint.grid);
    this.modules = cloneModules(blueprint.modules);
    this.stats = computeStatsFromGrid(this.blueprint, this.modules);
    this.hp = this.stats.hp;
    this.maxHp = this.stats.hp;
    this.damage = this.stats.damage;
    this.range = this.stats.range;
    this.speed = (type === "vehicle" ? 34 : 58) * this.stats.speedMultiplier;
    this.cooldown = (type === "vehicle" ? 0.7 : 0.45) * this.stats.cooldownMultiplier;
    this.range = this.stats.range;
    this.armor = this.stats.armor;
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
      if (game.keys.steerUp) my -= 1;
      if (game.keys.steerDown) my += 1;
      if (game.keys.steerLeft) mx -= 1;
      if (game.keys.steerRight) mx += 1;
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

    if (target && !target.dead && this.attackTimer <= 0 && this.distTo(target) <= this.range) {
      game.fireShot(this, target, this.damage, this.type === "vehicle" ? "#e9c77d" : "#8cf0cf", this.type === "vehicle" ? 290 : 390);
      this.attackTimer = this.cooldown;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const color = this.controlled ? "#7fe8ff" : this.type === "vehicle" ? "#e6bd70" : "#6ce0ba";
    ctx.shadowColor = color;
    ctx.shadowBlur = this.controlled ? 15 : 8;
    ctx.fillStyle = color;
    drawGridShape(ctx, this.blueprint, 4, this.type === "vehicle" ? 1.35 : 1.4, this.modules);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(232,255,251,.75)";
    ctx.lineWidth = 1;
    strokeGridShape(ctx, this.blueprint, 4, this.type === "vehicle" ? 1.35 : 1.4, this.modules);
    drawHpBar(ctx, this.hp, this.maxHp, 24, -22);
    ctx.restore();
  }
}

class Turret extends Entity {
  constructor(x, y, blueprint) {
    super(x, y, 12, "player");
    this.type = "Turret";
    this.blueprint = cloneGrid(blueprint.grid);
    this.modules = cloneModules(blueprint.modules);
    this.stats = computeStatsFromGrid(this.blueprint, this.modules);
    this.hp = this.stats.hp * 1.6;
    this.maxHp = this.hp;
    this.damage = this.stats.damage * 1.1;
    this.range = this.stats.range + 28;
    this.cooldown = 0.45 * this.stats.cooldownMultiplier;
    this.armor = this.stats.armor;
    this.shotCostCopper = 1;
    this.speed = 0;
  }

  update(dt, game) {
    this.attackTimer -= dt;
    const target = game.findNearestEnemy(this.x, this.y);
    if (!target) return;
    if (!target.dead && this.attackTimer <= 0 && this.distTo(target) <= this.range && game.resources.copper >= this.shotCostCopper) {
      game.resources.copper -= this.shotCostCopper;
      game.fireShot(this, target, this.damage, "#86e9ff", 460);
      this.attackTimer = this.cooldown;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = "#86e9ff";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#67b9dd";
    drawGridShape(ctx, this.blueprint, 4, 1.1, this.modules);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d7f8ff";
    ctx.lineWidth = 1;
    strokeGridShape(ctx, this.blueprint, 4, 1.1, this.modules);
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
    } else if (archetype === "boss") {
      this.maxHp = 520;
      this.hp = 520;
      this.speed = 23;
      this.damage = 22;
      this.cooldown = 1.25;
      this.radius = 23;
      this.color = "#cc83f3";
      this.bossWindup = 0;
      this.bossAttackPoint = null;
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
    if (this.archetype === "boss") {
      if (this.bossWindup > 0) {
        this.bossWindup -= dt;
        if (this.bossWindup <= 0 && this.bossAttackPoint) {
          const victims = [game.mainCore, ...game.structures, ...game.turrets, ...game.units];
          for (const victim of victims) {
            if (!victim.dead && Math.hypot(victim.x - this.bossAttackPoint.x, victim.y - this.bossAttackPoint.y) <= BOSS_SLAM_RADIUS) {
              victim.takeDamage(this.damage);
            }
          }
          this.bossWindup = 0;
          this.bossAttackPoint = null;
          this.attackTimer = this.cooldown;
        }
        return;
      }
      if (d > this.range * 0.95) {
        this.moveToward(target.x, target.y, dt);
      } else if (this.attackTimer <= 0) {
        this.bossAttackPoint = { x: target.x, y: target.y };
        this.bossWindup = BOSS_SLAM_WINDUP;
      }
      return;
    }
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
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.archetype === "boss" ? 21 : 8;
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
    } else if (this.archetype === "boss") {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-this.radius * .78, -this.radius * .78, this.radius * 1.56, this.radius * 1.56);
      ctx.rotate(-Math.PI / 4);
      ctx.strokeStyle = "#f5d9ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.42)";
    ctx.lineWidth = 1;
    if (this.archetype === "fast") {
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, this.radius);
      ctx.lineTo(-this.radius, this.radius);
      ctx.closePath();
      ctx.stroke();
    } else if (this.archetype === "tank") {
      ctx.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawHpBar(ctx, this.hp, this.maxHp, 22, -20);
    ctx.restore();
  }

  renderBossWarning(ctx, reducedMotion = false) {
    if (this.archetype !== "boss" || this.bossWindup <= 0 || !this.bossAttackPoint) return;
    const { x, y } = this.bossAttackPoint;
    const progress = Math.max(0, 1 - this.bossWindup / BOSS_SLAM_WINDUP);
    const pulse = reducedMotion ? .5 : .5 + Math.sin(performance.now() / 90) * .12;
    ctx.save();
    ctx.fillStyle = `rgba(255,82,96,${pulse * .16})`;
    ctx.beginPath(); ctx.arc(x, y, BOSS_SLAM_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,103,112,.94)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.arc(x, y, BOSS_SLAM_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255,220,218,${.58 + progress * .35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y);
    ctx.moveTo(x, y - 11); ctx.lineTo(x, y + 11);
    ctx.stroke();
    ctx.fillStyle = "#ffdadd";
    ctx.font = "bold 10px 'DM Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`⚠ SLAM · ${Math.max(0, this.bossWindup).toFixed(1)}s`, x, y - BOSS_SLAM_RADIUS - 10);
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
    this.batchPaid = false;
    this.resourceType = null;
    this.resourceRate = 0;
  }

  update(dt, game) {
    if (this.type === "MiniCore") {
      if (this.resourceType) {
        game.resources[this.resourceType] += this.resourceRate * game.getResourceRateMultiplier(this.x, this.y) * dt;
      }
      return;
    }

    const stats = computeStatsFromGrid(this.blueprint.grid, this.blueprint.modules);
    const cost = game.getProductionCost(this.blueprint.grid, this.blueprint.modules);
    const batchTime = 4.5 + stats.cellCount * 1.6;
    const speedBoost = (1 + Math.min(1.5, game.resources.coal / 300)) * (1 + .12 * game.upgradeLevels.fabrication);

    if (game.units.length + game.turrets.length >= MAX_UNITS) {
      this.running = false;
      return;
    }
    if (!this.batchPaid) {
      if (!game.canAfford(cost)) {
        this.running = false;
        return;
      }
      game.pay(cost);
      this.batchPaid = true;
    }

    this.running = true;
    this.productionProgress += dt * this.baseSpeed * speedBoost;
    if (this.productionProgress < batchTime) return;
    this.productionProgress -= batchTime;
    this.batchPaid = false;
    if (this.type === "Assembler") {
      game.units.push(new Unit(this.x + randRange(-10, 10), this.y + randRange(-10, 10), this.blueprint, "drone"));
    } else if (this.type === "TurretFoundry") {
      game.turrets.push(new Turret(this.x + randRange(-16, 16), this.y + randRange(-16, 16), this.blueprint));
    } else if (this.type === "VehicleBay") {
      game.units.push(new Unit(this.x + randRange(-12, 12), this.y + randRange(-12, 12), this.blueprint, "vehicle"));
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const color = this.type === "Assembler" ? "#63d2b2" : this.type === "TurretFoundry" ? "#79b9ed" : this.type === "VehicleBay" ? "#e2bb74" : "#56c9eb";
    ctx.shadowColor = color;
    ctx.shadowBlur = this.running ? 13 : 7;
    ctx.fillStyle = "#102b34";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 28, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = .7;
    ctx.fillStyle = color;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.globalAlpha = 1;
    if (this.type !== "MiniCore") {
      const duration = 4.5 + computeStatsFromGrid(this.blueprint.grid, this.blueprint.modules).cellCount * 1.6;
      const p = Math.min(1, this.productionProgress / duration);
      ctx.fillStyle = "rgba(0,0,0,.65)";
      ctx.fillRect(-15, 18, 30, 4);
      ctx.fillStyle = this.running ? color : "#567079";
      ctx.fillRect(-15, 18, 30 * p, 4);
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
      game.resources[this.resourceType] += this.resourceRate * game.getResourceRateMultiplier(this.x, this.y) * dt;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.main) {
      ctx.shadowColor = "#50dfff";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#6ce0ec";
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(207,251,255,.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#0d566a";
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = "#dcfbff";
      ctx.fillRect(-2, -2, 4, 4);
    } else {
      ctx.shadowColor = "#56c1ff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#1f829c";
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(13, -7); ctx.lineTo(13, 7); ctx.lineTo(0, 14); ctx.lineTo(-13, 7); ctx.lineTo(-13, -7); ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#99e9ff";
      ctx.stroke();
      ctx.fillStyle = "#d5f8ff";
      ctx.fillRect(-3, -3, 6, 6);
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
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, pointerType: "mouse" };
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.cameraSpeed = 320;
    this.activePointerId = null;
    this.activePointerType = "mouse";
    this.touchPanning = false;
    this.touchPointers = new Map();
    this.pinchState = null;

    this.resources = { copper: 240, coal: 90, gold: 140 };
    this.mainCore = new Core((WORLD_W * TILE_SIZE) / 2, (WORLD_H * TILE_SIZE) / 2, true);

    this.structures = [];
    this.units = [];
    this.turrets = [];
    this.enemies = [];
    this.projectiles = [];

    this.wave = 1;
    this.waveTimer = this.getWaveInterval(this.wave);
    this.waveActive = false;
    this.hasPlacedFirstMiner = false;
    this.enemiesAtWaveStart = 0;
    this.waveStartSnapshot = null;
    this.lastWaveRecap = null;
    this.elapsed = 0;
    this.toastTimer = 0;
    this.gameOver = false;
    this.started = false;
    this.paused = false;
    this.menuMode = "main";
    this.lastNonOptionsMenuMode = "main";
    this.isSandbox = false;
    this.infiniteCoreHealth = false;
    this.infiniteResources = false;
    this.autoSaveInterval = 75;
    this.autoSaveTimer = 0;
    this.saveStorageKey = "geometron_saves_v1";
    this.maxSaveSlots = 3;
    this.settingsStorageKey = "geometron_settings_v1";
    this.settings = { zoom: 1, panSpeed: 320, reducedMotion: false };
    this.keybinds = { ...DEFAULT_KEYBINDS };
    this.rebindingAction = null;
    this.keys = {};
    this.ignoreKeyUntilUp = null;
    this.loadSettings();
    this.blueprintStorageKey = "geometron_blueprints_v1";
    this.tutorialStorageKey = "geometron_tutorial_completed_v1";
    try {
      this.tutorialCompleted = localStorage.getItem(this.tutorialStorageKey) === "1";
    } catch {
      this.tutorialCompleted = false;
    }
    this.tutorialActive = false;
    this.tutorialIndex = 0;
    this.tutorialFacts = {};

    this.buildMode = null;
    this.selectedStructure = null;
    this.selectedUnit = null;
    this.selectedUnits = [];
    this.selectedNode = null;
    this.testTargets = [];

    this.scenario = "frontier";
    this.terrainFeatures = this.createTerrainFeatures();
    this.terrainDamageTimer = 0;
    this.upgradeLevels = { plating: 0, fabrication: 0, survey: 0, overclock: 0 };
    this.pendingUpgrade = false;
    this.upgradeChosen = false;
    this.selectedUpgrade = null;
    this.upgradeChoices = [];
    this.nextDoctrine = "balanced";
    this.activeContract = "none";
    this.contractBaseline = null;

    this.leftMouseDown = false;
    this.dragSelecting = false;
    this.dragStart = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.dragCurrent = { x: 0, y: 0, worldX: 0, worldY: 0 };
    this.moveCommandMode = false;

    this.designGridSize = 3;
    this.designGrid = starterDesignGrid(this.designGridSize);
    this.designModules = emptyModules();
    this.selectedCellRole = 1;
    this.designHistory = [];

    this.resourceNodes = this.createResourceNodes();
    this.centerCameraOnCore();

    this.bindEvents();
    this.showMainMenu();
    this.renderSaveList();
    this.renderBlueprintLibrary();
    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  createResourceNodes() {
    const cx = this.mainCore.x;
    const cy = this.mainCore.y;
    const nodes = [
      { x: cx - 320, y: cy - 160, type: "coal", occupied: false },
      { x: cx + 320, y: cy + 120, type: "copper", occupied: false },
      { x: cx - 350, y: cy + 250, type: "gold", occupied: false },
      { x: cx + 260, y: cy - 280, type: "coal", occupied: false },
      { x: cx + 420, y: cy - 80, type: "copper", occupied: false },
      { x: cx - 120, y: cy + 360, type: "gold", occupied: false },
      { x: cx + 120, y: cy + 410, type: "coal", occupied: false },
      { x: cx - 440, y: cy - 20, type: "copper", occupied: false }
    ];
    if (this.scenario === "rich") {
      nodes.push(
        { x: cx + 500, y: cy + 250, type: "gold", occupied: false },
        { x: cx - 520, y: cy - 260, type: "copper", occupied: false }
      );
    }
    return nodes;
  }

  createTerrainFeatures() {
    const cx = this.mainCore.x;
    const cy = this.mainCore.y;
    const features = [
      { type: "ruin", x: cx - 205, y: cy - 205, radius: 44 },
      { type: "ruin", x: cx + 235, y: cy + 220, radius: 38 },
      { type: "spring", x: cx + 330, y: cy + 120, radius: 96 },
      { type: "spring", x: cx - 350, y: cy + 250, radius: 96 },
      { type: "spring", x: cx + 260, y: cy - 280, radius: 76 },
      { type: "ion", x: cx - 15, y: cy - 365, radius: 72 }
    ];
    if (this.scenario === "shattered") {
      features.push({ type: "ruin", x: cx + 330, y: cy - 105, radius: 48 }, { type: "ion", x: cx - 390, y: cy + 350, radius: 72 });
    } else if (this.scenario === "rich") {
      features.push({ type: "spring", x: cx + 410, y: cy + 315, radius: 120 }, { type: "spring", x: cx - 440, y: cy - 330, radius: 120 });
    } else if (this.scenario === "ion") {
      features.push(
        { type: "ion", x: cx + 385, y: cy - 320, radius: 84 },
        { type: "ion", x: cx - 410, y: cy + 345, radius: 82 },
        { type: "ion", x: cx + 410, y: cy + 365, radius: 84 },
        { type: "ion", x: cx - 350, y: cy - 380, radius: 78 }
      );
    }
    return features;
  }

  bindEvents() {
    window.addEventListener("keydown", (e) => {
      if (this.rebindingAction) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "Unidentified", "Process"].includes(e.code)) {
          this.renderKeybindSettings("Choose a key, not a modifier by itself.");
          return;
        }
        const action = this.rebindingAction;
        const assignedAction = KEYBIND_ACTIONS.find((item) => item.id !== action && this.keybinds[item.id] === e.code);
        if (assignedAction) {
          this.rebindingAction = null;
          this.ignoreKeyUntilUp = e.code;
          this.renderKeybindSettings(`${this.formatKeybind(e.code)} is already assigned to ${assignedAction.label}. Change that binding first.`);
          return;
        }
        this.keybinds[action] = e.code;
        this.rebindingAction = null;
        this.ignoreKeyUntilUp = e.code;
        this.saveSettings();
        this.renderKeybindSettings(`${KEYBIND_ACTIONS.find((item) => item.id === action)?.label} is now ${this.formatKeybind(e.code)}.`);
        if (this.tutorialActive) this.renderTutorialStep();
        return;
      }

      if (this.ignoreKeyUntilUp === e.code) {
        e.preventDefault();
        return;
      }
      if (e.code === "Escape" && document.fullscreenElement) {
        e.preventDefault();
        document.exitFullscreen().catch(() => {});
        return;
      }
      const action = this.getBoundAction(e.code);
      if (action === "pause" || (e.code === "Escape" && ["options", "glossary"].includes(this.menuMode))) {
        e.preventDefault();
        this.handleEscapeToggle();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target?.matches?.("input, select, textarea")) return;
      if (action) {
        e.preventDefault();
        this.keys[action] = true;
      }
      if (action === "zoomIn") {
        e.preventDefault();
        this.zoomBy(1.1);
      }
      if (action === "zoomOut") {
        e.preventDefault();
        this.zoomBy(1 / 1.1);
      }
      if (action === "resetZoom") {
        e.preventDefault();
        this.setZoomAt(1);
      }
      if (action === "cycleUnit") this.pickNextControllableUnit();
      if (action === "moveCommand" && this.selectedUnits.length > 0) {
        this.moveCommandMode = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      if (this.ignoreKeyUntilUp === e.code) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.ignoreKeyUntilUp = null;
        return;
      }
      if (this.rebindingAction) return;
      const action = this.getBoundAction(e.code);
      if (action) this.keys[action] = false;
    });
    window.addEventListener("blur", () => {
      this.keys = {};
      this.ignoreKeyUntilUp = null;
    });

    this.canvas.addEventListener("pointermove", (e) => {
      const previousX = this.mouse.x;
      const previousY = this.mouse.y;
      this.updateMouseFromEvent(e);
      if (e.pointerType === "touch" && this.touchPointers.has(e.pointerId)) {
        this.touchPointers.set(e.pointerId, { x: this.mouse.x, y: this.mouse.y });
        if (this.pinchState && this.touchPointers.size >= 2) {
          const points = [...this.touchPointers.values()].slice(0, 2);
          const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
          const midX = (points[0].x + points[1].x) / 2;
          const midY = (points[0].y + points[1].y) / 2;
          const zoom = clampZoom(this.pinchState.zoom * distance / this.pinchState.distance);
          this.camera.zoom = zoom;
          this.settings.zoom = zoom;
          this.camera.x = this.pinchState.worldX - midX / zoom;
          this.camera.y = this.pinchState.worldY - midY / zoom;
          this.clampCamera();
          this.mouse.worldX = this.camera.x + this.mouse.x / zoom;
          this.mouse.worldY = this.camera.y + this.mouse.y / zoom;
          this.syncSettingsUI();
          return;
        }
      }
      if (!this.leftMouseDown || e.pointerId !== this.activePointerId) return;
      const dx = this.mouse.x - previousX;
      const dy = this.mouse.y - previousY;
      const travel = Math.hypot(this.mouse.x - this.dragStart.x, this.mouse.y - this.dragStart.y);
      if (travel > 8 && this.activePointerType === "touch" && !this.moveCommandMode && !this.buildMode) {
        this.touchPanning = true;
      } else if (travel > 6 && this.activePointerType !== "touch") {
        this.dragSelecting = true;
      }
      if (this.touchPanning) {
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
        this.clampCamera();
        this.updateMouseFromEvent(e);
      }
      this.dragCurrent.x = this.mouse.x;
      this.dragCurrent.y = this.mouse.y;
      this.dragCurrent.worldX = this.mouse.worldX;
      this.dragCurrent.worldY = this.mouse.worldY;
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      this.updateMouseFromEvent(e);
      if (e.pointerType === "mouse" && e.button === 2) {
        this.handleRemoveClick();
        return;
      }
      if (e.button !== 0) return;
      e.preventDefault();
      this.canvas.setPointerCapture?.(e.pointerId);
      if (e.pointerType === "touch") {
        this.touchPointers.set(e.pointerId, { x: this.mouse.x, y: this.mouse.y });
        if (this.touchPointers.size >= 2) {
          const points = [...this.touchPointers.values()].slice(0, 2);
          const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
          const midX = (points[0].x + points[1].x) / 2;
          const midY = (points[0].y + points[1].y) / 2;
          this.pinchState = {
            distance,
            zoom: this.camera.zoom,
            worldX: this.camera.x + midX / this.camera.zoom,
            worldY: this.camera.y + midY / this.camera.zoom
          };
          this.activePointerId = null;
          this.leftMouseDown = false;
          this.dragSelecting = false;
          this.touchPanning = false;
          return;
        }
      }
      this.activePointerId = e.pointerId;
      this.activePointerType = e.pointerType || "mouse";
      this.leftMouseDown = true;
      this.dragSelecting = false;
      this.touchPanning = false;
      this.dragStart.x = this.mouse.x;
      this.dragStart.y = this.mouse.y;
      this.dragStart.worldX = this.mouse.worldX;
      this.dragStart.worldY = this.mouse.worldY;
      this.dragCurrent.x = this.mouse.x;
      this.dragCurrent.y = this.mouse.y;
      this.dragCurrent.worldX = this.mouse.worldX;
      this.dragCurrent.worldY = this.mouse.worldY;
    });

    this.canvas.addEventListener("pointerup", (e) => {
      this.updateMouseFromEvent(e);
      if (e.pointerType === "touch" && this.touchPointers.has(e.pointerId)) {
        const wasPinching = !!this.pinchState;
        this.touchPointers.delete(e.pointerId);
        if (wasPinching) {
          this.pinchState = null;
          const remainingPointer = [...this.touchPointers.entries()][0];
          this.activePointerId = remainingPointer ? remainingPointer[0] : null;
          this.activePointerType = "touch";
          this.leftMouseDown = !!remainingPointer;
          this.dragSelecting = false;
          this.touchPanning = !!remainingPointer;
          if (remainingPointer) {
            this.mouse.x = remainingPointer[1].x;
            this.mouse.y = remainingPointer[1].y;
            this.mouse.worldX = this.camera.x + this.mouse.x / this.camera.zoom;
            this.mouse.worldY = this.camera.y + this.mouse.y / this.camera.zoom;
            this.dragStart.x = remainingPointer[1].x;
            this.dragStart.y = remainingPointer[1].y;
          }
          this.saveSettings();
          return;
        }
      }
      if (e.pointerId !== this.activePointerId || e.button !== 0 || !this.leftMouseDown) return;
      this.leftMouseDown = false;
      if (!this.touchPanning && this.dragSelecting) {
        this.selectUnitsInDrag();
      } else if (!this.touchPanning && this.moveCommandMode && this.selectedUnits.length > 0) {
        this.issueMoveCommand(this.mouse.worldX, this.mouse.worldY);
        this.moveCommandMode = false;
      } else if (!this.touchPanning) {
        this.handleWorldClick();
      }
      this.dragSelecting = false;
      this.touchPanning = false;
      this.activePointerId = null;
    });

    this.canvas.addEventListener("pointercancel", (e) => {
      if (e.pointerType === "touch") {
        this.touchPointers.delete(e.pointerId);
        if (this.pinchState) {
          this.saveSettings();
          this.touchPointers.clear();
        }
        this.pinchState = null;
      }
      this.leftMouseDown = false;
      this.dragSelecting = false;
      this.touchPanning = false;
      this.activePointerId = null;
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * this.canvas.height : e.deltaY;
      this.setZoomAt(this.camera.zoom * Math.exp(-delta * .001), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    document.getElementById("zoomInBtn").addEventListener("click", () => this.zoomBy(1.12));
    document.getElementById("zoomOutBtn").addEventListener("click", () => this.zoomBy(1 / 1.12));
    document.getElementById("zoomReadout").addEventListener("click", () => this.setZoomAt(1));
    document.getElementById("centerViewBtn").addEventListener("click", () => this.centerCameraOnCore());
    document.getElementById("zoomSlider").addEventListener("input", (e) => {
      this.setZoomAt(Number(e.target.value) / 100);
    });
    document.getElementById("panSpeedSlider").addEventListener("input", (e) => {
      this.cameraSpeed = Math.max(100, Math.min(600, Number(e.target.value)));
      this.settings.panSpeed = this.cameraSpeed;
      this.syncSettingsUI();
      this.saveSettings();
    });
    document.getElementById("reducedMotionToggle").addEventListener("change", (e) => {
      this.settings.reducedMotion = e.target.checked;
      this.applyMotionSetting();
      this.saveSettings();
    });
    document.getElementById("resetOptionsBtn").addEventListener("click", () => this.resetSettings());
    document.getElementById("cancelKeybindBtn").addEventListener("click", () => this.cancelKeybindCapture());
    document.addEventListener("pointerdown", (e) => {
      if (this.rebindingAction && !e.target.closest("#keybindList, #cancelKeybindBtn")) this.cancelKeybindCapture();
    });
    document.getElementById("fullscreenBtn").addEventListener("click", () => this.toggleFullscreen());
    document.addEventListener("fullscreenchange", () => this.syncSettingsUI());

    document.querySelectorAll("#buildButtons button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-build");
        this.buildMode = this.buildMode === v ? null : v;
        this.moveCommandMode = false;
        this.syncButtons();
        if (this.buildMode === "MiniCore") this.notify("⛏ Tap a glowing deposit");
      });
    });

    document.getElementById("moveCommandBtn").addEventListener("click", () => {
      if (this.selectedUnits.length === 0) return;
      this.moveCommandMode = !this.moveCommandMode;
      if (this.moveCommandMode) {
        this.buildMode = null;
        this.syncButtons();
        this.notify("➤ Tap a destination");
      } else {
        this.notify("× Move cancelled");
      }
    });

    document.getElementById("assignBlueprintBtn").addEventListener("click", () => {
      if (!this.selectedStructure) return;
      if (this.selectedStructure.type === "MiniCore" || this.selectedStructure.type === "MainCore" || this.selectedStructure.type === "Turret") return;
      if (this.selectedStructure.batchPaid) {
        const reserved = this.getProductionCost(this.selectedStructure.blueprint.grid, this.selectedStructure.blueprint.modules);
        this.resources.copper += reserved.copper;
        this.resources.coal += reserved.coal;
        this.resources.gold += reserved.gold;
      }
      this.selectedStructure.blueprint = this.getWorkshopBlueprint();
      this.selectedStructure.productionProgress = 0;
      this.selectedStructure.batchPaid = false;
      this.notify("⇪ Blueprint synced");
      this.completeTutorialAction("blueprint");
    });

    document.querySelectorAll("#cellRoleButtons button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedCellRole = Number(btn.getAttribute("data-role"));
        document.querySelectorAll("#cellRoleButtons button").forEach((item) => item.classList.toggle("active", item === btn));
      });
    });

    document.getElementById("undoShapeBtn").addEventListener("click", () => this.undoDesign());
    document.getElementById("mirrorShapeBtn").addEventListener("click", () => this.mirrorDesign());
    document.getElementById("mountModuleBtn").addEventListener("click", () => this.mountDesignModule());
    document.getElementById("saveBlueprintBtn").addEventListener("click", () => this.saveBlueprint());
    document.getElementById("loadBlueprintBtn").addEventListener("click", () => this.loadBlueprint());
    document.getElementById("exportBlueprintBtn").addEventListener("click", () => this.exportBlueprintCode());
    document.getElementById("importBlueprintBtn").addEventListener("click", () => this.importBlueprintCode());

    document.getElementById("scenarioSelect").addEventListener("change", () => this.renderScenarioDescription());
    document.getElementById("doctrineSelect").addEventListener("change", (e) => {
      this.nextDoctrine = ["balanced", "swarm", "armor"].includes(e.target.value) ? e.target.value : "balanced";
    });
    document.getElementById("contractSelect").addEventListener("change", (e) => {
      this.activeContract = ["none", "core", "miners", "turrets"].includes(e.target.value) ? e.target.value : "none";
    });

    const shapeCanvas = document.getElementById("shapeCanvas");
    shapeCanvas.addEventListener("mousedown", (e) => {
      const rect = shapeCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * shapeCanvas.width / rect.width;
      const y = (e.clientY - rect.top) * shapeCanvas.height / rect.height;
      const pad = 22;
      const gridPx = shapeCanvas.width - pad * 2;
      if (x < pad || y < pad || x >= shapeCanvas.width - pad || y >= shapeCanvas.height - pad) return;
      const cellW = gridPx / this.designGridSize;
      const cellH = gridPx / this.designGridSize;
      const gx = Math.floor((x - pad) / cellW);
      const gy = Math.floor((y - pad) / cellH);
      if (gx < 0 || gy < 0 || gx >= this.designGridSize || gy >= this.designGridSize) return;
      const next = cloneGrid(this.designGrid);
      next[gy][gx] = next[gy][gx] === this.selectedCellRole ? 0 : this.selectedCellRole;
      if (countCells(next) === 0) {
        next[gy][gx] = this.selectedCellRole;
      }
      if (isConnected(next)) {
        this.recordDesignHistory();
        this.designGrid = next;
        this.completeTutorialAction("shape");
      } else {
        this.notify("⚠ Keep cells connected");
      }
      this.drawShapeEditor();
    });

    document.getElementById("upgradeGridBtn").addEventListener("click", () => {
      if (this.designGridSize >= MAX_BLUEPRINT_GRID) {
        this.notify("▦ Grid maxed");
        return;
      }
      const requiredWave = this.getGridUnlockWave();
      if (this.wave < requiredWave) {
        this.notify(`🔒 ${this.designGridSize + 1}×${this.designGridSize + 1} after W${requiredWave - 1}`);
        return;
      }
      const cost = this.getGridUpgradeCost();
      if (this.resources.gold < cost) {
        this.notify(`◆ ${cost} Au needed`);
        return;
      }
      this.resources.gold -= cost;
      this.recordDesignHistory();
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
      this.notify(`▦ ${this.designGridSize}×${this.designGridSize}`);
    });

    document.getElementById("clearShapeBtn").addEventListener("click", () => {
      this.recordDesignHistory();
      this.designGrid = starterDesignGrid(this.designGridSize);
      this.designModules = emptyModules();
      this.drawShapeEditor();
      this.notify("↺ Blueprint reset");
    });

    document.getElementById("startGameBtn").addEventListener("click", () => {
      this.loadLatestSave();
    });

    document.getElementById("startSandboxBtn").addEventListener("click", () => {
      this.startSandboxGame();
    });

    document.getElementById("tutorialBtn").addEventListener("click", () => {
      this.startTutorialGame();
    });

    document.getElementById("tutorialPrimaryBtn").addEventListener("click", () => {
      if (!this.tutorialActive || this.tutorialIndex !== 0) return;
      this.tutorialIndex = 1;
      this.advanceTutorialPastCompletedActions();
      this.renderTutorialStep();
    });

    document.getElementById("tutorialSkipBtn").addEventListener("click", () => {
      this.finishTutorial(true);
    });

    document.getElementById("restartGameBtn").addEventListener("click", () => {
      this.resetGame(this.menuMode === "main" ? false : this.isSandbox);
      this.started = true;
      this.paused = false;
      this.setMenu(false);
      if (!this.isSandbox && !this.tutorialCompleted) this.beginTutorial(false);
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

    document.getElementById("glossaryBtn").addEventListener("click", () => {
      this.showGlossaryMenu();
    });

    document.getElementById("backBtn").addEventListener("click", () => {
      this.cancelKeybindCapture();
      if (this.lastNonOptionsMenuMode === "pause") this.showPauseMenu();
      else if (this.lastNonOptionsMenuMode === "gameover") this.showGameOverMenu();
      else this.showMainMenu();
    });

    document.getElementById("startWaveBtn").addEventListener("click", () => {
      if (!this.isSandbox || !this.started || this.paused || this.gameOver || this.waveActive || this.pendingUpgrade) return;
      this.spawnWave(this.wave);
      this.waveActive = true;
      this.enemiesAtWaveStart = this.enemies.length;
      this.waveTimer = 0;
      this.notify(`⚔ W${this.wave}${this.wave % 5 === 0 ? " · ★ BOSS" : " · GO"}`);
      this.syncSandboxUi();
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

    document.getElementById("spawnTargetsBtn").addEventListener("click", () => this.spawnTestTargets());
    document.getElementById("clearTargetsBtn").addEventListener("click", () => {
      this.testTargets = [];
      this.notify("× Targets cleared");
    });

    document.getElementById("upgradeChoices").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-upgrade]");
      if (btn) this.chooseUpgrade(btn.getAttribute("data-upgrade"));
    });
    document.getElementById("deployWaveBtn").addEventListener("click", () => this.deployNextWave());

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
    this.mouse.worldX = this.camera.x + this.mouse.x / this.camera.zoom;
    this.mouse.worldY = this.camera.y + this.mouse.y / this.camera.zoom;
    this.mouse.pointerType = e.pointerType || "mouse";
  }

  loadSettings() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(this.settingsStorageKey) || "{}") || {};
    } catch {
      stored = {};
    }
    const systemMotionPreference = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.settings.zoom = clampZoom(Number.isFinite(stored.zoom) ? stored.zoom : 1);
    this.settings.panSpeed = Math.max(100, Math.min(600, Number.isFinite(stored.panSpeed) ? stored.panSpeed : 320));
    this.settings.reducedMotion = typeof stored.reducedMotion === "boolean" ? stored.reducedMotion : systemMotionPreference;
    const storedKeybinds = stored.keybinds;
    const storedCodes = KEYBIND_ACTIONS.map(({ id }) => storedKeybinds?.[id]);
    const validKeybinds = storedKeybinds && typeof storedKeybinds === "object"
      && storedCodes.every((code) => typeof code === "string" && code.length > 0)
      && new Set(storedCodes).size === KEYBIND_ACTIONS.length;
    this.keybinds = validKeybinds ? { ...DEFAULT_KEYBINDS, ...storedKeybinds } : { ...DEFAULT_KEYBINDS };
    this.settings.keybinds = { ...this.keybinds };
    this.camera.zoom = this.settings.zoom;
    this.cameraSpeed = this.settings.panSpeed;
    this.applyMotionSetting();
    this.syncSettingsUI();
    this.renderKeybindSettings();
  }

  saveSettings() {
    try {
      this.settings.keybinds = { ...this.keybinds };
      localStorage.setItem(this.settingsStorageKey, JSON.stringify(this.settings));
    } catch {
      // Settings still apply for the current session if browser storage is unavailable.
    }
  }

  syncSettingsUI() {
    const zoomSlider = document.getElementById("zoomSlider");
    const panSpeedSlider = document.getElementById("panSpeedSlider");
    const motionToggle = document.getElementById("reducedMotionToggle");
    if (zoomSlider) zoomSlider.value = String(Math.round(this.camera.zoom * 100));
    if (panSpeedSlider) panSpeedSlider.value = String(this.cameraSpeed);
    const zoomValue = document.getElementById("zoomValue");
    const panSpeedValue = document.getElementById("panSpeedValue");
    const zoomReadout = document.getElementById("zoomReadout");
    if (zoomValue) zoomValue.value = `${Math.round(this.camera.zoom * 100)}%`;
    if (panSpeedValue) panSpeedValue.value = `${this.cameraSpeed} px/s`;
    if (zoomReadout) {
      zoomReadout.textContent = `${Math.round(this.camera.zoom * 100)}%`;
      zoomReadout.setAttribute("aria-label", `Reset map zoom; current zoom ${Math.round(this.camera.zoom * 100)} percent`);
    }
    if (motionToggle) motionToggle.checked = this.settings.reducedMotion;
    const fullscreenBtn = document.getElementById("fullscreenBtn");
    if (fullscreenBtn) fullscreenBtn.textContent = document.fullscreenElement ? "⛶ Exit fullscreen" : "⛶ Fullscreen";
    const panKeys = ["panUp", "panLeft", "panDown", "panRight"].map((action) => this.formatKeybind(action)).join("/");
    document.querySelectorAll("[data-key-display]").forEach((element) => {
      const action = element.getAttribute("data-key-display");
      element.textContent = action === "pan" ? panKeys : this.formatKeybind(action);
    });
  }

  getBoundAction(code) {
    const exact = KEYBIND_ACTIONS.find(({ id }) => this.keybinds[id] === code);
    if (exact) return exact.id;
    if (this.keybinds.zoomIn === DEFAULT_KEYBINDS.zoomIn && code === "NumpadAdd") return "zoomIn";
    if (this.keybinds.zoomOut === DEFAULT_KEYBINDS.zoomOut && code === "NumpadSubtract") return "zoomOut";
    return null;
  }

  formatKeybind(action) {
    const code = this.keybinds[action] || DEFAULT_KEYBINDS[action] || action;
    const named = {
      Equal: "+", Minus: "−", NumpadAdd: "Num +", NumpadSubtract: "Num −", Escape: "Esc",
      ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
      Space: "Space", Backspace: "⌫", Delete: "Del", Enter: "Enter", Tab: "Tab"
    };
    if (named[code]) return named[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
    return code;
  }

  renderKeybindSettings(hintText = "") {
    const list = document.getElementById("keybindList");
    if (!list) return;
    list.replaceChildren();
    for (const { id, label } of KEYBIND_ACTIONS) {
      const row = document.createElement("div");
      row.className = "keybind-row";
      const name = document.createElement("span");
      name.textContent = label;
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("listening", this.rebindingAction === id);
      button.textContent = this.rebindingAction === id ? "Press a key…" : this.formatKeybind(id);
      button.setAttribute("aria-label", `${label}: ${this.rebindingAction === id ? "waiting for a key" : this.formatKeybind(id)}`);
      button.addEventListener("click", () => {
        this.keys = {};
        this.rebindingAction = id;
        this.renderKeybindSettings();
      });
      row.append(name, button);
      list.append(row);
    }
    const hint = document.getElementById("keybindHint");
    const cancelBtn = document.getElementById("cancelKeybindBtn");
    const action = KEYBIND_ACTIONS.find(({ id }) => id === this.rebindingAction);
    if (hint) hint.textContent = hintText || (action
      ? `Press a key for ${action.label}. Click Cancel to stop.`
      : "Displayed keys are defaults. Click one to replace it; changes save in this browser. Use Defaults to reset them.");
    if (cancelBtn) cancelBtn.style.display = action ? "block" : "none";
  }

  cancelKeybindCapture() {
    if (!this.rebindingAction) return;
    this.rebindingAction = null;
    this.renderKeybindSettings("Key change cancelled. Your current bindings are unchanged.");
  }

  applyMotionSetting() {
    document.body.classList.toggle("reduce-motion", this.settings.reducedMotion);
  }

  setZoomAt(nextZoom, screenX = this.canvas.width / 2, screenY = this.canvas.height / 2, persist = true) {
    const zoom = clampZoom(nextZoom);
    const oldZoom = this.camera.zoom || 1;
    if (Math.abs(zoom - oldZoom) < .001) return;
    const worldX = this.camera.x + screenX / oldZoom;
    const worldY = this.camera.y + screenY / oldZoom;
    this.camera.zoom = zoom;
    this.settings.zoom = zoom;
    this.camera.x = worldX - screenX / zoom;
    this.camera.y = worldY - screenY / zoom;
    this.clampCamera();
    this.mouse.worldX = this.camera.x + this.mouse.x / zoom;
    this.mouse.worldY = this.camera.y + this.mouse.y / zoom;
    this.syncSettingsUI();
    if (persist) this.saveSettings();
  }

  zoomBy(factor) {
    this.setZoomAt(this.camera.zoom * factor);
  }

  resetSettings() {
    this.settings = { zoom: 1, panSpeed: 320, reducedMotion: false };
    this.keybinds = { ...DEFAULT_KEYBINDS };
    this.rebindingAction = null;
    this.camera.zoom = 1;
    this.cameraSpeed = 320;
    this.centerCameraOnCore();
    this.applyMotionSetting();
    this.syncSettingsUI();
    this.renderKeybindSettings("Settings and keyboard controls restored to their defaults.");
    this.saveSettings();
    if (this.tutorialActive) this.renderTutorialStep();
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.notify("Fullscreen is not available in this browser");
    }
    this.syncSettingsUI();
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
    const glossaryBtn = document.getElementById("glossaryBtn");
    const backBtn = document.getElementById("backBtn");
    const tutorialBtn = document.getElementById("tutorialBtn");
    const saveListPanel = document.getElementById("saveListPanel");
    const missionPicker = document.getElementById("missionPicker");
    const optionsPanel = document.getElementById("optionsPanel");
    const glossaryPanel = document.getElementById("glossaryPanel");
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
    tutorialBtn.style.display = "none";
    glossaryBtn.style.display = "none";
    saveListPanel.style.display = "none";
    missionPicker.style.display = "none";
    optionsPanel.style.display = "none";
    glossaryPanel.style.display = "none";
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
    document.getElementById("restartGameBtn").textContent = "New Run";
    this.setMenu(true, "GEOMETRON", "Design · build · survive.", false, false, "menu");
    this.setMenuButtons(true, true, true, false, false, true, false);
    const tutorialBtn = document.getElementById("tutorialBtn");
    tutorialBtn.textContent = this.tutorialCompleted ? "Replay Guide" : "Guide";
    tutorialBtn.style.display = "inline-block";
    document.getElementById("glossaryBtn").style.display = "inline-block";
    document.getElementById("missionPicker").style.display = "block";
    document.getElementById("saveListPanel").style.display = "block";
    this.renderSaveList();
  }

  showPauseMenu() {
    this.menuMode = "pause";
    this.lastNonOptionsMenuMode = "pause";
    document.getElementById("restartGameBtn").textContent = "Restart";
    this.setMenu(true, "PAUSED", `Ⅱ  ·  ${this.formatKeybind("pause")} to resume`, false, false, "game");
    this.setMenuButtons(false, false, true, true, true, true, false);
    document.getElementById("glossaryBtn").style.display = "inline-block";
    document.getElementById("resumeGameBtn").style.order = "-2";
    document.getElementById("restartGameBtn").style.order = "-1";
  }

  showOptionsMenu() {
    this.menuMode = "options";
    this.setMenu(true, "OPTIONS", "View and comfort settings.", false, false, this.lastNonOptionsMenuMode === "pause" || this.lastNonOptionsMenuMode === "gameover" ? "game" : "menu");
    this.setMenuButtons(false, false, false, false, false, false, true);
    document.getElementById("optionsPanel").style.display = "block";
    this.syncSettingsUI();
    this.renderKeybindSettings();
  }

  showGlossaryMenu() {
    this.menuMode = "glossary";
    const bgMode = ["pause", "gameover"].includes(this.lastNonOptionsMenuMode) ? "game" : "menu";
    this.setMenu(true, "FIELD GUIDE", "Game terms, systems, and symbols.", false, false, bgMode);
    this.setMenuButtons(false, false, false, false, false, false, true);
    document.getElementById("glossaryPanel").style.display = "block";
  }

  showGameOverMenu() {
    this.closeTutorial();
    this.menuMode = "gameover";
    this.lastNonOptionsMenuMode = "gameover";
    document.getElementById("restartGameBtn").textContent = "Retry";
    this.setMenu(true, "CORE LOST", `Wave ${Math.max(0, this.wave - 1)}  ·  redesign and relaunch`, false, false, "game");
    this.setMenuButtons(false, false, true, false, true, true, false);
    document.getElementById("glossaryBtn").style.display = "inline-block";
  }

  beginTutorial(force = false) {
    if (!force && this.tutorialCompleted) return;
    this.tutorialActive = true;
    this.tutorialIndex = 0;
    this.tutorialFacts = {};
    this.renderTutorialStep();
  }

  advanceTutorialPastCompletedActions() {
    while (this.tutorialIndex > 0 && this.tutorialIndex < TUTORIAL_STEPS.length && this.tutorialFacts[TUTORIAL_STEPS[this.tutorialIndex].action]) {
      this.tutorialIndex += 1;
    }
    if (this.tutorialIndex >= TUTORIAL_STEPS.length) this.finishTutorial(false);
  }

  renderTutorialStep() {
    const panel = document.getElementById("tutorialPanel");
    this.clearTutorialHighlights();
    if (!this.tutorialActive || this.tutorialIndex >= TUTORIAL_STEPS.length) {
      panel.style.display = "none";
      return;
    }
    const step = TUTORIAL_STEPS[this.tutorialIndex];
    const taskCount = TUTORIAL_STEPS.length - 1;
    document.getElementById("tutorialTitle").textContent = step.title;
    this.renderTutorialCopy(step);
    document.getElementById("tutorialCount").textContent = `${Math.max(0, this.tutorialIndex)} / ${taskCount}`;
    document.getElementById("tutorialProgress").style.width = `${Math.max(0, this.tutorialIndex) / taskCount * 100}%`;
    document.getElementById("tutorialPrimaryBtn").style.display = this.tutorialIndex === 0 ? "inline-block" : "none";
    panel.style.display = "block";
    if (step.target) {
      const target = document.querySelector(step.target);
      if (target && target.getClientRects().length > 0) target.classList.add("tutorial-highlight");
    }
  }

  clearTutorialHighlights() {
    document.querySelectorAll(".tutorial-highlight").forEach((element) => element.classList.remove("tutorial-highlight"));
  }

  renderTutorialCopy(step) {
    const copy = document.getElementById("tutorialCopy");
    copy.replaceChildren();
    if (step.iconFrom) {
      const source = document.querySelector(step.iconFrom);
      if (source) {
        const icon = document.createElement("span");
        icon.className = "tutorial-step-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.append(source.cloneNode(true));
        copy.append(icon);
      }
    }

    const keyLabels = {
      "{cycleUnit}": this.formatKeybind("cycleUnit"),
      "{moveCommand}": this.formatKeybind("moveCommand")
    };
    const text = step.copy.replace(/\{cycleUnit\}|\{moveCommand\}/g, (token) => keyLabels[token]);
    const terms = [...(step.terms || [])].map((term) => keyLabels[term] || term).sort((a, b) => b.length - a.length);
    const lowerCopy = text.toLowerCase();
    let cursor = 0;
    while (cursor < text.length) {
      let nextIndex = text.length;
      let nextTerm = "";
      for (const term of terms) {
        const found = lowerCopy.indexOf(term.toLowerCase(), cursor);
        if (found >= 0 && (found < nextIndex || (found === nextIndex && term.length > nextTerm.length))) {
          nextIndex = found;
          nextTerm = term;
        }
      }
      if (!nextTerm) {
        copy.append(document.createTextNode(text.slice(cursor)));
        break;
      }
      if (nextIndex > cursor) copy.append(document.createTextNode(text.slice(cursor, nextIndex)));
      const highlight = document.createElement("span");
      highlight.className = "game-term";
      highlight.textContent = text.slice(nextIndex, nextIndex + nextTerm.length);
      copy.append(highlight);
      cursor = nextIndex + nextTerm.length;
    }
  }

  renderTutorialWorldGlow(ctx) {
    if (!this.tutorialActive || this.tutorialIndex >= TUTORIAL_STEPS.length) return;
    const action = TUTORIAL_STEPS[this.tutorialIndex].action;
    const targets = [];
    if (action === "miner") {
      for (const node of this.resourceNodes) if (!node.occupied) targets.push({ x: node.x, y: node.y, radius: 17 });
    } else if (action === "unit") {
      const allies = this.units.length > 0 ? this.units : this.structures.filter((structure) => structure.type === "Assembler");
      for (const entity of allies) targets.push({ x: entity.x, y: entity.y, radius: (entity.radius || 16) + 11 });
    } else if (action === "wave") {
      targets.push({ x: this.mainCore.x, y: this.mainCore.y, radius: 48 });
    }
    if (targets.length === 0) return;
    ctx.save();
    ctx.strokeStyle = "#ffd875";
    ctx.lineWidth = 2.5 / this.camera.zoom;
    ctx.shadowColor = "rgba(255,216,117,.95)";
    ctx.shadowBlur = 19;
    for (const target of targets) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  completeTutorialAction(action) {
    if (!this.tutorialActive || this.tutorialIndex === 0) return;
    this.tutorialFacts[action] = true;
    const step = TUTORIAL_STEPS[this.tutorialIndex];
    if (step && step.action === action) {
      this.tutorialIndex += 1;
      this.advanceTutorialPastCompletedActions();
      this.renderTutorialStep();
    }
  }

  finishTutorial(skipped = false) {
    this.tutorialActive = false;
    this.tutorialCompleted = true;
    this.clearTutorialHighlights();
    document.getElementById("tutorialPanel").style.display = "none";
    try {
      localStorage.setItem(this.tutorialStorageKey, "1");
    } catch {
      // Keep the guide complete for this session if storage is unavailable.
    }
    this.notify(skipped ? "× Guide skipped" : "✓ Guide complete");
  }

  closeTutorial() {
    this.tutorialActive = false;
    this.clearTutorialHighlights();
    const panel = document.getElementById("tutorialPanel");
    if (panel) panel.style.display = "none";
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

  startTutorialGame() {
    this.startNormalGame();
    this.beginTutorial(true);
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
    if (this.menuMode === "options" || this.menuMode === "glossary") {
      if (this.lastNonOptionsMenuMode === "pause") this.showPauseMenu();
      else if (this.lastNonOptionsMenuMode === "gameover") this.showGameOverMenu();
      else this.showMainMenu();
      return;
    }
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
  }

  resumeFromPause() {
    if (!this.started) return;
    this.paused = false;
    this.menuMode = "none";
    this.setMenu(false);
  }

  returnToMenu() {
    this.closeTutorial();
    this.paused = false;
    this.started = false;
    this.moveCommandMode = false;
    this.showMainMenu();
    this.updateSandboxUiVisibility();
  }

  resetGame(sandboxMode = this.isSandbox) {
    this.closeTutorial();
    this.isSandbox = sandboxMode;
    this.scenario = document.getElementById("scenarioSelect")?.value || this.scenario || "frontier";
    this.resources = this.scenario === "rich" ? { copper: 340, coal: 125, gold: 205 } : { copper: 240, coal: 90, gold: 140 };
    this.mainCore = new Core((WORLD_W * TILE_SIZE) / 2, (WORLD_H * TILE_SIZE) / 2, true);
    if (this.scenario === "shattered") {
      this.mainCore.hp = 720;
      this.mainCore.maxHp = 720;
    }
    this.terrainFeatures = this.createTerrainFeatures();
    this.terrainDamageTimer = 0;
    this.structures = [];
    this.units = [];
    this.turrets = [];
    this.enemies = [];
    this.projectiles = [];
    this.testTargets = [];
    this.wave = 1;
    this.waveTimer = this.getWaveInterval(this.wave);
    this.waveActive = false;
    this.hasPlacedFirstMiner = false;
    this.enemiesAtWaveStart = 0;
    this.waveStartSnapshot = null;
    this.lastWaveRecap = null;
    this.upgradeLevels = { plating: 0, fabrication: 0, survey: 0, overclock: 0 };
    this.pendingUpgrade = false;
    this.upgradeChosen = false;
    this.selectedUpgrade = null;
    this.upgradeChoices = [];
    document.getElementById("intermissionPanel").style.display = "none";
    document.getElementById("upgradeChoices").replaceChildren();
    document.getElementById("deployWaveBtn").disabled = true;
    document.getElementById("deployWaveBtn").textContent = "Select upgrade";
    this.nextDoctrine = "balanced";
    this.activeContract = "none";
    this.contractBaseline = null;
    this.elapsed = 0;
    this.buildMode = null;
    this.selectedStructure = null;
    this.selectedNode = null;
    if (this.selectedUnit) this.selectedUnit.controlled = false;
    this.selectedUnit = null;
    this.selectedUnits = [];
    this.gameOver = false;
    this.paused = false;
    this.menuMode = "main";
    this.lastNonOptionsMenuMode = "main";
    this.resourceNodes = this.createResourceNodes();
    this.designHistory = [];
    this.renderScenarioDescription();
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
    const cloneBlueprint = (bp) => ({ grid: cloneGrid(bp.grid), modules: cloneModules(bp.modules) });
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
        batchPaid: s.batchPaid,
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
        blueprint: cloneBlueprint({ grid: u.blueprint, modules: u.modules })
      })),
      turrets: this.turrets.map((t) => ({
        x: t.x,
        y: t.y,
        hp: t.hp,
        maxHp: t.maxHp,
        dead: t.dead,
        attackTimer: t.attackTimer,
        blueprint: cloneBlueprint({ grid: t.blueprint, modules: t.modules })
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
        attackTimer: e.attackTimer,
        bossWindup: e.bossWindup || 0,
        bossAttackPoint: e.bossAttackPoint ? { ...e.bossAttackPoint } : null
      })),
      resourceNodes: this.resourceNodes.map((n) => ({ ...n })),
      wave: this.wave,
      waveTimer: this.waveTimer,
      waveActive: this.waveActive,
      hasPlacedFirstMiner: this.hasPlacedFirstMiner,
      enemiesAtWaveStart: this.enemiesAtWaveStart,
      waveStartSnapshot: this.waveStartSnapshot ? { ...this.waveStartSnapshot } : null,
      lastWaveRecap: this.lastWaveRecap ? { ...this.lastWaveRecap, rewards: { ...this.lastWaveRecap.rewards } } : null,
      pendingUpgrade: this.pendingUpgrade,
      upgradeChosen: this.upgradeChosen,
      selectedUpgrade: this.selectedUpgrade,
      upgradeChoices: [...this.upgradeChoices],
      upgradeLevels: { ...this.upgradeLevels },
      nextDoctrine: this.nextDoctrine,
      activeContract: this.activeContract,
      contractBaseline: this.contractBaseline ? { ...this.contractBaseline } : null,
      scenario: this.scenario,
      camera: { ...this.camera },
      isSandbox: this.isSandbox,
      infiniteCoreHealth: this.infiniteCoreHealth,
      infiniteResources: this.infiniteResources,
      designGridSize: this.designGridSize,
      designGrid: cloneGrid(this.designGrid),
      designModules: cloneModules(this.designModules),
      selectedCellRole: this.selectedCellRole
    };
  }

  applyState(state) {
    if (!state) return false;
    this.closeTutorial();
    this.scenario = SCENARIOS[state.scenario] ? state.scenario : "frontier";
    document.getElementById("scenarioSelect").value = this.scenario;
    this.renderScenarioDescription();
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
        mini.blueprint = { grid: cloneGrid(s.blueprint.grid), modules: cloneModules(s.blueprint.modules) };
        return mini;
      }
      const structure = new Structure(s.x, s.y, s.type);
      structure.hp = s.hp;
      structure.maxHp = s.maxHp;
      structure.dead = s.dead;
      structure.productionProgress = s.productionProgress || 0;
      structure.batchPaid = !!s.batchPaid;
      structure.resourceType = s.resourceType;
      structure.resourceRate = s.resourceRate;
      structure.blueprint = { grid: cloneGrid(s.blueprint.grid), modules: cloneModules(s.blueprint.modules) };
      return structure;
    });

    this.units = state.units.map((u) => {
      const unit = new Unit(u.x, u.y, { grid: cloneGrid(u.blueprint.grid), modules: cloneModules(u.blueprint.modules) }, u.type);
      unit.hp = u.hp;
      unit.maxHp = u.maxHp;
      unit.dead = u.dead;
      unit.attackTimer = u.attackTimer || 0;
      return unit;
    });

    this.turrets = state.turrets.map((t) => {
      const turret = new Turret(t.x, t.y, { grid: cloneGrid(t.blueprint.grid), modules: cloneModules(t.blueprint.modules) });
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
      enemy.bossWindup = Math.max(0, e.bossWindup || 0);
      enemy.bossAttackPoint = e.bossAttackPoint ? { ...e.bossAttackPoint } : null;
      return enemy;
    });

    this.resourceNodes = state.resourceNodes.map((n) => ({ ...n }));
    this.terrainFeatures = this.createTerrainFeatures();
    this.wave = state.wave;
    this.waveTimer = state.waveTimer;
    this.waveActive = !!state.waveActive;
    this.hasPlacedFirstMiner = typeof state.hasPlacedFirstMiner === "boolean"
      ? state.hasPlacedFirstMiner
      : this.wave > 1 || this.waveActive || this.structures.some((structure) => structure.type === "MiniCore");
    this.enemiesAtWaveStart = state.enemiesAtWaveStart || state.enemies.length;
    this.waveStartSnapshot = state.waveStartSnapshot ? { ...state.waveStartSnapshot } : null;
    if (!this.waveStartSnapshot && state.waveActive) {
      this.waveStartSnapshot = { coreHp: this.mainCore.hp, unitCount: this.units.length, structureCount: this.structures.length + this.turrets.length };
    }
    this.lastWaveRecap = state.lastWaveRecap && state.lastWaveRecap.rewards
      ? { ...state.lastWaveRecap, rewards: { ...state.lastWaveRecap.rewards } }
      : null;
    this.pendingUpgrade = !!state.pendingUpgrade;
    this.upgradeChosen = !!state.upgradeChosen;
    this.selectedUpgrade = UPGRADE_CARDS[state.selectedUpgrade] ? state.selectedUpgrade : null;
    this.upgradeChoices = Array.isArray(state.upgradeChoices) ? state.upgradeChoices.filter((id) => UPGRADE_CARDS[id]) : [];
    this.upgradeLevels = { plating: 0, fabrication: 0, survey: 0, overclock: 0, ...(state.upgradeLevels || {}) };
    this.nextDoctrine = ["balanced", "swarm", "armor"].includes(state.nextDoctrine) ? state.nextDoctrine : "balanced";
    this.activeContract = ["none", "core", "miners", "turrets"].includes(state.activeContract) ? state.activeContract : "none";
    this.contractBaseline = state.contractBaseline || null;
    this.testTargets = [];
    this.projectiles = [];
    this.camera = { ...(state.camera || { x: 0, y: 0 }), zoom: clampZoom(Number.isFinite(state.camera?.zoom) ? state.camera.zoom : this.settings.zoom) };
    this.settings.zoom = this.camera.zoom;
    this.saveSettings();
    this.syncSettingsUI();
    this.isSandbox = !!state.isSandbox;
    this.infiniteCoreHealth = !!state.infiniteCoreHealth;
    this.infiniteResources = !!state.infiniteResources;
    this.designGridSize = state.designGridSize;
    this.designGrid = cloneGrid(state.designGrid);
    this.designModules = cloneModules(state.designModules);
    this.selectedCellRole = Number.isInteger(state.selectedCellRole) && state.selectedCellRole >= 1 && state.selectedCellRole <= 4 ? state.selectedCellRole : 1;
    this.designHistory = [];
    document.querySelectorAll("#cellRoleButtons button").forEach((button) => {
      button.classList.toggle("active", Number(button.getAttribute("data-role")) === this.selectedCellRole);
    });
    document.getElementById("doctrineSelect").value = this.nextDoctrine;
    document.getElementById("contractSelect").value = this.activeContract;

    this.selectedStructure = null;
    this.selectedNode = null;
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
    document.getElementById("intermissionPanel").style.display = this.pendingUpgrade ? "block" : "none";
    this.renderUpgradeChoices();
    this.renderWaveRecap();
    this.drawShapeEditor();
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
    const continueBtn = document.getElementById("startGameBtn");
    continueBtn.disabled = slots.length === 0;
    continueBtn.title = slots.length === 0 ? "Start a new expedition to create your first save." : "Load the most recent expedition.";
    if (slots.length === 0) {
      saveList.innerHTML = '<div class="save-empty">∅ No saves</div>';
      return;
    }
    saveList.innerHTML = slots
      .map((slot, i) => {
        const label = i === 0 ? "◷ Latest" : `◷ ${i + 1}`;
        return `
          <div class="save-row">
            <div class="save-meta">${label}: ${this.formatSaveTime(slot.timestamp)}</div>
            <div class="save-actions">
              <button title="Load save" aria-label="Load save" data-save-action="load" data-save-id="${slot.id}">↧</button>
              <button title="Delete save" aria-label="Delete save" data-save-action="delete" data-save-id="${slot.id}">×</button>
            </div>
          </div>`;
      })
      .join("");
  }

  updateSandboxUiVisibility() {
    document.getElementById("sandboxPanel").style.display = this.isSandbox ? "block" : "none";
    document.getElementById("helpPanel").style.display = this.isSandbox ? "none" : "block";
  }

  syncSandboxUi() {
    const healthBtn = document.getElementById("toggleInfiniteHealthBtn");
    const resourceBtn = document.getElementById("toggleInfiniteResourcesBtn");
    healthBtn.textContent = "♥";
    healthBtn.title = `Core shield ${this.infiniteCoreHealth ? "ON" : "OFF"}`;
    healthBtn.setAttribute("aria-label", healthBtn.title);
    resourceBtn.textContent = "∞";
    resourceBtn.title = `Infinite resources ${this.infiniteResources ? "ON" : "OFF"}`;
    resourceBtn.setAttribute("aria-label", resourceBtn.title);
    healthBtn.classList.toggle("active", this.infiniteCoreHealth);
    resourceBtn.classList.toggle("active", this.infiniteResources);
    const waveBtn = document.getElementById("startWaveBtn");
    waveBtn.disabled = !this.started || this.paused || this.gameOver || this.waveActive || this.pendingUpgrade;
    waveBtn.textContent = this.waveActive ? "⚔" : `⚔ ${this.wave}`;
    waveBtn.title = this.waveActive ? "Wave in progress" : `Launch wave ${this.wave}`;
    waveBtn.setAttribute("aria-label", waveBtn.title);
  }

  centerCameraOnCore() {
    this.camera.x = this.mainCore.x - this.canvas.width / (2 * this.camera.zoom);
    this.camera.y = this.mainCore.y - this.canvas.height / (2 * this.camera.zoom);
    this.clampCamera();
  }

  clampCamera() {
    const maxX = WORLD_W * TILE_SIZE - this.canvas.width / this.camera.zoom;
    const maxY = WORLD_H * TILE_SIZE - this.canvas.height / this.camera.zoom;
    this.camera.x = Math.max(0, Math.min(Math.max(0, maxX), this.camera.x));
    this.camera.y = Math.max(0, Math.min(Math.max(0, maxY), this.camera.y));
  }

  updateCameraFromInput(dt) {
    let mx = 0;
    let my = 0;
    if (this.keys.panUp) my -= 1;
    if (this.keys.panDown) my += 1;
    if (this.keys.panLeft) mx -= 1;
    if (this.keys.panRight) mx += 1;
    if (mx !== 0 || my !== 0) {
      const m = Math.hypot(mx, my);
      const worldSpeed = this.cameraSpeed / this.camera.zoom;
      this.camera.x += (mx / m) * worldSpeed * dt;
      this.camera.y += (my / m) * worldSpeed * dt;
      this.clampCamera();
    }
  }

  getWaveInterval(waveNumber) {
    return waveNumber <= 1 ? 38 : Math.max(24, 34 - (waveNumber - 2) * 0.6);
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
    this.selectedStructure = null;
    this.selectedNode = null;
    if (this.selectedUnit) this.completeTutorialAction("unit");
  }

  selectUnitsInDrag() {
    const minX = Math.min(this.dragStart.worldX, this.dragCurrent.worldX);
    const maxX = Math.max(this.dragStart.worldX, this.dragCurrent.worldX);
    const minY = Math.min(this.dragStart.worldY, this.dragCurrent.worldY);
    const maxY = Math.max(this.dragStart.worldY, this.dragCurrent.worldY);

    this.selectedUnits = this.units.filter((u) => u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY);
    this.selectedStructure = null;
    this.selectedNode = null;
    this.moveCommandMode = false;
    if (this.selectedUnit && !this.selectedUnits.includes(this.selectedUnit)) {
      this.selectedUnit.controlled = false;
      this.selectedUnit = null;
    }
    if (this.selectedUnits.length > 0) this.completeTutorialAction("unit");
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
    this.completeTutorialAction("command");
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
      this.selectedStructure = null;
      this.selectedNode = null;
      this.moveCommandMode = false;
      this.completeTutorialAction("unit");
      return;
    }

    const clickedStructure = this.findStructureAt(wx, wy);
    if (clickedStructure) {
      if (this.selectedUnit) this.selectedUnit.controlled = false;
      this.selectedUnit = null;
      this.selectedUnits = [];
      this.selectedStructure = clickedStructure;
      this.selectedNode = null;
      this.moveCommandMode = false;
      return;
    }

    if (!this.buildMode) {
      const clickedNode = this.findNodeNear(wx, wy, this.mouse.pointerType === "touch" ? 30 : 22);
      if (clickedNode) {
        if (this.selectedUnit) this.selectedUnit.controlled = false;
        this.selectedUnit = null;
        this.selectedUnits = [];
        this.selectedStructure = null;
        this.selectedNode = clickedNode;
        this.moveCommandMode = false;
        return;
      }
      if (this.selectedUnit) this.selectedUnit.controlled = false;
      this.selectedUnit = null;
      this.selectedUnits = [];
      this.selectedStructure = null;
      this.selectedNode = null;
      this.moveCommandMode = false;
      return;
    }

    const gx = Math.floor(wx / TILE_SIZE);
    const gy = Math.floor(wy / TILE_SIZE);
    const x = gx * TILE_SIZE + TILE_SIZE / 2;
    const y = gy * TILE_SIZE + TILE_SIZE / 2;

    if (this.structures.length >= MAX_STRUCTURES) {
      this.notify("⚠ Structure cap");
      return;
    }

    if (this.buildMode === "MiniCore") {
      const node = this.findNodeNear(x, y, MINER_SNAP_RADIUS);
      if (!node) {
        this.notify("⛏ Tap a glowing deposit");
        return;
      }
      if (node.occupied) {
        this.notify("⚠ Deposit occupied");
        return;
      }
      const cost = { copper: 50, coal: 0, gold: 20 };
      if (!this.canAfford(cost)) {
        this.notify("◉50 + ◆20 needed");
        return;
      }
      this.pay(cost);
      const mini = new Core(node.x, node.y, false);
      mini.resourceType = node.type;
      mini.resourceRate = node.type === "copper" ? 2.4 : node.type === "coal" ? 2.0 : 1.3;
      mini.type = "MiniCore";
      this.structures.push(mini);
      node.occupied = true;
      if (!this.hasPlacedFirstMiner) {
        this.hasPlacedFirstMiner = true;
        this.waveTimer = this.isSandbox ? 0 : this.getWaveInterval(this.wave);
      }
      this.selectedStructure = mini;
      this.selectedUnit = null;
      this.selectedUnits = [];
      this.selectedNode = null;
      this.moveCommandMode = false;
      this.notify(`✓ ${node.type.toUpperCase()} · +${mini.resourceRate.toFixed(1)}/s`);
      this.completeTutorialAction("miner");
      return;
    }

    if (this.isBlockedPlacement(x, y, 24)) {
      this.notify("⚠ Placement blocked");
      return;
    }

    let cost;
    if (this.buildMode === "Assembler") cost = { copper: 40, coal: 10, gold: 8 };
    else if (this.buildMode === "TurretFoundry") cost = { copper: 60, coal: 8, gold: 18 };
    else cost = { copper: 80, coal: 20, gold: 28 };

    if (!this.canAfford(cost)) {
      this.notify("⚠ Need resources");
      return;
    }
    this.pay(cost);

    const s = new Structure(x, y, this.buildMode);
    s.blueprint = this.getWorkshopBlueprint();
    this.structures.push(s);
    this.selectedStructure = s;
    this.selectedUnit = null;
    this.selectedUnits = [];
    this.selectedNode = null;
    this.moveCommandMode = false;
    this.notify(`✓ ${this.buildMode} · ◇ synced`);
    if (this.buildMode === "Assembler") this.completeTutorialAction("assembler");
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

    if (removed) {
      this.notify("Unit scrapped");
      return;
    }

    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      if (Math.hypot(wx - t.x, wy - t.y) <= t.radius + 4) {
        if (this.selectedStructure === t) this.selectedStructure = null;
        this.turrets.splice(i, 1);
        removed = true;
        break;
      }
    }

    if (removed) {
      this.notify("Defense scrapped");
      return;
    }

    for (let i = this.structures.length - 1; i >= 0; i--) {
      const s = this.structures[i];
      if (Math.hypot(wx - s.x, wy - s.y) > 20) continue;
      if (s.type === "MiniCore") {
        const node = this.findNodeNear(s.x, s.y, 2);
        if (node) node.occupied = false;
        this.resources.copper += 24;
        this.resources.gold += 10;
      } else if (s.type === "Assembler") {
        this.resources.copper += 16; this.resources.coal += 4; this.resources.gold += 3;
      } else if (s.type === "TurretFoundry") {
        this.resources.copper += 24; this.resources.coal += 3; this.resources.gold += 7;
      } else if (s.type === "VehicleBay") {
        this.resources.copper += 32; this.resources.coal += 8; this.resources.gold += 11;
      }
      if (this.selectedStructure === s) this.selectedStructure = null;
      this.structures.splice(i, 1);
      removed = true;
      break;
    }

    if (removed) {
      this.notify("⊖ Structure scrapped · refund");
    } else {
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
    for (const node of this.resourceNodes) {
      if (Math.hypot(x - node.x, y - node.y) < dist + 12) return true;
    }
    for (const feature of this.terrainFeatures) {
      if (feature.type === "ruin" && Math.hypot(x - feature.x, y - feature.y) < dist + feature.radius) return true;
    }
    for (const s of this.structures) {
      if (Math.hypot(x - s.x, y - s.y) < dist + 18) return true;
    }
    for (const t of this.turrets) {
      if (Math.hypot(x - t.x, y - t.y) < dist + 16) return true;
    }
    return false;
  }

  getBuildCost(type) {
    if (type === "Assembler") return { copper: 40, coal: 10, gold: 8 };
    if (type === "TurretFoundry") return { copper: 60, coal: 8, gold: 18 };
    if (type === "VehicleBay") return { copper: 80, coal: 20, gold: 28 };
    if (type === "MiniCore") return { copper: 50, coal: 0, gold: 20 };
    return { copper: 0, coal: 0, gold: 0 };
  }

  getProductionCost(grid, modules = emptyModules()) {
    const stats = computeStatsFromGrid(grid, modules);
    return {
      copper: Math.max(10, Math.ceil(stats.costCopper * 2 + stats.moduleCount * 8)),
      coal: Math.max(1, Math.ceil(stats.cellCount / 3)),
      gold: Math.max(2, Math.ceil(stats.costGold * 2 + stats.moduleCount * 3))
    };
  }

  getWorkshopBlueprint() {
    return { grid: cloneGrid(this.designGrid), modules: cloneModules(this.designModules) };
  }

  getResourceRateMultiplier(x, y) {
    let multiplier = 1 + .15 * this.upgradeLevels.survey;
    for (const feature of this.terrainFeatures) {
      if (feature.type === "spring" && Math.hypot(x - feature.x, y - feature.y) <= feature.radius) multiplier += .35;
    }
    return multiplier;
  }

  applyTerrainEffects(dt) {
    const entities = [this.mainCore, ...this.structures, ...this.units, ...this.turrets, ...this.enemies];
    for (const feature of this.terrainFeatures) {
      if (feature.type !== "ion") continue;
      for (const entity of entities) {
        if (!entity.dead && Math.hypot(entity.x - feature.x, entity.y - feature.y) < feature.radius) entity.takeDamage(2.8 * dt);
      }
    }
  }

  renderTerrainFeatures(ctx) {
    for (const feature of this.terrainFeatures) {
      ctx.save();
      if (feature.type === "ion") {
        ctx.fillStyle = "rgba(192, 112, 238, .055)";
        ctx.strokeStyle = "rgba(208, 143, 244, .34)";
        ctx.shadowColor = "#bb75ea";
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(feature.x, feature.y, feature.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.arc(feature.x, feature.y, feature.radius * .7, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#d3a1f0";
        ctx.font = "8px 'DM Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("ION FIELD · DAMAGE", feature.x, feature.y + feature.radius + 13);
      } else if (feature.type === "spring") {
        ctx.fillStyle = "rgba(108,224,186,.035)";
        ctx.strokeStyle = "rgba(108,224,186,.16)";
        ctx.beginPath(); ctx.arc(feature.x, feature.y, feature.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(143,225,194,.48)";
        ctx.font = "8px 'DM Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("RESOURCE SPRING · +35%", feature.x, feature.y + feature.radius + 12);
      } else {
        ctx.fillStyle = "#16252c";
        ctx.strokeStyle = "#74868b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(feature.x - feature.radius, feature.y + 7);
        ctx.lineTo(feature.x - feature.radius * .7, feature.y - feature.radius * .55);
        ctx.lineTo(feature.x - 8, feature.y - feature.radius);
        ctx.lineTo(feature.x + feature.radius * .8, feature.y - feature.radius * .45);
        ctx.lineTo(feature.x + feature.radius, feature.y + feature.radius * .65);
        ctx.lineTo(feature.x + feature.radius * .25, feature.y + feature.radius);
        ctx.lineTo(feature.x - feature.radius * .65, feature.y + feature.radius * .72);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(172,194,196,.5)";
        ctx.font = "8px 'DM Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("ANCIENT RUINS · NO BUILD", feature.x, feature.y + feature.radius + 13);
      }
      ctx.restore();
    }
  }

  findNodeNear(x, y, dist) {
    for (const n of this.resourceNodes) {
      if (Math.hypot(x - n.x, y - n.y) <= dist) return n;
    }
    return null;
  }

  findStructureAt(x, y) {
    const touchPadding = this.mouse.pointerType === "touch" ? 10 : 0;
    if (Math.hypot(x - this.mainCore.x, y - this.mainCore.y) <= 24 + touchPadding) return this.mainCore;
    for (const s of this.structures) {
      if (Math.hypot(x - s.x, y - s.y) <= 20 + touchPadding) return s;
    }
    for (const t of this.turrets) {
      if (Math.hypot(x - t.x, y - t.y) <= 18 + touchPadding) return t;
    }
    return null;
  }

  findUnitAt(x, y) {
    const touchPadding = this.mouse.pointerType === "touch" ? 12 : 4;
    for (const u of this.units) {
      if (Math.hypot(x - u.x, y - u.y) <= u.radius + touchPadding) return u;
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

    this.elapsed += dt;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) document.getElementById("toast").classList.remove("visible");
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
    this.mouse.worldX = this.camera.x + this.mouse.x / this.camera.zoom;
    this.mouse.worldY = this.camera.y + this.mouse.y / this.camera.zoom;

    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= this.autoSaveInterval) {
      this.autoSaveTimer = 0;
      this.saveCurrentGame();
    }

    if (!this.isSandbox && this.hasPlacedFirstMiner && !this.waveActive && !this.pendingUpgrade) {
      this.waveTimer -= dt;
    }
    if (!this.isSandbox && this.hasPlacedFirstMiner && !this.waveActive && !this.pendingUpgrade && this.waveTimer <= 0) {
      this.spawnWave(this.wave);
      this.notify(`⚠ W${this.wave} inbound${this.wave % 5 === 0 ? " · ★" : ""}`);
    }

    this.mainCore.update(dt, this);
    for (const s of this.structures) s.update(dt, this);
    for (const u of this.units) u.update(dt, this);
    for (const t of this.turrets) t.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    for (const p of this.projectiles) p.update(dt);
    this.applyTerrainEffects(dt);

    this.cleanupDead();
    if (this.waveActive && this.enemies.length === 0) {
      const clearedWave = this.wave;
      const rewardScale = this.scenario === "shattered" ? 1.35 : 1;
      const reward = {
        copper: Math.round((26 + clearedWave * 4) * rewardScale),
        coal: Math.round((8 + Math.floor(clearedWave / 2)) * rewardScale),
        gold: Math.round((10 + Math.floor(clearedWave / 2)) * rewardScale)
      };
      this.resources.copper += reward.copper;
      this.resources.coal += reward.coal;
      this.resources.gold += reward.gold;
      const contractOutcome = this.resolveActiveContract();
      const waveStart = this.waveStartSnapshot || {
        coreHp: this.mainCore.hp,
        unitCount: this.units.length,
        structureCount: this.structures.length + this.turrets.length
      };
      this.lastWaveRecap = {
        wave: clearedWave,
        enemiesDefeated: this.enemiesAtWaveStart,
        coreDamage: Math.max(0, Math.round(waveStart.coreHp - this.mainCore.hp)),
        unitLosses: Math.max(0, waveStart.unitCount - this.units.length),
        structureLosses: Math.max(0, waveStart.structureCount - this.structures.length - this.turrets.length),
        rewards: { ...reward },
        contractOutcome
      };
      this.waveStartSnapshot = null;
      this.wave += 1;
      this.waveActive = false;
      this.notify(`✓ W${clearedWave} · +${reward.copper}◉ +${reward.gold}◆${contractOutcome ? ` · ${contractOutcome}` : ""}`);
      if (clearedWave === 1) this.completeTutorialAction("wave");
      this.beginIntermission();
      this.syncSandboxUi();
    }
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
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.testTargets = this.testTargets.filter((target) => !target.dead);
    this.selectedUnits = this.selectedUnits.filter((u) => !u.dead && this.units.includes(u));

    if (this.selectedUnit && this.selectedUnit.dead) this.selectedUnit = null;
    if (this.selectedStructure && this.selectedStructure.dead) this.selectedStructure = null;
  }

  spawnWave(waveIndex) {
    this.contractBaseline = {
      coreHp: this.mainCore.hp,
      miners: this.structures.filter((structure) => structure.type === "MiniCore" && !structure.dead).length,
      turrets: this.turrets.length
    };
    let count = 5 + waveIndex * 2;
    if (this.nextDoctrine === "swarm") count += 5;
    if (this.nextDoctrine === "armor") count = Math.max(4, count - 2);
    count = Math.min(32, count);
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
      let type;
      if (this.nextDoctrine === "swarm") type = r < .72 ? "fast" : r < .95 ? "balanced" : "tank";
      else if (this.nextDoctrine === "armor") type = r < .16 ? "fast" : r < .38 ? "balanced" : "tank";
      else if (waveIndex < 3) type = r < 0.55 ? "fast" : "balanced";
      else if (waveIndex % 4 === 0) type = r < 0.24 ? "fast" : r < 0.52 ? "balanced" : "tank";
      else type = r < 0.3 ? "fast" : r < 0.68 ? "balanced" : "tank";
      const enemy = new Enemy(x, y, type);
      const scenarioBoost = this.scenario === "rich" ? 1.15 : 1;
      const doctrineBoost = this.nextDoctrine === "armor" ? 1.35 : 1;
      const scaling = (1 + Math.max(0, waveIndex - 1) * 0.075) * scenarioBoost * doctrineBoost;
      enemy.maxHp = Math.round(enemy.maxHp * scaling);
      enemy.hp = enemy.maxHp;
      enemy.damage = Math.round(enemy.damage * (1 + Math.max(0, waveIndex - 1) * 0.035));
      this.enemies.push(enemy);
    }
    if (waveIndex % 5 === 0) {
      const side = Math.floor(Math.random() * 4);
      const edge = WORLD_W * TILE_SIZE;
      const boss = new Enemy(side === 1 ? edge : side === 3 ? 0 : randRange(0, edge), side === 2 ? edge : side === 0 ? 0 : randRange(0, edge), "boss");
      boss.maxHp = Math.round(boss.maxHp * (1 + Math.floor(waveIndex / 5 - 1) * .18));
      boss.hp = boss.maxHp;
      this.enemies.push(boss);
    }
    this.waveActive = true;
    this.enemiesAtWaveStart = this.enemies.length;
    this.waveStartSnapshot = {
      coreHp: this.mainCore.hp,
      unitCount: this.units.length,
      structureCount: this.structures.length + this.turrets.length
    };
    this.waveTimer = 0;
  }

  resolveActiveContract() {
    if (!this.contractBaseline || this.activeContract === "none") return "";
    const baseline = this.contractBaseline;
    let success = false;
    let title = "Contract failed";
    if (this.activeContract === "core") {
      success = this.mainCore.hp >= baseline.coreHp;
      title = "Untouched Core";
    } else if (this.activeContract === "miners") {
      const miners = this.structures.filter((structure) => structure.type === "MiniCore" && !structure.dead).length;
      success = baseline.miners > 0 && miners >= baseline.miners;
      title = "Protect Miners";
    } else if (this.activeContract === "turrets") {
      success = this.turrets.length <= baseline.turrets;
      title = "Lean Defense";
    }
    let outcome;
    if (success) {
      this.resources.copper += 70;
      this.resources.gold += 25;
      outcome = `${title} complete (+70 CU, +25 AU)`;
    } else {
      outcome = `${title} missed`;
    }
    this.activeContract = "none";
    this.contractBaseline = null;
    return outcome;
  }

  findEnemyTarget(enemy) {
    const candidates = [this.mainCore, ...this.structures, ...this.turrets, ...this.units].filter((target) => !target.dead);
    let best = this.mainCore;
    let bestScore = Infinity;
    for (const target of candidates) {
      const distance = enemy.distTo(target);
      let score = distance;
      if (enemy.archetype === "fast" && target.type === "MiniCore") score *= .72;
      if ((enemy.archetype === "tank" || enemy.archetype === "boss") && target === this.mainCore) score *= .88;
      if (target.dead) continue;
      if (score < bestScore) {
        best = target;
        bestScore = score;
      }
    }
    return best;
  }

  findNearestEnemy(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const e of [...this.enemies, ...this.testTargets]) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  fireShot(shooter, target, damage, color, speed) {
    const damageBoost = 1 + .1 * this.upgradeLevels.overclock;
    this.projectiles.push(new Projectile(shooter.x, shooter.y, target, damage * damageBoost, color, speed));
  }

  notify(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    this.toastTimer = 3.4;
  }

  updateUi() {
    const copper = Math.floor(this.resources.copper);
    const coal = Math.floor(this.resources.coal);
    const gold = Math.floor(this.resources.gold);
    document.getElementById("resourceText").innerHTML =
      `<span class="resource-chip"><i class="resource-dot copper-dot"></i>${copper}<span style="color:#859da4">CU</span></span>` +
      `<span class="resource-chip"><i class="resource-dot coal-dot"></i>${coal}<span style="color:#859da4">CO</span></span>` +
      `<span class="resource-chip"><i class="resource-dot gold-dot"></i>${gold}<span style="color:#859da4">AU</span></span>`;
    document.getElementById("resourceText").title = "◉ Copper · ⬟ Coal · ◆ Gold";

    const bossWarning = this.waveActive ? this.enemies.find((enemy) => enemy.archetype === "boss" && enemy.bossWindup > 0) : null;
    const waveText = bossWarning
      ? `⚠ SLAM · ${bossWarning.bossWindup.toFixed(1)}s`
      : this.pendingUpgrade
      ? `◇ ${String(this.wave).padStart(2, "0")} READY`
      : this.waveActive
      ? `⚔ ${String(this.wave).padStart(2, "0")} · ◉ ${this.enemies.length}`
      : !this.isSandbox && !this.hasPlacedFirstMiner
      ? "⛏ MINER"
      : `⚔ ${String(this.wave).padStart(2, "0")} · ${this.isSandbox ? "Ⅱ" : `◷ ${Math.max(0, Math.ceil(this.waveTimer))}`}`;
    const waveEl = document.getElementById("waveText");
    waveEl.textContent = this.waveActive && this.wave % 5 === 0 ? `${waveText} · ★` : waveText;
    waveEl.classList.toggle("boss-warning-active", !!bossWarning);
    waveEl.title = bossWarning ? "Boss slam incoming · move units outside the red target ring" : this.pendingUpgrade ? "Choose your next upgrade" : this.waveActive ? `${this.enemies.length} hostiles remain` : !this.isSandbox && !this.hasPlacedFirstMiner ? "Place a Miner Core to start the countdown" : this.isSandbox ? "Wave ready" : `Next wave in ${Math.max(0, Math.ceil(this.waveTimer))} seconds`;
    const statusEl = document.getElementById("statusText");
    statusEl.textContent = `${this.isSandbox ? "∞" : "⌂"} · ${this.units.length + this.turrets.length}/${MAX_UNITS}${this.buildMode ? ` · ⊕ ${this.buildMode}` : ""}${this.moveCommandMode ? " · ➜" : ""}`;
    statusEl.title = `${this.isSandbox ? "Sandbox" : "Frontier"} · ${this.units.length + this.turrets.length}/${MAX_UNITS} units${this.buildMode ? ` · building ${this.buildMode}` : ""}${this.moveCommandMode ? " · choose destination" : ""}`;

    const objective = document.getElementById("objectiveText");
    const coreRatio = this.mainCore.hp / this.mainCore.maxHp;
    objective.children[0].textContent = `♥ ${Math.ceil(this.mainCore.hp)}/${this.mainCore.maxHp} · ` + (this.pendingUpgrade
      ? "◇ PREP"
      : this.waveActive
      ? `⚔ ${this.wave}${this.wave % 5 === 0 ? " · ★" : ""}`
      : !this.isSandbox && !this.hasPlacedFirstMiner
      ? "⛏ PLACE MINER"
      : `${({ frontier: "FRONTIER", shattered: "SHATTERED", rich: "RICH", ion: "ION" })[this.scenario] || "FRONTIER"}${this.isSandbox ? " · LAUNCH" : ""}`);
    objective.children[0].style.color = coreRatio < .3 ? "#ff958d" : coreRatio < .6 ? "#e7c47e" : "#a6bdc3";
    const panKeys = ["panUp", "panLeft", "panDown", "panRight"].map((action) => this.formatKeybind(action)).join("/");
    const pauseKey = this.formatKeybind("pause");
    objective.children[1].innerHTML = this.moveCommandMode
      ? `<kbd>${this.formatKeybind("moveCommand")}</kbd> ➜ CLICK · <kbd>${pauseKey}</kbd> Ⅱ`
      : `<kbd>${panKeys}</kbd> PAN · <kbd>${this.formatKeybind("cycleUnit")}</kbd> ⇄ · <kbd>${this.formatKeybind("moveCommand")}</kbd> ➜ · <kbd>${pauseKey}</kbd> Ⅱ`;
    objective.children[1].title = this.moveCommandMode ? `Click a destination · ${pauseKey} pauses` : "Pan · steer · cycle unit · move squad · pause";
    const progress = this.pendingUpgrade ? 100 : !this.isSandbox && !this.hasPlacedFirstMiner ? 0 : this.waveActive
      ? Math.max(0, Math.min(100, 100 * (1 - this.enemies.length / Math.max(1, this.enemiesAtWaveStart))))
      : (this.isSandbox ? 0 : 100 * (1 - this.waveTimer / this.getWaveInterval(this.wave)));
    document.getElementById("waveProgress").style.width = `${progress}%`;

    const selTitle = document.getElementById("selectedTitle");
    const info = document.getElementById("infoText");
    const assignBtn = document.getElementById("assignBlueprintBtn");
    const moveBtn = document.getElementById("moveCommandBtn");
    moveBtn.style.display = this.selectedUnits.length > 0 ? "inline-grid" : "none";
    moveBtn.classList.toggle("active", this.moveCommandMode);
    moveBtn.title = this.moveCommandMode ? "Tap a destination or cancel move" : "Move selected units";
    moveBtn.setAttribute("aria-label", this.moveCommandMode ? "Choose a move destination" : "Move selected units");

    if (this.selectedStructure) {
      const structure = this.selectedStructure;
      selTitle.textContent = structure.type === "MiniCore" ? `${structure.resourceType} ⛏` : structure.type === "MainCore" ? "Core" : structure.type;
      assignBtn.disabled = structure.type === "MiniCore" || structure.type === "MainCore" || structure.type === "Turret";
      assignBtn.style.display = assignBtn.disabled ? "none" : "inline-block";
      if (structure.type === "MiniCore") {
        const output = structure.resourceRate * this.getResourceRateMultiplier(structure.x, structure.y);
        info.textContent = `⛏ ${structure.resourceType.toUpperCase()}  +${output.toFixed(1)}/s\n♥ ${Math.floor(structure.hp)}/${Math.floor(structure.maxHp)}`;
      } else if (structure.type === "MainCore") {
        info.textContent = `⌖ RELAY\n♥ ${Math.floor(this.mainCore.hp)}/${Math.floor(this.mainCore.maxHp)} · HOLD`;
      } else if (structure.type === "Turret") {
        const stats = computeStatsFromGrid(structure.blueprint, structure.modules);
        info.textContent = `✣ AUTO · ♥ ${Math.floor(structure.hp)}/${Math.floor(structure.maxHp)}\n⚔ ${stats.damage.toFixed(0)} · ◎ ${structure.range.toFixed(0)}\n↘ ${structure.shotCostCopper} Cu/shot`;
      } else {
        const stats = computeStatsFromGrid(structure.blueprint.grid, structure.blueprint.modules);
        const duration = 4.5 + stats.cellCount * 1.6;
        const cost = this.getProductionCost(structure.blueprint.grid, structure.blueprint.modules);
        const state = structure.running ? `↻ ${Math.round(structure.productionProgress / duration * 100)}%` : structure.batchPaid ? "◷ QUEUED" : "Ⅱ IDLE";
        info.textContent = `♥ ${Math.floor(structure.hp)}/${Math.floor(structure.maxHp)} · ${state}\n▦ ${stats.cellCount} · ⚔ ${stats.damage.toFixed(0)} · ◎ ${stats.range.toFixed(0)}\n◇ ${Object.entries(structure.modules || {}).filter(([, type]) => type).length} · ◉ ${cost.copper} · ⬟ ${cost.coal} · ◆ ${cost.gold}`;
      }
    } else if (this.selectedNode) {
      const node = this.selectedNode;
      const icon = node.type === "copper" ? "◉" : node.type === "coal" ? "⬟" : "◆";
      const baseRate = ({ copper: 2.4, coal: 2.0, gold: 1.3 })[node.type] || 1;
      const output = baseRate * this.getResourceRateMultiplier(node.x, node.y);
      selTitle.textContent = `${node.type.toUpperCase()} DEPOSIT`;
      assignBtn.disabled = true;
      assignBtn.style.display = "none";
      info.textContent = `${icon} RESOURCE NODE\n⛏ +${output.toFixed(1)}/s PER MINER\n${node.occupied ? "● OCCUPIED" : "○ AVAILABLE"}`;
    } else if (this.selectedUnit) {
      const unit = this.selectedUnit;
      const stats = unit.stats;
      selTitle.textContent = unit.type === "vehicle" ? "Vehicle" : "Drone";
      assignBtn.disabled = true;
      assignBtn.style.display = "none";
      info.textContent = `${unit.controlled ? "⌖ DIRECT" : "◇ SQUAD"}\n♥ ${Math.floor(unit.hp)}/${Math.floor(unit.maxHp)} · ⛨ ${unit.armor.toFixed(0)}\n⚔ ${stats.damage.toFixed(0)} · ◎ ${stats.range.toFixed(0)} · ➤ ${unit.speed.toFixed(0)}\n▣ ${this.selectedUnits.length}`;
    } else {
      selTitle.textContent = "—";
      info.textContent = "⌖ Select unit / structure";
      assignBtn.disabled = true;
      assignBtn.style.display = "none";
    }
    info.title = "♥ health · ⛨ armor · ⚔ damage · ◎ range · ➤ speed · ↻ production";

    const shapeStats = computeStatsFromGrid(this.designGrid, this.designModules);
    document.getElementById("shapeMeta").textContent = `${this.designGridSize}×${this.designGridSize} · ▦${shapeStats.cellCount}\n♥${shapeStats.hp} · ⛨${shapeStats.armor.toFixed(1)}\n⚔${shapeStats.damage.toFixed(0)} · ◎${shapeStats.range.toFixed(0)}\n➤${shapeStats.speedMultiplier.toFixed(2)}× · ↻${shapeStats.cooldownMultiplier.toFixed(2)}×`;
    document.getElementById("shapeMeta").title = "Grid · cells · health · armor · damage · range · speed · cooldown";
    const upgradeBtn = document.getElementById("upgradeGridBtn");
    const upgradeCost = this.getGridUpgradeCost();
    const requiredWave = this.getGridUnlockWave();
    upgradeBtn.textContent = this.designGridSize >= MAX_BLUEPRINT_GRID ? "MAX" : this.wave < requiredWave ? `🔒 W${requiredWave}` : this.resources.gold < upgradeCost ? `◆${upgradeCost}` : `▦ ${this.designGridSize + 1}×${this.designGridSize + 1}`;
    upgradeBtn.title = this.designGridSize >= MAX_BLUEPRINT_GRID ? "Maximum workshop size reached" : `Costs ${upgradeCost} gold; unlocked at Wave ${requiredWave}`;
    upgradeBtn.disabled = this.designGridSize >= MAX_BLUEPRINT_GRID || this.wave < requiredWave || this.resources.gold < upgradeCost;
  }

  recordDesignHistory() {
    this.designHistory.push({ size: this.designGridSize, grid: cloneGrid(this.designGrid), modules: cloneModules(this.designModules) });
    if (this.designHistory.length > 30) this.designHistory.shift();
  }

  undoDesign() {
    const previous = this.designHistory.pop();
    if (!previous) {
      this.notify("↶ Nothing to undo");
      return;
    }
    this.designGridSize = previous.size;
    this.designGrid = cloneGrid(previous.grid);
    this.designModules = cloneModules(previous.modules);
    this.drawShapeEditor();
    this.notify("↶ Undone");
  }

  mirrorDesign() {
    const next = cloneGrid(this.designGrid);
    for (let y = 0; y < this.designGridSize; y++) {
      for (let x = 0; x < Math.floor(this.designGridSize / 2); x++) {
        next[y][this.designGridSize - 1 - x] = this.designGrid[y][x];
      }
    }
    if (!isConnected(next)) {
      this.notify("⚠ Mirror needs a centerline");
      return;
    }
    this.recordDesignHistory();
    this.designGrid = next;
    this.drawShapeEditor();
    this.notify("↔ Mirrored");
  }

  mountDesignModule() {
    const side = document.getElementById("moduleSideSelect").value;
    const type = document.getElementById("moduleTypeSelect").value;
    const nextType = SOCKET_MODULES.includes(type) ? type : null;
    if (this.designModules[side] === nextType) return;
    this.recordDesignHistory();
    this.designModules[side] = nextType;
    this.drawShapeEditor();
    this.notify(nextType ? `＋ ${nextType} · ${side}` : `× ${side} socket`);
  }

  getBlueprintLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.blueprintStorageKey) || "[]");
      return Array.isArray(stored) ? stored.filter((item) => item && typeof item.name === "string" && Array.isArray(item.grid)) : [];
    } catch {
      return [];
    }
  }

  renderBlueprintLibrary() {
    const select = document.getElementById("blueprintLibrary");
    if (!select) return;
    const entries = this.getBlueprintLibrary();
    select.replaceChildren(new Option("Saved blueprints", ""));
    for (const entry of entries) {
      const option = new Option(entry.name, entry.id);
      select.add(option);
    }
  }

  setBlueprintMessage(message) {
    document.getElementById("blueprintMessage").textContent = message;
  }

  saveBlueprint() {
    const nameInput = document.getElementById("blueprintName");
    const name = nameInput.value.trim() || `Blueprint ${this.getBlueprintLibrary().length + 1}`;
    const entries = this.getBlueprintLibrary();
    entries.push({
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      name: name.slice(0, 24),
      size: this.designGridSize,
      grid: cloneGrid(this.designGrid),
      modules: cloneModules(this.designModules)
    });
    try {
      localStorage.setItem(this.blueprintStorageKey, JSON.stringify(entries.slice(-20)));
      this.renderBlueprintLibrary();
      document.getElementById("blueprintName").value = "";
      this.setBlueprintMessage(`Saved “${name.slice(0, 24)}”.`);
    } catch {
      this.setBlueprintMessage("Could not save. Browser storage may be full.");
    }
  }

  loadBlueprint() {
    const id = document.getElementById("blueprintLibrary").value;
    const entry = this.getBlueprintLibrary().find((item) => item.id === id);
    if (!entry) {
      this.setBlueprintMessage("Choose a saved blueprint first.");
      return;
    }
    if (!this.isValidBlueprint(entry)) {
      this.setBlueprintMessage("That saved blueprint is invalid.");
      return;
    }
    this.recordDesignHistory();
    this.designGridSize = entry.size;
    this.designGrid = cloneGrid(entry.grid);
    this.designModules = cloneModules(entry.modules);
    this.drawShapeEditor();
    this.setBlueprintMessage(`Loaded “${entry.name}”.`);
  }

  isValidBlueprint(data) {
    const size = data?.size;
    if (!Number.isInteger(size) || size < 3 || size > MAX_BLUEPRINT_GRID) return false;
    if (!Array.isArray(data.grid) || data.grid.length !== size) return false;
    if (data.grid.some((row) => !Array.isArray(row) || row.length !== size || row.some((cell) => !Number.isInteger(cell) || cell < 0 || cell > 4))) return false;
    return isConnected(data.grid);
  }

  async exportBlueprintCode() {
    const payload = { v: 1, size: this.designGridSize, grid: this.designGrid, modules: this.designModules };
    const code = btoa(JSON.stringify(payload));
    const field = document.getElementById("blueprintCode");
    field.value = code;
    field.focus();
    field.select();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        this.setBlueprintMessage("Blueprint code copied to clipboard.");
      } else {
        this.setBlueprintMessage("Code selected. Copy it to share this blueprint.");
      }
    } catch {
      this.setBlueprintMessage("Code selected. Copy it to share this blueprint.");
    }
  }

  importBlueprintCode() {
    const code = document.getElementById("blueprintCode").value.trim();
    try {
      const payload = JSON.parse(atob(code));
      if (payload.v !== 1 || !this.isValidBlueprint(payload)) throw new Error("Invalid blueprint");
      this.recordDesignHistory();
      this.designGridSize = payload.size;
      this.designGrid = cloneGrid(payload.grid);
      this.designModules = cloneModules(payload.modules);
      this.drawShapeEditor();
      this.setBlueprintMessage("Blueprint imported. Save it to keep it in your library.");
    } catch {
      this.setBlueprintMessage("That code could not be read as a valid blueprint.");
    }
  }

  renderScenarioDescription() {
    const scenario = document.getElementById("scenarioSelect")?.value || this.scenario || "frontier";
    const description = document.getElementById("scenarioDescription");
    if (description) description.textContent = SCENARIOS[scenario] || SCENARIOS.frontier;
  }

  getGridUnlockWave() {
    return this.designGridSize;
  }

  getGridUpgradeCost() {
    return 70 + (this.designGridSize - 3) * 65;
  }

  beginIntermission() {
    this.pendingUpgrade = true;
    this.upgradeChosen = false;
    this.selectedUpgrade = null;
    this.nextDoctrine = "balanced";
    this.activeContract = "none";
    const pool = Object.keys(UPGRADE_CARDS);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.upgradeChoices = pool.slice(0, 3);
    document.getElementById("doctrineSelect").value = "balanced";
    document.getElementById("contractSelect").value = "none";
    this.renderUpgradeChoices();
    this.renderWaveRecap();
    document.getElementById("intermissionPanel").style.display = "block";
    this.syncSandboxUi();
  }

  renderWaveRecap() {
    const recap = this.lastWaveRecap;
    const panel = document.getElementById("waveRecap");
    panel.hidden = !recap;
    if (!recap) return;
    document.getElementById("recapHeading").textContent = `✓ W${recap.wave} CLEARED`;
    document.getElementById("recapEnemies").textContent = String(recap.enemiesDefeated);
    document.getElementById("recapCoreDamage").textContent = String(recap.coreDamage);
    document.getElementById("recapUnitLosses").textContent = String(recap.unitLosses);
    document.getElementById("recapStructureLosses").textContent = String(recap.structureLosses);
    const rewards = recap.rewards || {};
    document.getElementById("recapRewards").textContent = `LOOT  +${rewards.copper || 0}◉  +${rewards.coal || 0}⬟  +${rewards.gold || 0}◆`;
    const contract = document.getElementById("recapContract");
    contract.textContent = recap.contractOutcome || "";
    contract.hidden = !recap.contractOutcome;
  }

  renderUpgradeChoices() {
    const container = document.getElementById("upgradeChoices");
    container.innerHTML = this.upgradeChoices.map((id) => {
      const card = UPGRADE_CARDS[id];
      const level = this.upgradeLevels[id] || 0;
      const selected = this.selectedUpgrade === id;
      const disabled = this.upgradeChosen && !selected;
      return `<button class="${selected ? "active" : ""}" data-upgrade="${id}" title="${card.title}: ${card.description}" aria-label="${card.title}: ${card.description}" ${disabled ? "disabled" : ""}><i class="upgrade-symbol" aria-hidden="true">${card.icon}</i><strong>${card.title}${level ? ` · ${level + 1}` : ""}</strong><span>${card.description}</span></button>`;
    }).join("");
    document.getElementById("deployWaveBtn").disabled = !this.upgradeChosen;
    document.getElementById("deployWaveBtn").textContent = this.upgradeChosen ? `▶ ${this.wave}` : "Select upgrade";
  }

  chooseUpgrade(id) {
    if (!this.pendingUpgrade || this.upgradeChosen || !this.upgradeChoices.includes(id)) return;
    this.upgradeLevels[id] = (this.upgradeLevels[id] || 0) + 1;
    if (id === "plating") {
      this.mainCore.maxHp += 120;
      this.mainCore.hp = Math.min(this.mainCore.maxHp, this.mainCore.hp + 120);
    }
    this.upgradeChosen = true;
    this.selectedUpgrade = id;
    this.renderUpgradeChoices();
    this.notify(`⬆ ${UPGRADE_CARDS[id].title}`);
  }

  deployNextWave() {
    if (!this.pendingUpgrade || !this.upgradeChosen) return;
    this.pendingUpgrade = false;
    this.nextDoctrine = document.getElementById("doctrineSelect").value;
    this.activeContract = document.getElementById("contractSelect").value;
    this.contractBaseline = null;
    document.getElementById("intermissionPanel").style.display = "none";
    this.waveTimer = this.isSandbox ? 0 : this.getWaveInterval(this.wave);
    this.syncSandboxUi();
    if (!this.isSandbox) this.notify(`⚔ W${this.wave} · ${this.nextDoctrine}`);
  }

  spawnTestTargets() {
    if (!this.isSandbox) return;
    const center = this.selectedUnit || this.selectedStructure || this.mainCore;
    const radius = 115;
    this.testTargets = [
      new TargetDummy(center.x, center.y - radius),
      new TargetDummy(center.x + radius, center.y),
      new TargetDummy(center.x, center.y + radius),
      new TargetDummy(center.x - radius, center.y)
    ];
    this.notify("◎ 4 targets deployed");
  }

  drawShapeEditor() {
    const canvas = document.getElementById("shapeCanvas");
    const ctx = canvas.getContext("2d");
    const n = this.designGridSize;
    const pad = 22;
    const gridPx = canvas.width - pad * 2;
    const cw = gridPx / n;
    const ch = gridPx / n;
    const roleColors = { 1: ["#173d40", "#6ce0ba"], 2: ["#50392f", "#ff9b79"], 3: ["#173b48", "#74d9f4"], 4: ["#382e4b", "#c29af2"] };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#081820";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (this.designGrid[y][x]) {
          const [fill, edge] = roleColors[this.designGrid[y][x]] || roleColors[1];
          ctx.fillStyle = fill;
          ctx.fillRect(pad + x * cw + 2, pad + y * ch + 2, cw - 4, ch - 4);
          ctx.strokeStyle = edge;
          ctx.lineWidth = 2;
          ctx.strokeRect(pad + x * cw + 4, pad + y * ch + 4, cw - 8, ch - 8);
          ctx.fillStyle = edge;
          ctx.fillRect(pad + x * cw + cw * .4, pad + y * ch + ch * .4, cw * .2, ch * .2);
        } else {
          ctx.fillStyle = "#10262d";
          ctx.fillRect(pad + x * cw + 2, pad + y * ch + 2, cw - 4, ch - 4);
        }
      }
    }

    ctx.strokeStyle = "rgba(130, 183, 188, .2)";
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(pad + i * cw, pad);
      ctx.lineTo(pad + i * cw, canvas.height - pad);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, pad + i * ch);
      ctx.lineTo(canvas.width - pad, pad + i * ch);
      ctx.stroke();
    }

    const socketInfo = {
      N: [canvas.width / 2, 10], E: [canvas.width - 10, canvas.height / 2],
      S: [canvas.width / 2, canvas.height - 10], W: [10, canvas.height / 2]
    };
    const socketColors = { weapon: "#ff9475", shield: "#78e2c1", support: "#81d9f5" };
    for (const [side, [sx, sy]] of Object.entries(socketInfo)) {
      const module = this.designModules[side];
      ctx.fillStyle = module ? socketColors[module] : "#152b33";
      ctx.strokeStyle = module ? "#e7f7f1" : "#668089";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#d8e7e9";
      ctx.font = "7px 'DM Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(module ? module[0].toUpperCase() : side, sx, sy + 2.5);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.renderGrid(ctx);
    this.renderTerrainFeatures(ctx);
    this.renderNodes(ctx);

    this.mainCore.render(ctx);
    for (const s of this.structures) s.render(ctx);
    for (const t of this.turrets) t.render(ctx);
    for (const u of this.units) u.render(ctx);
    for (const e of this.enemies) e.render(ctx);
    for (const target of this.testTargets) target.render(ctx);
    for (const p of this.projectiles) p.render(ctx);
    for (const e of this.enemies) e.renderBossWarning(ctx, this.settings.reducedMotion);
    this.renderTutorialWorldGlow(ctx);

    if (this.selectedStructure) {
      const s = this.selectedStructure;
      const radius = s.type === "MainCore" ? 34 : s.type === "MiniCore" ? 25 : 22;
      ctx.save();
      ctx.strokeStyle = "rgba(116,217,244,.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (s.type === "MiniCore") {
        ctx.strokeStyle = "rgba(108,224,186,.18)";
        ctx.beginPath(); ctx.arc(s.x, s.y, 74, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    if (this.selectedUnits.length > 0) {
      for (const u of this.selectedUnits) {
        ctx.strokeStyle = u.controlled ? "#92f4ff" : "rgba(108,224,186,.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        if (u.commandTarget) {
          ctx.strokeStyle = "rgba(116,217,244,.32)";
          ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.commandTarget.x, u.commandTarget.y); ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = "#74d9f4";
          ctx.beginPath(); ctx.arc(u.commandTarget.x, u.commandTarget.y, 5, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    if (this.buildMode) {
      const gx = Math.floor(this.mouse.worldX / TILE_SIZE);
      const gy = Math.floor(this.mouse.worldY / TILE_SIZE);
      const px = gx * TILE_SIZE + TILE_SIZE / 2;
      const py = gy * TILE_SIZE + TILE_SIZE / 2;
      const cost = this.getBuildCost(this.buildMode);
      const affordable = this.canAfford(cost);
      const underCap = this.structures.length < MAX_STRUCTURES;
      const node = this.buildMode === "MiniCore" ? this.findNodeNear(px, py, MINER_SNAP_RADIUS) : null;
      const valid = this.buildMode === "MiniCore"
        ? !!node && !node.occupied && affordable && underCap
        : affordable && underCap && !this.isBlockedPlacement(px, py, 24);
      const tint = valid ? "#6ce0ba" : "#ff847c";
      ctx.fillStyle = valid ? "rgba(108,224,186,.12)" : "rgba(255,132,124,.12)";
      ctx.fillRect(px - 16, py - 16, 32, 32);
      ctx.strokeStyle = tint;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - 16, py - 16, 32, 32);
      ctx.fillStyle = tint;
      ctx.font = "10px 'DM Mono', monospace";
      ctx.textAlign = "center";
      const placementLabel = this.buildMode === "MiniCore"
        ? valid ? "PLACE HERE" : !underCap ? "STRUCTURE CAP" : !affordable ? "NEED RESOURCES" : node?.occupied ? "OCCUPIED" : "NEED DEPOSIT"
        : valid ? "READY" : !underCap ? "STRUCTURE CAP" : !affordable ? "NEED RESOURCES" : "BLOCKED";
      ctx.fillText(placementLabel, px, py + 31);
    }

    ctx.restore();

    if (this.leftMouseDown && this.dragSelecting) {
      const x = Math.min(this.dragStart.x, this.dragCurrent.x);
      const y = Math.min(this.dragStart.y, this.dragCurrent.y);
      const w = Math.abs(this.dragCurrent.x - this.dragStart.x);
      const h = Math.abs(this.dragCurrent.y - this.dragStart.y);
      ctx.fillStyle = "rgba(108, 224, 186, 0.1)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#6ce0ba";
      ctx.strokeRect(x, y, w, h);
    }

    if (this.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#ff9b91";
      ctx.font = "800 38px Manrope, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CORE DESTROYED", this.canvas.width / 2, this.canvas.height / 2 - 12);
      ctx.fillStyle = "#d2e4e5";
      ctx.font = "13px 'DM Mono', monospace";
      ctx.fillText("Waves Survived: " + (this.wave - 1), this.canvas.width / 2, this.canvas.height / 2 + 24);
    }
  }

  renderGrid(ctx) {
    const startX = Math.floor(this.camera.x / TILE_SIZE) * TILE_SIZE;
    const endX = this.camera.x + this.canvas.width / this.camera.zoom + TILE_SIZE;
    const startY = Math.floor(this.camera.y / TILE_SIZE) * TILE_SIZE;
    const endY = this.camera.y + this.canvas.height / this.camera.zoom + TILE_SIZE;

    ctx.fillStyle = "#0b1c21";
    ctx.fillRect(startX, startY, endX - startX, endY - startY);

    const major = TILE_SIZE * 4;
    const majorX = Math.floor(startX / major) * major;
    const majorY = Math.floor(startY / major) * major;
    ctx.fillStyle = "rgba(104, 168, 159, .035)";
    for (let y = majorY; y < endY; y += major) {
      for (let x = majorX; x < endX; x += major) {
        if ((Math.floor(x / major) + Math.floor(y / major)) % 2 === 0) ctx.fillRect(x, y, major, major);
      }
    }

    ctx.strokeStyle = "rgba(134, 182, 182, .075)";
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

    ctx.strokeStyle = "rgba(116,217,244,.11)";
    ctx.lineWidth = 1.5;
    for (let x = majorX; x <= endX; x += major) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = majorY; y <= endY; y += major) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    ctx.strokeStyle = "rgba(116,217,244,.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, WORLD_W * TILE_SIZE - 2, WORLD_H * TILE_SIZE - 2);
  }

  renderNodes(ctx) {
    for (const n of this.resourceNodes) {
      const color = n.type === "coal" ? "#a4b7bd" : n.type === "copper" ? "#df9363" : "#e9c66f";
      ctx.save();
      if (this.buildMode === "MiniCore" && !n.occupied) {
        const snapX = Math.floor(n.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const snapY = Math.floor(n.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        ctx.fillStyle = "rgba(108,224,186,.055)";
        ctx.strokeStyle = "rgba(108,224,186,.58)";
        ctx.setLineDash([4, 4]);
        ctx.fillRect(snapX - TILE_SIZE / 2, snapY - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(snapX - TILE_SIZE / 2, snapY - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        ctx.setLineDash([]);
      }
      ctx.shadowColor = color;
      ctx.shadowBlur = n.occupied ? 14 : 8;
      ctx.fillStyle = n.occupied ? "#15313a" : "#14272e";
      ctx.beginPath();
      ctx.arc(n.x, n.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = n.occupied ? "#6ce0ba" : color;
      ctx.lineWidth = n.occupied ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.occupied ? 18 : 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      if (n.type === "coal") {
        ctx.moveTo(n.x, n.y - 7); ctx.lineTo(n.x + 6, n.y - 2); ctx.lineTo(n.x + 4, n.y + 6); ctx.lineTo(n.x - 5, n.y + 5); ctx.lineTo(n.x - 7, n.y - 2); ctx.closePath();
      } else {
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = "rgba(197,220,219,.58)";
      ctx.font = "8px 'DM Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(n.type.toUpperCase(), n.x, n.y + 28);
      const hovered = !this.buildMode && this.mouse.pointerType !== "touch" && this.findNodeNear(this.mouse.worldX, this.mouse.worldY, 20) === n;
      if (hovered) {
        const baseRate = ({ copper: 2.4, coal: 2.0, gold: 1.3 })[n.type] || 1;
        const rate = (baseRate * this.getResourceRateMultiplier(n.x, n.y)).toFixed(1);
        const detail = `+${rate}/s · ${n.occupied ? "OCCUPIED" : "FREE"}`;
        ctx.font = "9px 'DM Mono', monospace";
        const width = ctx.measureText(detail).width + 12;
        ctx.fillStyle = "rgba(5,15,21,.94)";
        ctx.fillRect(n.x - width / 2, n.y + 33, width, 17);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(n.x - width / 2, n.y + 33, width, 17);
        ctx.fillStyle = "#dff5f2";
        ctx.fillText(detail, n.x, n.y + 45);
      }
      ctx.restore();
    }
  }

  resize() {
    const zoom = this.camera.zoom || 1;
    const centerX = this.camera.x + this.canvas.width / (2 * zoom);
    const centerY = this.camera.y + this.canvas.height / (2 * zoom);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.x = centerX - this.canvas.width / (2 * zoom);
    this.camera.y = centerY - this.canvas.height / (2 * zoom);
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

function computeStatsFromGrid(grid, modules = emptyModules()) {
  const n = grid.length;
  let cellCount = 0;
  let perimeter = 0;
  let edgeCells = 0;
  let armorCells = 0;
  let weaponCells = 0;
  let sensorCells = 0;
  let engineCells = 0;
  let minX = n;
  let minY = n;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!grid[y][x]) continue;
      cellCount++;
      if (grid[y][x] === 1) armorCells++;
      if (grid[y][x] === 2) weaponCells++;
      if (grid[y][x] === 3) sensorCells++;
      if (grid[y][x] === 4) engineCells++;
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
  const safeModules = cloneModules(modules);
  const moduleCount = Object.values(safeModules).filter(Boolean).length;
  const weaponModules = Object.values(safeModules).filter((module) => module === "weapon").length;
  const shieldModules = Object.values(safeModules).filter((module) => module === "shield").length;
  const supportModules = Object.values(safeModules).filter((module) => module === "support").length;

  return {
    cellCount,
    perimeter,
    edgeCells,
    bbox,
    armorCells,
    weaponCells,
    sensorCells,
    engineCells,
    moduleCount,
    weaponModules,
    shieldModules,
    supportModules,
    hp: cellCount * 8 + armorCells * 12 + shieldModules * 34,
    armor: armorCells * .2 + shieldModules * 3,
    damage: edgeCells * 1.7 + weaponCells * 3 + weaponModules * 6,
    speedMultiplier: 1 + engineCells * .07 + supportModules * .04,
    cooldownMultiplier: Math.max(.58, 1 - weaponCells * .025 - weaponModules * .08),
    costCopper: perimeter * 2 + weaponCells * 4 + sensorCells * 2 + engineCells * 3,
    costGold: cellCount / 2 + sensorCells * .35 + supportModules,
    buildTime: cellCount * .5 + moduleCount * 1.3,
    range: baseRange + bbox * 10 + sensorCells * 12 + supportModules * 14
  };
}

function defaultBlueprint() {
  return { grid: starterDesignGrid(3), modules: emptyModules() };
}

function emptyModules() {
  return { N: null, E: null, S: null, W: null };
}

function cloneModules(modules) {
  const safe = emptyModules();
  if (!modules) return safe;
  for (const side of Object.keys(safe)) {
    if (SOCKET_MODULES.includes(modules[side])) safe[side] = modules[side];
  }
  return safe;
}

function starterDesignGrid(n) {
  const grid = createGrid(n, 0);
  const mid = Math.floor(n / 2);
  grid[mid][mid] = 1;
  if (mid > 0) grid[mid - 1][mid] = 1;
  if (mid < n - 1) grid[mid + 1][mid] = 1;
  if (mid > 0) grid[mid][mid - 1] = 1;
  if (mid < n - 1) grid[mid][mid + 1] = 1;
  return grid;
}

function drawGridShape(ctx, grid, cellPx, scale, modules = emptyModules()) {
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
  const baseColor = ctx.fillStyle;
  const roleColors = { 2: "#ef9b7e", 3: "#83e4f4", 4: "#c19af0" };

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!grid[y][x]) continue;
      const px = ox + (x - minX) * cellPx * scale;
      const py = oy + (y - minY) * cellPx * scale;
      ctx.fillStyle = roleColors[grid[y][x]] || baseColor;
      ctx.fillRect(px, py, cellPx * scale - 1, cellPx * scale - 1);
    }
  }
  ctx.fillStyle = baseColor;
  const moduleColors = { weapon: "#ff9475", shield: "#78e2c1", support: "#81d9f5" };
  const safeModules = cloneModules(modules);
  const sockets = {
    N: [0, oy - 5],
    E: [ox + w + 1, 0],
    S: [0, oy + h + 1],
    W: [ox - 5, 0]
  };
  for (const [side, type] of Object.entries(safeModules)) {
    if (!type) continue;
    const [mx, my] = sockets[side];
    ctx.fillStyle = moduleColors[type];
    ctx.fillRect(mx - 3, my - 3, 6, 6);
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.strokeRect(mx - 3, my - 3, 6, 6);
  }
}

function strokeGridShape(ctx, grid, cellPx, scale) {
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
      ctx.strokeRect(px + .5, py + .5, cellPx * scale - 2, cellPx * scale - 2);
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

function clampZoom(zoom) {
  const value = Number.isFinite(zoom) ? zoom : 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

new Game(document.getElementById("gameCanvas"));
