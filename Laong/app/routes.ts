import { ChartNoAxesColumnIncreasing, ClipboardList, FlaskConical, ShieldCheck } from "lucide-react";

export const groups = [
  { label: "งานทดลอง", icon: ClipboardList, links: [["runs", "รายการทดลอง"], ["templates", "แบบฟอร์ม"], ["history", "ประวัติและรายงาน"]] },
  { label: "ห้องแล็บ", icon: FlaskConical, links: [["machines", "ทะเบียนเครื่อง"], ["monitor", "ติดตามเครื่อง"]] },
  { label: "การจัดการ", icon: ChartNoAxesColumnIncreasing, links: [["executive", "ภาพรวมผู้บริหาร"], ["executive-reports", "รายงานผู้บริหาร"], ["admin-monitor", "การแชร์ข้อมูล"], ["settings", "ตั้งค่า"]] },
  { label: "พรีวิว Admin", icon: ShieldCheck, links: [["admin", "ภาพรวม Admin"], ["admin-users", "ผู้ใช้"], ["admin-machines", "ทะเบียนเครื่ององค์กร"], ["admin-audit", "ประวัติการจัดการ"], ["admin-formula", "คลังสูตรและเอกสาร"]] },
];
export const pages = Object.fromEntries([["today", "วันนี้"], ["calendar", "ปฏิทินแล็บ"], ["notifications", "แจ้งเตือน"], ...groups.flatMap(group => group.links)]);
