/*
 * ตัวอย่างโค้ดฝั่งบอร์ด ESP32 สำหรับ Laong (ยังไม่ได้ทดสอบกับบอร์ดจริง ใช้เป็นจุดเริ่มต้น)
 *
 * ทำอะไร: เปิด WebSocket server พอร์ต 81 ตอบ hello, ping, status และรับคำสั่งกล้อง cam.start, cam.stop, cam.snap
 * ไม่ทำอะไร: ไม่มีคำสั่งควบคุม Spray Dryer (ฮีตเตอร์ ปั๊ม พัดลม) ข้อความอื่นนอกรายการถูกทิ้ง ตามบรีฟที่ว่าระบบช่วยตัดสินใจ ไม่ควบคุมเครื่อง
 *
 * ไลบรารีที่ต้องติดตั้งใน Arduino IDE (Library Manager):
 *   - "WebSockets" โดย Markus Sattler (arduinoWebSockets)
 *   - "ArduinoJson" เวอร์ชัน 7
 * บอร์ด: ESP32 (ถ้าใช้ ESP32-CAM ให้เติมโค้ดกล้องในฟังก์ชัน camStart, camStop, camSnap)
 *
 * ข้อความ (JSON หนึ่งบรรทัดต่อหนึ่งข้อความ) ดูรายละเอียดที่ docs/ESP32-LINK.md
 */
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// ใส่ชื่อ Wi-Fi และรหัสของคุณเอง ห้ามอัปโหลดไฟล์ที่มีรหัสจริงขึ้นที่เก็บโค้ด
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

const char* BOARD_NAME = "ESP32";
const char* FW_VERSION = "0.1.0";

WebSocketsServer ws(81);

// สถานะกล้อง: "none", "ready", "busy", "error"
const char* camState = "none";
String currentRun = "";

// ---- เติมโค้ดกล้องของคุณตรงนี้ ----
void camStart(const String& run) { currentRun = run; camState = "busy"; /* เริ่มบันทึกหรือถ่ายต่อเนื่อง */ }
void camStop() { camState = "ready"; /* หยุดกล้อง */ }
void camSnap() { /* ถ่ายหนึ่งภาพ แล้วกลับเป็น ready */ camState = "ready"; }
// ---------------------------------

void sendJson(uint8_t num, JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  ws.sendTXT(num, out);
}

void sendCam(uint8_t num) {
  JsonDocument d;
  d["t"] = "cam";
  d["state"] = camState;
  sendJson(num, d);
}

void onMessage(uint8_t num, const char* payload) {
  JsonDocument in;
  if (deserializeJson(in, payload)) return;           // อ่านไม่ได้ ทิ้ง
  const char* t = in["t"] | "";

  if (!strcmp(t, "hello")) {
    JsonDocument d;
    d["t"] = "hello"; d["board"] = BOARD_NAME; d["fw"] = FW_VERSION; d["cam"] = camState;
    sendJson(num, d);
  } else if (!strcmp(t, "ping")) {
    JsonDocument d;
    d["t"] = "pong"; d["id"] = in["id"] | 0;
    sendJson(num, d);
  } else if (!strcmp(t, "status")) {
    JsonDocument d;
    d["t"] = "status"; d["cam"] = camState; d["uptimeS"] = (uint32_t)(millis() / 1000);
    sendJson(num, d);
  } else if (!strcmp(t, "cam.start")) {
    camStart(String((const char*)(in["run"] | ""))); sendCam(num);
  } else if (!strcmp(t, "cam.stop")) {
    camStop(); sendCam(num);
  } else if (!strcmp(t, "cam.snap")) {
    camSnap(); sendCam(num);
  }
  // ข้อความอื่นทั้งหมดถูกทิ้งโดยตั้งใจ
}

void onEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_TEXT && length < 512) onMessage(num, (const char*)payload);
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.print("\nที่อยู่บอร์ด: ws://"); Serial.print(WiFi.localIP()); Serial.println(":81");
  camState = "ready";
  ws.begin();
  ws.onEvent(onEvent);
}

void loop() { ws.loop(); }
