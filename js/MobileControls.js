/**
 * MobileControls
 * --------------
 * Wires up two on-screen virtual joysticks and the throttle / weapon buttons,
 * writing into the shared InputManager.
 *
 *   Left stick  (cyclic)     -> pitch / bank
 *   Right stick (collective) -> ▲ climb / ▼ descend  +  ◀▶ yaw
 *
 * Each stick reports a normalised vector where up-on-screen is +y and
 * right-on-screen is +x. Buttons are momentary.
 */
export class MobileControls {
  constructor(input) {
    this.input = input;
    this.enabled = false;
    this._joyRadius = 46;

    // Left cyclic stick -> pitch (y) / bank (x)
    this._bindStick('joystick', 'joystick-knob', (x, y) => {
      this.input.joy.x = x;
      this.input.joy.y = y;
    });
    // Right collective stick -> climb/descend (y) + yaw (x)
    this._bindStick('collective-stick', 'collective-knob', (x, y) => {
      this.input.mobileYaw = x;
      this.input.mobileCollective = y;
    });

    this._bindWeapons();
    this._bindTargetScreenTap();
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
  }

  /**
   * Bind one virtual joystick. `write(x, y)` receives the normalised stick
   * vector (-1..1) where up-on-screen is +y and right-on-screen is +x; it is
   * called on every move and reset to (0, 0) on release. Each stick tracks its
   * own touch identifier so the two can be used simultaneously.
   */
  _bindStick(joyId, knobId, write) {
    const joy = document.getElementById(joyId);
    const knob = document.getElementById(knobId);
    const radius = this._joyRadius;
    let id = null;

    const center = () => {
      const r = joy.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const move = (cx, cy) => {
      const c = center();
      let dx = cx - c.x, dy = cy - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      write(dx / radius, -dy / radius);   // screen y inverted: up = +
    };
    const findTouch = (e) => {
      if (!e.changedTouches) return e; // mouse
      for (const t of e.touches) if (t.identifier === id) return t;
      return null;
    };
    const onDown = (e) => {
      if (id !== null) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      id = e.changedTouches ? t.identifier : 'mouse';
      move(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (id === null) return;
      const t = findTouch(e);
      if (!t) return;
      move(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onUp = (e) => {
      if (id === null) return;
      const ended = e.changedTouches ? [...e.changedTouches].some(t => t.identifier === id) : true;
      if (!ended) return;
      id = null;
      write(0, 0);
      knob.style.transform = 'translate(0px, 0px)';
    };

    joy.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: false });
    window.addEventListener('touchcancel', onUp, { passive: false });

    // Mouse fallback (useful for desktop testing / touch-emulation)
    joy.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', (e) => { if (id === 'mouse') onMove(e); });
    window.addEventListener('mouseup', (e) => { if (id === 'mouse') onUp(e); });
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

  _bindWeapons() {
    // Weapon selection — reuse the same toggle callbacks the keyboard drives.
    this._tap('btn-gun',      () => this.input.onToggleGun?.());
    this._tap('btn-rockets',  () => this.input.onToggleRockets?.());
    this._tap('btn-missiles', () => this.input.onToggleMissiles?.());
    this._tap('btn-flares',   () => this.input.onDeployFlares?.());

    // Context-sensitive FIRE: hold to fire the gun, tap to loose a rocket/missile.
    // main.js decides what to do based on the armed weapon / target mode.
    this._hold('btn-fire',
      () => this.input.onFireDown?.(),
      () => this.input.onFireUp?.());
  }

  /**
   * Tapping / clicking the always-on sensor screen cycles to the next target
   * (replaces the old swipe gesture and the CYCLE button). A small movement
   * tolerance keeps a drag from counting as a tap.
   */
  _bindTargetScreenTap() {
    const mfd = document.getElementById('mfd');
    if (!mfd) return;
    let x0 = null, y0 = null, moved = false;

    const down = (cx, cy) => { x0 = cx; y0 = cy; moved = false; };
    const move = (cx, cy) => {
      if (x0 === null) return;
      if (Math.abs(cx - x0) > 12 || Math.abs(cy - y0) > 12) moved = true;
    };
    const up = () => {
      if (x0 !== null && !moved) this.input.onSwipeTarget?.(1);  // next target
      x0 = y0 = null;
    };

    mfd.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; down(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
    mfd.addEventListener('touchmove', (e) => { const t = e.changedTouches[0]; move(t.clientX, t.clientY); }, { passive: false });
    mfd.addEventListener('touchend', (e) => { up(); e.preventDefault(); }, { passive: false });
    // Mouse for desktop
    mfd.addEventListener('mousedown', (e) => down(e.clientX, e.clientY));
    mfd.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    mfd.addEventListener('mouseup', up);
  }
}
