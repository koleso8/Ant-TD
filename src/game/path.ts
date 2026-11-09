import { clamp, dist, lerp, type Vec } from '../engine/math';

/**
 * Внутренние точки тропы прижимаются к центрам клеток: прямые участки идут ровно по
 * середине ряда или столбца, и соседние клетки остаются свободными под башни.
 * Первая и последняя точки (вход и нора муравейника) не трогаются.
 */
export function snapWaypoints(w: readonly Vec[], cell: number): Vec[] {
  const snap = (v: number) => Math.round((v - cell / 2) / cell) * cell + cell / 2;
  return w.map((p, i) => (i === 0 || i === w.length - 1 ? { x: p.x, y: p.y } : { x: snap(p.x), y: snap(p.y) }));
}

/**
 * Тропа: ломаная по точкам уровня со скруглёнными углами. Прямые участки лежат
 * точно на линии между точками, поэтому дорожка не выходит из «своих» клеток;
 * точки выборки идут через равные промежутки, чтобы поиск ближайшей был честным.
 */
export class Path {
  readonly pts: Vec[] = [];
  readonly cum: number[] = [];
  readonly length: number;

  constructor(waypoints: readonly Vec[], cornerRadius = 22, step = 6) {
    const n = waypoints.length;
    const pts = this.pts;
    pts.push({ x: waypoints[0].x, y: waypoints[0].y });
    const addLine = (a: Vec, b: Vec) => {
      const L = dist(a.x, a.y, b.x, b.y);
      const k = Math.max(1, Math.ceil(L / step));
      for (let i = 1; i <= k; i++) pts.push({ x: lerp(a.x, b.x, i / k), y: lerp(a.y, b.y, i / k) });
    };
    let cur = waypoints[0];
    for (let i = 1; i < n - 1; i++) {
      const prev = waypoints[i - 1];
      const v = waypoints[i];
      const next = waypoints[i + 1];
      const lenIn = dist(prev.x, prev.y, v.x, v.y) || 1;
      const lenOut = dist(v.x, v.y, next.x, next.y) || 1;
      const r = Math.min(cornerRadius, lenIn / 2, lenOut / 2);
      const a = { x: v.x - ((v.x - prev.x) / lenIn) * r, y: v.y - ((v.y - prev.y) / lenIn) * r };
      const b = { x: v.x + ((next.x - v.x) / lenOut) * r, y: v.y + ((next.y - v.y) / lenOut) * r };
      addLine(cur, a);
      const K = Math.max(4, Math.ceil((r * 1.6) / step));
      for (let k = 1; k <= K; k++) {
        const t = k / K;
        const u = 1 - t;
        pts.push({ x: u * u * a.x + 2 * u * t * v.x + t * t * b.x, y: u * u * a.y + 2 * u * t * v.y + t * t * b.y });
      }
      cur = b;
    }
    addLine(cur, waypoints[n - 1]);
    let acc = 0;
    this.cum.push(0);
    for (let i = 1; i < pts.length; i++) {
      acc += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      this.cum.push(acc);
    }
    this.length = acc;
  }

  at(d: number): { x: number; y: number; angle: number } {
    d = clamp(d, 0, this.length);
    let lo = 0;
    let hi = this.cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid; else hi = mid;
    }
    if (lo >= this.pts.length - 1) lo = this.pts.length - 2;
    const a = this.pts[lo];
    const b = this.pts[lo + 1];
    const seg = this.cum[lo + 1] - this.cum[lo] || 1;
    const t = clamp((d - this.cum[lo]) / seg, 0, 1);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  nearest(x: number, y: number): { d: number; x: number; y: number; dist: number } {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < this.pts.length; i++) {
      const dd = dist(x, y, this.pts[i].x, this.pts[i].y);
      if (dd < bd) { bd = dd; best = i; }
    }
    return { d: this.cum[best], x: this.pts[best].x, y: this.pts[best].y, dist: bd };
  }
}
