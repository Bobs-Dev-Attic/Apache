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
    const count = 7;
    for (let i = 0; i < count; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = 40 + rnd() * 95;
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

  cycle() {
    if (this.aliveCount() === 0) { this.locked = -1; return; }
    let i = this.locked;
    for (let k = 0; k < this.list.length; k++) {
      i = (i + 1) % this.list.length;
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
    if (target) {
      target.alive = false;
      target.group.visible = false;
    }
    // fireball
    const fire = new THREE.Mesh(
      new THREE.SphereGeometry(1.0 * scale, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb44a, transparent: true, opacity: 1, depthWrite: false })
    );
    fire.position.copy(pos);
    this.scene.add(fire);
    this.explosions.push({ mesh: fire, life: 0.5, max: 0.5, grow: 5 * scale });
    // smoke
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 * scale, 7, 6),
      new THREE.MeshBasicMaterial({ color: 0x3b342c, transparent: true, opacity: 0.9, depthWrite: false })
    );
    smoke.position.copy(pos).y += 0.6;
    this.scene.add(smoke);
    this.explosions.push({ mesh: smoke, life: 1.1, max: 1.1, grow: 3.5 * scale, rise: 2.2 });
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

  /** Guided Hellfire-style missile: launches, then homes onto the target. */
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
    // initial direction: forward + slightly up (loft), then it homes
    const dir = target.pos.clone().sub(fromPos).normalize();
    dir.y += 0.35; dir.normalize();
    this.missiles.push({ mesh, target, pos: fromPos.clone(), dir, speed: 26, maxSpeed: 96, turn: 2.4, trailT: 0 });
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

    // guided missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      const aim = m.target.alive ? m.target.pos : m.pos;
      const desired = aim.clone().sub(m.pos);
      const dist = desired.length();
      if (dist <= (m.speed * dt + 0.6) || !m.target.alive) {
        this._detonate(m.target.alive ? m.target.pos : m.pos, m.target.alive ? m.target : null, 1.6);
        this.scene.remove(m.mesh);
        m.mesh.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        this.missiles.splice(i, 1);
        if (onKill) onKill();
        continue;
      }
      desired.normalize();
      // steer current heading toward the target with a limited turn rate
      const ang = m.dir.angleTo(desired);
      const step = m.turn * dt;
      if (ang <= step || ang < 1e-4) m.dir.copy(desired);
      else m.dir.lerp(desired, step / ang).normalize();
      m.speed = Math.min(m.maxSpeed, m.speed + 70 * dt);
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
  }
}
