# Apache — Isometric Helicopter Simulation

A 3D **isometric helicopter flight simulation** that runs in any modern browser
on **desktop and mobile**, in landscape orientation. The MVP features a
procedurally-built **low-poly AH-64 Apache** flying over a **low-poly desert**.

Built with [Three.js](https://threejs.org/) — no build step required. Just serve
the folder and open it.

![status](https://img.shields.io/badge/status-MVP-c2a06a)

## Features

- **Low-poly Apache** — tandem cockpit, twin engine nacelles, 4-blade main &
  tail rotors, stub wings with rocket pods & Hellfire rails, nose sensor turret,
  landing gear. Rotors spin and blur up to speed.
- **Low-poly desert** — procedurally displaced dune terrain, scattered rocks,
  saguaro cacti, distant mesas, a warm gradient sky, sun shadows and fog.
- **Weapons** — M230 chain gun (fire at the cursor), Hydra rockets, and guided
  Hellfire missiles with a targeting sensor "video screen" (MFD): scatter of
  enemy tanks & technicals, target locking, Tab to cycle; rockets fly straight
  to the locked target (nose within 45°), missiles fly a high top-attack profile
  (nose within 120°). A hit throws debris and dirt, blows parts off the vehicle,
  and leaves a burning hulk with a smoke column and a scorched ground stain.
  Every weapon has a limited munition count (GUN 1200, RKT 38, MSL 16, FLARE 30).
  Vehicles have hit points and a floating damage bar: sustained gun fire makes
  them smoke, then burn, then explode; tracers ricochet off armour; and
  survivors flee the wreck on foot (running, crawling wounded, or on fire).
- **Fuel** — flying and moving burn fuel; the tank runs a few minutes of hard
  flying and the engine flames out when it runs dry.
- **Instruments** — a bottom-docked gauge cluster (artificial horizon, airspeed,
  altimeter, heading compass, rotor, fuel) with an ammo readout.
- **Menu** — a top-left menu with New Game, How to Play and Options (unlimited
  fuel / ammo, invert cyclic).
- **Radar** — a heading-up top-down scope showing target blips, range rings and
  a sweep, with the locked target highlighted.
- **Rotatable isometric camera** — orbit, tilt, zoom and pan; optionally
  follows the aircraft.
- **Multi-platform input**
  - **Desktop**: keyboard flight + mouse camera.
  - **Mobile**: twin on-screen joysticks (cyclic + collective/yaw) plus a
    weapon toolbar and a fire button, touch gestures for the camera.
- **Landscape-first** — a rotate prompt appears on portrait phones.
- **HUD** — altitude (ft), speed (mph), heading, rotor %, fuel %.

## Controls

### Flight — keyboard
| Key | Action |
| --- | --- |
| `W` / `S` | Pitch forward / back — powers you forward / back |
| `A` / `D` | Bank left / right — powers you sideways |
| `Q` / `E` | Yaw (pedals) left / right |
| `C` / `Shift` | Collective up — climb |
| `Z` / `Ctrl` | Collective down — descend |
| `G` | Arm / stow the main gun (M230) |
| `R` | Rocket sensor/targeting mode |
| `M` | Missile (guided) sensor/targeting mode |
| `Tab` | Cycle locked target |
| `1` / `2` | Fire rockets / missiles at the locked target |
| `F` | Deploy flares (countermeasures) |
| `V` | Toggle camera follow |
| Right-click | Fire the armed weapon (gun → cursor, rockets/missiles → locked target) |
| `F` | Toggle camera follow |
| `H` / `?` | Toggle help |

### Flight — mobile
- **Left virtual joystick** — cyclic: tilt to fly in that direction. The
  further you push, the more power — there is no separate throttle button.
- **Right virtual joystick** — collective & yaw: forward = climb, back =
  descend, left / right = yaw.

### Weapons — mobile
- **GUN / RKT / MSL / ✦** — a 2×2 pad above the left stick: select the chain
  gun, rockets or missiles, or deploy flares (**✦**). Each button shows its
  remaining rounds.
- **Tap the sensor screen** to cycle the locked target.
- **FIRE** — hold to fire the gun (toward screen-centre), or tap to
  loose a rocket / missile at the locked target.
- The **targeting sensor screen** under the radar is always live.

### Camera — mouse
- **Left-drag** — rotate the isometric view (orbit + tilt).
- **Right-drag** — pan.
- **Wheel** — zoom in / out.

### Camera — touch
- **One finger drag** — rotate.
- **Two-finger pinch** — zoom.
- **Two-finger drag** — pan.

### Camera views
A **3×3 view picker** (top-left) selects a camera around the aircraft — a compass
of presets:

| REAR L | REAR | REAR R |
| :---: | :---: | :---: |
| **SIDE L** | **TOP** | **SIDE R** |
| **FRONT L** | **FRONT** | **FRONT R** |

The default is **REAR** (chase-from-behind). All but TOP track the aircraft's
heading; rotating the camera by hand returns to free-look.

## Running locally

The app loads Three.js from a CDN via an [import map], so it must be served over
HTTP (opening `index.html` directly via `file://` will not work).

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

[import map]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap

## Project structure

```
index.html              markup, HUD, mobile controls, import map
css/style.css           all styling (HUD, overlays, mobile pad)
js/main.js              bootstrap: renderer, camera, loop, UI wiring
js/IsometricControls.js custom ortho camera controller (mouse + touch)
js/Helicopter.js        low-poly Apache model + arcade flight model
js/Environment.js       desert terrain, props, sky, lighting
js/InputManager.js      keyboard + mobile -> unified control vector
js/MobileControls.js    on-screen joystick & button wiring
```

## Notes & roadmap

This is an MVP arcade flight model (not a true 6-DOF sim). Natural next steps:

- Weapon effects, targets and a mission loop.
- Rotor-wash dust particles and engine audio.
- Bundling Three.js locally for fully offline use.
- Gamepad support.
