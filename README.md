# 🚀 Zexta Project Launcher (Frontline Minecraft Launcher)

ตัวเปิดเกม Minecraft รุ่นพัฒนาพิเศษ ขับเคลื่อนด้วยระบบหลังบ้านความเร็วสูงของ **Tauri (Rust)** และหน้าต่างโต้ตอบผู้ใช้ดีไซน์พรีเมียมสไตล์ **Next.js + macOS Grid**

---

## ✨ คุณสมบัติเด่น (Key Features)

### 🎨 หน้าจอผู้ใช้ระดับพรีเมียม (Premium Frontend UI/UX)
- **ดีไซน์ Vercel/Next.js Dashboard**: โครงสร้างเลย์เอาต์จัดวางแบบ Grid ทันสมัย สวยงาม พร้อมพื้นหลัง Dotted Grid และการใช้ชุดสีที่ดูคลีนหรูหรา
- **macOS Controls**: ปุ่มควบคุมหน้าต่างสไตล์ Mac (Minimize, Close) และแท็บเลือก Preferences ที่ลื่นไหล
- **Obsidian Card Highlights**: เอฟเฟกต์การวางเมาส์สั่นไหวและสะท้อนแสงไฟที่การ์ดเชื่อมต่อเซิร์ฟเวอร์แบบ Obsidian Style
- **Masked IP Address**: ระบบซ่อน/แสดง IP ของเซิร์ฟเวอร์ด้วยปุ่มลูกตาสุดปลอดภัย เพื่อป้องกันการหลุดข้อมูลหน้าสตรีม
- **macOS-style Custom Modal**: หน้าต่างยืนยันการปิดเกมสไตล์กล่องกระจกฝ้า (Glassmorphic) ป้องกันการถูกเบราว์เซอร์บล็อกหน้าต่าง
- **Dual-Language support**: รองรับการสลับภาษาไทย (TH) และอังกฤษ (EN) ทันทีในส่วนการตั้งค่า

### ⚙️ ระบบหลังบ้านทรงพลัง (Tauri Rust Backend Engine)
- **Parallel Multi-threaded Downloads**: ระบบดาวน์โหลดไฟล์ระบบย่อย (Libraries) ขนานกัน 12 ช่อง และทรัพยากรเกม (Assets) ขนานกัน 25 ช่อง ช่วยประหยัดเวลาและดาวน์โหลดไวขึ้นถึง **10 เท่า**
- **Adoptium Temurin Java 21 Auto-Installer**: ระบบดาวน์โหลดตัวรัน Java JRE 21 ของแท้จาก Adoptium ลงบนไดเรกทอรีส่วนตัวโดยอัตโนมัติ ทำให้ผู้ใช้ไม่ต้องติดตั้ง Java ลงบนเครื่องเอง
- **3-Attempt Auto Retry**: ระบบดาวน์โหลดที่ปลอดภัย หากตรวจพบไฟล์เสียงหรือทรัพยากรขนาดใหญ่ขาดหายหรือล้มเหลวขณะดาวน์โหลด จะทวนซ้ำใหม่อัตโนมัติ 3 ครั้งพร้อมตรวจสอบความถูกต้องของขนาดไฟล์ (File Size Verification)
- **G1GC JVM Optimizations**: ติดตั้งพารามิเตอร์การเปิดเกมระดับสูง (เช่น G1 GC, String Deduplication) ทำให้ Minecraft รันเร็วขึ้นและกินแรมเสถียรขึ้น ลดอาการกระตุก (Micro-stutter)
- **Live Logs Console**: ระบบดึงข้อมูล Stdout/Stderr ของ Minecraft ส่งตรงมาเป็นล็อกแบบเรียลไทม์ไว้บนหน้าจอ Launcher ให้ตรวจสอบสถานะการเริ่มเกมได้ทันที

---

## 🛠️ คำสั่งเริ่มใช้งานโปรเจกต์ (Commands Guide)

ก่อนเริ่มรัน ให้แน่ใจว่าติดตั้ง Node.js และตัวคอมไพล์ภาษา Rust (cargo/rustc) เรียบร้อยแล้ว

### 1. ติดตั้งไลบรารีที่จำเป็น
```bash
npm install
```

### 2. รันในโหมดพัฒนา (Development Mode)
ใช้คำสั่งนี้เพื่อเปิดโปรแกรมทดสอบแบบ Live-reload ทั้งส่วน Frontend และ Backend:
```bash
npm run tauri dev
```

### 3. บิวด์ตัวติดตั้งโปรแกรม (Production Build)
บิวด์ซอร์สโค้ดและรวมไฟล์ติดตั้งสำเร็จรูป (Installer Package เช่น .exe) ของ Tauri:
```bash
npm run tauri build
```

---

## 📁 โครงสร้างโปรเจกต์ (Project Directory)

- `/src`: ซอร์สโค้ดฝั่งหน้าบ้าน React + CSS Tailwind v4
- `/src-tauri`: ซอร์สโค้ดฝั่งหลังบ้าน Rust ที่บรรจุระบบดาวน์โหลดและรันเกม Minecraft
  - `src-tauri/src/launcher.rs`: เอนจินดาวน์โหลดตัวเกม, Fabric, Mods, Java และตัว Spawn JVM
  - `src-tauri/src/lib.rs`: จุดรับคำสั่งและส่งต่อการทำงานไปยังตัว Launcher และ APIs ของ Windows/Microsoft Login
- `/public`: ทรัพยากรไฟล์ภาพ ไอคอน และรูปภาพโลโก้ `zexta-logo.png`
