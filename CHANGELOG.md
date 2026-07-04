# Changelog

All notable changes to the Apache isometric helicopter simulation are recorded
here. The version shown on the loading screen is defined in
[`js/version.js`](js/version.js) and must match the latest entry below.

The scheme is `MAJOR.MINOR.PATCH`:
- **PATCH** — tweaks, fixes, small polish
- **MINOR** — new features / content
- **MAJOR** — large or breaking overhauls

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
