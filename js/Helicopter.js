import * as THREE from 'three';

/**
 * Helicopter
 * ----------
 * A procedurally-built low-poly AH-64 Apache and an arcade flight model.
 *
 * The model is assembled from primitives with flat shading for a faceted,
 * low-poly aesthetic. It exposes `.group` (the root Object3D) which the
 * flight model drives.
 *
 * Flight model (arcade, not a true 6-DOF sim):
 *   - collective  -> vertical thrust / altitude
 *   - cyclic      -> pitch & bank, which produce forward / lateral drift
 *   - pedals      -> yaw (heading)
 *   - hover assist auto-levels attitude and holds altitude
 */
export class Helicopter {
  constructor() {
    this.group = new THREE.Group();

    // --- flight state ---
    this.velocity = new THREE.Vector3();
    this.heading = 0;                 // yaw, radians
    this.pitch = 0;                   // nose up/down (visual + drift)
    this.bank = 0;                    // roll (visual + drift)
    this.rotorSpeed = 0;              // 0..1 spool
    this.targetRotor = 1;
    this.altitude = 12;

    // Static visual yaw offset applied to the model only (does not affect the
    // flight/travel direction). Negative = clockwise viewed from above.
    this.modelYaw = -Math.PI / 12;   // ~15° clockwise
    this.group.position.set(0, this.altitude, 0);

    // rotor references for animation
    this.mainRotor = null;
    this.tailRotor = null;

    this._build();
  }

