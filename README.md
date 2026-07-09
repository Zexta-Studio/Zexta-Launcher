<div align="center">
  <img src="public/zexta-logo.png" width="80" alt="Zexta Launcher">
  <br><br>
  <h1 style="margin: 0; font-size: 2.5em; letter-spacing: -0.02em;">Zexta Launcher</h1>
  <p style="margin: 4px 0 0; font-size: 1.05em;">
    Vision Pro–inspired Minecraft client · Tauri 2.0 · React 19
  </p>
  <br>
  <p>
    <img src="https://img.shields.io/badge/v2.6.0-007AFF?style=for-the-badge&label=version&labelColor=1C1C1E" alt="Version">
    <img src="https://img.shields.io/badge/Rust-1.85-DEA584?style=for-the-badge&logo=rust&logoColor=white&labelColor=1C1C1E" alt="Rust">
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=1C1C1E" alt="React">
    <img src="https://img.shields.io/badge/Tauri-2-FFC131?style=for-the-badge&logo=tauri&logoColor=black&labelColor=1C1C1E" alt="Tauri">
    <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white&labelColor=1C1C1E" alt="Vite">
  </p>
</div>

<br>

---

<br>

<div align="center">
  <table>
    <tr>
      <td width="33%" align="center"><b>✨ Liquid Glass</b><br><sub>80px depth blur · 3-layer depth<br>ambient orbs · glass cards</sub></td>
      <td width="33%" align="center"><b>🎨 6 Themes</b><br><sub>Blue · Purple · Green · Orange<br>Red · Mono — pick your accent</sub></td>
      <td width="33%" align="center"><b>🌏 TH/EN</b><br><sub>Full Thai & English<br>interface support</sub></td>
    </tr>
    <tr>
      <td width="33%" align="center"><b>🚀 One-click Launch</b><br><sub>Modpack auto-install<br>Fabric · Minecraft 1.21.1</sub></td>
      <td width="33%" align="center"><b>💻 Cross-platform</b><br><sub>Windows · macOS · Linux<br>via Tauri 2.0</sub></td>
      <td width="33%" align="center"><b>🔑 Microsoft Auth</b><br><sub>Secure login · Discord RPC<br>profile sync</sub></td>
    </tr>
  </table>
</div>

<br>

---

<br>

##  Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | ≥ 18 | Frontend build |
| [Rust](https://rustup.rs/) | latest stable | Tauri backend |
| [Tauri CLI](https://v2.tauri.app/start/cli/) | v2 | Desktop bundling |

##  Quick Start

```bash
npm install        # install dependencies
npm run dev        # dev mode with hot reload
npm run build      # build web frontend only
npm run tauri build   # build full desktop app
```

### Output

```
dist/                  → static web build
src-tauri/target/release/   → desktop executable
```

<br>

---

<br>

##  Tech Stack

```
Layer       Technology
────────────────────────────────────
Frontend    React 19 · TypeScript
Bundler     Vite 8
Styling     Tailwind CSS v4
Desktop     Tauri 2.0 (Rust)
Auth        Microsoft OAuth · Discord RPC
Font        LINE Seed Sans TH
```

##  Structure

```
src
├── App.tsx        Main UI (dashboard, settings, modals, all views)
├── index.css      Tailwind imports · theme variables · glass animations
├── config.ts      Default launcher config (version, URLs, changelog)
└── main.tsx       React DOM entry
```

<br>

---

<br>

##  Theme System

Configure in **Settings → Appearance** — persisted in `localStorage('theme')`.

| Theme   | Accent   |
|---------|----------|
| Blue    | `#007AFF` |
| Purple  | `#5856D6` |
| Green   | `#34C759` |
| Orange  | `#FF9500` |
| Red     | `#FF3B30` |
| Mono    | `#8E8E93` |

<br>

---

<br>

##  Changelog

### v2.6.0 — Vision Pro Redesign
`2025-07-09`

- Apple Vision Pro–inspired 3-layer glass UI (80px blur)
- Ambient gradient orbs with slow float animation
- Glass cards with hover lift + accent-colored shadow
- RGB accent variables for dynamic colored glows
- Full Thai language support across all UI
- Game log display during active gameplay
- Premium button system with press feedback

### v2.5.0 — EX1: Unless
`2025-03-23`

- Enhanced system optimization for better performance
- Improved launcher UI/UX with better accessibility
- Cross-platform support (Windows, macOS, Linux)
- Java 21 auto-installation for all platforms
- Bug fixes for mod synchronization

<br>

---

<br>

<div align="center">
  <sub>Zexta Project · 2025</sub>
  <br>
  <sub>
    <a href="https://discord.gg/frontline">Discord</a> ·
    <a href="https://frontline-project.com">Website</a>
  </sub>
</div>
