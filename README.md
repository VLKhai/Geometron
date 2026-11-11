# GEOMETRON: Frontier Protocol

**Design machines. Build an outpost. Hold the Core against escalating attacks.**

Geometron is a single-player, browser-based strategy and defense game. Gather three resources, build automatic production, and design the shape and equipment of the drones, vehicles, and turrets your factories create. Waves continue to grow in difficulty, with a major boss assault every fifth wave.

## Start playing

Keep these game files together in one folder:

- `index.html` — game screen and interface
- `main.js` — game logic
- `geometron.png` — background and visual asset

Open `index.html` in a modern browser to play. No installer, build step, or server is required. The interface uses Google Fonts when available and falls back to system fonts when offline.

For a hosted version, upload the files to the root of a static site. Keep `index.html`, `main.js`, and `geometron.png` side by side. Progress is saved in the current browser, so it does not automatically sync between devices or browser profiles.

## Your objective

Protect the **Core** and survive as many waves as possible. The Core starts with 1,000 HP in most expeditions. If its HP reaches zero, the run ends.

The first assault countdown begins only after you place your first Miner. That gives you time to establish resource income and defenses. After a wave is cleared, review the recap, choose an upgrade, set the next wave's doctrine and optional contract, then deploy.

## Game modes and expeditions

The main menu offers four expeditions, a guided tutorial, a Field Guide glossary, and a freeform Sandbox. The Field Guide is also available from the pause menu and explains gameplay terms such as doctrines, contracts, deposits, and Blueprints.

| Mode | What changes |
| --- | --- |
| **Frontier** | Balanced starting resources, terrain, and enemy strength. |
| **Shattered** | The Core starts at 720 HP. Wave rewards are 35% higher, and the map has extra hazardous terrain. |
| **Rich Expanse** | Starts with more resources and has extra deposits and resource springs. Enemies have more HP. |
| **Ion Crown** | Adds several damaging Ion Fields. Plan routes and building locations around the hazards. |
| **Guide** | A step-by-step tutorial introduces mining, construction, blueprint design, unit selection, and squad orders. Important game terms are highlighted in yellow, the exact build icon is repeated in the instruction, and a glowing outline points to the relevant control or map object. It can be replayed from the menu. |
| **Sandbox** | Start with infinite resources and a protected Core. Launch waves when ready, spawn target dummies, and toggle the sandbox assists. |

The world is a 64 × 64 tile map. Use the camera controls to scout deposits and terrain around the Core.

## Resources and deposits

Three resources pay for buildings and machine production:

| Symbol | Resource | Main uses |
| --- | --- | --- |
| ◉ | Copper | Buildings, production, and turret shots |
| ⬟ | Coal | Production and production speed |
| ◆ | Gold | Buildings, machine designs, and grid expansion |

Place a Miner on a highlighted deposit tile. It produces its deposit's resource automatically:

| Deposit | Base output per second |
| --- | ---: |
| Copper | 2.4 |
| Coal | 2.0 |
| Gold | 1.3 |

Resource Springs increase Miner output in their radius by 35%. Each Survey upgrade adds another 15% mining output. Select a deposit or hover over one with a mouse to see its expected output and whether a Miner already occupies it.

Frontier, Shattered, and Ion Crown start with 240 copper, 90 coal, and 140 gold. Rich Expanse starts with 340 copper, 125 coal, and 205 gold.

## Buildings

Choose a building icon, then click or tap a valid map location. The Miner must be placed on a deposit. Other buildings use open ground. The game allows up to 20 structures.

| Building | Cost | Function |
| --- | --- | --- |
| **Miner** | 50 ◉, 20 ◆ | Produces the resource at its deposit. |
| **Assembler** | 40 ◉, 10 ⬟, 8 ◆ | Produces drones using the current blueprint. |
| **Turret Foundry** | 60 ◉, 8 ⬟, 18 ◆ | Produces stationary automatic turrets using the current blueprint. Each turret shot costs 1 copper. |
| **Vehicle Bay** | 80 ◉, 20 ⬟, 28 ◆ | Produces durable, hard-hitting vehicles using the current blueprint. Vehicles move more slowly than drones. |

Factory output consumes a resource cost based on the blueprint's cells and modules. Coal reserves and Fabrication upgrades increase production speed. Select an existing factory and press **⇪** to apply the current Workshop design to it. New factories use the current design automatically.

Right-click a unit or structure to scrap it. Buildings return some of their original materials; removed units and turrets do not provide a refund.

## Units and combat

Drones and vehicles automatically seek nearby enemies and attack within their weapon range. Select one to control it directly with the arrow keys. A selected squad can receive a destination order; after reaching it, units return to automatic combat.

The total unit and turret limit is 100. Enemy groups approach from the edges of the map and target the Core, Miners, factories, defenses, and units.

