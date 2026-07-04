/**
 * InputManager
 * ------------
 * Unifies keyboard and mobile on-screen controls into a single normalised
 * control vector consumed by the flight model each frame:
 *
 *   { collective, pitch, roll, yaw, throttle }  (all 0..1 or -1..1)
 *
 * Keyboard : W/S pitch, A/D roll, Q/E yaw, Shift/Ctrl collective.
 * Mobile   : left stick -> pitch/roll (cyclic), right stick -> collective/yaw.
 *
 * "throttle" is the engine power that drives the helicopter across the ground
 * in whatever direction it is tilted. It is no longer a separate control — it
 * is derived from how far the cyclic is deflected (the left stick / WASD), so
 * tilting is what powers the aircraft. Neutral cyclic = hover; altitude
 * auto-holds when the collective is neutral.
 */
export class InputManager {
  constructor() {
    this.keys = new Set();

    // Mobile analog/state
    this.joy = { x: 0, y: 0 };        // -1..1, y+ = up on screen (cyclic)
    this.mobileCollective = 0;         // -1..1 (right stick, up = climb)
    this.mobileYaw = 0;                // -1..1 (right stick, right = yaw right)

    this.onToggleFollow = null;
    this.onToggleHelp = null;
    this.onToggleGun = null;
    this.onToggleRockets = null;
    this.onToggleMissiles = null;
    this.onCycleTarget = null;
    this.onSwipeTarget = null;   // (dir) => cycle target; dir +1 next / -1 prev
    this.onDeployFlares = null;
    this.onFireRockets = null;
    this.onFireMissiles = null;
    // Mobile context-sensitive fire button (press / release)
    this.onFireDown = null;
    this.onFireUp = null;

    this._bindKeyboard();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) {
        e.preventDefault();
      }
      if (k === 'f' && !e.repeat) this.onDeployFlares?.();
      if (k === 'v' && !e.repeat) this.onToggleFollow?.();
      if (k === 'g' && !e.repeat) this.onToggleGun?.();
      if (k === 'r' && !e.repeat) this.onToggleRockets?.();
      if (k === 'm' && !e.repeat) this.onToggleMissiles?.();
      if (k === '1' && !e.repeat) this.onFireRockets?.();
      if (k === '2' && !e.repeat) this.onFireMissiles?.();
      if (k === 'tab' && !e.repeat) this.onCycleTarget?.();
      if ((k === 'h' || k === '?') && !e.repeat) this.onToggleHelp?.();
      this.keys.add(k);
      if (e.key === 'Shift') this.keys.add('shift');
      if (e.key === 'Control') this.keys.add('control');
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (e.key === 'Shift') this.keys.delete('shift');
      if (e.key === 'Control') this.keys.delete('control');
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  _kb(...names) { return names.some((n) => this.keys.has(n)) ? 1 : 0; }

  /** Combine all sources into the control vector. */
  sample() {
    // Pitch: W / ArrowUp forward (nose down, drift fwd), S / ArrowDown back
    let pitch = this._kb('w', 'arrowup') - this._kb('s', 'arrowdown');
    // Roll: D right, A left
    let roll = this._kb('d', 'arrowright') - this._kb('a', 'arrowleft');
    // Yaw: E right, Q left
    let yaw = this._kb('e') - this._kb('q');
    // Collective: C / Shift up, Z / Ctrl down
    let collective = this._kb('c', 'shift') - this._kb('z', 'control');

    // Fold in mobile sticks (cyclic on the left, collective/yaw on the right)
    pitch += this.joy.y;
    roll += this.joy.x;
    yaw += this.mobileYaw;
    collective += this.mobileCollective;

    const clamp = (v) => Math.max(-1, Math.min(1, v));
    pitch = clamp(pitch);
    roll = clamp(roll);

    // Power comes from the cyclic itself: the further it is deflected (left
    // stick / WASD), the more engine power drives the aircraft in that
    // direction. Neutral cyclic -> throttle 0 -> settle to a hover.
    const throttle = Math.min(1, Math.hypot(pitch, roll));

    return {
      pitch,
      roll,
      yaw: clamp(yaw),
      collective: clamp(collective),
      throttle,
    };
  }
}
