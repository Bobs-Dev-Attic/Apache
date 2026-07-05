/**
 * Instruments — cockpit gauge cluster with a collapsible mini readout.
 * -------------------------------------------------------------------
 * Full mode shows graphical SVG gauges (artificial horizon, airspeed,
 * altimeter, heading compass, rotor bar). The collapse button shrinks the
 * panel to a compact text readout.
 */
const NS = 'http://www.w3.org/2000/svg';

export class Instruments {
  constructor() {
    this.root = document.getElementById('instruments');
    this.collapsed = false;

    this.aiRoll = document.getElementById('ai-roll');
    this.aiPitch = document.getElementById('ai-pitch');
    this.asiNeedle = document.getElementById('asi-needle');
    this.asiVal = document.getElementById('asi-val');
    this.altNeedle = document.getElementById('alt-needle');
    this.altVal = document.getElementById('alt-val');
    this.hdgCard = document.getElementById('hdg-card');
    this.hdgVal = document.getElementById('hdg-val');
    this.rtrBar = document.getElementById('rtr-bar');
    this.rtrVal = document.getElementById('rtr-val');

    this.mAlt = document.getElementById('hud-alt');
    this.mSpd = document.getElementById('hud-spd');
    this.mHdg = document.getElementById('hud-hdg');
    this.mRtr = document.getElementById('hud-rtr');

    this.btn = document.getElementById('instr-collapse');
    this.btn.addEventListener('click', () => this.toggle());

    this._buildCompass();
  }

  toggle() {
    this.collapsed = !this.collapsed;
    this.root.classList.toggle('collapsed', this.collapsed);
    this.btn.textContent = this.collapsed ? '▸' : '▾';
    this.btn.title = this.collapsed ? 'Expand instruments' : 'Collapse instruments';
  }

  _buildCompass() {
    for (let a = 0; a < 360; a += 30) {
      const rad = (a - 90) * Math.PI / 180;
      const r1 = 38, r2 = (a % 90 === 0 ? 29 : 34);
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', (50 + Math.cos(rad) * r1).toFixed(1));
      line.setAttribute('y1', (50 + Math.sin(rad) * r1).toFixed(1));
      line.setAttribute('x2', (50 + Math.cos(rad) * r2).toFixed(1));
      line.setAttribute('y2', (50 + Math.sin(rad) * r2).toFixed(1));
      line.setAttribute('stroke', 'rgba(255,233,194,.5)');
      line.setAttribute('stroke-width', '1');
      this.hdgCard.appendChild(line);
    }
    for (const [lab, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const rad = (a - 90) * Math.PI / 180;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (50 + Math.cos(rad) * 21).toFixed(1));
      t.setAttribute('y', (50 + Math.sin(rad) * 21 + 3).toFixed(1));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', lab === 'N' ? '#ff6a4a' : 'rgba(255,233,194,.85)');
      t.setAttribute('font-size', '9');
      t.setAttribute('font-weight', '700');
      t.textContent = lab;
      this.hdgCard.appendChild(t);
    }
  }

  update(heli) {
    const spd = heli.speedKmh * 0.621371;         // km/h -> mph
    const alt = Math.max(0, heli.altitude) * 3.28084; // m -> ft
    const hdg = heli.headingDeg;
    const rtr = heli.rotorSpeed * 100;

    // Mini text is always kept in sync (cheap)
    this.mAlt.textContent = alt.toFixed(0);
    this.mSpd.textContent = spd.toFixed(0);
    this.mHdg.textContent = hdg.toFixed(0).padStart(3, '0');
    this.mRtr.textContent = rtr.toFixed(0);
    if (this.collapsed) return;

    // Artificial horizon: bank rolls it, pitch shifts it.
    const rollDeg = -(heli.bank || 0) * 180 / Math.PI;
    const pitchDeg = (heli.pitch || 0) * 180 / Math.PI; // + = nose down
    this.aiRoll.setAttribute('transform', `rotate(${rollDeg.toFixed(1)} 50 50)`);
    this.aiPitch.setAttribute('transform', `translate(0 ${(pitchDeg * 1.1).toFixed(1)})`);

    // Airspeed & altitude arc needles (-120°..+120° over the range)
    const asiA = -120 + Math.min(spd, 160) / 160 * 240;   // 0..160 mph
    this.asiNeedle.setAttribute('transform', `rotate(${asiA.toFixed(1)} 50 52)`);
    this.asiVal.textContent = spd.toFixed(0);
    const altA = -120 + Math.min(alt, 720) / 720 * 240;   // 0..720 ft
    this.altNeedle.setAttribute('transform', `rotate(${altA.toFixed(1)} 50 52)`);
    this.altVal.textContent = alt.toFixed(0);

    // Heading compass card rotates so the current heading sits under the pointer
    this.hdgCard.setAttribute('transform', `rotate(${(-hdg).toFixed(1)} 50 50)`);
    this.hdgVal.textContent = hdg.toFixed(0).padStart(3, '0');

    // Rotor bar
    const full = 60;
    const h = Math.max(0.5, rtr / 100 * full);
    this.rtrBar.setAttribute('y', (16 + (full - h)).toFixed(1));
    this.rtrBar.setAttribute('height', h.toFixed(1));
    this.rtrVal.textContent = rtr.toFixed(0);
  }
}
