import * as THREE from 'three';
import { VERSION } from './version.js';
import { IsometricControls } from './IsometricControls.js';
import { Helicopter } from './Helicopter.js';
import { Environment } from './Environment.js';
import { InputManager } from './InputManager.js';
import { MobileControls } from './MobileControls.js';
import { Weapon } from './Weapon.js';
import { Targets } from './Targets.js';
import { Instruments } from './Instruments.js';
import { Radar } from './Radar.js';
import { Flares } from './Flares.js';

/* ------------------------------------------------------------------ *
 * Renderer & scene
 * ------------------------------------------------------------------ */
// Stamp the current version onto the loading screen + title
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = 'v' + VERSION;
document.title = `Apache v${VERSION} — Isometric Helicopter Sim`;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();

/* ------------------------------------------------------------------ *
 * Orthographic (isometric) camera
 * ------------------------------------------------------------------ */
function makeCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = 24; // world units visible vertically at zoom 1
  const cam = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect,
    viewSize, -viewSize,
    0.1, 2000
  );
  cam.zoom = 1;
  return cam;
}
let camera = makeCamera();

/* ------------------------------------------------------------------ *
 * World
 * ------------------------------------------------------------------ */
const env = new Environment(scene);
const heli = new Helicopter();
heli.group.traverse((o) => {
  if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
});
// place the aircraft on the ground at spawn, spooled and ready
const spawnGround = env.heightAt(0, 0);
heli.group.position.set(0, spawnGround + 12, 0);
scene.add(heli.group);

const controls = new IsometricControls(camera, canvas);
controls.setFollowObject(heli.group);
controls.target.copy(heli.group.position);

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */
const input = new InputManager();
const mobile = new MobileControls(input);

input.onToggleFollow = () => {
  controls.follow = !controls.follow;
  if (controls.follow) controls.panOffset.set(0, 0, 0);
};
input.onToggleHelp = () => toggleHelp();

/* ------------------------------------------------------------------ *
 * Weapon (M230 chain gun)
 * ------------------------------------------------------------------ */
const weapon = new Weapon(scene, heli);
const reticle = document.getElementById('reticle');
const gunStatus = document.getElementById('gun-status');

input.onToggleGun = () => {
  weapon.armed = !weapon.armed;
  gunStatus.classList.toggle('hidden', !weapon.armed);
  reticle.classList.toggle('hidden', !weapon.armed);
  canvas.classList.toggle('armed', weapon.armed);
  if (weapon.armed && targetMode) setTargetMode(null);  // gun & rockets/missiles are exclusive
  controls.panEnabled = !weapon.armed && !targetMode;   // right-drag fires instead of panning
  if (!weapon.armed) { weapon.setFiring(false); mobileFiring = false; }
  // Park the reticle at the current cursor (screen-centre on touch, where the
  // gun fires from since there is no pointer to track).
  if (weapon.armed) reticle.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
  mobile.setWeaponState(weapon.armed ? 'gun' : (targetMode || null));
};

// Cursor tracking + right-button firing (desktop)
const cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let rightDown = false;
let mobileFiring = false;   // gun trigger held via the on-screen FIRE button
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const aimPoint = new THREE.Vector3();

// Use pointer events (the controls preventDefault() pointerdown, which would
// otherwise suppress the compatibility mouse events).
canvas.addEventListener('pointermove', (e) => {
  cursor.x = e.clientX; cursor.y = e.clientY;
  reticle.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
});
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2 && weapon.armed) rightDown = true;
});
window.addEventListener('pointerup', (e) => { if (e.button === 2) rightDown = false; });
window.addEventListener('blur', () => { rightDown = false; });

