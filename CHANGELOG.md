# Changelog

All notable changes to the Apache isometric helicopter simulation are recorded
here. The version shown on the loading screen is defined in
[`js/version.js`](js/version.js) and must match the latest entry below.

The scheme is `MAJOR.MINOR.PATCH`:
- **PATCH** — tweaks, fixes, small polish
- **MINOR** — new features / content
- **MAJOR** — large or breaking overhauls

## [0.18.0] — 2026-07-05
### Changed
- **Camera views are now a 3×3 picker** (top-left) instead of a single cycle
  button — a compass of camera positions around the aircraft: REAR L / REAR /
  REAR R, SIDE L / TOP / SIDE R, FRONT L / FRONT / FRONT R. The active view is
  highlighted; REAR is the default and all but TOP track the heading.

## [0.17.1] — 2026-07-05
### Changed
- **Reworked the Hellfire top-attack flight** so it reads clearly and hits from
  directly overhead: the missile drops off the rail, the **motor lights (a
  visible exhaust plume + hot smoke)** and it flies forward a little, then
  **climbs steeply to a high apex**, flies to directly over the target, and
  **dives straight down** onto it. Fixed the far-target case where it flattened
  out and skimmed/overshot instead of diving vertically (it now brakes on
  approach and the proximity fuze accounts for the missile's speed).

## [0.17.0] — 2026-07-05
### Added
- **Vehicle damage model.** Targets now have hit points and take cumulative
  gun damage. A health bar floats above any hurt target; as damage mounts a
  vehicle starts **smoking**, then **catches fire** (throwing charred pieces),
  and at zero HP **explodes into a smoldering wreck**. Rockets and missiles are
  still one-shot lethal.
- **Tracer ricochets.** Chain-gun rounds that strike a vehicle now spark and
  ricochet off the armour (and deal damage) instead of passing through.
- **Fleeing soldiers.** Survivors bail out of a destroyed vehicle and flee —
  most **run**, some are wounded and **crawl**, and some are **on fire**,
  sprinting erratically before collapsing. They follow the terrain and animate
  (pumping limbs, smoke trails) before dispersing.
### Changed
- **Gun sight lags the cursor.** The reticle/aim now eases toward the pointer
  (the turret is heavy) instead of snapping to it.

## [0.16.0] — 2026-07-05
### Added
- **Fuel.** Flying and moving now burn fuel. A real AH-64 carries ~370 US gal
  and burns ~150 gal/hr in cruise (~2.5 h endurance); that's compressed to a
  game tank of ~11 min hovering / ~4 min of hard cruise, with a hover +
  translational + climb burn model. The FUEL gauge turns red near empty, and
  running dry flames out the engine (the rotor spools down and you settle).
- **Munition counts.** Every weapon is now limited — GUN 1200, RKT 38, MSL 16,
  FLARE 30 (roughly an Apache load). Counts show on the panel and the mobile
  weapon pad, empty weapons are refused, and the gun stops when dry.
- **Menu.** The top-left **☰ menu** opens **New Game**, **How to Play** and
  **Options** (unlimited fuel, unlimited ammo, invert cyclic — persisted).
### Changed
- **Tap the sensor screen to cycle targets** (replaces the swipe gesture and the
  CYCLE button); the Tab key still cycles on desktop.
- **Instrument panel** is docked to the bottom of the screen, a bit larger, with
  the collapse/mini mode removed and a fuel gauge + ammo readout added.

## [0.15.0] — 2026-07-04
### Changed
- **Map is 6× larger** (2400 units across, up from 400) with proportionally more
  terrain detail, rocks, cacti and mesas spread across it, and targets scattered
  over a much wider area. The sky now follows the aircraft so it always surrounds
  it on the bigger map.
- **Instruments read imperial units**: altitude in **ft** and speed in **mph**.

## [0.14.1] — 2026-07-04
### Changed
- **Default camera view is now REAR** (chase-from-behind, heading-tracking)
  instead of the isometric overview.

## [0.14.0] — 2026-07-04
### Added
- **Firing arcs.** The nose must be pointed within **45°** of the target to fire
  rockets, or **120°** to fire a missile; an off-axis shot is refused and briefly
  flashes the sensor screen red.
### Changed
- **Missiles climb high again.** Restored (and steepened) the top-attack profile
  so guided missiles gain real altitude — they throttle their sideways drift
  while climbing, reach a high apex, then dive onto the target.

## [0.13.2] — 2026-07-04
### Changed
- **Radar and sensor screen aligned to the right edge** of the screen (radar on
  top, MFD directly below), clearing the centre for the aircraft.

## [0.13.1] — 2026-07-04
### Changed
- **Radar moved to the top-centre** of the screen, with the targeting sensor
  screen (MFD) stacked directly below it (was top-right).

## [0.13.0] — 2026-07-04
### Added
- **Destructible wrecks.** A rocket or missile hit now throws out dirt clods,
  dust and metal fragments (which arc, bounce and settle), blows the vehicle's
  upper parts off, and leaves a charred, flaming hulk with a rising smoke column
  and a black smoldering scorch stain on the ground.

## [0.12.0] — 2026-07-04
### Added
- **Cycling camera views.** The recenter button is now a **🎥 view button** —
  press it to cycle through camera presets: ISO (default), CHASE, TOP-DOWN,
  REAR L / REAR / REAR R, SIDE L / SIDE R, and LOW L / LOW R. The chase, rear
  and side views track the aircraft's heading so they stay oriented as it turns;
  a brief label shows the active view. Manually rotating the camera drops back
  into free-look.
### Changed
- **Moved the ? and camera buttons** from the top-right to just right of the
  cyclic stick.

## [0.11.0] — 2026-07-04
### Changed
- **Top-attack missiles.** Guided missiles now fly a top-attack profile: they
  drop off the rail, light the motor and climb steeply to a high cruise
  altitude, then pitch over and dive straight down onto the target from above
  (instead of homing in on a flat trajectory).

## [0.10.0] — 2026-07-04
### Added
- **Swipe the sensor screen to cycle targets.** On mobile, swiping horizontally
  across the always-on targeting screen cycles the locked target — right for the
  next, left for the previous — mirroring the `Tab` key / `⟳` button. `cycle()`
  now takes a direction.
### Changed
- **Mobile weapon pad relocated.** GUN / RKT / MSL / FLARE now sit in a **2×2
  grid just above the left cyclic stick**, with a full-width **CYCLE** bar on
  top (freeing the top-left corner).

## [0.9.0] — 2026-07-04
### Changed
- **Power now comes from the cyclic.** The dedicated throttle is gone — the
  **PWR button** (mobile) and **Space** (keyboard) no longer exist. Engine power
  is derived from how far the cyclic is deflected, so tilting with the **left
  stick / WASD** is what drives the aircraft in that direction. Neutral cyclic
  settles to a hover. Collective (climb/descend) and yaw are unchanged.

## [0.8.0] — 2026-07-04
### Changed
- **Twin sticks on mobile.** The climb/descend and yaw buttons are replaced by a
  second on-screen joystick on the right: push forward to climb, back to descend,
  left/right to yaw. The left stick still handles cyclic (pitch/bank).
- **Targeting sensor is always on** and now lives **under the radar** (top-right)
  instead of appearing bottom-center only in a weapon mode. It auto-locks the
  nearest target at start and keeps a live feed regardless of the armed weapon.
- **FIRE moved above the PWR (throttle) button** on the right.
- **FLARE moved next to the MSL selector** in the top-left weapon toolbar, which
  is now a horizontal row (GUN · RKT · MSL · FLARE · CYCLE).

## [0.7.0] — 2026-07-04
### Added
- **Mobile weapon controls.** Touch devices now get an on-screen weapon set:
  left-edge **GUN / RKT / MSL** selectors plus **⟳** to cycle targets, and a
  right-edge context-sensitive **FIRE** button (hold to fire the chain gun, tap
  to loose a rocket or missile at the locked target) with a **✦ FLARE** button.
  Selecting a weapon on either touch or keyboard keeps both in sync; FIRE and
  CYCLE grey out until they apply.

## [0.6.1] — 2026-07-04
### Changed
- **Instrument panel moved to the bottom-center** of the screen (was top-left),
  clearing the top corners and sitting between the mobile flight controls.

## [0.6.0] — 2026-07-04
### Added
- **Flares** on `F` — dispenses a burst of bright countermeasure particles that
  eject down and behind the aircraft and burn out.
- **Dedicated fire keys**: `1` fires rockets and `2` fires missiles at the
  locked target (auto-locks the nearest if nothing is locked). Right-click still
  fires the active sensor-mode weapon.
### Changed
- Camera follow moved from `F` to `V` (F is now flares).

## [0.5.0] — 2026-07-04
### Added
- **Guided missiles.** Press `M` for missile mode (shares the targeting sensor
  screen and Tab cycling). Right-click launches a Hellfire-style missile that
  lofts then homes onto the locked target with a smoke trail and a larger
  detonation. Gun / rockets / missiles are mutually exclusive.
- **Instrument panel.** A cockpit gauge cluster — artificial horizon, airspeed,
  altimeter, heading compass and rotor bar — that **collapses to a mini text
  readout** via the ▾ button.
- **Radar scope.** A heading-up top-down scope on the right showing target
  blips, range rings and a rotating sweep, with the locked target highlighted.

## [0.4.0] — 2026-07-04
### Added
- **Rockets + targeting sensor.** Press `R` to enter rocket mode: a green
  "TADS" sensor **video screen** (MFD) appears at the bottom, showing a live
  zoomed camera feed of the locked target. **Tab** cycles through targets;
  a world-space lock box tracks the target in the main view.
- **Right-click** fires a Hydra rocket at the locked target; it flies in and
  detonates with a fireball + smoke, destroying the target and auto-locking the
  next one.
- Enemy ground targets scattered across the desert (low-poly T-72 tanks and
  technicals) with range readout (`TGT n/total`, metres).
- Gun and rockets are mutually exclusive weapon modes.

## [0.3.0] — 2026-07-04
### Added
- **M230 chain gun.** Press `G` to arm the main gun; while armed, hold the
  **right mouse button** to fire at the cursor location. The cursor is
  projected onto the terrain, the nose gun slews to aim, and it fires tracer
  rounds at machine-gun cadence with a muzzle flash and dust impacts.
- Gun model (housing + barrel) under the nose, a "GUN ARMED" HUD indicator and
  a targeting reticle that follows the cursor.
- While the gun is armed, right-drag fires instead of panning the camera
  (left-drag still rotates, wheel still zooms).

## [0.2.4] — 2026-07-04
### Added
- `C` climbs and `Z` descends (collective), alongside the existing Shift/Ctrl.
  Help overlay and README updated.

## [0.2.3] — 2026-07-04
### Fixed
- Rotated the tail rotor 90° so its disc faces sideways (a proper anti-torque
  rotor on the side of the fin) instead of facing fore-and-aft. It still spins
  cleanly via a mount wrapper.

## [0.2.2] — 2026-07-04
### Fixed
- **Root cause of the "body looks off" issue.** The main fuselage was
  internally yawed ~30° off the nose/tail axis — `rotation.y` (meant only to
  orient the hexagonal faces) was rotating about the wrong axis due to Euler
  order, so it turned the whole fuselage instead of spinning its faces. It now
  spins about its own long axis and sits square with the nose, tail boom and
  rotor mast. No whole-body offset could fix this, which is why earlier yaw
  tweaks never looked right.
- Reset the visual whole-body yaw offset to 0 now that the model is built
  square; the nose points where the aircraft flies.

## [0.2.1] — 2026-07-04
### Changed
- Rotated the helicopter body a further 15° clockwise (now ~45° total), per
  a top-down reference. Visual only; does not affect the flight direction.

## [0.2.0] — 2026-07-04
### Added
- **Power / throttle control.** Cyclic now only tilts the helicopter; hold
  power to actually fly it across the terrain in whatever direction it is
  tilted, release to slow to a hover. Keyboard `Space`; a dedicated **PWR**
  button on mobile.
### Changed
- Flight model reworked so the aircraft builds real momentum and cruises
  (gentler horizontal drag, capped top speed) instead of barely drifting.
- Altitude now auto-holds when the collective is neutral (previous hover-assist
  key removed; hold Shift/Ctrl to climb/descend).
- Increased the model's visual yaw offset to ~30° clockwise (still visual only;
  does not affect the flight/travel direction).

