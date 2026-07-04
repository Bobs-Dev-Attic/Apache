/**
 * MobileControls
 * --------------
 * Wires up the on-screen virtual joystick (cyclic) and the button cluster
 * (collective + yaw) and writes into the shared InputManager.
 *
 * The joystick reports a normalised vector where up-on-screen is +y
 * (forward) and right-on-screen is +x. Buttons are momentary.
 */
export class MobileControls {
  constructor(input) {
    this.input = input;
    this.enabled = false;

    this.joy = document.getElementById('joystick');
    this.knob = document.getElementById('joystick-knob');
    this._joyId = null;
    this._joyRadius = 46;

    this._bindJoystick();
    this._bindButtons();
    this._bindWeapons();
    this.setWeaponState(null);   // nothing selected at start
  }

  enable() {
    this.enabled = true;
    document.getElementById('mobile-controls').classList.remove('hidden');
  }

  /** Reflect the active weapon in the selector buttons (driven by main.js so
   *  keyboard and touch stay in sync). mode: 'gun' | 'rockets' | 'missiles' | null */
  setWeaponState(mode) {
    const map = { gun: 'btn-gun', rockets: 'btn-rockets', missiles: 'btn-missiles' };
    for (const [key, id] of Object.entries(map)) {
      document.getElementById(id).classList.toggle('active', mode === key);
    }
    // FIRE is only meaningful once a weapon is selected.
    document.getElementById('btn-fire').classList.toggle('disabled', !mode);
    // CYCLE only cycles targets in a sensor (rocket/missile) mode.
    document.getElementById('btn-cycle').classList.toggle('disabled',
      mode !== 'rockets' && mode !== 'missiles');
  }

  _center() {
    const r = this.joy.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  _bindJoystick() {
    const onDown = (e) => {
      if (this._joyId !== null) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this._joyId = e.changedTouches ? t.identifier : 'mouse';
      this._moveKnob(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (this._joyId === null) return;
      const t = this._findTouch(e);
      if (!t) return;
      this._moveKnob(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onUp = (e) => {
      if (this._joyId === null) return;
      const ended = e.changedTouches ? [...e.changedTouches].some(t => t.identifier === this._joyId) : true;
      if (!ended) return;
      this._joyId = null;
      this.input.joy.x = 0;
      this.input.joy.y = 0;
      this.knob.style.transform = 'translate(0px, 0px)';
    };

    this.joy.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: false });
    window.addEventListener('touchcancel', onUp, { passive: false });

    // Mouse fallback (useful for desktop testing / touch-emulation)
    this.joy.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', (e) => { if (this._joyId === 'mouse') onMove(e); });
    window.addEventListener('mouseup', (e) => { if (this._joyId === 'mouse') onUp(e); });
  }

  _findTouch(e) {
    if (!e.changedTouches) return e; // mouse
    for (const t of e.touches) if (t.identifier === this._joyId) return t;
    return null;
  }

  _moveKnob(cx, cy) {
    const c = this._center();
    let dx = cx - c.x;
    let dy = cy - c.y;
    const dist = Math.hypot(dx, dy);
    const max = this._joyRadius;
    if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // normalise; screen y is inverted (up = forward)
    this.input.joy.x = dx / max;
    this.input.joy.y = -dy / max;
  }

  /** Momentary "hold" button: fires onStart on press, onEnd on release. */
  _hold(id, onStart, onEnd) {
    const el = document.getElementById(id);
    const start = (e) => { el.classList.add('active'); onStart(); e.preventDefault(); };
    const end = (e) => { el.classList.remove('active'); onEnd(); e.preventDefault(); };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', (e) => { if (el.classList.contains('active')) end(e); });
  }

  /** One-shot "tap" button: fires fn once on press with a brief press flash. */
  _tap(id, fn) {
    const el = document.getElementById(id);
    const press = (e) => {
      el.classList.add('tapped');
      fn();
      e.preventDefault();
    };
    const release = () => el.classList.remove('tapped');
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
  }

  _bindButtons() {
    this._hold('btn-power',     () => this.input.mobileThrottle = 1,    () => this.input.mobileThrottle = 0);
    this._hold('btn-up',        () => this.input.mobileCollective = 1,  () => this.input.mobileCollective = 0);
    this._hold('btn-down',      () => this.input.mobileCollective = -1, () => this.input.mobileCollective = 0);
    this._hold('btn-yaw-left',  () => this.input.mobileYaw = -1,        () => this.input.mobileYaw = 0);
    this._hold('btn-yaw-right', () => this.input.mobileYaw = 1,         () => this.input.mobileYaw = 0);
  }

  _bindWeapons() {
    // Weapon selection — reuse the same toggle callbacks the keyboard drives.
    this._tap('btn-gun',      () => this.input.onToggleGun?.());
    this._tap('btn-rockets',  () => this.input.onToggleRockets?.());
    this._tap('btn-missiles', () => this.input.onToggleMissiles?.());
    this._tap('btn-cycle',    () => this.input.onCycleTarget?.());
    this._tap('btn-flares',   () => this.input.onDeployFlares?.());

    // Context-sensitive FIRE: hold to fire the gun, tap to loose a rocket/missile.
    // main.js decides what to do based on the armed weapon / target mode.
    this._hold('btn-fire',
      () => this.input.onFireDown?.(),
      () => this.input.onFireUp?.());
  }
}
