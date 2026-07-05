import * as THREE from 'three';

/**
 * Targets — enemy ground units, target locking/cycling, rockets & explosions.
 * -------------------------------------------------------------------------
 * Scatters a handful of low-poly enemy vehicles across the desert. Rocket
 * mode (`R`) locks a target; Tab cycles to the next live one. Firing launches
 * a Hydra rocket from the wing that flies to the locked target and detonates,
 * destroying it.
 *
 * The caller owns the sensor camera / MFD; this module just exposes the target
 * list, the locked target, and the systems that move rockets and fade blasts.
 */
export class Targets {
  constructor(scene, env) {
    this.scene = scene;
    this.env = env;
    this.list = [];
    this.locked = -1;
    this.rockets = [];
    this.missiles = [];
    this.explosions = [];
    this.debris = [];      // ballistic chunks / vehicle parts thrown by a blast
    this.hulks = [];        // burning wrecks that keep smoking
    this.scorches = [];     // scorch stains on the ground
    this._spawn();
  }

  _mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.2, ...opts });
  }

  _makeTank() {
    const g = new THREE.Group();
    const hullMat = this._mat(0x6b5a2e);
    const dark = this._mat(0x2e2a1c);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 2.4), hullMat);
    hull.position.y = 0.9; g.add(hull);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.8, 6), hullMat);
    turret.position.y = 1.7; g.add(turret);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), dark);
    barrel.rotation.z = Math.PI / 2; barrel.position.set(1.8, 1.75, 0); g.add(barrel);
    for (const s of [-1, 1]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.6, 0.6), dark);
      track.position.set(0, 0.4, s * 1.15); g.add(track);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  _makeTruck() {
    const g = new THREE.Group();
    const body = this._mat(0x7a6b3a);
    const dark = this._mat(0x2a271b);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.8), body);
    cab.position.set(1.1, 1.1, 0); g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 2.0), body);
    bed.position.set(-0.7, 0.95, 0); g.add(bed);
    // mounted gun on the bed
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), dark);
    post.position.set(-0.7, 1.7, 0); g.add(post);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), dark);
    gun.rotation.z = Math.PI / 2; gun.position.set(-0.1, 2.0, 0); g.add(gun);
    for (const x of [1.0, -1.0]) for (const s of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8), dark);
      wheel.rotation.x = Math.PI / 2; wheel.position.set(x, 0.4, s * 1.0); g.add(wheel);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  _spawn() {
    let seed = 4242;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const count = 12;
    for (let i = 0; i < count; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = 45 + rnd() * 470;   // spread across the larger map
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const y = this.env.heightAt(x, z);
      const isTank = rnd() > 0.45;
      const group = isTank ? this._makeTank() : this._makeTruck();
      group.position.set(x, y, z);
      group.rotation.y = rnd() * Math.PI * 2;
      this.scene.add(group);
      this.list.push({
        group,
        pos: new THREE.Vector3(x, y + 1.4, z),
        alive: true,
        name: isTank ? 'T-72 TANK' : 'TECHNICAL',
        id: i + 1,
        radius: isTank ? 2.4 : 1.8,
      });
    }
  }

  get lockedTarget() {
    return this.locked >= 0 && this.list[this.locked]?.alive ? this.list[this.locked] : null;
  }

  aliveCount() { return this.list.reduce((n, t) => n + (t.alive ? 1 : 0), 0); }

  /** 1-based index of the locked target among the *living* targets, for HUD. */
  lockedOrdinal() {
    if (this.locked < 0) return 0;
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      if (this.list[i].alive) { n++; if (i === this.locked) return n; }
    }
    return 0;
  }

  lockNearest(from) {
    let best = -1, bd = Infinity;
    this.list.forEach((t, i) => {
      if (!t.alive) return;
      const d = from.distanceTo(t.pos);
      if (d < bd) { bd = d; best = i; }
    });
    this.locked = best;
  }

  cycle(dir = 1) {
    if (this.aliveCount() === 0) { this.locked = -1; return; }
    const n = this.list.length;
    const step = dir < 0 ? -1 : 1;   // +1 next, -1 previous
    let i = this.locked;
    for (let k = 0; k < n; k++) {
      i = (i + step + n) % n;
      if (this.list[i].alive) { this.locked = i; return; }
    }
  }

  fireRocketAt(fromPos, target) {
    if (!target || !target.alive) return false;
    const mesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xded4c0, flatShading: true, roughness: 0.6 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 6), bodyMat);
    b.rotation.x = Math.PI / 2; mesh.add(b);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 6), this._mat(0x33312a));
    tip.rotation.x = Math.PI / 2; tip.position.z = 0.7; mesh.add(tip);
    // flame
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.7, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.9 })
    );
    flame.rotation.x = -Math.PI / 2; flame.position.z = -0.7; mesh.add(flame);
    mesh.position.copy(fromPos);
    this.scene.add(mesh);
    this.rockets.push({ mesh, flame, target, speed: 78, pos: fromPos.clone() });
    return true;
  }

  _detonate(pos, target, scale = 1) {
    const groundY = this.env.heightAt(pos.x, pos.z);
    // fireball
    const fire = new THREE.Mesh(
      new THREE.SphereGeometry(1.0 * scale, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb44a, transparent: true, opacity: 1, depthWrite: false })
    );
    fire.position.copy(pos);
    this.scene.add(fire);
    this.explosions.push({ mesh: fire, life: 0.5, max: 0.5, grow: 5 * scale });
    // rolling smoke ball
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 * scale, 7, 6),
      new THREE.MeshBasicMaterial({ color: 0x3b342c, transparent: true, opacity: 0.9, depthWrite: false })
    );
    smoke.position.copy(pos).y += 0.6;
    this.scene.add(smoke);
    this.explosions.push({ mesh: smoke, life: 1.1, max: 1.1, grow: 3.5 * scale, rise: 2.2 });

    // thrown dirt, dust and fragments
    this._spawnDebris(pos, groundY, scale);

    // shred the vehicle: parts fly off, a burning hulk + ground stain remain
    if (target && target.group) {
      target.alive = false;
      this._wreckTarget(target, pos, groundY, scale);
      this._scorch(target.pos, groundY, target.radius);
    }
  }

  _rndSpin(s = 8) {
    return new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  /** Dirt clods, a dust cloud and metal fragments blown out of the impact. */
  _spawnDebris(pos, groundY, scale) {
    // chunks of dirt / metal that arc out under gravity
    const chunks = Math.round(11 * scale);
    for (let k = 0; k < chunks; k++) {
      const metal = Math.random() < 0.35;
      const s = (metal ? 0.1 : 0.14) + Math.random() * (metal ? 0.16 : 0.28);
      const geo = Math.random() < 0.6
        ? new THREE.TetrahedronGeometry(s)
        : new THREE.BoxGeometry(s, s * (0.6 + Math.random()), s);
      const mesh = new THREE.Mesh(geo, this._mat(metal ? 0x2b2822 : 0x4a3a20, { roughness: 1, metalness: metal ? 0.5 : 0.1 }));
      mesh.castShadow = true;
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * (metal ? 12 : 8);
      const vel = new THREE.Vector3(Math.cos(ang) * spd, 6 + Math.random() * 9, Math.sin(ang) * spd);
      this.debris.push({
        mesh, pos: pos.clone(), vel, angVel: this._rndSpin(12),
        groundY, life: 1.6 + Math.random() * 1.4, fade: 0.5,
      });
    }
    // low, spreading dust cloud (reuses the explosion fade/grow system)
    const dust = Math.round(6 * scale);
    for (let k = 0; k < dust; k++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 + Math.random() * 0.5, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x8a7550, transparent: true, opacity: 0.5, depthWrite: false })
      );
      puff.position.set(
        pos.x + (Math.random() - 0.5) * 2.0, groundY + 0.3 + Math.random() * 0.6,
        pos.z + (Math.random() - 0.5) * 2.0
      );
      this.scene.add(puff);
      this.explosions.push({ mesh: puff, life: 1.0 + Math.random() * 0.7, max: 1.7, grow: 2.6 * scale, rise: 1.1 });
    }
  }

  /** Break the vehicle apart: throw its upper parts, char the rest into a
   *  smoldering hulk with flames. */
  _wreckTarget(target, pos, groundY, scale) {
    const g = target.group;
    g.updateMatrixWorld(true);
    const parts = g.children.filter(o => o.isMesh);
    const hulkMat = this._mat(0x1a1712, { roughness: 1, metalness: 0.1 });
    let flew = 0;
    for (const child of parts) {
      // upper parts (turret, barrel, gun, mount) blow off; the base stays
      if (child.position.y > 1.3) {
        const wp = child.getWorldPosition(new THREE.Vector3());
        const wq = child.getWorldQuaternion(new THREE.Quaternion());
        g.remove(child);
        child.material = this._mat(0x241d15, { roughness: 1, metalness: 0.3 });
        child.position.copy(wp);
        child.quaternion.copy(wq);
        this.scene.add(child);
        const out = new THREE.Vector3(wp.x - pos.x, 0, wp.z - pos.z);
        if (out.lengthSq() < 0.02) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        out.normalize();
        const spd = 4 + Math.random() * 6;
        const vel = new THREE.Vector3(out.x * spd, 8 + Math.random() * 6, out.z * spd);
        this.debris.push({
          mesh: child, pos: wp.clone(), vel, angVel: this._rndSpin(7),
          groundY, life: 4 + Math.random() * 2, fade: 0.8, ownMat: true,
        });
        flew++;
      } else {
        child.material = hulkMat;
      }
    }
    // settle + tilt the charred hulk
    g.position.y = groundY - 0.12;
    g.rotation.z += (Math.random() - 0.5) * 0.28;
    g.rotation.x += (Math.random() - 0.5) * 0.16;
    // flames riding on the wreck
    const flames = this._makeFlames(scale);
    flames.position.set(0, 1.1, 0);
    g.add(flames);
    this.hulks.push({ group: g, pos: target.pos.clone(), groundY, smokeT: 0, flames });
    void flew;
  }

  _makeFlames(scale) {
    const grp = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.28 * scale, 1.0 * scale, 6),
        new THREE.MeshBasicMaterial({ color: k === 1 ? 0xffd24a : 0xff7a26, transparent: true, opacity: 0.9, depthWrite: false })
      );
      flame.position.set((k - 1) * 0.5 * scale, 0.4 + Math.random() * 0.2, (Math.random() - 0.5) * 0.6);
      grp.add(flame);
    }
    return grp;
  }

  /** Flat black scorch stain painted on the ground under a kill. */
  _scorch(center, groundY, radius) {
    const r = (radius || 2) * 2.4;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0a0806, transparent: true, opacity: 0, depthWrite: false,
    });
    mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
    const decal = new THREE.Mesh(new THREE.CircleGeometry(r, 22), mat);
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(center.x, groundY + 0.06, center.z);
    decal.receiveShadow = true;
    this.scene.add(decal);
    this.scorches.push({ mesh: decal, t: 0, fadeIn: 0.5, opacity: 0.78 });
  }

  _trailPuff(pos) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xbfb8ab, transparent: true, opacity: 0.7, depthWrite: false })
    );
    puff.position.copy(pos);
    this.scene.add(puff);
    this.explosions.push({ mesh: puff, life: 0.6, max: 0.6, grow: 1.6, rise: 0.6 });
  }

  /**
   * Guided top-attack missile. It drops off the rail, lights the motor and
   * climbs to a high cruise altitude above the target, then pitches over and
   * dives straight down onto it (Javelin-style top attack).
   */
  fireMissileAt(fromPos, target) {
    if (!target || !target.alive) return false;
    const mesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb9b2a0, flatShading: true, roughness: 0.5 });
    const dark = this._mat(0x2a281f);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.6, 6), bodyMat);
    b.rotation.x = Math.PI / 2; mesh.add(b);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 6), dark);
    tip.rotation.x = Math.PI / 2; tip.position.z = 1.0; mesh.add(tip);
    for (let f = 0; f < 4; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.34), dark);
      fin.position.z = -0.7;
      fin.rotation.z = (f / 4) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.z = (f / 4) * Math.PI * 2;
      fin.rotation.z = 0; fin.position.set(0.22, 0, -0.7);
      pivot.add(fin); mesh.add(pivot);
    }
    mesh.position.copy(fromPos);
    this.scene.add(mesh);
    // Horizontal bearing to the target (used to nudge the initial drop forward).
    const toTarget = target.pos.clone().sub(fromPos);
    const launchFwd = new THREE.Vector3(toTarget.x, 0, toTarget.z).normalize();
    // Starts by dropping off the rail: a shallow forward dip before the motor
    // lights (a steep nose-down would be unrecoverable at this turn rate).
    const dir = new THREE.Vector3(launchFwd.x, -0.6, launchFwd.z).normalize();
    this.missiles.push({
      mesh, target, pos: fromPos.clone(), dir,
      speed: 14, maxSpeed: 92, turn: 3.2, trailT: 0,
      phase: 'drop', phaseT: 0, cruise: 30, launchFwd,
    });
    return true;
  }

  update(dt, onKill) {
    // rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      const targetPos = r.target.alive ? r.target.pos : r.pos; // if target died, fly on & fizzle
      const dir = targetPos.clone().sub(r.pos);
      const dist = dir.length();
      const step = r.speed * dt;
      if (dist <= step + 0.5 || !r.target.alive) {
        this._detonate(r.target.alive ? r.target.pos : r.pos, r.target.alive ? r.target : null);
        this.scene.remove(r.mesh);
        r.mesh.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        this.rockets.splice(i, 1);
        if (onKill) onKill();
        continue;
      }
      dir.normalize();
      r.pos.addScaledVector(dir, step);
      r.mesh.position.copy(r.pos);
      r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      r.flame.material.opacity = 0.6 + Math.random() * 0.35;
    }

    // guided top-attack missiles: drop -> climb to altitude -> dive on target
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      const tpos = m.target.alive ? m.target.pos : m.pos;
      const distToTarget = m.pos.distanceTo(tpos);

      // detonate on impact (only reachable in the terminal dive) or if the
      // target is already gone
      if (distToTarget <= (m.speed * dt + 0.6) || !m.target.alive) {
        this._detonate(m.target.alive ? m.target.pos : m.pos, m.target.alive ? m.target : null, 1.6);
        this.scene.remove(m.mesh);
        m.mesh.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        this.missiles.splice(i, 1);
        if (onKill) onKill();
        continue;
      }

      m.phaseT += dt;
      const dx = tpos.x - m.pos.x, dz = tpos.z - m.pos.z;
      const horiz = Math.hypot(dx, dz);
      const desired = new THREE.Vector3();
      if (m.phase === 'drop') {
        // shallow forward dip off the rail for a beat, then light the motor
        desired.set(m.launchFwd.x, -0.6, m.launchFwd.z);
        if (m.phaseT >= 0.28) { m.phase = 'climb'; m.phaseT = 0; }
      } else if (m.phase === 'climb') {
        // Climb hard to a high cruise altitude. While still gaining height the
        // horizontal pull is throttled so it goes steeply UP first; once high
        // it levels off and cruises over the target before tipping into a dive.
        const up = (tpos.y + m.cruise) - m.pos.y;
        if (up > 4) {
          const hs = Math.min(1, 10 / (horiz + 0.01));  // limit sideways drift while climbing
          desired.set(dx * hs, Math.max(up, 22), dz * hs);
        } else {
          desired.set(dx, up, dz);
        }
        // tip over once at altitude and roughly over the target, if it has
        // clearly overshot the apex, or after a safety timeout
        if ((up <= 3 && horiz < 16) || up < -3 || m.phaseT > 6) { m.phase = 'dive'; m.phaseT = 0; }
      } else { // dive straight down onto the target
        desired.subVectors(tpos, m.pos);
      }
      desired.normalize();

      // steer current heading toward the desired direction with a limited turn
      // rate; the terminal dive pitches over faster
      const ang = m.dir.angleTo(desired);
      const turn = (m.phase === 'dive' ? m.turn * 2.4 : m.turn) * dt;
      if (ang <= turn || ang < 1e-4) m.dir.copy(desired);
      else m.dir.lerp(desired, turn / ang).normalize();

      // gentle during the drop, then accelerate to cruise once the motor lights
      m.speed = m.phase === 'drop' ? 14 : Math.min(m.maxSpeed, m.speed + 70 * dt);
      m.pos.addScaledVector(m.dir, m.speed * dt);
      m.mesh.position.copy(m.pos);
      m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), m.dir);
      // smoke trail
      m.trailT -= dt;
      if (m.trailT <= 0) { this._trailPuff(m.pos); m.trailT = 0.028; }
    }

    // explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.life -= dt;
      const t = 1 - Math.max(0, e.life / e.max);
      e.mesh.scale.setScalar(1 + t * e.grow);
      e.mesh.material.opacity = Math.max(0, e.life / e.max) * (e.rise ? 0.9 : 1);
      if (e.rise) e.mesh.position.y += e.rise * dt;
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.explosions.splice(i, 1);
      }
    }

    // flying debris / vehicle parts (ballistic, bounce, settle, fade)
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (!d.settled) {
        d.vel.y -= 24 * dt;                 // gravity
        d.pos.addScaledVector(d.vel, dt);
        d.mesh.rotation.x += d.angVel.x * dt;
        d.mesh.rotation.y += d.angVel.y * dt;
        d.mesh.rotation.z += d.angVel.z * dt;
        if (d.pos.y <= d.groundY + 0.06) {
          d.pos.y = d.groundY + 0.06;
          if (!d.bounced && d.vel.y < -3) {   // one small bounce, then rest
            d.vel.y *= -0.32; d.vel.x *= 0.4; d.vel.z *= 0.4;
            d.angVel.multiplyScalar(0.4); d.bounced = true;
          } else {
            d.settled = true; d.vel.set(0, 0, 0);
          }
        }
        d.mesh.position.copy(d.pos);
      }
      if (d.life < d.fade) {
        d.mesh.material.transparent = true;
        d.mesh.material.opacity = Math.max(0, d.life / d.fade);
      }
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
        this.debris.splice(i, 1);
      }
    }

    // burning hulks: flicker the flames and keep a smoke column rising
    for (const h of this.hulks) {
      for (const f of h.flames.children) {
        f.scale.set(0.8 + Math.random() * 0.5, 0.7 + Math.random() * 0.7, 0.8 + Math.random() * 0.5);
        f.material.opacity = 0.6 + Math.random() * 0.4;
      }
      h.smokeT -= dt;
      if (h.smokeT <= 0) {
        h.smokeT = 0.24;
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.6 + Math.random() * 0.4, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0x171310, transparent: true, opacity: 0.7, depthWrite: false })
        );
        puff.position.set(
          h.pos.x + (Math.random() - 0.5) * 0.8, h.groundY + 1.4,
          h.pos.z + (Math.random() - 0.5) * 0.8
        );
        this.scene.add(puff);
        this.explosions.push({ mesh: puff, life: 2.4 + Math.random(), max: 3.4, grow: 3.0, rise: 3.6 });
      }
    }

    // scorch stains fade in, then persist
    for (const sc of this.scorches) {
      if (sc.t < sc.fadeIn) {
        sc.t += dt;
        sc.mesh.material.opacity = Math.min(sc.opacity, (sc.t / sc.fadeIn) * sc.opacity);
      }
    }
  }
}
