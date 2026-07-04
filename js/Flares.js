import * as THREE from 'three';

/**
 * Flares — defensive countermeasures.
 * -----------------------------------
 * `F` dispenses a burst of bright flare particles that eject down and behind
 * the helicopter, flicker hot then burn out under light gravity. Purely a
 * visual/countermeasure effect; a short cooldown prevents spamming.
 */
export class Flares {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.cooldown = 0;
    this._origin = new THREE.Vector3();
  }

  deploy(heli) {
    if (this.cooldown > 0) return;
    this.cooldown = 0.22;

    const origin = heli.body.localToWorld(this._origin.set(-1.4, -0.7, 0));
    // backward direction (opposite the nose)
    const back = new THREE.Vector3(-Math.cos(heli.heading), 0, Math.sin(heli.heading));

    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 6, 5),
        new THREE.MeshBasicMaterial({
          color: 0xffe089, transparent: true, opacity: 1,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        -3 - Math.random() * 4,
        (Math.random() - 0.5) * 9
      );
      vel.addScaledVector(back, 2 + Math.random() * 4);
      const max = 1.3 + Math.random() * 0.5;
      this.parts.push({ mesh, vel, life: max, max });
    }
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vel.y -= 9.8 * 0.45 * dt;       // light gravity
      p.vel.multiplyScalar(1 - 1.4 * dt); // air drag
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.mesh.material.opacity = k;
      p.mesh.material.color.setHSL(0.09, 1, 0.45 + 0.35 * k);       // white-hot → orange
      p.mesh.scale.setScalar(0.55 + k * 0.8 + Math.random() * 0.25); // flicker
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.parts.splice(i, 1);
      }
    }
  }
}
