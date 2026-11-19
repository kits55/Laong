// ชิ้นส่วนที่ลอยเหนือหน้า: ตัวเลือกแบบเลื่อนลง (Select), ลิ้นชัก (Drawer), สวิตช์ (Switch)
// ทุกตัวเปิด/ปิดแบบนุ่ม ใช้คีย์บอร์ดได้ครบ และปิดแอนิเมชันเมื่อผู้ใช้ตั้ง reduced motion (ผ่านกฎ CSS กลาง)
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

/* ===================== Select ===================== */
export interface Opt { value: string; label: string; sub?: string }

interface Pos { left: number; width: number; top?: number; bottom?: number; maxH: number; up: boolean }

export function Select({ id, value, onChange, options, ariaLabel, className, minListWidth }: {
  id?: string; value: string; onChange: (v: string) => void; options: Opt[]; ariaLabel?: string; className?: string; minListWidth?: number;
}) {
  const auto = useId();
  const listId = `${id ?? auto}-list`;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<Pos | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const buf = useRef({ s: '', t: 0 });
  const closeTimer = useRef<number>();
  const sel = options.findIndex((o) => o.value === value);

  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const need = Math.min(288, options.length * 48 + 12);
    const up = below < need + 12 && r.top > below;
    const width = Math.max(r.width, minListWidth ?? 0);
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    setPos({ left, width, up, top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined, maxH: Math.max(160, (up ? r.top : below) - 20) });
  }, [options.length, minListWidth]);

  const openIt = () => {
    window.clearTimeout(closeTimer.current);
    place();
    setMounted(true);
    setActive(sel >= 0 ? sel : 0);
    window.setTimeout(() => setOpen(true), 20);
  };
  const closeIt = useCallback((focusBtn = true) => {
    setOpen(false);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMounted(false), 150);
    if (focusBtn) btn.current?.focus();
  }, []);
  const choose = (i: number) => { const o = options[i]; if (o) onChange(o.value); closeIt(); };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!mounted) return;
    const away = (e: MouseEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !list.current?.contains(t)) closeIt(false); };
    const re = () => place();
    document.addEventListener('mousedown', away);
    window.addEventListener('resize', re);
    window.addEventListener('scroll', re, true);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('resize', re); window.removeEventListener('scroll', re, true); };
  }, [mounted, closeIt, place]);
  useLayoutEffect(() => {
    if (open && active >= 0) (list.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openIt(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); closeIt(); }
    else if (e.key === 'Tab') closeIt(false);
    else if (e.key.length === 1) {
      const now = Date.now();
      buf.current.s = now - buf.current.t > 600 ? e.key.toLowerCase() : buf.current.s + e.key.toLowerCase();
      buf.current.t = now;
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(buf.current.s));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <>
      <button
        id={id} ref={btn} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        className={`sel__btn ${className ?? ''}`} data-open={open ? 'true' : undefined}
        onClick={() => (open ? closeIt() : openIt())} onKeyDown={onKey}
      >
        <span className="sel__val">{options[sel]?.label ?? ''}</span>
        <span className="sel__chev"><Icon name="chevronDown" size={18} /></span>
      </button>
      {mounted && pos ? createPortal(
        <ul id={listId} ref={list} role="listbox" className="sel__list" data-open={open ? 'true' : 'false'} data-up={pos.up ? 'true' : undefined}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}>
          {options.map((o, i) => (
            <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={i === sel} data-active={i === active ? 'true' : undefined}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
              <span className="sel__t"><span>{o.label}</span>{o.sub ? <small>{o.sub}</small> : null}</span>
              {i === sel ? <span className="sel__ok"><Icon name="check" size={18} /></span> : null}
            </li>
          ))}
        </ul>, document.body) : null}
    </>
  );
}

/* ===================== Drawer ===================== */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const prev = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      prev.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      document.body.style.overflow = 'hidden';
      const r = window.setTimeout(() => { setShown(true); panel.current?.focus(); }, 20);
      return () => window.clearTimeout(r);
    }
    setShown(false);
    document.body.style.overflow = '';
    const t = window.setTimeout(() => { setMounted(false); prev.current?.focus?.(); }, 280);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !panel.current) return;
    const f = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[role=combobox],[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  if (!mounted) return null;
  return createPortal(
    <div className="drawer" data-open={shown ? 'true' : 'false'}>
      <div className="drawer__scrim" onClick={onClose} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel} onKeyDown={onKey}>
        <div className="drawer__grab" aria-hidden="true" />
        <header className="drawer__head">
          <h2 id={titleId} className="drawer__title">{title}</h2>
          <button type="button" className="ld-btn iconbtn" onClick={onClose} aria-label="ปิด"><Icon name="x" size={18} /></button>
        </header>
        <div className="drawer__body">{children}</div>
      </aside>
    </div>, document.body);
}

/* ===================== Switch ===================== */
export function Switch({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true"><span className="switch__thumb" /></span>
      <span className="switch__t"><span>{label}</span>{hint ? <small>{hint}</small> : null}</span>
    </label>
  );
}
