// ชิ้นส่วน UI ที่ห่อคลาส ld-* ของ Laong design system (ไม่ใส่สีหรือขนาดตัวอักษรเอง)
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { KIND_INFO, KIND_ORDER, type Kind, type Num } from '../core/types';
import { Icon, type IconName } from './icons';
import { Select } from './overlay';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* ---------- ป้ายที่มาของข้อมูล ---------- */
/** แสดงตัวเลขตามจำนวนทศนิยม และไม่ให้ขึ้น -0.0 */
export function showNum(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
}

export function Chip({ kind, extra, title }: { kind: Kind; extra?: string; title?: string }) {
  const info = KIND_INFO[kind];
  return (
    <span className="ld-chip" data-kind={kind} title={title ?? info.meaning}>
      <span className="ld-chip__icon" aria-hidden="true">{info.glyph}</span>
      {info.word}{extra ? ` · ${extra}` : ''}
    </span>
  );
}

export function MissingText({ children = 'ยังไม่มีค่า' }: { children?: string }) {
  return (
    <span className="missing">
      <span className="missing__text">{children}</span>
      <Chip kind="missing" />
    </span>
  );
}

/** ตัวเลขหนึ่งค่า หนึ่งป้าย ค่า null แสดง "ยังไม่มีค่า" พร้อมป้าย Missing เสมอ */
export function Val({ v, digits = 1, unit, kind, className }: { v: Num | undefined; digits?: number; unit?: string; kind: Kind; className?: string }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return <MissingText />;
  return (
    <span className={`val ${className ?? ''}`}>
      <span className="ld-num val__n">{showNum(v, digits)}</span>
      {unit ? <span className="val__u">{unit}</span> : null}
      <Chip kind={kind} />
    </span>
  );
}

export function Legend({ kinds = KIND_ORDER }: { kinds?: Kind[] }) {
  return (
    <ul className="legend">
      {kinds.map((k) => (
        <li key={k}>
          <Chip kind={k} />
          <span className="legend__t">{KIND_INFO[k].meaning}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- ตัวเลขนับขึ้น (ไม่เกิน 400ms ปิดเมื่อ reduced motion) ---------- */
export function CountUp({ value, digits = 1, duration = 400 }: { value: number; digits?: number; duration?: number }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  const raf = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return; }
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / Math.min(duration, 400));
      const e = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <>{shown.toFixed(digits)}</>;
}

/* ---------- Metric ---------- */
export function Metric({ label, value, unit, kind, digits = 1, hint, count }: {
  label: string; value: Num | undefined; unit?: string; kind: Kind; digits?: number; hint?: ReactNode; count?: boolean;
}) {
  const has = value !== null && value !== undefined && Number.isFinite(value);
  return (
    <div className="ld-metric">
      <span className="ld-metric__label">{label}</span>
      {has ? (
        <div>
          <span className="ld-metric__value">{count ? <CountUp value={value as number} digits={digits} /> : showNum(value as number, digits)}</span>
          {unit ? <span className="ld-metric__unit">{unit}</span> : null}
        </div>
      ) : (
        <div className="ld-metric__empty">ยังไม่มีค่า</div>
      )}
      <div className="ld-metric__meta">
        <Chip kind={has ? kind : 'missing'} />
      </div>
      {hint ? <div className="ld-hint">{hint}</div> : null}
    </div>
  );
}

/* ---------- Notice ---------- */
const NOTICE_GLYPH: Record<string, string> = { info: 'i', warn: '!', danger: '✕', ok: '✓', unvalidated: '!' };
export function Notice({ kind = 'info', title, children, role }: { kind?: 'info' | 'warn' | 'danger' | 'ok' | 'unvalidated'; title?: string; children?: ReactNode; role?: 'alert' | 'status' }) {
  return (
    <div className="ld-notice" data-kind={kind} role={role ?? (kind === 'danger' ? 'alert' : undefined)}>
      <span className="ld-notice__icon" aria-hidden="true">{NOTICE_GLYPH[kind]}</span>
      <div>
        {title ? <p className="ld-notice__title">{title}</p> : null}
        {children ? <div className="ld-notice__body">{children}</div> : null}
      </div>
    </div>
  );
}

/** แถบ UNVALIDATED ที่ติดกับผลทำนายและผลคำนวณทุกชุด (กฎข้อมูลข้อ 9) */
export function UnvalidatedBar({ kind = 'predicted', extra }: { kind?: 'predicted' | 'calculated'; extra?: string }) {
  return (
    <Notice kind="unvalidated" title={kind === 'predicted' ? 'ผลทำนาย UNVALIDATED' : 'คำนวณ UNVALIDATED'}>
      {extra ?? 'โมเดลนี้ยังไม่ผ่านการตรวจกับค่าที่อ่านได้จริง ใช้ดูแนวโน้มก่อนรัน ห้ามใช้เป็นเหตุผลเดียวในการตัดสินใจหน้างาน'}
    </Notice>
  );
}

/* ---------- Panel ---------- */
export function Panel({ title, actions, children, id, className, bodyClassName }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; className?: string; bodyClassName?: string }) {
  return (
    <section className={`ld-panel ${className ?? ''}`} id={id}>
      {title || actions ? (
        <header className="ld-panel__head">
          {title ? <h2 className="ld-panel__title">{title}</h2> : <span />}
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`ld-panel__body ${bodyClassName ?? ''}`}>{children}</div>
    </section>
  );
}

/** ส่วนพับสำหรับขั้นสูง ห้ามใส่คำเตือนทางวิทยาศาสตร์ไว้ในนี้ */
export function Collapse({ title, children, defaultOpen = false, badge }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  return (
    <details className="ld-panel" open={defaultOpen}>
      <summary>
        <span className="sum-title">{title}</span>
        {badge ? <span className="sum-badge">{badge}</span> : null}
      </summary>
      <div className="ld-panel__body">{children}</div>
    </details>
  );
}

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' | 'default'; icon?: IconName; block?: boolean };
export function Btn({ variant = 'default', icon, block, children, className, type = 'button', ...rest }: BtnProps) {
  const cls = ['ld-btn', variant === 'primary' && 'ld-btn--primary', variant === 'quiet' && 'ld-btn--quiet', variant === 'danger' && 'ld-btn--danger', block && 'ld-btn--block', className].filter(Boolean).join(' ');
  return (
    <button className={cls} type={type} {...rest}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

/* ---------- Field ---------- */
interface FieldShellProps { id: string; label: ReactNode; hint?: ReactNode; error?: string | null; chip?: ReactNode; children: ReactNode; className?: string }
export function FieldShell({ id, label, hint, error, chip, children, className }: FieldShellProps) {
  return (
    <div className={`ld-field ${className ?? ''}`} data-invalid={error ? 'true' : undefined}>
      <div className="field-top">
        <label className="ld-label" htmlFor={id}>{label}</label>
        {chip}
      </div>
      {children}
      {error ? <span className="ld-error" id={`${id}-err`} role="alert">{error}</span> : hint ? <span className="ld-hint" id={`${id}-hint`}>{hint}</span> : null}
    </div>
  );
}

export function NumField({ id, label, value, onChange, unit, hint, error, chip, placeholder = 'ยังไม่มีค่า', onEnter, autoFocus, inputRef, disabled }: {
  id: string; label: ReactNode; value: string; onChange: (v: string) => void; unit?: string; hint?: ReactNode; error?: string | null; chip?: ReactNode;
  placeholder?: string; onEnter?: () => void; autoFocus?: boolean; inputRef?: React.Ref<HTMLInputElement>; disabled?: boolean;
}) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} chip={chip}>
      <div className="ld-input-wrap">
        <input
          id={id} ref={inputRef} className="ld-input ld-input--num" inputMode="decimal" autoComplete="off" value={value} placeholder={placeholder}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} aria-invalid={error ? true : undefined} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}
          onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } } : undefined}
        />
        {unit ? <span className="ld-unit">{unit}</span> : null}
      </div>
    </FieldShell>
  );
}

