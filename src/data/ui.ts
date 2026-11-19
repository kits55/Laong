// สถานะหน้าจอที่ไม่เก็บลงเครื่อง: ลิ้นชักตั้งค่าและแท็บที่เปิดอยู่
import { useSyncExternalStore } from 'react';

export type DrawerTab = 'machine' | 'board' | 'legend' | 'more';
interface UiState { open: boolean; tab: DrawerTab }

let ui: UiState = { open: false, tab: 'machine' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openDrawer(tab: DrawerTab = 'machine') { ui = { open: true, tab }; emit(); }
export function closeDrawer() { ui = { ...ui, open: false }; emit(); }
export function setDrawerTab(tab: DrawerTab) { ui = { ...ui, tab }; emit(); }
export function useUi(): UiState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => ui, () => ui);
}
