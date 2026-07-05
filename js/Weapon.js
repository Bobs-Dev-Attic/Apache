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
    this.ricochets = [];           // spark fragments bouncing off armour
    this.shotsFired = 0;
    this.rounds = Infinity;        // remaining 30mm rounds (set by main)
    this.unlimited = false;
    this.getTargets = null;        // () => target list, for hit tests
    this.onTargetHit = null;       // (target, point) => apply damage

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
    let dist = dir.length();
    if (dist < 0.001) return;
    dir.normalize();

    // Hit test against targets along the shot: the nearest whose centre is
    // within its radius of the ray gets hit, and the tracer stops there.
    let hitTarget = null;
    const tgts = this.getTargets ? this.getTargets() : null;
    if (tgts) {
      for (const t of tgts) {
        if (!t.alive) continue;
        const px = t.pos.x - from.x, py = t.pos.y - from.y, pz = t.pos.z - from.z;
        const proj = px * dir.x + py * dir.y + pz * dir.z;   // along the ray
        if (proj < 0 || proj > dist) continue;
        const cx = from.x + dir.x * proj, cy = from.y + dir.y * proj, cz = from.z + dir.z * proj;
        const d = Math.hypot(t.pos.x - cx, t.pos.y - cy, t.pos.z - cz);
        if (d < (t.radius || 2)) { dist = proj; hitTarget = t; }
      }
    }

    const geo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe15a });
    const mesh = new THREE.Mesh(geo, mat);
    // orient the cylinder (local +Y) along the travel direction
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(from);
    this.scene.add(mesh);

    this.tracers.push({ mesh, from, dir: dir.clone(), travelled: 0, total: dist, speed: this.tracerSpeed, hitTarget });
    this.shotsFired++;

    // muzzle flash
    this._flash.visible = true;
    this._flash.material.opacity = 0.9;
    this._flashTimer = 0.05;

    // slight aim scatter so it reads like a machine gun (re-aim uses fresh aim each shot)
  }

  /** A few bright sparks that deflect off the point of impact on armour. */
  _ricochet(pos, inDir) {
    // reflect the incoming direction off a roughly-upward surface, then scatter
    const base = new THREE.Vector3(inDir.x, Math.abs(inDir.y) + 0.6, inDir.z).normalize();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xffe06a, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      spark.position.copy(pos);
      this.scene.add(spark);
      const spd = 8 + Math.random() * 12;
      const vel = base.clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 1.1, Math.random() * 0.6, (Math.random() - 0.5) * 1.1))
        .normalize().multiplyScalar(spd);
      const max = 0.25 + Math.random() * 0.3;
      this.ricochets.push({ mesh: spark, vel, life: max, max });
    }
    // a small flash at the strike
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flash.position.copy(pos);
    this.scene.add(flash);
    this.impacts.push({ mesh: flash, life: 0.1, max: 0.1, spark: true });
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
        if (!this.unlimited && this.rounds <= 0) { this.firing = false; break; }  // out of rounds
        this._spawnTracer();
        if (!this.unlimited) this.rounds--;
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
        if (t.hitTarget && t.hitTarget.alive) {
          this.onTargetHit?.(t.hitTarget, hit);
          this._ricochet(hit, t.dir);      // sparks bounce off the armour
        } else {
          this._spawnImpact(hit);          // dust on the ground
        }
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mesh.position.copy(t.from).addScaledVector(t.dir, t.travelled);
      }
    }

    // ricochet sparks (ballistic, brief)
    for (let i = this.ricochets.length - 1; i >= 0; i--) {
      const s = this.ricochets[i];
      s.life -= dt;
      s.vel.y -= 26 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.material.opacity = Math.max(0, s.life / s.max);
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.ricochets.splice(i, 1);
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