## [0.1.1] — 2026-07-04
### Fixed
- Cyclic axes were swapped: left/right (bank) input tilted the aircraft
  fore/aft and forward/back (pitch) input rolled it. Pitch now rotates about
  the lateral axis and roll about the longitudinal axis, so the model tilts
  the way you steer.
- Rotated the helicopter body ~15° clockwise so it sits square to the view.
  The offset is visual only and does not affect the flight/travel direction.
### Changed
- Idle bob no longer accumulates drift; it is applied as a bounded pitch offset.

## [0.1.0] — 2026-07-04
### Added
- Initial MVP release.
- Low-poly AH-64 Apache: tandem canopy, twin nacelles, 4-blade main & tail
  rotors, stub wings with rocket pods/Hellfire rails, nose turret, landing gear.
- Low-poly desert environment: procedural dune terrain, scattered rocks, cacti,
  distant mesas, gradient sky, sun shadows and fog.
- Custom isometric orthographic camera with rotate/tilt, zoom, pan and follow,
  driven by mouse and multi-touch gestures.
- Arcade flight model: collective, cyclic, pedals and hover assist.
- Adaptive input: keyboard on desktop, on-screen joystick + buttons on mobile.
- HUD (altitude/speed/heading/rotor), help overlay, landscape prompt.
- Version number displayed on the loading screen.
