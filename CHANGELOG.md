# Changelog

All notable changes to the Apache isometric helicopter simulation are recorded
here. The version shown on the loading screen is defined in
[`js/version.js`](js/version.js) and must match the latest entry below.

The scheme is `MAJOR.MINOR.PATCH`:
- **PATCH** — tweaks, fixes, small polish
- **MINOR** — new features / content
- **MAJOR** — large or breaking overhauls

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
