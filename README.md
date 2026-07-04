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
- **Weapons** — M230 chain gun (fire at the cursor) and Hydra rockets with a
  targeting sensor "video screen" (MFD): scatter of enemy tanks & technicals,
  target locking, Tab to cycle, rockets that fly to the locked target and
  detonate.
- **Rotatable isometric camera** — orbit, tilt, zoom and pan; optionally
  follows the aircraft.
- **Multi-platform input**
  - **Desktop**: keyboard flight + mouse camera.
  - **Mobile**: on-screen virtual joystick + buttons for flight, touch
    gestures for the camera.
- **Landscape-first** — a rotate prompt appears on portrait phones.
- **HUD** — altitude, speed, heading, rotor %.

## Controls

### Flight — keyboard
| Key | Action |
| --- | --- |
| `W` / `S` | Pitch forward / back (drift fwd / back) |
| `A` / `D` | Bank left / right (drift left / right) |
| `Q` / `E` | Yaw (pedals) left / right |
| `C` / `Shift` | Collective up — climb |
| `Z` / `Ctrl` | Collective down — descend |
| `Space` | Power — fly in the tilt direction |
| `G` | Arm / stow the main gun (M230) |
| `R` | Rocket mode + targeting sensor screen |
| `Tab` | Cycle locked target (rocket mode) |
| Right-click | Fire the armed weapon (gun → cursor, rockets → locked target) |
| `F` | Toggle camera follow |
| `H` / `?` | Toggle help |

### Flight — mobile
- **Left virtual joystick** — cyclic (pitch & bank).
- **▲ / ▼ buttons** — collective (climb / descend).
- **↺ / ↻ buttons** — yaw.

### Camera — mouse
- **Left-drag** — rotate the isometric view (orbit + tilt).
- **Right-drag** — pan.
- **Wheel** — zoom in / out.

### Camera — touch
- **One finger drag** — rotate.
- **Two-finger pinch** — zoom.
- **Two-finger drag** — pan.

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
