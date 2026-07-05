import * as THREE from 'three';

/**
 * Soldiers — dismounted crew that flee a destroyed vehicle.
 * ---------------------------------------------------------
 * When a target is destroyed, any survivors are spawned as small low-poly
 * figures near the wreck. Each behaves one of three ways:
 *   - run   : upright, sprinting away from the wreck, legs & arms pumping
 *   - crawl : wounded — pitched forward, low and slow
 *   - fire  : on fire — charred, running erratically then collapsing, smoking
 * They follow the terrain height and fade out after a while so they don't
 * accumulate.
 */
export class Soldiers {
  constructor(scene, env) {
    this.scene = scene;
    this.env = env;
    this.list = [];
    this.puffs = [];   // smoke trailing burning soldiers
  }

  spawn(pos, count, groundY) {
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const state = r < 0.55 ? 'run' : (r < 0.8 ? 'crawl' : 'fire');
      const s = this._makeFigure(state);
      const ang = Math.random() * Math.PI * 2;
      const rad = 1.5 + Math.random() * 1.8;
      const x = pos.x + Math.cos(ang) * rad;
      const z = pos.z + Math.sin(ang) * rad;
      const gy = this.env.heightAt(x, z);
      s.group.position.set(x, gy, z);
      // flee directly away from the wreck
      const away = new THREE.Vector2(x - pos.x, z - pos.z);
      if (away.lengthSq() < 0.01) away.set(Math.cos(ang), Math.sin(ang));
      away.normalize();
      s.dir = away;
      s.group.rotation.y = Math.atan2(away.x, away.y);
      this.scene.add(s.group);
      this.list.push(s);
    }
  }

  _mat(color) {
    return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0.05 });
  }

  _makeFigure(state) {
    const g = new THREE.Group();
    const onFire = state === 'fire';
    const cloth = this._mat(onFire ? 0x241d15 : 0x5a5334);
    const skin = this._mat(onFire ? 0x241d15 : 0x8a6b4a);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.26), cloth);
    torso.position.y = 1.0; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), skin);
    head.position.y = 1.45; head.castShadow = true; g.add(head);

    // limbs pivot at the hip / shoulder so they can swing
    const legGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
    const mkLimb = (geo, x, y) => {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(geo, cloth);
      m.position.y = -geo.parameters.height / 2; m.castShadow = true;
      pivot.add(m); pivot.position.set(x, y, 0); g.add(pivot);
      return pivot;
    };
    const legL = mkLimb(legGeo, -0.12, 0.68);
    const legR = mkLimb(legGeo, 0.12, 0.68);
    const armL = mkLimb(armGeo, -0.28, 1.28);
    const armR = mkLimb(armGeo, 0.28, 1.28);

    const fig = {
      group: g, state, phase: Math.random() * 6, dir: new THREE.Vector2(0, 1),
      legL, legR, armL, armR, collapsed: false, smokeT: 0, flames: null,
      life: state === 'run' ? 12 : (state === 'crawl' ? 15 : 9),
      fireT: 2 + Math.random() * 2,
    };
    if (state === 'crawl') g.rotation.x = -1.15;   // pitched forward, low
    if (onFire) {
      fig.flames = this._makeFlames();
      fig.flames.position.y = 1.0;
      g.add(fig.flames);
    }
    return fig;
  }

  _makeFlames() {
    const grp = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.17, 0.7, 6),
        new THREE.MeshBasicMaterial({ color: k === 1 ? 0xffd24a : 0xff7a26, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      f.position.set((k - 1) * 0.2, 0.2 + Math.random() * 0.2, 0);
      grp.add(f);
    }
    return grp;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      const g = s.group;
      s.life -= dt;
      const fade = s.life < 1.2 ? Math.max(0, s.life / 1.2) : 1;

      // on-fire: run erratically, then collapse and keep smoldering
      if (s.state === 'fire' && !s.collapsed) {
        s.fireT -= dt;
        const jit = (Math.random() - 0.5) * 2.0 * dt;
        const c = Math.cos(jit), sn = Math.sin(jit);
        s.dir.set(s.dir.x * c - s.dir.y * sn, s.dir.x * sn + s.dir.y * c).normalize();
        g.rotation.y = Math.atan2(s.dir.x, s.dir.y);
        if (s.fireT <= 0) { s.collapsed = true; g.rotation.x = -1.5; s.life = Math.min(s.life, 4.5); }
      }

      // speed by state
      let speed;
      if (s.collapsed) speed = 0;
      else if (s.state === 'crawl') speed = 1.1;
      else if (s.state === 'fire') speed = 4.6;
      else speed = 3.8;

      if (speed > 0) {
        g.position.x += s.dir.x * speed * dt;
        g.position.z += s.dir.y * speed * dt;
      }
      // follow terrain (crawlers / collapsed sit lower)
      const gy = this.env.heightAt(g.position.x, g.position.z);
      g.position.y = (s.state === 'crawl' || s.collapsed) ? gy + 0.2 : gy;

      // limb swing + run bob
      s.phase += (speed + 1.5) * dt * 2.2;
      const sw = s.collapsed ? 0 : (s.state === 'crawl' ? 0.5 : 0.95);
      const a = Math.sin(s.phase) * sw;
      s.legL.rotation.x = a; s.legR.rotation.x = -a;
      s.armL.rotation.x = -a; s.armR.rotation.x = a;
      if (s.state === 'run' && !s.collapsed) g.position.y += Math.abs(Math.sin(s.phase)) * 0.05;

      // burning flames + smoke trail
      if (s.flames) {
        for (const f of s.flames.children) {
          f.scale.setScalar(0.7 + Math.random() * 0.6);
          f.material.opacity = (0.6 + Math.random() * 0.4) * fade;
        }
        s.smokeT -= dt;
        if (s.smokeT <= 0) { s.smokeT = 0.15; this._smoke(g.position.x, g.position.y + 1.2, g.position.z); }
      }

      // fade the body out at end of life
      if (fade < 1) {
        g.traverse(o => {
          if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) {
            o.material.transparent = true; o.material.opacity = fade;
          }
        });
      }
      if (s.life <= 0) {
        this.scene.remove(g);
        g.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        this.list.splice(i, 1);
      }
    }

    // smoke puffs from burning soldiers
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      p.mesh.position.y += 2.2 * dt;
      p.mesh.scale.setScalar(1 + (1 - p.life / p.max) * 2);
      p.mesh.material.opacity = Math.max(0, p.life / p.max) * 0.55;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.puffs.splice(i, 1);
      }
    }
  }

  _smoke(x, y, z) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0x2a241c, transparent: true, opacity: 0.55, depthWrite: false })
    );
    puff.position.set(x, y, z);
    this.scene.add(puff);
    this.puffs.push({ mesh: puff, life: 1.2, max: 1.2 });
  }
}