| Enemy | Base HP | Behavior |
| --- | ---: | --- |
| Fast | 35 | Moves quickly and has low HP. |
| Standard | 70 | Balanced movement and durability. |
| Tank | 130 | Slow, durable, and deals heavier damage. |
| Boss | 520 | Appears every fifth wave and grows stronger in later cycles. |

Bosses charge a **Slam** for 1.15 seconds. A red circle marks the blast area, a countdown appears in the wave display, and the Slam damages allied entities inside the marked zone. Move units out of the circle before impact.

Ion Fields drain HP from anything caught inside them. Ruins block construction. Resource Springs increase mining output.

## Waves, upgrades, and contracts

The first wave starts 38 seconds after the first Miner is placed. Later waves have a preparation countdown that gradually shortens, down to 24 seconds. In Sandbox, waves can be launched manually.

Each wave adds enemies as the expedition progresses, up to 32 regular enemies; a boss joins every fifth wave. Clearing a wave grants copper, coal, and gold. The recap reports enemies defeated, Core damage, unit and structure losses, and the wave's resource reward.

Between waves, choose one of three randomly offered upgrades:

| Upgrade | Effect per level |
| --- | --- |
| **Plating** | +120 maximum Core HP |
| **Fabrication** | +12% factory production speed |
| **Survey** | +15% Miner output |
| **Overclock** | +10% weapon damage |

Also choose a doctrine for the next wave:

- **Balanced** — standard enemy mix.
- **Swarm** — adds five enemies and favors fast enemies.
- **Armor** — reduces the group by two (minimum four), favors tanks, and gives enemies 35% more HP.

An optional contract can earn a bonus of 70 copper and 25 gold if completed:

- **Untouched Core** — finish without Core damage.
- **Protect Miners** — keep all Miners alive.
- **Lean Defense** — finish with no more turrets than you had when the wave began.

## Design your blueprint

The **Workshop** lets you create the machine shape factories will build. The starter grid is 3 × 3. Click a cell to add or remove the selected cell type. Filled cells must stay connected by their sides, and a design must contain at least one cell.

| Cell type | Main effect |
| --- | --- |
| ⛨ Armor | Adds health and armor. |
| ⚔ Weapon | Adds damage and reduces attack cooldown. |
| ◎ Sensor | Adds weapon range. |
| ϟ Engine | Adds movement speed. |

Every filled cell contributes health. Exposed edge cells also add damage, and the shape's dimensions contribute range. Adding cells and modules makes production more expensive.

Four sockets around the blueprint can hold modules:

| Module | Effect |
| --- | --- |
| Weapon | More damage and a shorter attack cooldown. |
| Shield | More health and armor. |
| Support | More speed and range. |

Workshop tools include undo, horizontal mirror, reset, and grid expansion. Grid size can grow to 8 × 8. Expansion unlocks with wave progress; the next cost is shown on the grid button. The cost starts at 70 gold and rises by 65 gold for each expansion.

Use the **Library** to save up to 20 designs in this browser, load them later, or export and import a share code. A share code contains the design grid and socket modules.

## Controls

### Keyboard and mouse

| Input | Action |
| --- | --- |
| **W / A / S / D** | Pan the camera |
| **Click** | Select a unit, structure, or deposit; place the active building |
| **Drag** | Select a group of units |
| **Q** | Cycle to the next controllable unit |
| **Arrow keys** | Steer the selected unit |
| **E**, then click | Order selected units to move to a destination |
| **+ / −** | Zoom in or out |
| **0** | Reset zoom to 100% |
| **Mouse wheel** | Zoom toward or away from the pointer |
| **Right-click** | Scrap a unit or building |
| **Escape** | Pause or resume |

### Touch

- Drag the map to pan.
- Pinch the map to zoom. The on-screen **＋ / −** controls also change zoom; tap the percentage to reset to 100%.
- Tap units, structures, or deposits to select and inspect them.
- Use the on-screen **➤ Move** button, then tap a destination to order selected units.
- Tap a building button, then tap the map to place it. Miner placement snaps to a highlighted deposit tile.

## Options

Open **Options** from the main or pause menu to adjust map zoom, camera pan speed, reduced motion, and fullscreen mode. Expand **Keyboard controls** to rebind camera pan, unit steering, unit cycling, move orders, zoom, reset zoom, and pause. Click a displayed key and press its replacement. **E** is the default move-order key. Use **Defaults** to restore the original keybinds, 100% zoom, standard pan speed, and normal motion. Settings are saved in the current browser.

## Saves and local data

The game automatically saves an expedition about every 75 seconds and keeps the three most recent save slots in the browser's local storage. Use **Continue** for the latest save, or load/delete an individual slot from the menu. Saves are tied to the browser and site address where you played.

The blueprint library and tutorial completion setting are also stored locally in that browser. Clearing browser site data can remove these saves and designs.

## Project files

This is a static browser game built with HTML, CSS, JavaScript, and the Canvas 2D API. There is no backend or build toolchain. `main.js` contains gameplay systems and simulation; `index.html` contains the interface and styling; `geometron.png` is the local artwork used by the menu.
