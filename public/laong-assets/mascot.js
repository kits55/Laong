'use strict';

const mascotDirections = { left: 'ซ้าย', right: 'ขวา', up: 'ขึ้น', down: 'ลง' };
const mascotWeatherLabels = { hot: 'อากาศร้อน', cold: 'อากาศเย็น', rain: 'ฝนตก', calm: 'อากาศสบาย' };
const mascotWeatherRefresh = 20 * 60 * 1000;
let mascotWeatherCache;
let mascotWeatherRequest;
let mascotMotionPaused = false;
try { mascotMotionPaused = localStorage.getItem('laong.mascot.paused') === 'true'; } catch { /* Use the session default. */ }

function mascotWeather() {
  if (mascotWeatherCache?.until > Date.now()) return Promise.resolve(mascotWeatherCache.pose);
  mascotWeatherRequest ??= (async () => {
    let pose = '';
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m,weather_code', {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const { current } = await response.json();
        if (Number.isFinite(current?.temperature_2m) && Number.isInteger(current.weather_code)) {
          const rain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(current.weather_code);
          pose = rain ? 'rain' : current.temperature_2m >= 32 ? 'hot' : current.temperature_2m <= 22 ? 'cold' : 'calm';
        }
      }
    } catch { /* Laong can stay in its resting pose offline. */ }
    mascotWeatherCache = { pose, until: Date.now() + (pose ? mascotWeatherRefresh : 60_000) };
    mascotWeatherRequest = undefined;
    return pose;
  })();
  return mascotWeatherRequest;
}

