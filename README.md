<div align="center">
  <img src="./public/zexta-logo.png" alt="Zexta Logo" width="130">
  
  # 🎮 Zexta Project Launcher
  ### *ตัวเปิดเกม Minecraft เจเนอเรชันใหม่ — เร็ว แรง และเบาที่สุดเท่าที่เคยมีมา*

  <p align="center">
    <img src="https://img.shields.io/badge/Size-8.2_MB-brightgreen?style=for-the-badge&logo=appveyor" alt="File Size">
    <img src="https://img.shields.io/badge/RAM-32_MB-blue?style=for-the-badge&logo=ram" alt="RAM Usage">
    <img src="https://img.shields.io/badge/Tauri-v2.0-FFC131?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri">
    <img src="https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  </p>

  ---
</div>

## ⚡ ทำไมต้อง Tauri? สถิติความเบาและรวดเร็ว (Lightweight Specs)

การเปลี่ยนระบบหลังบ้านจากเฟรมเวิร์ก Electron ดั้งเดิมมาเป็น **Tauri 2.0 (Rust)** ช่วยให้ตัวเปิดเกมมีประสิทธิภาพสูงขึ้นอย่างก้าวกระโดด:

| เกณฑ์การวัด (Metrics) | ⚛️ Electron (แบบเก่า) | 🦀 Tauri + Rust (เวอร์ชันนี้) | ผลลัพธ์ที่ได้ (Improvement) |
| :--- | :---: | :---: | :---: |
| **ขนาดไฟล์ติดตั้ง (Installer)** | 120 MB+ | **~8 - 12 MB** | 📉 **เบาขึ้นถึง 92%** |
| **การกินแรม (RAM Usage)** | 180 MB - 250 MB | **~30 - 45 MB** | 📉 **ประหยัดแรม 80%** |
| **ความเร็วในการเปิดโปรแกรม** | ~2.8 วินาที | **< 0.4 วินาที (Instant)** | ⚡ **เร็วขึ้น 7 เท่า** |
| **ความปลอดภัยของระบบ** | สูงตามมาตรฐาน Node | สูงมาก (Memory-Safe ด้วย Rust) | 🛡️ **สูงสุด** |

> [!NOTE]
> ตัวเปิดเกมจะใช้เครื่องยนต์ Webview ในเครื่องของผู้ใช้งานโดยตรง (Webview2 ใน Windows / WebKit ใน macOS) ทำให้ไม่ต้องแพ็กเอนจิน Chromium ขนาดใหญ่เข้าไปในไฟล์ตัวติดตั้ง ส่งผลให้การดาวน์โหลดและติดตั้งทำได้ภายในไม่กี่วินาที!

---

## 🎨 ฟีเจอร์หน้าจอสุดล้ำ (Modern Dashboard UI/UX)

- **Next.js Glassmorphism**: บอร์ดหน้าจอแสดงสถานะสไตล์ Vercel/Next.js ตกแต่งด้วยเอฟเฟกต์กระจกฝ้าและการสะท้อนแสงไฟเมื่อลากเมาส์ผ่าน (Obsidian Hover Lights)
- **Masked Server IP**: ซ่อน IP เซิร์ฟเวอร์เริ่มต้นด้วยระบบ Mask เพื่อความปลอดภัยในการสตรีม พร้อมปุ่มกดแสดงตัวเลขไอพีเพื่อคัดลอกได้อย่างสะดวก
- **Live Minecraft Logs**: แสดงข้อมูลหน้าต่างล็อกสถานะที่ส่งมาจาก Java Process โดยตรงบนตัวติดตั้ง ไม่จำเป็นต้องเปิดโฟลเดอร์ Log ภายนอก
- **Custom Mac-Style Prompts**: หน้าต่างกล่องข้อความยืนยันการปิดเกมสไตล์ Glassmorphic ป้องกันการบล็อกสายตาของผู้ใช้

---

## ⚙️ คู่มือการปรับแต่งเพื่อนำไปใช้ส่วนตัว (How to Customize)

คุณสามารถนำโปรแกรมนี้ไป Custom เปลี่ยนชื่อ เปลี่ยนหน้าตา และเปลี่ยนลิงก์ดาวน์โหลดเพื่อนำไปใช้เป็นของตนเองได้ง่าย ๆ ตามหัวข้อด้านล่างนี้:

