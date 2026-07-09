<p align="center">
  <img src="public/zexta-logo.png" width="72" alt="Zexta Launcher">
</p>

<h1 align="center">Zexta Launcher</h1>

<p align="center">
  <strong>Vision Pro–inspired Minecraft client launcher</strong>
  <br>
  Built with Tauri 2.0 · React 19 · Vite 8 · Tailwind v4
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.6.0-007AFF?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/rust-1.85+-DEA584?style=flat-square&logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/tauri-2.0-FFC131?style=flat-square&logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/license-MIT-8E8E93?style=flat-square" alt="License">
</p>

---

##  Features

- **Apple Vision Pro glass UI** — 3-layer depth with 80px blur, ambient orbs, glass cards
- **6 accent themes** — Blue, Purple, Green, Orange, Red, Mono
- **Thai / English UI** — full bilingual support
- **Microsoft account sign-in** — Discord RPC integration
- **Modpack auto-install** — Fabric-based Minecraft 1.21.1
- **Game log streaming** — real-time output while playing

##  Requirements

| Tool | Version |
|------|---------|
| [Node.js](https://nodejs.org/) | ≥ 18 |
| [Rust](https://rustup.rs/) | latest stable |
| [Tauri CLI](https://v2.tauri.app/start/cli/) | v2 |

##  Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode (hot reload)
npm run dev

# 3. Build for production
npm run build          # web frontend only
npm run tauri build    # full desktop executable
```

##  Build Output

```
dist/                          → static web build
src-tauri/target/release/      → desktop executable
```

##  Tech Stack

```
Frontend    React 19 + TypeScript
Bundler     Vite 8
Styling     Tailwind CSS v4
Desktop     Tauri 2.0 (Rust)
Auth        Microsoft OAuth
Font        LINE Seed Sans TH
```

##  Project Structure

```
src/
├── App.tsx         → Main UI (dashboard, settings, modals)
├── index.css       → Tailwind, theme variables, glass animations
├── config.ts       → Default launcher configuration
└── main.tsx        → React entry point
```

##  Theme System

Change accent color in **Settings → Appearance**.

| Theme   | Accent   | RGB                        |
|---------|----------|----------------------------|
| Blue    | `#007AFF`| `rgba(0, 122, 255, ...)`   |
| Purple  | `#5856D6`| `rgba(88, 86, 214, ...)`   |
| Green   | `#34C759`| `rgba(52, 199, 89, ...)`   |
| Orange  | `#FF9500`| `rgba(255, 149, 0, ...)`   |
| Red     | `#FF3B30`| `rgba(255, 59, 48, ...)`   |
| Mono    | `#8E8E93`| `rgba(142, 142, 147, ...)` |

Persisted in `localStorage('theme')`.

##  Changelog

**v2.6.0** — Vision Pro Liquid Glass redesign

- Apple Vision Pro–inspired 3-layer glass UI (80px blur)
- Ambient gradient orbs with slow float animation
- Glass cards with hover lift + accent-colored shadow
- RGB accent variables for dynamic colored glows
- Full Thai language support across all UI
- Game log display during active gameplay
- All-new premium button system with press feedback

---

<p align="center">
  <sub>Zexta Project &middot; 2025</sub>
</p>
