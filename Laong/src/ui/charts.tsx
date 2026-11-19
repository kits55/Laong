// กราฟ SVG หนึ่งแกน (หน่วยเดียว) ตามหลัก dataviz ของบรีฟ
// - ไม่ใช้สีอย่างเดียว: ชุดข้อมูลต่างกันที่รูปจุด (วงกลมทึบ / สี่เหลี่ยมกลวง) และลายเส้น (ทึบ / ประ)
// - ค่า null ไม่ถูกวาดเป็น 0 เส้นขาดช่วงและไม่มีจุด
// - ต้องส่งตารางคู่กราฟเข้ามาเสมอ (prop table)
// - แอนิเมชันเล่นครั้งเดียวตอนขึ้น: เส้นวาด, จุดเด้งไล่ตามลำดับ, แถบแนวอ่านผลขยาย
// - ชี้หรือกดลูกศรเพื่อดูค่าของแต่ละจุดในกล่องข้อความ (ตัวเลขทุกค่ามีป้ายที่มา)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Kind, Num } from '../core/types';
import { KIND_INFO } from '../core/types';

export interface Series {
  id: string;
  label: string;
  kind: Kind;
  marker: 'circle' | 'square';
  dashed?: boolean;
  points: { x: number | string; y: Num }[];
}

function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const COLOR: Record<string, string> = {
  measured: 'var(--st-measured-fg)', observed: 'var(--st-observed-fg)', calculated: 'var(--st-calculated-fg)',
  predicted: 'var(--st-predicted-fg)', proxy: 'var(--st-proxy-fg)', assumed: 'var(--st-assumed-fg)',
  validated: 'var(--st-validated-fg)', unvalidated: 'var(--st-unvalidated-fg)', missing: 'var(--ink-muted)',
};

