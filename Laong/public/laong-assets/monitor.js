(() => {
'use strict';

let dependencies;
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('React dependency unavailable')); };
    document.head.append(script);
  });
}

window.loadLaongMonitor = () => {
  dependencies ??= Promise.resolve()
    .then(() => window.React || loadScript('https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js'))
    .then(() => window.ReactDOM || loadScript('https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js'))
    .catch(error => { dependencies = undefined; throw error; });
  return dependencies;
};

// The demonstration has no device or camera endpoint.
const states = {
  idle: 'รอเปิดเครื่อง',
  connecting: 'กำลังเชื่อม Wi-Fi',
  live: 'รับข้อมูลแล้ว',
  offline: 'ขาดการเชื่อมต่อ',
  warning: 'พบเหตุผิดปกติ',
  done: 'จบรันแล้ว',
};
const settingsKey = 'laong.monitor-preview.v1';
function readVisibility() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    return { status: saved?.status === true, camera: saved?.camera === true };
  } catch {
    return { status: false, camera: false };
  }
}

let simulation = { phase: 'idle', frame: null, events: [] };

function Monitor({ admin }) {
  const { createElement: h, useEffect, useState } = window.React;
  const [view, setView] = useState(simulation);
  const [visibility, setVisibility] = useState(readVisibility);
  const [preview, setPreview] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const controls = admin && !preview;
  const showCamera = controls || visibility.camera;

  function changePhase(phase) {
    const time = new Date();
    const hasFrame = ['live', 'warning', 'done'].includes(phase);
    simulation = {
      phase,
      frame: hasFrame ? time : simulation.frame,
      events: [{ phase, time }, ...simulation.events].slice(0, 8),
    };
    setView(simulation);
  }

  useEffect(() => {
    function sync(event) {
      if (event.key === settingsKey || event.key === null) setVisibility(readVisibility());
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (view.phase !== 'connecting') return;
    const timer = setTimeout(() => changePhase('live'), 1400);
    return () => clearTimeout(timer);
  }, [view.phase]);

  function toggle(key) {
    const next = { ...visibility, [key]: !visibility[key] };
    try {
      localStorage.setItem(settingsKey, JSON.stringify(next));
      setVisibility(next);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  const timeLabel = time => time?.toLocaleTimeString('th-TH', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok',
  }) ?? 'ยังไม่มีข้อมูล';
  const actions = [
    ['connecting', 'เปิดเครื่อง'], ['offline', 'ตัดสัญญาณ'],
    ['warning', 'พบความผิดปกติ'], ['done', 'จบรัน'],
  ];
  return h('div', { className: 'monitor-layout' },
    h('header', { className: 'monitor-bar' },
      h('strong', null, 'SD-01 · Spray Dryer'), h('span', { className: 'source' }, 'โหมดจำลอง'),
      admin && h('button', { className: 'button', onClick: () => setPreview(!preview), 'aria-pressed': preview },
        preview ? 'กลับมุม Admin' : 'ดูมุมผู้ชม')),
    controls && h('section', { className: 'panel panel-pad monitor-controls', 'aria-label': 'การตั้งค่าการแสดงผล' },
      h('h2', null, 'การแสดงผล'),
      h('p', { className: 'hint' }, 'สิทธิ์ในหน้านี้เป็นตัวอย่าง UI สำหรับเบราว์เซอร์นี้'),
      h('div', { className: 'actions' }, ...[
        ['status', 'ให้ทุกคนดูสถานะเครื่อง'], ['camera', 'ให้ทุกคนดูภาพกล้อง'],
      ].map(([key, label]) => h('label', { key, className: 'monitor-switch' },
        h('input', { type: 'checkbox', role: 'switch', checked: visibility[key], onChange: () => toggle(key) }), label))),
      storageError && h('p', { role: 'alert' }, 'บันทึกการตั้งค่าในเบราว์เซอร์ไม่ได้')),
    !controls && !visibility.status && !visibility.camera
      ? h('p', { className: 'panel panel-pad' }, 'ผู้ดูแลยังไม่ได้เปิดหน้าติดตามให้ผู้ชม')
      : h('div', { className: 'monitor-grid' },
        showCamera && h('section', { className: 'panel monitor-camera', 'aria-label': 'ตัวอย่างภาพกล้อง' },
          h('div', { className: 'monitor-frame', 'data-phase': view.phase, 'data-frame': Boolean(view.frame) },
            h('span', { className: 'monitor-lens', 'aria-hidden': true }),
            h('strong', { key: view.phase }, view.frame
              ? view.phase === 'offline' ? 'ภาพล่าสุด · ขาดการเชื่อมต่อ' : 'ตัวอย่างเฟรมกล้อง'
              : states[view.phase]),
            h('span', null, view.frame ? `เฟรมจำลอง ${timeLabel(view.frame)} น.` : 'ยังไม่ได้รับเฟรมจำลอง'))),
        (controls || visibility.status) && h('section', { className: 'panel panel-pad monitor-events' },
          h('h2', null, 'สถานะและเหตุการณ์'),
          h('p', { className: 'monitor-state', role: 'status' }, states[view.phase]),
          view.events.length ? h('ol', null, ...view.events.map(({ phase, time }, index) =>
            h('li', { key: `${time.getTime()}-${index}` }, h('time', { className: 'mono', dateTime: time.toISOString() }, timeLabel(time)), states[phase])))
            : h('p', { className: 'hint' }, 'ยังไม่มีเหตุการณ์'))),
    controls && h('section', { className: 'panel panel-pad monitor-controls' },
      h('h2', null, 'ลองสถานการณ์'),
      h('div', { className: 'actions' }, ...actions.map(([phase, label]) => h('button', {
        className: phase === 'connecting' ? 'button primary' : 'button',
        key: phase, disabled: phase === 'connecting' ? view.phase === 'connecting' : !view.frame,
        onClick: () => changePhase(phase),
      }, label)))));
}

window.mountLaongMonitor = (container, admin) => {
  const root = window.ReactDOM.createRoot(container);
  root.render(window.React.createElement(Monitor, { admin }));
  return () => {
    root.unmount();
    window.unmountLaongMonitor = undefined;
  };
};
})();
