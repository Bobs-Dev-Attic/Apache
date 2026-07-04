import * as THREE from 'three';

/**
 * Weapon — the Apache's M230 chain gun.
 * ------------------------------------
 * Arms with `G`. While armed, the gun mount slews to track the aim point
 * (the cursor projected onto the terrain). Holding fire (right mouse button)
 * spits tracer rounds from the muzzle toward that point at machine-gun cadence,
 * with a muzzle flash and a dust impact where each round lands.
 *
 * The caller is responsible for computing the world-space aim point (via a
 * raycast from the cursor) and calling setAim()/setFiring() each frame.
 */
export class Weapon {
  constructor(scene, heli) {
    this.scene = scene;
    this.heli = heli;

    this.armed = false;
    this.firing = false;
    this.aim = new THREE.Vector3(20, 0, 0);
    this.hasAim = false;

    this.fireRate = 11;            // rounds / second
    this._cooldown = 0;
    this.tracerSpeed = 200;        // m/s (slow enough to read as a streak)

    this.tracers = [];
    this.impacts = [];
    this.shotsFired = 0;

    this._tmpFrom = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    this._tmpLocal = new THREE.Vector3();

    this._buildMuzzleFlash();
  }

  _buildMuzzleFlash() {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0, depthWrite: false })
    );
    flash.scale.set(1.4, 0.7, 0.7);
    flash.visible = false;
    this.heli.gunMuzzle.add(flash);
    this._flash = flash;
    this._flashTimer = 0;
  }

  setAim(point, hasAim) {
    if (point) this.aim.copy(point);
    this.hasAim = !!hasAim;
  }

  setFiring(on) {
    this.firing = on && this.armed;
  }

  _muzzleWorld(out) {
    return this.heli.gunMuzzle.getWorldPosition(out);
  }

  /** Slew the gun mount so its barrel (+X) points at the aim point. */
  _aimGun() {
    if (!this.armed) {
      // relax to forward when stowed
      this.heli.gunMount.rotation.y *= 0.85;
      this.heli.gunMount.rotation.z *= 0.85;
      return;
    }
    // aim point in the body's local space (where the gun mount lives)
    const local = this.heli.body.worldToLocal(this._tmpLocal.copy(this.aim));
    const dx = local.x - this.heli.gunMount.position.x;
    const dy = local.y - this.heli.gunMount.position.y;
    const dz = local.z - this.heli.gunMount.position.z;
    const h = Math.hypot(dx, dz) || 1e-3;
    let yaw = Math.atan2(-dz, dx);
    let pitch = Math.atan2(dy, h);
    // keep it to a sane forward cone
    yaw = THREE.MathUtils.clamp(yaw, -1.9, 1.9);
    pitch = THREE.MathUtils.clamp(pitch, -1.2, 0.6);
    const m = this.heli.gunMount.rotation;
    m.y += (yaw - m.y) * 0.4;
    m.z += (pitch - m.z) * 0.4;
  }

  _spawnTracer() {
    const from = this._muzzleWorld(this._tmpFrom).clone();
    const dir = this._tmpDir.copy(this.aim).sub(from);
    const dist = dir.length();
    if (dist < 0.001) return;
    dir.normalize();

    const geo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe15a });
    const mesh = new THREE.Mesh(geo, mat);
    // orient the cylinder (local +Y) along the travel direction
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(from);
    this.scene.add(mesh);

    this.tracers.push({ mesh, from, dir, travelled: 0, total: dist, speed: this.tracerSpeed });
    this.shotsFired++;

    // muzzle flash
    this._flash.visible = true;
    this._flash.material.opacity = 0.9;
    this._flashTimer = 0.05;

    // slight aim scatter so it reads like a machine gun (re-aim uses fresh aim each shot)
  }

  _spawnImpact(pos) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xcaa46a, transparent: true, opacity: 0.85, depthWrite: false })
    );
    puff.position.copy(pos);
    this.scene.add(puff);
    this.impacts.push({ mesh: puff, life: 0.32, max: 0.32 });

    // a brief spark
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 1, depthWrite: false })
    );
    spark.position.copy(pos);
    this.scene.add(spark);
    this.impacts.push({ mesh: spark, life: 0.12, max: 0.12, spark: true });
  }

  update(dt) {
    this._aimGun();

    // muzzle flash decay
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      this._flash.material.opacity = Math.max(0, this._flashTimer / 0.05) * 0.9;
      if (this._flashTimer <= 0) this._flash.visible = false;
    }

    // fire cadence
    this._cooldown -= dt;
    if (this.firing && this.armed && this.hasAim) {
      while (this._cooldown <= 0) {
        this._spawnTracer();
        this._cooldown += 1 / this.fireRate;
      }
    } else if (this._cooldown < 0) {
      this._cooldown = 0;
    }

    // advance tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.travelled += t.speed * dt;
      if (t.travelled >= t.total) {
        const hit = t.from.clone().addScaledVector(t.dir, t.total);
        this._spawnImpact(hit);
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mesh.position.copy(t.from).addScaledVector(t.dir, t.travelled);
      }
    }

    // fade impacts
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const p = this.impacts[i];
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.mesh.material.opacity = (p.spark ? 1 : 0.85) * k;
      if (!p.spark) p.mesh.scale.setScalar(1 + (1 - k) * 1.6);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.impacts.splice(i, 1);
      }
    }
  }
}
