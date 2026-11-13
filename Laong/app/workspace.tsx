"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { animate, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { Bell, CalendarDays, ChevronDown, FlaskConical, Menu, Sun, X } from "lucide-react";
import * as React from "react";
import { memo, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { groups, pages } from "./routes";

const LegacySurface = memo(function LegacySurface({ body }: { body: string }) {
  return <div className="legacy-surface" dangerouslySetInnerHTML={{ __html: body }} />;
});
let startup: Promise<void> | undefined;

function loadSurface() {
  Object.assign(window, { React, ReactDOM: { createRoot }, animateLaong: animate });
  startup ??= (async () => {
    for (const name of ["reports", "workspace", "calendar", "previews", "admin", "monitor", "mascot", "app"]) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `/laong-assets/${name}.js`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(name));
        document.body.append(script);
      });
    }
  })();
  return startup;
}

function routeFromLocation() {
  const { pathname, search } = window.location;
  return pathname === "/" ? `today${search}` : pathname.slice(1) + search;
}

export function Workspace({ body }: { body: string }) {
  const pathname = usePathname();
  const route = pathname.split("/")[1] || "today";
  const current = route === "run" ? "runs" : route;
  const validRoute = route === "run" ? pathname.split("/").filter(Boolean).length === 2
    : Object.hasOwn(pages, route) && pathname.split("/").filter(Boolean).length <= 1;
  const [menuOpen, setMenuOpen] = useState(false);
  const activeGroup = groups.find(group => group.links.some(([path]) => path === current))?.label ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    setOpenGroup(activeGroup);
  }, [activeGroup, current]);

  useEffect(() => {
    if (!ready || reduced) return;
    const content = document.querySelector("main#content");
    content?.getAnimations().forEach(animation => animation.cancel());
    content?.animate([{ opacity: .65, transform: "translateY(5px)" }, { opacity: 1, transform: "none" }],
      { duration: 180, easing: "cubic-bezier(.22,1,.36,1)" });
  }, [pathname, ready, reduced]);

  useEffect(() => {
    if (!validRoute) return;
    const browserHash = window.location.hash.slice(1);
    const initialRoute = browserHash || routeFromLocation();
    const initialUrl = initialRoute === "today" ? "/" : `/${initialRoute}`;
    window.history.replaceState(window.history.state, "", initialUrl);
    document.documentElement.dataset.laongRoute = initialRoute;
    void loadSurface().then(() => setReady(true), () => setFailed(true));

    function syncHash() {
      const hash = window.location.hash.slice(1);
      if (!hash || hash === "content") return;
      document.documentElement.dataset.laongRoute = hash;
      window.history.replaceState(window.history.state, "", hash === "today" ? "/" : `/${hash}`);
    }
    function syncBack() {
      if (window.location.hash) return;
      const target = routeFromLocation();
      if (document.documentElement.dataset.laongRoute === target) return;
      document.documentElement.dataset.laongRoute = target;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncBack);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncBack);
    };
  }, [validRoute]);

  useEffect(() => {
    if (!ready) return;
    const target = routeFromLocation();
    if (document.documentElement.dataset.laongRoute === target) return;
    document.documentElement.dataset.laongRoute = target;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [pathname, ready]);

  if (!validRoute) return null;
  return <MotionConfig reducedMotion="user">
    <div className="stitch-frame">
      <header className="stitch-header flex items-center">
        <button type="button" className="stitch-menu button" aria-expanded={menuOpen} aria-controls="stitch-sidebar"
          aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
        <span className="stitch-context"><FlaskConical size={17} aria-hidden="true" /> {current.startsWith("admin") ? "พรีวิว Admin" : "พื้นที่ทำงาน"} <span aria-hidden="true">/</span> <strong>{pages[current]}</strong></span>
        <Link className="button subtle" href="/notifications" aria-label="แจ้งเตือน"><Bell size={18} aria-hidden="true" /></Link>
      </header>
      <aside className="stitch-rail" data-visible={menuOpen} id="stitch-sidebar" onKeyDown={event => {
        if (event.key === "Escape") {
          setMenuOpen(false);
          document.querySelector<HTMLButtonElement>(".stitch-menu")?.focus();
        }
      }}>
        <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
          {/* The original mark is a local SVG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/laong-assets/icons/laong.svg" alt="" /><span>LaOng <small>ละออง</small></span>
        </Link>
        <nav aria-label="เมนูหลัก Laong">
          <Link href="/" className="nav-link" aria-current={current === "today" ? "page" : undefined} onClick={() => setMenuOpen(false)}>
            <Sun className="stitch-nav-icon" size={18} strokeWidth={1.65} aria-hidden="true" />{pages.today}
          </Link>
          <Link href="/calendar" className="nav-link" aria-current={current === "calendar" ? "page" : undefined} onClick={() => setMenuOpen(false)}>
            <CalendarDays className="stitch-nav-icon" size={18} strokeWidth={1.65} aria-hidden="true" />{pages.calendar}
          </Link>
          {groups.map(group => <MenuGroup key={group.label} group={group} current={current}
            open={openGroup === group.label}
            onOpenChange={open => setOpenGroup(open ? group.label : null)}
            onNavigate={() => setMenuOpen(false)} />)}
        </nav>
        <p className="stitch-note">สมุดบันทึกการทดลอง<br />ข้อมูลอยู่ในเบราว์เซอร์นี้</p>
      </aside>
      <div className="stitch-content min-w-0">
        {!ready && <p className="panel panel-pad" role={failed ? "alert" : "status"}>{failed ? "เปิดพื้นที่ทำงานไม่ได้ กรุณาโหลดหน้าใหม่" : "กำลังเปิดพื้นที่ทำงาน"}</p>}
        <LegacySurface body={body} />
      </div>
    </div>
  </MotionConfig>;
}

function MenuGroup({ group, current, open, onOpenChange, onNavigate }: {
  group: typeof groups[number];
  current: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const reduced = useReducedMotion();
  const transition = { duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] as const };
  const GroupIcon = group.icon;

  return <Collapsible open={open} onOpenChange={onOpenChange} className="stitch-group">
    <CollapsibleTrigger className="stitch-trigger">
      <span className="stitch-trigger-label">
        <GroupIcon className="stitch-nav-icon" size={18} strokeWidth={1.65} aria-hidden="true" />{group.label}
      </span>
      <motion.span initial={false} animate={{ rotate: open ? 180 : 0 }} transition={transition}>
        <ChevronDown size={17} aria-hidden="true" />
      </motion.span>
    </CollapsibleTrigger>
    <CollapsibleContent forceMount asChild>
      <motion.div className="stitch-disclosure" initial={false} aria-hidden={!open} inert={!open}
        animate={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
        transition={transition}>
        <div className="stitch-disclosure-inner"><div className="stitch-links">
          {group.links.map(([path, label]) => <Link key={path} href={`/${path}`} className="nav-link"
            aria-current={path === current ? "page" : undefined} onClick={onNavigate}>{label}</Link>)}
        </div></div>
      </motion.div>
    </CollapsibleContent>
  </Collapsible>;
}
