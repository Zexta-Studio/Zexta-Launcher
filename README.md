# <p align="center"><img src="./public/zexta-logo.png" alt="Zexta Logo" width="120"></p>
# <p align="center">🎮 Zexta Project Launcher</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind">
</p>

---

## 🌟 ภาพรวมระบบ (Overview)

**Zexta Project Launcher (Frontline Edition)** คือตัวเปิดเกม Minecraft ระดับพรีเมียมที่ถูกเขียนขึ้นใหม่ด้วยเฟรมเวิร์กประสิทธิภาพสูง **Tauri 2.0 (Rust)** และหน้าจอโต้ตอบผู้ใช้ด้วยดีไซน์สุดล้ำสมัยของ **React 19 + Tailwind CSS** ออกแบบมาเพื่อให้ผู้เล่นของคุณได้รับประสบการณ์การเชื่อมต่อ โหลดทรัพยากรเกม และเข้าเล่นมอดแพ็กที่รวดเร็วและสวยงามที่สุด

---

## ⚙️ วิธีการปรับแต่งสเปกเพื่อทำเป็นของตัวเอง (How to Customize)

โปรแกรมได้รับการออกแบบมาให้แยกไฟล์การตั้งค่าออกอย่างชัดเจน คุณสามารถนำไป Custom เป็นของเซิร์ฟเวอร์ตัวเองได้ง่าย ๆ ดังนี้:

