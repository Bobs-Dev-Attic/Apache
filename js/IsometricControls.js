import * as THREE from 'three';

/**
 * IsometricControls
 * ------------------
 * A custom camera controller for an OrthographicCamera that gives an
 * isometric-style view which can be:
 *   - rotated  (orbit azimuth, and a clamped polar tilt)
 *   - zoomed   (ortho zoom factor)
 *   - panned   (moves the look-at target)
 *
 * Works with both mouse and multi-touch:
 *   Mouse : left-drag rotate, right/middle-drag pan, wheel zoom
 *   Touch : 1 finger rotate, 2 finger pinch-zoom + pan
 *
 * It can optionally "follow" a moving object (the helicopter): when
 * following, the target smoothly tracks the object while still honouring
 * any manual pan offset the user has applied.
 */
export class IsometricControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;

    // Orbit state
    this.target = new THREE.Vector3(0, 0, 0);
    this.azimuth = Math.PI / 4;          // 45° — classic isometric
    this.polar = Math.atan(1 / Math.sqrt(2)); // ~35.26° true-iso tilt
    this.radius = 60;                    // distance (direction only for ortho)

    // Limits
    this.minPolar = 0.18;                // near top-down-ish clamp
    this.maxPolar = 1.35;                // near horizon clamp
    this.minZoom = 0.25;
    this.maxZoom = 4.0;

    // Follow behaviour
    this.follow = true;
    this.followObject = null;
    this.followLerp = 0.08;
    this.panOffset = new THREE.Vector3(0, 0, 0);

    // Camera view presets cycled by the view button. `az` is a fixed world
    // azimuth; `rel` (radians) is an offset from "directly behind" that tracks
    // the aircraft's heading, so those views stay oriented as it turns.
    // Ordered: overview -> chase -> top-down -> around the rear -> sides -> low front.
    const HALF = Math.PI / 2, QTR = Math.PI / 4;
    this.views = [
      { name: 'ISO',    az: Math.PI / 4, polar: 0.6155, zoom: 1.0 },
      { name: 'CHASE',  rel: 0,          polar: 0.95,   zoom: 1.15 },
      { name: 'TOP',    az: Math.PI / 4, polar: this.minPolar, zoom: 1.0 },
      { name: 'REAR L', rel: -QTR,       polar: 1.12,   zoom: 1.0 },
      { name: 'REAR',   rel: 0,          polar: 1.28,   zoom: 1.0 },
      { name: 'REAR R', rel: QTR,        polar: 1.12,   zoom: 1.0 },
      { name: 'SIDE L', rel: -HALF,      polar: 1.2,    zoom: 1.0 },
      { name: 'SIDE R', rel: HALF,       polar: 1.2,    zoom: 1.0 },
      { name: 'LOW L',  rel: -3 * QTR,   polar: 1.28,   zoom: 1.0 },
      { name: 'LOW R',  rel: 3 * QTR,    polar: 1.28,   zoom: 1.0 },
    ];
    this.viewIndex = 0;
    this._headingTrack = false;   // true while a heading-relative view is active
    this._azRel = 0;
    this.getHeading = null;       // () => aircraft heading (radians)
    this.onViewChange = null;     // (name) => void, for a UI label

    // Smoothing damping
    this.damping = 0.15;
    this._azTarget = this.azimuth;
    this._polTarget = this.polar;
    this._zoomTarget = camera.zoom;

    // When false, the right/middle mouse button no longer pans (e.g. while the
    // gun is armed and right-click is used to fire). Touch pinch-pan is unaffected.
    this.panEnabled = true;

    // Interaction bookkeeping
    this._pointers = new Map();
    this._lastSingle = null;
    this._lastPinchDist = 0;
    this._lastPinchMid = null;
    this._button = 0;

    this.rotateSpeed = 0.006;
    this.panSpeed = 1.0;
    this.zoomSpeed = 1.0;

    this._bind();
  }

  setFollowObject(obj) { this.followObject = obj; }

  recenter() { this.setView(0); }

  /** Advance to the next camera view preset (wraps around). */
  cycleView() { this.setView((this.viewIndex + 1) % this.views.length); }

  /** Apply a camera view preset by index. */
  setView(index) {
    this.viewIndex = index;
    const v = this.views[index];
    this.panOffset.set(0, 0, 0);
    this.follow = true;
    this._polTarget = v.polar;
    this._zoomTarget = v.zoom;
    if (v.rel !== undefined) {
      this._headingTrack = true;
      this._azRel = v.rel;
    } else {
      this._headingTrack = false;
      this._azTarget = v.az;
    }
    this.onViewChange?.(v.name);
  }

  /** World azimuth that places the camera directly behind the aircraft. */
  _behindAz(h) { return Math.atan2(-Math.cos(h), Math.sin(h)); }

  _bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    el.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp, { passive: false });
    window.addEventListener('pointercancel', this._onPointerUp, { passive: false });
    el.addEventListener('wheel', this._onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onPointerDown = (e) => {
    // Ignore interactions that start on UI controls
    if (e.target.closest('#mobile-controls, #top-controls, #help-overlay')) return;
    this.dom.setPointerCapture?.(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._button = e.button;

    if (this._pointers.size === 1) {
      this._lastSingle = { x: e.clientX, y: e.clientY };
    } else if (this._pointers.size === 2) {
      this._initPinch();
    }
    e.preventDefault();
  };

  _onPointerMove = (e) => {
    if (!this._pointers.has(e.pointerId)) return;
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this._pointers.size === 1 && this._lastSingle) {
      const dx = e.clientX - this._lastSingle.x;
      const dy = e.clientY - this._lastSingle.y;
      this._lastSingle = { x: e.clientX, y: e.clientY };

      // Right / middle mouse button pans (unless disabled), left rotates.
      if ((this._button === 2 || this._button === 1) && this.panEnabled) {
        this._pan(dx, dy);
      } else if (this._button !== 2 && this._button !== 1) {
        this._rotate(dx, dy);
      }
    } else if (this._pointers.size === 2) {
      this._handlePinch();
    }
    e.preventDefault();
  };

  _onPointerUp = (e) => {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size === 1) {
      // Resume single-finger tracking with the remaining pointer
      const [p] = this._pointers.values();
      this._lastSingle = { x: p.x, y: p.y };
      this._button = 0;
    } else if (this._pointers.size === 0) {
      this._lastSingle = null;
    }
  };

  _onWheel = (e) => {
    e.preventDefault();
    const factor = Math.pow(0.999, e.deltaY * this.zoomSpeed);
    this._zoomTarget = THREE.MathUtils.clamp(this._zoomTarget * factor, this.minZoom, this.maxZoom);
  };

  _rotate(dx, dy) {
    // Manually rotating drops out of a canned view into free-look.
    this._headingTrack = false;
    this._azTarget -= dx * this.rotateSpeed;
    this._polTarget = THREE.MathUtils.clamp(
      this._polTarget - dy * this.rotateSpeed,
      this.minPolar, this.maxPolar
    );
  }

  _pan(dx, dy) {
    // Convert screen-space drag into world-space pan on the ground plane,
    // scaled by the current ortho zoom so it feels 1:1.
    const scale = this.panSpeed / this.camera.zoom * 0.05;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    const move = new THREE.Vector3();
    move.addScaledVector(right, -dx * scale);
    move.addScaledVector(up, dy * scale);
    this.panOffset.add(move);
    this.follow = this.followObject ? this.follow : false;
  }

  _initPinch() {
    const pts = [...this._pointers.values()];
    this._lastPinchDist = this._dist(pts[0], pts[1]);
    this._lastPinchMid = this._mid(pts[0], pts[1]);
  }

  _handlePinch() {
    const pts = [...this._pointers.values()];
    const dist = this._dist(pts[0], pts[1]);
    const mid = this._mid(pts[0], pts[1]);

    if (this._lastPinchDist > 0) {
      const factor = dist / this._lastPinchDist;
      this._zoomTarget = THREE.MathUtils.clamp(this._zoomTarget * factor, this.minZoom, this.maxZoom);
    }
    if (this._lastPinchMid) {
      this._pan(mid.x - this._lastPinchMid.x, mid.y - this._lastPinchMid.y);
    }
    this._lastPinchDist = dist;
    this._lastPinchMid = mid;
  }

  _dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  _mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  update() {
    // Heading-relative views: keep the azimuth target parked behind the
    // aircraft (unwrapped to the nearest revolution so it never spins around).
    if (this._headingTrack && this.getHeading) {
      let a = this._behindAz(this.getHeading()) + this._azRel;
      while (a - this.azimuth > Math.PI) a -= 2 * Math.PI;
      while (a - this.azimuth < -Math.PI) a += 2 * Math.PI;
      this._azTarget = a;
    }

    // Smooth orbit + zoom toward targets
    this.azimuth += (this._azTarget - this.azimuth) * this.damping;
    this.polar += (this._polTarget - this.polar) * this.damping;
    this.camera.zoom += (this._zoomTarget - this.camera.zoom) * this.damping;
    this.camera.updateProjectionMatrix();

    // Follow the helicopter if enabled
    if (this.follow && this.followObject) {
      const p = this.followObject.position;
      this.target.x += (p.x - this.target.x) * this.followLerp;
      this.target.y += (p.y - this.target.y) * this.followLerp;
      this.target.z += (p.z - this.target.z) * this.followLerp;
    }

    const focus = new THREE.Vector3().copy(this.target).add(this.panOffset);

    // Spherical -> cartesian camera offset
    const sinP = Math.sin(this.polar);
    const offset = new THREE.Vector3(
      this.radius * sinP * Math.sin(this.azimuth),
      this.radius * Math.cos(this.polar),
      this.radius * sinP * Math.cos(this.azimuth)
    );

    this.camera.position.copy(focus).add(offset);
    this.camera.lookAt(focus);
    this.camera.updateMatrixWorld();
  }
}
