<div align="center">
  <img src="public/zexta-logo.png" width="80">
  <br><br>
  <h1 style="margin: 0; font-size: 2.5em; letter-spacing: -0.02em;">Zexta Launcher</h1>
  <p style="margin: 4px 0 0; color: #8E8E93; font-size: 1.05em;">
    Vision Pro–inspired Minecraft client · Tauri 2.0 · React 19
  </p>
  <br>
  <p>
    <img src="https://img.shields.io/badge/v2.6.0-007AFF?style=for-the-badge&label=version&labelColor=1C1C1E">
    <img src="https://img.shields.io/badge/Rust-1.85-DEA584?style=for-the-badge&logo=rust&logoColor=white&labelColor=1C1C1E">
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=1C1C1E">
    <img src="https://img.shields.io/badge/Tauri-2-FFC131?style=for-the-badge&logo=tauri&logoColor=black&labelColor=1C1C1E">
    <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white&labelColor=1C1C1E">
  </p>
  <br>
  <img src="https://images.unsplash.com/photo-1627398242454-45a1465c2479?q=80&w=1200&auto=format&fit=crop" width="90%" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
</div>

<br>

---

<br>

<div align="center">
  <table>
    <tr>
      <td width="33%" align="center">
        <br>
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojios/Sparkles.png" width="28"><br>
        <b>Liquid Glass</b><br>
        <sub>80px depth blur · 3-layer depth<br>ambient orbs · glass cards</sub>
        <br>
      </td>
      <td width="33%" align="center">
        <br>
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojios/Artist%20Palette.png" width="28"><br>
        <b>6 Themes</b><br>
        <sub>Blue · Purple · Green · Orange<br>Red · Mono — pick your accent</sub>
        <br>
      </td>
      <td width="33%" align="center">
        <br>
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojios/Globe%20Showing%20Asia-Australia.png" width="28"><br>
        <b>TH/EN</b><br>
        <sub>Full Thai & English<br>interface support</sub>
        <br>
      </td>
    </tr>
    <tr>
      <td width="33%" align="center">
        <br>
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojios/Rocket.png" width="28"><br>
        <b>One-click Launch</b><br>
        <sub>Modpack auto-install<br>Fabric · Minecraft 1.21.1</sub>
        <br>
      </td>
      <td width="33%" align="center">
        <br>
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojios/Desktop%20Computer.png" width="28"><br>
        <b>Cross-platform</b><br>
        <sub>Windows · macOS · Linux<br>via Tauri 2.0</sub>
        <br>
      </td>
      <td width="33%" align="center">
        <br>
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojios/Key.png" width="28"><br>
        <b>Microsoft Auth</b><br>
        <sub>Secure login · Discord RPC<br>profile sync</sub>
        <br>
      </td>
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

<div align="center">

| Theme   | Accent   | Preview |
|---------|----------|---------|
| Blue    | `#007AFF` | <img src="https://img.shields.io/badge/⬤-007AFF?style=flat-square&labelColor=1C1C1E"> |
| Purple  | `#5856D6` | <img src="https://img.shields.io/badge/⬤-5856D6?style=flat-square&labelColor=1C1C1E"> |
| Green   | `#34C759` | <img src="https://img.shields.io/badge/⬤-34C759?style=flat-square&labelColor=1C1C1E"> |
| Orange  | `#FF9500` | <img src="https://img.shields.io/badge/⬤-FF9500?style=flat-square&labelColor=1C1C1E"> |
| Red     | `#FF3B30` | <img src="https://img.shields.io/badge/⬤-FF3B30?style=flat-square&labelColor=1C1C1E"> |
| Mono    | `#8E8E93` | <img src="https://img.shields.io/badge/⬤-8E8E93?style=flat-square&labelColor=1C1C1E"> |

</div>

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
