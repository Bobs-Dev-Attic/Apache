/**
 * InputManager
 * ------------
 * Unifies keyboard and mobile on-screen controls into a single normalised
 * control vector consumed by the flight model each frame:
 *
 *   { collective, pitch, roll, yaw, throttle }  (all 0..1 or -1..1)
 *
 * Keyboard : W/S pitch, A/D roll, Q/E yaw, Shift/Ctrl collective, Space power.
 * Mobile   : left virtual joystick -> pitch/roll, right buttons -> collective,
 *            yaw, and the POWER (throttle) button.
 *
 * "throttle" is the engine power that drives the helicopter across the ground
 * in whatever direction it is tilted — hold it to fly, release it to slow to
 * a hover. Altitude auto-holds when the collective is neutral.
 */
export class InputManager {
  constructor() {
    this.keys = new Set();

    // Mobile analog/state
    this.joy = { x: 0, y: 0 };        // -1..1, y+ = up on screen
    this.mobileCollective = 0;         // -1 / 0 / +1
    this.mobileYaw = 0;                // -1 / 0 / +1
    this.mobileThrottle = 0;           // 0 / 1

    this.onToggleFollow = null;
    this.onToggleHelp = null;
    this.onToggleGun = null;
    this.onToggleRockets = null;
    this.onToggleMissiles = null;
    this.onCycleTarget = null;
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
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) {
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
    // Throttle / power: Space (keyboard) or the mobile PWR button
    let throttle = Math.max(this._kb(' '), this.mobileThrottle);

    // Fold in mobile joystick (y up on screen -> forward pitch)
    pitch += this.joy.y;
    roll += this.joy.x;
    yaw += this.mobileYaw;
    collective += this.mobileCollective;

    // Clamp
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    return {
      pitch: clamp(pitch),
      roll: clamp(roll),
      yaw: clamp(yaw),
      collective: clamp(collective),
      throttle: Math.max(0, Math.min(1, throttle)),
    };
  }
}