export function TextField({ id, label, value, onChange, hint, error, type = 'text', placeholder, autoComplete, right, chip }: {
  id: string; label: ReactNode; value: string; onChange: (v: string) => void; hint?: ReactNode; error?: string | null; type?: string; placeholder?: string; autoComplete?: string; right?: ReactNode; chip?: ReactNode;
}) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} chip={chip}>
      <div className="ld-input-wrap">
        <input id={id} className="ld-input" type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)} />
        {right}
      </div>
    </FieldShell>
  );
}

export function SelectField({ id, label, value, onChange, options, hint, chip }: {
  id: string; label: ReactNode; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hint?: ReactNode; chip?: ReactNode;
}) {
  return (
    <FieldShell id={id} label={label} hint={hint} chip={chip}>
      <Select id={id} value={value} onChange={onChange} options={options} />
    </FieldShell>
  );
}

/** ตัวเลือกแบบปุ่มวิทยุ จัดเป็นแถบ ใช้เลือกที่มาของค่า โหมด และสถานะ */
export function Seg<T extends string>({ legend, value, onChange, options, name }: { legend: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; sub?: string }[]; name: string }) {
  return (
    <fieldset className="seg">
      <legend className="ld-label">{legend}</legend>
      <div className="seg__row">
        {options.map((o) => (
          <label key={o.value} className="seg__opt" data-on={value === o.value ? 'true' : undefined}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="seg__label">{o.label}</span>
            {o.sub ? <span className="seg__sub">{o.sub}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="chk" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="chk__box" aria-hidden="true"><Icon name="check" size={16} /></span>
      <span className="chk__t">{children}</span>
    </label>
  );
}

/* ---------- หัวหน้า ---------- */
export function PageHead({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="pagehead">
      <div className="pagehead__t">
        <h1 className="h1">{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      {actions ? <div className="pagehead__a">{actions}</div> : null}
    </header>
  );
}

/* ---------- ตาราง (บนจอแคบเป็นการ์ด) ---------- */
export function DT({ children, caption, className }: { children: ReactNode; caption?: string; className?: string }) {
  return (
    <div className="ld-table-wrap ld-table-wrap--cards">
      <table className={`ld-table ld-table--cards ${className ?? ''}`}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function useNow(active: boolean, ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

/* ---------- แท็บแบบแถบสลับ: ใช้รวมของที่ไม่ค่อยใช้ไว้ในกล่องเดียว เห็นทีละส่วน ---------- */
export function Tabs<T extends string>({ label, tabs, value, onChange }: { label: string; tabs: { key: T; label: string; badge?: ReactNode }[]; value: T; onChange: (k: T) => void }) {
  const move = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    onChange(tabs[n].key);
    (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="pilltabs" role="tablist" aria-label={label} style={{ ['--n' as string]: tabs.length }}>
      {tabs.map((t, i) => (
        <button key={t.key} type="button" role="tab" id={`pt-${t.key}`} aria-selected={value === t.key} tabIndex={value === t.key ? 0 : -1}
          className="pilltab" onClick={() => onChange(t.key)} onKeyDown={(e) => move(e, i)}>
          {t.label}{t.badge ? <span className="pilltab__b">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
