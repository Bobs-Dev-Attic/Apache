import * as THREE from 'three';

/**
 * Environment
 * -----------
 * A low-poly desert: a rolling dune terrain built from a displaced plane,
 * scattered rocks, cacti and mesas, a warm sky and directional sun light.
 *
 * `heightAt(x, z)` returns the terrain height so the helicopter can respect
 * the ground. It uses the same deterministic value-noise the mesh is built
 * from, so the query matches the visible surface.
 */
export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.size = 400;
    this.segments = 120;
    this.amp = 9;
    this._build();
  }

  // --- deterministic hash-based value noise (matches mesh + query) ---
  _hash(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  _noise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const a = this._hash(xi, zi);
    const b = this._hash(xi + 1, zi);
    const c = this._hash(xi, zi + 1);
    const d = this._hash(xi + 1, zi + 1);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(a, b, u),
      THREE.MathUtils.lerp(c, d, u),
      v
    );
  }
  _fbm(x, z) {
    let f = 0, w = 0.5, freq = 0.02;
    for (let i = 0; i < 4; i++) {
      f += w * this._noise(x * freq, z * freq);
      freq *= 2;
      w *= 0.5;
    }
    return f;
  }

  heightAt(x, z) {
    // dunes + a gentle large-scale roll
    const dune = this._fbm(x, z) * this.amp;
    const roll = Math.sin(x * 0.012) * Math.cos(z * 0.01) * 2.2;
    return dune + roll - 3;
  }

  _build() {
    const scene = this.scene;

    // --- Sky (gradient via large back-side sphere) ---
    const skyGeo = new THREE.SphereGeometry(600, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x5b86c4) },
        mid: { value: new THREE.Color(0xbcd0e0) },
        bot: { value: new THREE.Color(0xe8cfa0) },
      },
      vertexShader: `
        varying vec3 vpos;
        void main(){ vpos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec3 vpos;
        uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){
          float h = normalize(vpos).y;
          vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0,0.6,h))
                           : mix(mid, bot, smoothstep(0.0,-0.25,h));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    scene.fog = new THREE.Fog(0xdcc9a3, 180, 520);

    // --- Lighting ---
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0xc2a06a, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d6, 2.1);
    sun.position.set(80, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 120;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    scene.add(new THREE.AmbientLight(0xffe8c0, 0.25));

    // --- Terrain ---
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.heightAt(x, z));
    }
    geo.computeVertexNormals();

    // vertex-colour the sand (lighter crests, darker troughs + rocky tint)
    const colors = [];
    const cLight = new THREE.Color(0xd8bd85);
    const cDark = new THREE.Color(0xa07d47);
    const cRock = new THREE.Color(0x8f7150);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp((y + 6) / (this.amp + 6), 0, 1);
      const base = cDark.clone().lerp(cLight, t);
      // slope-based rockiness using local normal
      const nx = geo.attributes.normal.getX(i);
      const nz = geo.attributes.normal.getZ(i);
      const slope = Math.hypot(nx, nz);
      base.lerp(cRock, THREE.MathUtils.clamp(slope * 1.4, 0, 0.5));
      colors.push(base.r, base.g, base.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 1.0,
      metalness: 0.0,
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);
    this.terrain = terrain;

    // --- Scatter props ---
    this._scatter();
  }

  _rockMat = new THREE.MeshStandardMaterial({ color: 0x9a7d55, flatShading: true, roughness: 1 });
  _cactusMat = new THREE.MeshStandardMaterial({ color: 0x4d6b3a, flatShading: true, roughness: 0.9 });
  _mesaMat = new THREE.MeshStandardMaterial({ color: 0xb5794a, flatShading: true, roughness: 1 });

  _placeOnGround(obj, x, z) {
    obj.position.set(x, this.heightAt(x, z), z);
    obj.castShadow = true;
    obj.receiveShadow = true;
    this.scene.add(obj);
  }

  _scatter() {
    // seeded pseudo-random so layout is stable across reloads
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const half = this.size / 2 - 20;

    // Rocks
    for (let i = 0; i < 46; i++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (Math.hypot(x, z) < 18) continue; // keep spawn clear
      const r = 0.8 + rnd() * 2.4;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), this._rockMat);
      rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      rock.scale.y = 0.6 + rnd() * 0.5;
      const g = new THREE.Group();
      g.add(rock);
      rock.position.y = r * 0.35;
      this._placeOnGround(g, x, z);
    }

    // Cacti (saguaro-ish)
    for (let i = 0; i < 34; i++) {
      const x = (rnd() * 2 - 1) * half;
      const z = (rnd() * 2 - 1) * half;
      if (Math.hypot(x, z) < 22) continue;
      const g = new THREE.Group();
      const h = 3 + rnd() * 3;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, h, 7), this._cactusMat);
      trunk.position.y = h / 2;
      trunk.castShadow = true;
      g.add(trunk);
      const arms = Math.floor(rnd() * 3);
      for (let a = 0; a < arms; a++) {
        const armH = 1.2 + rnd() * 1.4;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, armH, 6), this._cactusMat);
        const side = rnd() > 0.5 ? 1 : -1;
        const yy = h * (0.4 + rnd() * 0.3);
        arm.position.set(side * 0.55, yy, 0);
        arm.rotation.z = -side * 0.6;
        // elbow going up
        const up = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, armH * 0.8, 6), this._cactusMat);
        up.position.set(side * (0.55 + Math.sin(0.6) * armH * 0.5), yy + armH * 0.5, 0);
        arm.castShadow = true; up.castShadow = true;
        g.add(arm); g.add(up);
      }
      this._placeOnGround(g, x, z);
    }

    // Distant mesas / buttes for silhouette interest
    for (let i = 0; i < 9; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = 130 + rnd() * 45;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const r = 10 + rnd() * 16;
      const h = 14 + rnd() * 26;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, h, 6), this._mesaMat);
      mesa.position.y = h / 2;
      mesa.castShadow = true;
      mesa.receiveShadow = true;
      const g = new THREE.Group();
      g.add(mesa);
      this._placeOnGround(g, x, z);
      g.position.y = this.heightAt(x, z) - 2;
    }
  }

  /** keep the sun's shadow frustum centred on the aircraft */
  updateSun(focus) {
    if (!this.sun) return;
    this.sun.position.set(focus.x + 80, focus.y + 120, focus.z + 40);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
  }
}