function mountLaongMascot(corner) {
  corner.innerHTML = `
    <button type="button" class="mascot-grab mascot-motion" aria-label="เล่นกับน้องละออง" aria-describedby="mascot-help">
      <svg class="mascot-art" viewBox="0 0 210 228" aria-hidden="true">
        <ellipse cx="103" cy="214" rx="49" ry="5" fill="#173B46" opacity=".1"/>
        <g class="mascot-prop mascot-chair" fill="none" stroke="#966A42" stroke-width="7" stroke-linecap="round">
          <path d="M26 137 57 199h107l16-25M60 199l-6 15m94-15 12 15" />
          <path d="m31 140 29 52h102" stroke="#EAB573" stroke-width="12"/>
        </g>
        <g class="mascot-body">
          <path d="M100 18C100 18 30 98 30 144a70 70 0 0 0 140 0C170 98 100 18 100 18Z" fill="#A7DED9"/>
          <circle cx="70" cy="112" r="7" fill="#D2F0ED"/><circle cx="56" cy="130" r="4" fill="#D2F0ED"/>
          <g class="mascot-prop mascot-coat">
            <path d="M33 145q23 13 47 8l20 17 20-17q23 5 47-8a67 67 0 0 1-134 0Z" fill="#397487"/>
            <path d="M100 170v41m-43-30 14 5m72-5-14 5" stroke="#D2F0ED" stroke-width="4" stroke-linecap="round"/>
            <path d="m72 53 28-36 28 36q-28 13-56 0Z" fill="#397487"/>
            <path d="M73 54q27 12 54 0" stroke="#D2F0ED" stroke-width="6" stroke-linecap="round"/>
          </g>
          <g class="mascot-face">
            <g class="mascot-cheeks" fill="#F4B860"><ellipse cx="64" cy="155" rx="9" ry="7"/><ellipse cx="136" cy="155" rx="9" ry="7"/></g>
            <g class="mascot-eyes" fill="#173B46"><circle cx="80" cy="138" r="6.5"/><circle cx="120" cy="138" r="6.5"/></g>
            <path class="mascot-smile" d="M89 156q11 11 22 0" fill="none" stroke="#173B46" stroke-width="5" stroke-linecap="round"/>
            <ellipse class="mascot-prop mascot-gasp" cx="100" cy="158" rx="6" ry="7" fill="#173B46"/>
          </g>
          <path class="mascot-prop mascot-arms" d="m69 174 48 13q8 1 16-8m-2-5-48 13q-8 1-16-8" fill="none" stroke="#407D7C" stroke-width="5" stroke-linecap="round"/>
        </g>
        <g class="mascot-prop mascot-umbrella">
          <path d="M125 67v105q0 14 12 14 10 0 10-10" fill="none" stroke="#173B46" stroke-width="5" stroke-linecap="round"/>
          <path d="M49 75a76 62 0 0 1 152 0q-19-14-38 0-19-14-38 0-19-14-38 0-19-14-38 0Z" fill="#397487" stroke="#173B46" stroke-width="3" stroke-linejoin="round"/>
        </g>
        <g class="mascot-prop mascot-rainfall" fill="none" stroke="#397487" stroke-width="4" stroke-linecap="round">
          <path d="m33 47-5 13m165 33-5 13"/>
          <path d="m24 83-5 13m182 21-5 13"/>
          <path d="m39 114-5 13m149 6-5 13"/>
        </g>
        <g class="mascot-prop mascot-breeze" fill="none" stroke="#397487" stroke-width="3.5" stroke-linecap="round">
          <path d="M105 181q12-5 26-3t20-8"/>
          <path d="M110 189q12-4 23-2t16 2"/>
          <path d="M108 174q12-9 26-8"/>
        </g>
        <g class="mascot-drops" fill="#0F766E"><circle cx="172" cy="72" r="9"/><circle cx="187" cy="50" r="5.5"/><circle cx="195" cy="32" r="3.2"/></g>
      </svg>
    </button>
    <div class="mascot-caption"><span>น้องละออง</span>
      <button type="button" class="mascot-options" aria-expanded="false" aria-controls="mascot-settings" aria-label="ตัวเลือกน้องละออง">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg>
      </button>
    </div>
    <p class="mascot-help" id="mascot-help">ลองลากน้อง หรือกดลูกศรเมื่อโฟกัส</p>
    <div class="mascot-settings" id="mascot-settings" hidden>
      <button type="button" class="mascot-pause"></button>
      <div class="mascot-directions" aria-label="เลือกท่า" role="group">
        ${Object.entries(mascotDirections).map(([key, label]) => `<button type="button" data-direction="${key}" aria-label="ลองท่า${label}">${icon('back')}</button>`).join('')}
      </div>
      <fieldset class="mascot-weather">
        <legend>ท่าตามอากาศ</legend>
        <div class="mascot-weather-choices">
          ${[['', 'อัตโนมัติ'], ['hot', 'ร้อน'], ['cold', 'หนาว'], ['rain', 'ฝน']].map(([value, label]) => `
            <label><input type="radio" name="mascot-weather" value="${value}" ${value === '' ? 'checked' : ''}><span>${label}</span></label>`).join('')}
        </div>
      </fieldset>
      <p class="mascot-weather-status"></p>
    </div>`;

  const grab = corner.querySelector('.mascot-grab');
  const art = corner.querySelector('.mascot-art');
  const settings = corner.querySelector('.mascot-settings');
  const options = corner.querySelector('.mascot-options');
  const pause = corner.querySelector('.mascot-pause');
  const weatherChoices = corner.querySelector('.mascot-weather');
  const weatherStatus = corner.querySelector('.mascot-weather-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const flight = Object.assign(document.createElement('div'), { className: 'mascot-flight mascot-motion' });
  flight.setAttribute('aria-hidden', 'true');
  let pointer;
  let settleTimer;
  let weather = mascotWeatherCache?.until > Date.now() ? mascotWeatherCache.pose : '';
  let preview = '';
  let reaction = '';
  let returnMotion;
  let dragged = false;

  function updatePose() {
    const pose = reaction || preview || (mascotMotionPaused ? '' : weather);
    corner.dataset.pose = grab.dataset.pose = flight.dataset.pose = pose;
    weatherStatus.textContent = preview ? 'กำลังลองท่า'
      : weather ? `กรุงเทพฯ · ${mascotWeatherLabels[weather]}` : 'กรุงเทพฯ · ยังไม่มีข้อมูลอากาศ';
  }

  async function updateWeather() {
    weather = await mascotWeather();
    if (!controller.signal.aborted) updatePose();
  }

  function positionOptions() {
    if (settings.hidden) return;
    const edge = 12;
    const gap = 6;
    const anchor = options.getBoundingClientRect();
    const container = corner.getBoundingClientRect();
    const availableBelow = innerHeight - anchor.bottom - gap - edge;
    const availableAbove = anchor.top - gap - edge;
    const above = availableBelow < settings.scrollHeight + 2 && availableAbove > availableBelow;
    const panelWidth = settings.offsetWidth;
    const leftOfMascot = container.left - panelWidth - gap;
    const preferredLeft = above && leftOfMascot >= edge ? leftOfMascot : anchor.right - panelWidth;
    const left = Math.max(edge, Math.min(preferredLeft, document.documentElement.clientWidth - panelWidth - edge));
    settings.style.left = `${left - container.left}px`;
    settings.style.maxHeight = `${Math.max(0, above ? availableAbove : availableBelow)}px`;
    settings.style.top = above ? 'auto' : `${anchor.bottom - container.top + gap}px`;
    settings.style.bottom = above ? `${container.bottom - anchor.top + gap}px` : 'auto';
    settings.dataset.placement = above ? 'above' : 'below';
  }

  function setOptions(open) {
    settings.hidden = !open;
    options.setAttribute('aria-expanded', String(open));
    if (open) positionOptions();
  }

  function updatePause() {
    const paused = String(mascotMotionPaused);
    corner.dataset.paused = grab.dataset.paused = flight.dataset.paused = paused;
    pause.textContent = mascotMotionPaused ? 'เล่นท่าอัตโนมัติ' : 'พักท่าอัตโนมัติ';
    updatePose();
  }

  function dock() {
    returnMotion?.cancel();
    returnMotion = undefined;
    grab.append(art);
    flight.remove();
    reaction = '';
    updatePose();
  }

  function finishDrag() {
    const { id, moved } = pointer;
    pointer = undefined;
    if (grab.hasPointerCapture(id)) grab.releasePointerCapture(id);
    corner.dataset.dragging = 'false';
    if (!moved) return;
    const home = grab.getBoundingClientRect();
    const current = flight.getBoundingClientRect();
    if (reduced.matches || home.bottom <= 0 || home.top >= innerHeight) {
      dock();
      return;
    }
    returnMotion = flight.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${home.left - current.left}px, ${home.top - current.top}px)` },
    ], { duration: 360, easing: 'cubic-bezier(.2,.78,.26,1)', fill: 'forwards' });
    returnMotion.onfinish = dock;
  }

  function showReaction(direction) {
    if (pointer) return;
    clearTimeout(settleTimer);
    reaction = direction;
    updatePose();
    settleTimer = setTimeout(() => { reaction = ''; updatePose(); }, 700);
  }

  const listen = (element, event, handler) => element.addEventListener(event, handler, { signal: controller.signal });
  listen(grab, 'pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || pointer) return;
    clearTimeout(settleTimer);
    if (returnMotion) dock();
    reaction = '';
    dragged = false;
    const home = grab.getBoundingClientRect();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
      offsetX: event.clientX - home.left, offsetY: event.clientY - home.top, width: home.width, height: home.height, moved: false };
    grab.setPointerCapture(event.pointerId);
    corner.dataset.dragging = 'true';
    updatePose();
  });
  listen(window, 'pointermove', event => {
    if (event.pointerId !== pointer?.id) return;
    const x = event.clientX - pointer.x;
    const y = event.clientY - pointer.y;
    if (!pointer.moved && Math.max(Math.abs(x), Math.abs(y)) < 7) return;
    if (!pointer.moved) {
      pointer.moved = true;
      dragged = true;
      setOptions(false);
      flight.style.width = `${pointer.width}px`;
      flight.append(art);
      document.body.append(flight);
    }
    const viewport = document.documentElement;
    const clamp = (position, max) => Math.max(0, Math.min(position, max));
    flight.style.left = `${clamp(event.clientX - pointer.offsetX, viewport.clientWidth - pointer.width)}px`;
    flight.style.top = `${clamp(event.clientY - pointer.offsetY, viewport.clientHeight - pointer.height)}px`;
    if (Math.max(Math.abs(x), Math.abs(y)) < 7) return;
    const direction = Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
    if (reaction !== direction) {
      reaction = direction;
      updatePose();
    }
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(window, event, e => { if (e.pointerId === pointer?.id) finishDrag(); });
  }
  listen(grab, 'click', event => {
    if (event.detail && dragged) return;
    if (!reaction && !returnMotion) showReaction('up');
  });
  listen(grab, 'keydown', event => {
    const direction = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[event.key];
    if (!direction) return;
    event.preventDefault();
    showReaction(direction);
  });
  listen(options, 'click', () => setOptions(settings.hidden));
  for (const event of ['resize', 'scroll']) listen(window, event, () => {
    if (returnMotion) dock();
    positionOptions();
  });
  listen(corner, 'keydown', event => {
    if (event.key !== 'Escape' || settings.hidden) return;
    setOptions(false);
    options.focus();
  });
  listen(document, 'click', event => { if (!corner.contains(event.target)) setOptions(false); });
  listen(pause, 'click', () => {
    mascotMotionPaused = !mascotMotionPaused;
    try { localStorage.setItem('laong.mascot.paused', String(mascotMotionPaused)); } catch { /* Keep the session choice. */ }
    updatePause();
  });
  listen(weatherChoices, 'change', event => {
    preview = event.target.value;
    updatePose();
    positionOptions();
  });
  for (const button of settings.querySelectorAll('[data-direction]')) {
    listen(button, 'click', () => showReaction(button.dataset.direction));
  }
  const refreshInterval = setInterval(updateWeather, mascotWeatherRefresh);
  updatePause();
  void updateWeather();
  return () => {
    controller.abort();
    clearInterval(refreshInterval);
    clearTimeout(settleTimer);
    returnMotion?.cancel();
    flight.remove();
  };
}