export function PointsChart({ title, series, categories, yLabel, height = 260, band, links, lines = true, area = false, table, tableSummary = 'ดูเป็นตาราง', emptyText = 'ยังไม่มีข้อมูลให้แสดง', xUnit = 'นาทีที่' }: {
  title: string; series: Series[]; categories?: string[]; yLabel: string; xLabel?: string; height?: number;
  band?: { from: number; to: number; label: string } | null; links?: boolean; lines?: boolean; area?: boolean; table: ReactNode; tableSummary?: string; emptyText?: string; xUnit?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const narrow = w > 0 && w < 460;
  const m = { l: narrow ? 36 : 44, r: 12, t: 12, b: 30 };
  const ys = series.flatMap((s) => s.points.map((p) => p.y).filter((v): v is number => v !== null));
  const hasData = ys.length > 0;
  const lo = hasData ? Math.min(...ys, band ? band.from : Infinity) : 0;
  const hiV = hasData ? Math.max(...ys, band ? band.to : -Infinity) : 1;
  const pad = (hiV - lo || 4) * 0.12;
  const yTicks = niceTicks(lo - pad, hiV + pad, narrow ? 4 : 5);
  const y0 = yTicks[0] ?? lo - pad, y1 = yTicks[yTicks.length - 1] ?? hiV + pad;
  const iw = Math.max(10, w - m.l - m.r), ih = height - m.t - m.b;
  const sy = (v: number) => m.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;

  const xs = categories
    ? categories.map((_, i) => i)
    : Array.from(new Set(series.flatMap((s) => s.points.map((p) => Number(p.x))))).sort((a, b) => a - b);
  const xmin = xs.length ? Math.min(...xs) : 0, xmax = xs.length ? Math.max(...xs) : 1;
  const sx = (x: number) => categories
    ? m.l + (iw * (x + 0.5)) / categories.length
    : m.l + ((x - xmin) / (xmax - xmin || 1)) * iw;
  const xTicks = categories
    ? categories.map((c, i) => ({ v: i, label: narrow && c.length > 6 ? c.slice(-5) : c }))
    : niceTicks(xmin, xmax, Math.max(2, Math.floor(iw / 80))).map((v) => ({ v, label: String(v) }));
  const xVal = (p: { x: number | string }) => (categories ? categories.indexOf(String(p.x)) : Number(p.x));

  const segments = (s: Series) => {
    const segs: { d: string; pts: [number, number][] }[] = [];
    let cur: [number, number][] = [];
    [...s.points].sort((a, b) => xVal(a) - xVal(b)).forEach((p) => {
      if (p.y === null) { if (cur.length) segs.push({ d: '', pts: cur }); cur = []; return; }
      cur.push([sx(xVal(p)), sy(p.y)]);
    });
    if (cur.length) segs.push({ d: '', pts: cur });
    return segs.map((g) => ({ ...g, d: g.pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('') }));
  };

  // จุดที่ชี้: หา x ที่ใกล้ที่สุดในชุดค่า x ทั้งหมด
  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !xs.length) return;
    const px = clientX - box.left;
    let best = 0, bd = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(sx(x) - px); if (d < bd) { bd = d; best = i; } });
    setHi(best);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!xs.length) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setHi((h) => (h === null ? 0 : Math.min(xs.length - 1, h + 1))); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setHi((h) => (h === null ? xs.length - 1 : Math.max(0, h - 1))); }
    else if (e.key === 'Escape') setHi(null);
  };

  const hx = hi === null ? null : xs[hi];
  const tip = hx === null ? null : series.map((s) => {
    const p = s.points.find((q) => xVal(q) === hx);
    return { s, y: p ? p.y : null, has: !!p };
  }).filter((t) => t.has);
  const tipLabel = hx === null ? '' : categories ? categories[hx] : `${xUnit} ${hx}`;
  const tipLeft = hx === null ? 0 : Math.min(Math.max(sx(hx), 90), Math.max(90, w - 90));

  return (
    <figure className="chart">
      <figcaption className="chart__cap">{title}</figcaption>
      <div ref={ref} className="chart__box" onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHi(null)}>
        {w > 0 && hasData ? (
          <svg width={w} height={height} role="img" tabIndex={0} onKeyDown={onKey} onBlur={() => setHi(null)}
            aria-label={`${title}. ${yLabel}. เลื่อนด้วยปุ่มลูกศรซ้ายขวาเพื่อดูค่าของแต่ละจุด หรือดูตารางด้านล่าง`}>
            {band ? (
              <g className="chart__bandg">
                <rect x={m.l} width={iw} y={sy(band.to)} height={Math.max(0, sy(band.from) - sy(band.to))} className="chart__band" />
                <text x={m.l + iw - 4} y={sy(band.to) + 14} textAnchor="end" className="chart__bandlabel">{narrow ? 'แนวอ่านผล' : band.label}</text>
              </g>
            ) : null}
            {yTicks.map((t) => (
              <g key={t} className="chart__gridg">
                <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} className="chart__grid" />
                <text x={m.l - 8} y={sy(t) + 4} textAnchor="end" className="chart__tick">{t}</text>
              </g>
            ))}
            {narrow ? null : <text x={12} y={m.t + ih / 2} transform={`rotate(-90 12 ${m.t + ih / 2})`} textAnchor="middle" className="chart__axis">{yLabel}</text>}
            {xTicks.map((t) => (
              <text key={t.label} x={sx(t.v)} y={height - 10} textAnchor="middle" className="chart__tick">{t.label}</text>
            ))}
            {hx !== null ? <line x1={sx(hx)} x2={sx(hx)} y1={m.t} y2={m.t + ih} className="chart__guide" /> : null}
            {links && series.length >= 2
              ? categories?.map((c, i) => {
                  const a = series[0].points.find((p) => String(p.x) === c)?.y;
                  const b = series[1].points.find((p) => String(p.x) === c)?.y;
                  if (a === null || a === undefined || b === null || b === undefined) return null;
                  return <line key={c} x1={sx(i)} x2={sx(i)} y1={sy(a)} y2={sy(b)} className="chart__link" style={{ ['--d' as string]: `${i * 60}ms` }} />;
                })
              : null}
            {area && lines ? series.filter((s) => !s.dashed).map((s) => segments(s).map((g, i) => g.pts.length > 1 ? (
              <path key={`a-${s.id}-${i}`} d={`${g.d}L${g.pts[g.pts.length - 1][0].toFixed(1)},${m.t + ih}L${g.pts[0][0].toFixed(1)},${m.t + ih}Z`} fill={COLOR[s.kind]} className="chart__area" />
            ) : null)) : null}
            {lines ? series.map((s) => segments(s).map((g, i) => (
              <path key={`${s.id}-${i}`} d={g.d} fill="none" stroke={COLOR[s.kind]} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? '6 5' : undefined}
                pathLength={s.dashed ? undefined : 1} className={s.dashed ? 'chart__line chart__line--fade' : 'chart__line chart__line--draw'} />
            ))) : null}
            {series.map((s) => s.points.map((p, pi) => {
              if (p.y === null) return null;
              const cx = sx(xVal(p)), cy = sy(p.y);
              const on = hx !== null && xVal(p) === hx;
              const st = { ['--d' as string]: `${300 + pi * 55}ms`, transformOrigin: `${cx}px ${cy}px` };
              return s.marker === 'circle'
                ? <circle key={`${s.id}-${pi}`} cx={cx} cy={cy} r={on ? 6 : 4.5} fill={COLOR[s.kind]} stroke="var(--surface-200)" strokeWidth={1.5} className="chart__pt" style={st} />
                : <rect key={`${s.id}-${pi}`} x={cx - (on ? 6 : 4.5)} y={cy - (on ? 6 : 4.5)} width={on ? 12 : 9} height={on ? 12 : 9} rx={1.5} fill="var(--surface-200)" stroke={COLOR[s.kind]} strokeWidth={2} className="chart__pt" style={st} />;
            }))}
          </svg>
        ) : (
          <p className="chart__empty">{hasData ? '' : emptyText}</p>
        )}
        {tip && hx !== null ? (
          <div className="chart__tip" style={{ left: tipLeft }} role="status">
            <strong>{tipLabel}</strong>
            {tip.map((t) => (
              <div key={t.s.id} className="chart__tiprow">
                <span>{t.s.label}</span>
                <span className="ld-num">{t.y === null ? 'ยังไม่มีค่า' : t.y.toFixed(1)}</span>
                <span className="chart__tipk">{t.y === null ? KIND_INFO.missing.word : KIND_INFO[t.s.kind].word}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ul className="chart__legend">
        {series.map((s) => (
          <li key={s.id}>
            <svg width="22" height="14" aria-hidden="true">
              {s.dashed ? <line x1="0" x2="22" y1="7" y2="7" stroke={COLOR[s.kind]} strokeWidth="2" strokeDasharray="5 4" /> : <line x1="0" x2="22" y1="7" y2="7" stroke={COLOR[s.kind]} strokeWidth="2" />}
              {s.marker === 'circle' ? <circle cx="11" cy="7" r="4.5" fill={COLOR[s.kind]} /> : <rect x="6.5" y="2.5" width="9" height="9" rx="1.5" fill="var(--surface-200)" stroke={COLOR[s.kind]} strokeWidth="2" />}
            </svg>
            <span>{s.label}</span>
            <span className="chart__kind">{KIND_INFO[s.kind].word}</span>
          </li>
        ))}
      </ul>
      <details className="chart__table">
        <summary>{tableSummary}</summary>
        {table}
      </details>
    </figure>
  );
}