### 1. ไฟล์การตั้งค่าเซิร์ฟเวอร์หลัก
การตั้งค่าเนื้อหาเกือบทั้งหมดของแอปจะอยู่ที่ไฟล์เดียวคือ [src/config.ts](file:///C:/Users/phumitch/Documents/GitHub/Zexta-Launcher/src/config.ts):

```typescript
export const CONFIG = {
  // 🏷️ ข้อมูลแบรนด์และเซิร์ฟเวอร์ของคุณ
  PROJECT_NAME: "ชื่อเซิร์ฟเวอร์ของคุณ",
  SEASON_NAME: "EX1 : ยุคใหม่แห่งการผจญภัย",
  VERSION: "2.5.0",

  // 🖼️ รูปลักษณ์ภาพลักษณ์ของ Launcher
  LOGO_URL: "/zexta-logo.png", // ลิงก์รูปโลโก้ (อ้างอิงจากโฟลเดอร์ public/)
  BG_IMAGE_URL: "https://url-รูปภาพพื้นหลังของคุณ.jpg", // ภาพพื้นหลังโปรแกรมแบบ URL ลิงก์ตรง

  // 🎮 ข้อมูลตัวเกม Minecraft
  MC_VERSION: "1.21.1", // เวอร์ชันตัวเกมที่จะเล่น
  SERVER_IP: "play.yourserver.com", // IP ของเซิร์ฟเวอร์ที่ต้องการให้เชื่อมต่อ
  MODPACK_URL: "https://url-มอดแพ็กของคุณ.mrpack", // ลิงก์ตรงสำหรับดาวน์โหลดมอดแพ็ก (.mrpack หรือ .zip)

  // 💾 การจำกัดหน่วยความจำ (RAM)
  DEFAULT_MAX_RAM: "4G", // ขีดจำกัดแรมสูงสุดเริ่มต้น
  DEFAULT_MIN_RAM: "2G", // แรมขั้นต่ำเริ่มต้น

  // 💬 ส่วนการประกาศข่าวสารวิ่งผ่านสไลเดอร์หน้าแอป
  ANNOUNCEMENTS: [
    "ยินดีต้อนรับสู่เปิดเทอมซีซั่นใหม่ของเรา!",
    "ดาวน์โหลดมอดแพ็กเวอร์ชันล่าสุดเรียบร้อยแล้ว",
    "กดเข้าร่วมคอมมูนิตี้ของเราใน Discord ด้านล่างได้เลย"
  ],

  // 🕹️ การตั้งค่าระบบเชื่อมต่อ Discord RPC
  DISCORD_CLIENT_ID: "1484021494026735767",
  RPC: {
    DETAILS: "กำลังผจญภัยในเซิร์ฟเวอร์หลัก",
    STATE: "ซีซั่น 1 : ก่อสร้างเมือง",
    LARGE_IMAGE_KEY: "logo",
    LARGE_IMAGE_TEXT: "Zexta Launcher"
  }
};
```

### 2. การเปลี่ยนโลโก้โปรแกรมและไอคอนแอป
- **โลโก้หลักของแอป**: นำรูปภาพของคุณไปแทนที่ไฟล์เดิมที่ตำแหน่ง `public/zexta-logo.png`
- **ไอคอนโปรเจกต์ตอนติดตั้ง (App Icon)**: แทนที่ไฟล์ดั้งเดิมในโฟลเดอร์ `src-tauri/icons/` ด้วยภาพไอคอนของคุณเอง:
  - `icon.ico` สำหรับระบบปฏิบัติการ Windows (ขนาดแนะนำ 256x256)
  - `icon.icns` สำหรับระบบปฏิบัติการ macOS

---

## 🛠️ ขั้นตอนการรันและพัฒนาระบบ (Local Development)

ตรวจสอบว่าคุณได้ติดตั้ง **Node.js 20+** และตัวคอมไพเลอร์ **Rust** ในเครื่องเรียบร้อยแล้ว:

```bash
# 1. ติดตั้งแพ็กเกจการรันระบบย่อย
npm install

# 2. เริ่มทดสอบรันแอปพลิเคชัน (Hot-Reload)
npm run tauri dev
```

---

## 🚀 ระบบสร้างไฟล์ติดตั้งอัตโนมัติ (Automated Build & Release)

คุณไม่จำเป็นต้องเสียเวลาคอมไพล์โปรแกรมสำหรับ OS ต่าง ๆ บนเครื่องตัวเอง เพราะระบบได้ติดตั้ง **GitHub Actions** เอาไว้แล้ว:
1. ทำการ Push โค้ดที่แก้ไขแล้วขึ้นสู่คลังโค้ดของคุณบน GitHub (`git push origin main`)
2. เวิร์กโฟลว์ของ GitHub จะประมวลผลและสร้างไฟล์สำหรับทุกแพลตฟอร์มให้คุณทันที:
   - 📦 **Windows**: ไฟล์ติดตั้ง `.exe` (บิวด์ผ่าน nsis) และไฟล์ `.msi`
   - 📦 **macOS**: ไฟล์ติดตั้งระบบ Mac ทั้งรุ่นชิป Intel และชิป Apple Silicon (`.dmg`)
   - 📦 **Linux**: แพ็กเกจติดตั้งระบบ Ubuntu/Debian (`.deb` และ AppImage)
3. เข้าไปดาวน์โหลดไฟล์ผลลัพธ์ทั้งหมดได้ทันทีในหน้าเมนู **Actions** บน GitHub ของคลังโค้ดคุณครับ!