  _mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: opts.roughness ?? 0.75,
      metalness: opts.metalness ?? 0.15,
      ...opts,
    });
  }

  _build() {
    const OLIVE = 0x4a5236;
    const OLIVE_DK = 0x3a4029;
    const DARK = 0x23271b;
    const GLASS = 0x171d16;
    const METAL = 0x2b2e26;

    const olive = this._mat(OLIVE);
    const oliveDk = this._mat(OLIVE_DK);
    const dark = this._mat(DARK, { roughness: 0.9 });
    const glass = this._mat(GLASS, { roughness: 0.25, metalness: 0.4 });
    const metal = this._mat(METAL, { metalness: 0.55, roughness: 0.5 });

    // group      -> heading (yaw) + world position
    //   attitude -> pitch & roll (flight attitude)
    //     body   -> static model-yaw offset; holds all the meshes
    const attitude = new THREE.Group();
    this.group.add(attitude);
    this.attitude = attitude;

    const body = new THREE.Group();
    body.rotation.y = this.modelYaw;
    attitude.add(body);
    this.body = body;

    // --- Main fuselage (tapered) ---
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 5.4, 6), olive);
    fuse.rotation.z = Math.PI / 2;
    fuse.rotation.y = Math.PI / 6;
    fuse.scale.set(1, 1.15, 1);
    fuse.position.set(0.2, 0, 0);
    body.add(fuse);

    // Nose sensor turret (Apache's distinctive chin)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 6), oliveDk);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(3.0, -0.1, 0);
    body.add(nose);

    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), dark);
    chin.position.set(3.1, -0.55, 0);
    chin.scale.set(1, 0.8, 1);
    body.add(chin);

    // TADS/PNVS sensor drum
    const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), metal);
    sensor.rotation.x = Math.PI / 2;
    sensor.position.set(3.35, -0.5, 0);
    body.add(sensor);

    // --- Tandem cockpit canopy (stepped, two seats) ---
    const canopyF = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.05), glass);
    canopyF.position.set(1.9, 0.55, 0);
    canopyF.rotation.z = -0.08;
    body.add(canopyF);

    const canopyR = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.15), glass);
    canopyR.position.set(0.55, 0.72, 0);
    body.add(canopyR);

    // Cockpit frame between seats
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 1.1), oliveDk);
    frame.position.set(1.25, 0.62, 0);
    body.add(frame);

    // --- Engine nacelles (twin, either side of the rotor mast) ---
    for (const s of [-1, 1]) {
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 2.4, 6), oliveDk);
      nac.rotation.z = Math.PI / 2;
      nac.position.set(-0.5, 0.35, s * 0.6);
      body.add(nac);
      // exhaust
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.4, 6), dark);
      ex.rotation.z = Math.PI / 2;
      ex.position.set(-1.7, 0.4, s * 0.6);
      body.add(ex);
    }

    // --- Rotor mast / hub ---
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 6), metal);
    mast.position.set(0.3, 1.15, 0);
    body.add(mast);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 6), dark);
    hub.position.set(0.3, 1.7, 0);
    body.add(hub);

    // --- Main rotor (4 blades) ---
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0.3, 1.78, 0);
    const bladeGeo = new THREE.BoxGeometry(7.4, 0.06, 0.42);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(bladeGeo, dark);
      blade.rotation.y = (i / 4) * Math.PI * 2;
      // offset so blade root sits at hub
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 4) * Math.PI * 2;
      blade.rotation.y = 0;
      blade.position.set(3.4, 0, 0);
      pivot.add(blade);
      mainRotor.add(pivot);
    }
    body.add(mainRotor);
    this.mainRotor = mainRotor;

    // Spinning rotor disc (semi-transparent blur when at speed)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(3.7, 24),
      new THREE.MeshBasicMaterial({ color: 0x1a1a12, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0.3, 1.82, 0);
    body.add(disc);
    this.rotorDisc = disc;

    // --- Tail boom ---
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.16, 4.6, 6), olive);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(-3.6, 0.25, 0);
    body.add(boom);

    // Vertical stabiliser
    const vstab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.14), oliveDk);
    vstab.position.set(-5.7, 0.8, 0);
    vstab.rotation.z = 0.35;
    body.add(vstab);

    // Horizontal stabilator
    const hstab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 2.6), oliveDk);
    hstab.position.set(-5.2, 0.35, 0);
    body.add(hstab);

    // --- Tail rotor ---
    const tailRotor = new THREE.Group();
    tailRotor.position.set(-5.75, 0.9, 0.28);
    const tBladeGeo = new THREE.BoxGeometry(0.08, 1.7, 0.24);
    for (let i = 0; i < 4; i++) {
      const tb = new THREE.Mesh(tBladeGeo, dark);
      const pivot = new THREE.Group();
      pivot.rotation.x = (i / 4) * Math.PI * 2;
      tb.position.set(0, 0.85, 0);
      pivot.add(tb);
      tailRotor.add(pivot);
    }
    body.add(tailRotor);
    this.tailRotor = tailRotor;

    // --- Stub wings + weapon pylons ---
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 1.7), oliveDk);
      wing.position.set(0.2, 0.05, s * 1.35);
      body.add(wing);

      // Pylon
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), dark);
      pylon.position.set(0.2, -0.25, s * 2.0);
      body.add(pylon);

      // Rocket pod
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.2, 8), metal);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(0.5, -0.35, s * 2.0);
      body.add(pod);

      // Hellfire rail
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.5), dark);
      rail.position.set(0.2, -0.55, s * 1.6);
      body.add(rail);
    }

    // --- Landing gear (tailwheel + two main) ---
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), metal);
      strut.position.set(0.6, -1.0, s * 0.9);
      strut.rotation.x = s * 0.18;
      body.add(strut);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(0.6, -1.45, s * 1.0);
      body.add(wheel);
    }
    const tailStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), metal);
    tailStrut.position.set(-5.2, -0.15, 0);
    body.add(tailStrut);
    const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 8), dark);
    tailWheel.rotation.x = Math.PI / 2;
    tailWheel.position.set(-5.2, -0.42, 0);
    body.add(tailWheel);

    // Center the assembly so it rotates about its mass, roughly
    body.position.set(0, 0, 0);
  }

  /**
   * Advance the flight model.
   * @param {number} dt   delta seconds
   * @param {object} ctl  control inputs, all -1..1 unless noted
   *        ctl.collective : + up / - down
   *        ctl.pitch      : + nose down / - nose up (forward drift on +)
   *        ctl.roll       : + right / - left
   *        ctl.yaw        : + right / - left
   *        ctl.hover      : boolean, hover assist held
   * @param {number} groundY  terrain height beneath the aircraft
   */
  update(dt, ctl, groundY = 0) {
    // Rotor spool
    this.rotorSpeed += (this.targetRotor - this.rotorSpeed) * Math.min(1, dt * 1.2);
    const powered = this.rotorSpeed > 0.35;

    const authority = powered ? this.rotorSpeed : 0;

    // Attitude target from cyclic
    const maxTilt = 0.42;
    let targetPitch = ctl.pitch * maxTilt;
    let targetBank = -ctl.roll * maxTilt;

    if (ctl.hover) {
      targetPitch = 0;
      targetBank = 0;
    }

    // Smooth attitude
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 4);
    this.bank += (targetBank - this.bank) * Math.min(1, dt * 4);

    // Yaw from pedals
    this.heading -= ctl.yaw * 1.6 * dt * authority;

    // --- Translation ---
    // Forward direction from heading
    const fwd = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const right = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));

    // Cyclic tilt -> horizontal acceleration
    const accel = new THREE.Vector3();
    accel.addScaledVector(fwd, this.pitch * 14 * authority);
    accel.addScaledVector(right, this.bank * -14 * authority);

    // Vertical: collective vs gravity, with hover auto-hold
    const gravity = 9.8;
    let lift;
    if (ctl.hover && powered) {
      // hold altitude: PD toward zero vertical velocity
      lift = gravity - this.velocity.y * 3.0;
    } else {
      lift = gravity + ctl.collective * 16 * authority;
      if (!powered) lift = 0; // no power -> fall
    }
    accel.y = lift - gravity;

    // Integrate velocity with drag
    this.velocity.addScaledVector(accel, dt);
    const dragXZ = Math.pow(0.12, dt); // strong horizontal damping (arcade feel)
    const dragY = Math.pow(0.5, dt);
    this.velocity.x *= dragXZ;
    this.velocity.z *= dragXZ;
    this.velocity.y *= dragY;

    // Integrate position
    this.group.position.addScaledVector(this.velocity, dt);

    // Ground / ceiling limits
    const minY = groundY + 1.6;
    if (this.group.position.y < minY) {
      this.group.position.y = minY;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
    const maxY = 220;
    if (this.group.position.y > maxY) {
      this.group.position.y = maxY;
      if (this.velocity.y > 0) this.velocity.y = 0;
    }
    this.altitude = this.group.position.y - groundY;

    // Apply attitude to the model.
    // Body local frame: +X = nose (forward), +Z = right (lateral), +Y = up.
    // Pitch (nose up/down) rotates about the lateral (Z) axis; roll/bank
    // rotates about the longitudinal (X) axis. A subtle idle bob is folded
    // in as a pitch offset while grounded & spooling.
    const bob = powered ? 0 : Math.sin(performance.now() * 0.002) * 0.02;
    this.group.rotation.set(0, this.heading, 0);
    this.attitude.rotation.set(-this.bank, 0, -this.pitch + bob);

    // Animate rotors
    const rpm = 42 * this.rotorSpeed;
    if (this.mainRotor) this.mainRotor.rotation.y += rpm * dt;
    if (this.tailRotor) this.tailRotor.rotation.x += rpm * 1.4 * dt;

    // Blur the disc at speed
    if (this.rotorDisc) {
      this.rotorDisc.material.opacity = THREE.MathUtils.clamp(this.rotorSpeed - 0.3, 0, 1) * 0.28;
    }
  }

  get speedKmh() {
    return Math.hypot(this.velocity.x, this.velocity.z) * 3.6;
  }
  get headingDeg() {
    let d = (this.heading * 180 / Math.PI) % 360;
    if (d < 0) d += 360;
    return d;
  }
}
