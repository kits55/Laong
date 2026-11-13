import Link from "next/link";

export default function NotFound() {
  return <main className="panel-pad">
    <h1>ไม่พบหน้านี้</h1>
    <p className="muted">ตรวจลิงก์หรือกลับไปที่หน้าวันนี้</p>
    <Link className="button" href="/">กลับหน้าวันนี้</Link>
  </main>;
}
