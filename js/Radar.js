/**
 * Radar — a heading-up top-down scope of nearby targets.
 * ------------------------------------------------------
 * The helicopter sits at the centre pointing up; targets are plotted relative
 * to it (rotated by heading so "up" is where the nose points), with range
 * rings and a rotating sweep. The locked target is highlighted.
 */
export class Radar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.range = 150; // metres from centre to edge
    this.sweep = 0;
  }

  draw(heli, targets, dt) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) / 2 - 6;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(8,26,12,0.55)';
    ctx.fillRect(0, 0, W, H);

    // range rings + cross-hairs
    ctx.strokeStyle = 'rgba(120,255,150,0.22)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();

    // sweep wedge + line
    this.sweep += (dt || 0.016) * 1.8;
    const sa = this.sweep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, sa - 0.5, sa);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,255,150,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,255,150,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R);
    ctx.stroke();

    // targets, heading-up
    const h = heli.heading;
    const cosH = Math.cos(h), sinH = Math.sin(h);
    const hp = heli.group.position;
    const locked = targets.lockedTarget;
    for (const t of targets.list) {
      if (!t.alive) continue;
      const dx = t.pos.x - hp.x;
      const dz = t.pos.z - hp.z;
      const along = dx * cosH - dz * sinH; // ahead
      const side = dx * sinH + dz * cosH;  // right
      const px = cx + (side / this.range) * R;
      const py = cy - (along / this.range) * R;
      if (Math.hypot(px - cx, py - cy) > R) continue;
      const isLocked = t === locked;
      ctx.beginPath();
      ctx.arc(px, py, isLocked ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isLocked ? '#ff5a3c' : '#ffcf6e';
      ctx.fill();
      if (isLocked) {
        ctx.strokeStyle = '#ff5a3c';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();

    // own-ship marker at centre, pointing up
    ctx.fillStyle = '#8dff9e';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 4, cy + 5);
    ctx.lineTo(cx + 4, cy + 5);
    ctx.closePath();
    ctx.fill();
  }
}
