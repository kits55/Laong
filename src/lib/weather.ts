// สภาพอากาศปัจจุบันจาก Open-Meteo (ต้องแสดงที่มา CC BY 4.0 ฟรีเฉพาะการใช้งานไม่เชิงพาณิชย์)
// ส่งออกเฉพาะพิกัดแบบหยาบ ไม่ส่งชื่อ ข้อมูลรัน หรือข้อมูลของทีม
// เกณฑ์ท่า (ร้อน 32 องศาขึ้นไป, หนาว 22 องศาลงไป) เป็นค่าสมมติตั้งต้น ปรับได้ภายหลัง
export type WeatherPose = 'hot' | 'cold' | 'rain' | 'fog' | 'calm';

export interface WeatherNow { pose: WeatherPose; tempC: number; code: number }

const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const FOG = new Set([45, 48]);
export const HOT_C = 32;
export const COLD_C = 22;

export function poseFor(tempC: number, code: number): WeatherPose {
  if (RAIN.has(code)) return 'rain';
  if (FOG.has(code)) return 'fog';
  if (tempC >= HOT_C) return 'hot';
  if (tempC <= COLD_C) return 'cold';
  return 'calm';
}

export const WEATHER_LABEL: Record<WeatherPose, string> = { hot: 'อากาศร้อน', cold: 'อากาศเย็น', rain: 'ฝนตก', fog: 'มีหมอก', calm: 'อากาศสบาย' };

const CACHE_OK_MS = 20 * 60 * 1000;
const CACHE_FAIL_MS = 60 * 1000;
const cache = new Map<string, { until: number; value: WeatherNow | null }>();
const inflight = new Map<string, Promise<WeatherNow | null>>();

export function fetchWeather(lat: number, lon: number): Promise<WeatherNow | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.value);
  const running = inflight.get(key);
  if (running) return running;
  const p = (async (): Promise<WeatherNow | null> => {
    let value: WeatherNow | null = null;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const body = await res.json();
        const t = body?.current?.temperature_2m;
        const c = body?.current?.weather_code;
        if (Number.isFinite(t) && Number.isInteger(c)) value = { pose: poseFor(t, c), tempC: Math.round(t), code: c };
      }
    } catch {
      /* ออฟไลน์หรือถูกบล็อก: น้องละอองอยู่ท่าปกติได้ ไม่แสดงข้อผิดพลาด */
    }
    cache.set(key, { until: Date.now() + (value ? CACHE_OK_MS : CACHE_FAIL_MS), value });
    inflight.delete(key);
    return value;
  })();
  inflight.set(key, p);
  return p;
}
