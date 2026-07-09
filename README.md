# Zexta Launcher

Next-generation Minecraft client launcher built with **Tauri 2.0** (Rust) + **React 19** + **Vite 8**.

## Requirements

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (latest stable)
- Tauri CLI v2

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the web frontend only
npm run build

# Build the full Tauri desktop app
npm run tauri build
```

## Build Output

- **Web**: `dist/` — static frontend build
- **Tauri**: `src-tauri/target/release/` — desktop executable

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript |
| Bundler | Vite 8 |
| Styling | Tailwind CSS v4 |
| Desktop | Tauri 2.0 (Rust) |
| Auth | Microsoft OAuth (Discord RPC) |
| Font | LINE Seed Sans TH |

## Project Structure

```
src/
  App.tsx        — Main app component (all UI)
  index.css      — Tailwind + theme system + glass animations
  config.ts      — Default launcher config
  main.tsx       — React entry point
```

## Theme System

Change accent color in **Settings → Appearance**. Available themes:

- Blue (default), Purple, Green, Orange, Red, Mono

Theme is stored in `localStorage('theme')`.

## License

Zexta Project