// Project the cursor onto the terrain (fallback: far along the ray) → aim point
function updateAim() {
  ndc.x = (cursor.x / window.innerWidth) * 2 - 1;
  ndc.y = -(cursor.y / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(env.terrain, false);
  if (hits.length) {
    aimPoint.copy(hits[0].point);
    return true;
  }
  raycaster.ray.at(300, aimPoint);
  return true;
}

/* ------------------------------------------------------------------ *
 * Rockets + targeting sensor (MFD "video screen")
 * ------------------------------------------------------------------ */
const targets = new Targets(scene, env);

// A narrow-FOV sensor camera whose feed is rendered into the MFD rectangle.
const sensorCam = new THREE.PerspectiveCamera(16, 300 / 188, 0.5, 1200);

const mfd = document.getElementById('mfd');
const mfdTop = document.getElementById('mfd-top');
const mfdTgt = document.getElementById('mfd-tgt');
const mfdRng = document.getElementById('mfd-rng');
const lockBox = document.getElementById('lock-box');

// Targeting weapon mode: null | 'rockets' | 'missiles'
let targetMode = null;
const _v = new THREE.Vector3();
const _muzzleL = new THREE.Vector3();

function setTargetMode(mode) {
  targetMode = mode;
  const on = mode !== null;
  // The MFD sensor screen is always visible; only the world-space lock box and
  // the weapon label depend on being in a targeting mode.
  lockBox.classList.toggle('hidden', !on);
  controls.panEnabled = !on && !weapon.armed;
  if (on) {
    if (weapon.armed) input.onToggleGun();           // stow the gun (exclusive)
    mfdTop.textContent = mode === 'missiles' ? '◉ TADS — MISSILES' : '◉ TADS — ROCKETS';
    targets.lockNearest(heli.group.position);
  } else {
    mfdTop.textContent = '◉ TADS — SENSOR';
  }
  mobile.setWeaponState(mode || (weapon.armed ? 'gun' : null));
}

input.onToggleRockets = () => setTargetMode(targetMode === 'rockets' ? null : 'rockets');
input.onToggleMissiles = () => setTargetMode(targetMode === 'missiles' ? null : 'missiles');
input.onCycleTarget = () => { if (targetMode) targets.cycle(); };
// Swiping the always-on sensor screen cycles the locked target directly
// (right = next, left = previous), regardless of the selected weapon.
input.onSwipeTarget = (dir) => targets.cycle(dir);

// Dedicated fire buttons: 1 = rockets, 2 = missiles (at the locked target)
function fireMunition(kind) {
  if (!targets.lockedTarget) targets.lockNearest(heli.group.position);
  const tgt = targets.lockedTarget;
  if (!tgt) return;
  const from = heli.body.localToWorld(_v.set(0.2, -0.4, 1.6)); // wing pylon
  if (kind === 'missiles') targets.fireMissileAt(from, tgt);
  else targets.fireRocketAt(from, tgt);
}
input.onFireRockets = () => fireMunition('rockets');
input.onFireMissiles = () => fireMunition('missiles');

// Mobile FIRE button — context sensitive:
//   gun armed  -> hold to fire the chain gun (toward screen-centre)
//   rocket/msl -> loose one munition at the locked target per press
input.onFireDown = () => {
  if (weapon.armed) mobileFiring = true;
  else if (targetMode) fireMunition(targetMode);
};
input.onFireUp = () => { mobileFiring = false; };

// Flares (F)
const flares = new Flares(scene);
input.onDeployFlares = () => flares.deploy(heli);

// Fire the selected munition at the locked target on right-click (one per press)
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2 && targetMode) {
    const tgt = targets.lockedTarget;
    if (tgt) {
      const from = heli.body.localToWorld(_v.set(0.2, -0.4, 1.6)); // wing pylon
      if (targetMode === 'missiles') targets.fireMissileAt(from, tgt);
      else targets.fireRocketAt(from, tgt);
    }
  }
});

// Point the sensor camera from the nose sensor toward the locked target.
function updateSensor() {
  const tgt = targets.lockedTarget;
  const eye = heli.body.localToWorld(_muzzleL.set(3.35, -0.5, 0));
  sensorCam.position.copy(eye);
  if (tgt) {
    sensorCam.lookAt(tgt.pos);
  } else {
    // look forward along the nose if nothing is locked
    heli.body.localToWorld(_v.set(20, -2, 0));
    sensorCam.lookAt(_v);
  }
  sensorCam.updateMatrixWorld();
}