### 1. ปรับเปลี่ยนข้อมูลโปรเจกต์ เซิร์ฟเวอร์ และลิงก์มอดแพ็ก
การตั้งค่าส่วนนี้จะอยู่ในไฟล์ [src/config.ts](file:///C:/Users/phumitch/Documents/GitHub/Zexta-Launcher/src/config.ts) ซึ่งคุณสามารถเปลี่ยนค่าต่าง ๆ ได้ทันที:

```typescript
export const CONFIG = {
  // 🔗 ดึงข้อมูลการตั้งค่าระยะไกลจาก GitHub (Remote config)
  REMOTE_CONFIG_URL: "https://raw.githubusercontent.com/...",

  // 🏷️ ชื่อโปรเจกต์และชื่อซีซั่น
  PROJECT_NAME: "ชื่อเซิร์ฟเวอร์ของคุณ",
  SEASON_NAME: "ซีซั่น 1 : การเริ่มต้นใหม่",
  VERSION: "2.5.0",

  // 🖼️ ตกแต่งแบรนด์ (รูปภาพ & โลโก้)
  LOGO_URL: "/zexta-logo.png", // ไฟล์โลโก้ในโฟลเดอร์ public
  BG_IMAGE_URL: "https://url-รูปภาพพื้นหลังของคุณ.png", // รูปพื้นหลังแบบ URL 

  // 🎮 การตั้งค่าเกม Minecraft
  MC_VERSION: "1.21.1", // เวอร์ชันเกมหลักที่ต้องการรัน
  SERVER_IP: "ip-เซิร์ฟเวอร์ของคุณ.joinmc.link", // IP เซิร์ฟเวอร์ที่ต้องการให้เชื่อมต่อ
  MODPACK_URL: "https://url-ดาวน์โหลดไฟล์มอดแพ็ก.mrpack", // ลิงก์ตรงไฟล์ .mrpack หรือ .zip ของมอดแพ็ก

  // 💾 หน่วยความจำเริ่มต้น (RAM)
  DEFAULT_MAX_RAM: "4G", // ค่าเริ่มต้นสูงสุด (เช่น 4G, 6G, 8G)
  DEFAULT_MIN_RAM: "2G", // ค่าเริ่มต้นต่ำสุด

  // 💬 ประกาศข่าวสารหน้าต่าง Launcher
  ANNOUNCEMENTS: [
    "ยินดีต้อนรับสู่เซิร์ฟเวอร์ของเรา!",
    "สามารถเข้าร่วม Discord เพื่อติดตามข้อมูลข่าวสารล่าสุดได้เลย",
    "อัปเดตมอดแพ็กเวอร์ชันล่าสุดเรียบร้อยแล้ว!"
  ],
  
  // 🕹️ Discord Rich Presence (แสดงสถานะการเล่นเกมใน Discord ของผู้เล่น)
  DISCORD_CLIENT_ID: "1484021494026735767", 
  RPC: {
    DETAILS: "กำลังเล่นเซิร์ฟเวอร์ Zexta",
    STATE: "ผจญภัยในโลกกว้าง",
    LARGE_IMAGE_KEY: "logo"
  }
};
```

### 2. การเปลี่ยนโลโก้และรูปภาพที่ใช้บนแอป
- **โลโก้โปรแกรม (หน้าต่าง Login/Dashboard)**: นำไฟล์ภาพโลโก้ที่เป็น `.png` โปร่งใส ไปใส่ไว้ที่ `public/zexta-logo.png`
- **ไอคอนโปรแกรมเมื่อบิวด์สำเร็จ (App Icon)**: ไฟล์ไอคอนแอปพลิเคชันจะอยู่ในไดเรกทอรี `src-tauri/icons/` ให้ทำการสลับเปลี่ยนไฟล์ไอคอนดังนี้:
  - `icon.ico` สำหรับระบบปฏิบัติการ Windows
  - `icon.icns` สำหรับระบบปฏิบัติการ macOS
  - ไฟล์ภาพขนาดต่าง ๆ สำหรับ Linux และแอปสโตร์

---

## 🛠️ การติดตั้งและการรันในเครื่อง (Local Setup)

### สเปกเครื่องขั้นต่ำในการพัฒนา:
- **Node.js**: เวอร์ชัน 20 หรือสูงกว่า
- **Rust**: คอมไพเลอร์เวอร์ชันเสถียร (Stable Toolchain)
- **C++ Build Tools**: (เฉพาะ Windows) สำหรับใช้งานควบคู่กับ Rust

### ขั้นตอนการรัน:

1. **ดาวน์โหลดโมดูลและไลบรารีพัฒนาหน้าบ้าน**
   ```bash
   npm install
   ```

2. **ทดสอบรันโปรแกรมในโหมดผู้พัฒนา (Hot Reload)**
   รันคำสั่งนี้เพื่อเริ่มหน้าต่างทดสอบแอปพลิเคชันแบบด่วน (หากมีการแก้ไขโค้ด หน้าต่างจะอัปเดตให้อัตโนมัติ):
   ```bash
   npm run tauri dev
   ```

---

## 🚀 การสร้างตัวติดตั้งเพื่อแจกจ่าย (Building & Shipping)

เมื่อคุณปรับแต่งหน้าตาและไอคอนจนเสร็จสิ้นเรียบร้อยแล้ว และต้องการแพ็กเกจไฟล์ไปแจกจ่ายให้ผู้เล่นใช้งาน:

### 1. บิวด์บนเครื่องส่วนตัว (Local Build)
รันคำสั่งด้านล่างนี้เพื่อสร้างไฟล์ติดตั้งบนระบบปฏิบัติการปัจจุบันของคุณ:
```bash
npm run tauri build
```
- **สำหรับ Windows**: ผลลัพธ์ตัวติดตั้งแบบรันเดี่ยว `.exe` และ `.msi` จะถูกสร้างขึ้นที่ `src-tauri/target/release/bundle/nsis/` และ `/msi/`

### 2. บิวด์ระบบคลาวด์อัตโนมัติ (GitHub Actions Cloud Build)
โปรเจกต์นี้มาพร้อมเวิร์กโฟลว์การบิวด์อัตโนมัติบนระบบคลาวด์ เมื่อใดก็ตามที่คุณ push โค้ดขึ้นไปบน GitHub:
- **เกิดอะไรขึ้นเบื้องหลัง**: เครื่องเสมือนของ GitHub จะรันโปรแกรมระบบ Windows, macOS, และ Linux เพื่อทำแพ็กเกจตัวรันแยกแพลตฟอร์มพร้อมกัน
- **ดาวน์โหลดผลลัพธ์**: เข้าไปที่แถบ **Actions** บนเว็บคลังโค้ด GitHub ของคุณ -> เลือกงานล่าสุดที่ผ่านแล้ว -> เลื่อนลงล่างสุดเพื่อดาวน์โหลดตัวบิวด์ (Artifacts) ของทุกแพลตฟอร์มไปใช้งานแจกจ่ายได้ทันที

---

## 📁 โครงสร้างโปรเจกต์สำคัญ (Important Architecture)

```text
├── .github/workflows/package.yml  # ไฟล์เวิร์กโฟลว์บิวด์อัตโนมัติทุก OS บนระบบคลาวด์
├── src/                           # ซอร์สโค้ดหน้าบ้าน (Frontend)
│   ├── config.ts                  # ไฟล์ปรับแต่ง IP, แรม, มอดแพ็ก และประกาศข่าวสาร (หัวใจสำคัญในการ Custom)
│   ├── App.tsx                    # หน้าจอหลัก ตัวควบคุม React และกระบวนการดักล็อก
│   ├── index.css                  # ชุดสีและดีไซน์สไตล์ Vercel Grid Dashboard
├── src-tauri/                     # ซอร์สโค้ดหลังบ้าน (Backend Rust)
│   ├── src/launcher.rs            # ระบบโหลด Java อัตโนมัติ, การดาวน์โหลดคู่ขนาน Assets, และระบบ Retries
│   ├── src/lib.rs                 # ตัวประกาศคำสั่ง Tauri และ APIs การเข้าระบบ Microsoft 
│   ├── tauri.conf.json            # ไฟล์คอนฟิกระบุ Identifier, ชื่อโปรแกรม, และแพ็คเกจบิวด์
│   └── Cargo.toml                 # ดีเพนเดนซีของ Rust (whoami, chrono, zip ฯลฯ)
```