// Update MFD text + world-space lock box each frame
function updateTargetingHud() {
  const tgt = targets.lockedTarget;
  if (tgt) {
    mfd.classList.remove('no-target');
    const rng = heli.group.position.distanceTo(tgt.pos);
    mfdTgt.textContent = `TGT ${targets.lockedOrdinal()}/${targets.aliveCount()} ${tgt.name}`;
    mfdRng.textContent = `${rng.toFixed(0)}m`;
    // project target to screen for the lock box (only while actively targeting)
    _v.copy(tgt.pos).project(camera);
    if (targetMode && _v.z < 1) {
      const sx = (_v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_v.y * 0.5 + 0.5) * window.innerHeight;
      lockBox.style.display = 'block';
      lockBox.style.transform = `translate(${sx}px, ${sy}px)`;
    } else {
      lockBox.style.display = 'none';
    }
  } else {
    mfd.classList.add('no-target');
    mfdTgt.textContent = 'NO TARGET';
    mfdRng.textContent = '--';
    lockBox.style.display = 'none';
  }
}

// Render the sensor feed into the MFD rectangle (WebGL scissor pass)
function renderSensor() {
  // setViewport/setScissor take CSS pixels; the renderer applies pixelRatio.
  const r = mfd.getBoundingClientRect();
  const x = r.left;
  const y = window.innerHeight - r.bottom; // GL origin is bottom-left
  sensorCam.aspect = r.width / r.height;
  sensorCam.updateProjectionMatrix();
  renderer.setScissorTest(true);
  renderer.setViewport(x, y, r.width, r.height);
  renderer.setScissor(x, y, r.width, r.height);
  renderer.render(scene, sensorCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
}

/* ------------------------------------------------------------------ *
 * UI wiring
 * ------------------------------------------------------------------ */
const helpOverlay = document.getElementById('help-overlay');
function toggleHelp(force) {
  const show = force ?? helpOverlay.classList.contains('hidden');
  helpOverlay.classList.toggle('hidden', !show);
}
document.getElementById('btn-help').addEventListener('click', () => toggleHelp(true));
document.getElementById('btn-close-help').addEventListener('click', () => toggleHelp(false));
document.getElementById('btn-recenter').addEventListener('click', () => {
  controls.recenter();
  controls.target.copy(heli.group.position);
});

// Instrument gauge cluster + radar scope
const instruments = new Instruments();
const radar = new Radar(document.getElementById('radar-canvas'));

/* ------------------------------------------------------------------ *
 * Device / orientation handling
 * ------------------------------------------------------------------ */
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) mobile.enable();

const rotatePrompt = document.getElementById('rotate-prompt');
function checkOrientation() {
  // Only nag touch devices held in portrait
  const portrait = window.innerHeight > window.innerWidth;
  rotatePrompt.style.display = (isTouch && portrait) ? 'flex' : 'none';
}

/* ------------------------------------------------------------------ *
 * Resize
 * ------------------------------------------------------------------ */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = w / h;
  const viewSize = 24;
  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  checkOrientation();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
onResize();

/* ------------------------------------------------------------------ *
 * Loading screen off after first frame
 * ------------------------------------------------------------------ */
let firstFrame = true;
function hideLoading() {
  const l = document.getElementById('loading');
  l.classList.add('hidden');
  setTimeout(() => l.remove(), 700);
}

/* ------------------------------------------------------------------ *
 * Main loop
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp for tab-switch spikes

  const ctl = input.sample();
  const groundY = env.heightAt(heli.group.position.x, heli.group.position.z);
  heli.update(dt, ctl, groundY);

  controls.update();
  env.updateSun(controls.target);

  // Weapon: aim at the cursor, fire on right-button while armed
  if (weapon.armed) {
    const ok = updateAim();
    weapon.setAim(aimPoint, ok);
    weapon.setFiring(rightDown || mobileFiring);
  } else {
    weapon.setFiring(false);
  }
  weapon.update(dt);

  // Rockets / missiles + targeting. The sensor screen is always live, so the
  // camera + MFD text update every frame regardless of the selected weapon.
  targets.update(dt, () => { if (targetMode) targets.cycle(); }); // auto-lock next on kill
  updateSensor();
  updateTargetingHud();

  // Countermeasures + instruments + radar
  flares.update(dt);
  instruments.update(heli);
  radar.draw(heli, targets, dt);

  renderer.render(scene, camera);

  // The sensor "video screen" is a second render into the MFD rectangle
  renderSensor();

  if (firstFrame) { firstFrame = false; hideLoading(); }
}
targets.lockNearest(heli.group.position);  // give the always-on sensor a target
animate();

// Expose for debugging in the console
window.__sim = { scene, camera, heli, env, controls, input, weapon, targets, instruments, radar, flares, get targetMode() { return targetMode; } };
