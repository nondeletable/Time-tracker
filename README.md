<div align="center">
  <a href="https://github.com/nondeletable/Time-tracker">
    <img src="/README/promo/tt_icon.png" alt="Logo" width="100" height="100">
  </a>
<h2>Time Tracker</h2>
<p>A clean desktop time tracker for focused work - solo or as a pair, with a shared monthly limit and offline LAN sync.</p>
  <p>
    <a href="https://github.com/nondeletable/Time-tracker/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-4ade80.svg" alt="License: MIT"></a>
    <a href="https://github.com/nondeletable/Time-tracker/releases"><img src="https://img.shields.io/github/v/release/nondeletable/Time-tracker?label=release&color=4ade80" alt="Latest release"></a>
    <img src="https://img.shields.io/badge/Platform-Windows-4ade80.svg" alt="Platform: Windows">
    <img src="https://img.shields.io/badge/Built%20with-Electron-4ade80.svg" alt="Built with Electron">
  </p>
  <p>
    <a href="https://github.com/nondeletable/Time-tracker/blob/main/README.md">English </a> |
    <a href="https://github.com/nondeletable/Time-tracker/blob/main/README/README-TT-RU.md">Русский </a>
    <br>
    <br>
    <img src="/README/promo/TT.webp" alt="Time Tracker by nondeletable" width="98%"/>
    <br>
    <br>
  </p>
</div>

## ⏱️ What this app does

Time Tracker is a small desktop app for measuring how much time you actually spend on
work - by category, against a monthly budget of hours.

It started as a two-person tool: two people on the same home Wi-Fi, each tracking their own
work, sharing a single monthly hour limit (160 h by default). It has since grown into a
general-purpose tracker that works great **solo** and turns into a **pair** only when you
want it to - by creating a group and sharing a short code.

- Start a timer, pick a category, stop - the session is saved.
- Watch a shared monthly limit fill up (green → red when you go over).
- See per-category progress bars and a calendar of daily totals.
- Optionally pair up over your local network - no cloud, no accounts.
&nbsp;
&nbsp;

## 🎨 Features

- **Big round timer** with Start / Stop and a category dropdown; a post-stop dialog lets you
  review, re-assign the category, and save (or discard) the session.
- **Categories** with per-category colors - locale-aware presets on first run, plus your own
  custom ones; soft-delete and restore without losing history.
- **Shared monthly limit** across the whole period (160 h by default) shown as a top bar that
  turns from green to red once you go over.
- **Per-category progress bars** (relative to your busiest category) with live totals.
- **Calendar** popup - daily totals per user with avatars, month navigation, today highlighted.
- **Solo or pair.** Solo by default and fully offline. Optionally create a group (exactly two
  people) and share a 6-character code to sync over the LAN.
- **Secured LAN sync.** Auto-discovery over UDP, a WebSocket handshake validated by the group
  code, and a stable per-install ID - a device without the code is rejected. Owner's limit and
  period sync to the member; daily totals sync both ways for the shared limit and calendar.
- **Roles** - `solo` / `owner` / `member`. The member sees a read-only limit; the owner controls it.
- **Bilingual UI (RU / EN)** - auto-detected from your OS locale, switchable live in Settings.
- **Custom title bar** - frameless, draggable, with themed window controls; the window is
  resizable and remembers its size, position, and maximized state between runs.
- **Settings** in one place - user name & avatar, limit & period, categories, manual hour
  edits by date, sync, and language.
&nbsp;
&nbsp;

## 😎 Privacy & security

- ✅ Works **fully offline** - solo mode never touches the network.
- ✅ No accounts, no analytics, no telemetry.
- ✅ Your time entries stay **local** (SQLite in your AppData folder) and survive reinstalls.
- ✅ Pairing is opt-in and stays on your **local network** - nothing goes to the cloud.
- ✅ A device can only join your group with the exact 6-character code.
&nbsp;
&nbsp;

## ⚒ Installation

- Go to **Releases** and download the latest `time-tracker-<version>-setup.exe`.
- Run the installer (it creates a desktop shortcut).
- Launch **Time Tracker**, enter your name on first run, and start tracking.
&nbsp;
&nbsp;

## 🏓 How to use

1. Pick a **category** and press **Start**. Press **Stop** when you're done.
2. In the save dialog, confirm the time and category, then **Save**.
3. Watch the **shared limit** and **per-category bars** update.
4. Open the **Calendar** to see daily totals.
5. Want to pair with someone? Open **Settings → Sync**, **Create a group**, and share the
   code. The other person picks **Join** and enters it - you're synced over the LAN.
&nbsp;
&nbsp;

## 💾 Technologies

- **Electron** - desktop shell
- **Vanilla HTML + CSS + JavaScript** - UI (no bundler)
- **sql.js** - SQLite compiled to WebAssembly (no native build step)
- **ws** - WebSocket LAN sync, embedded in the main process
- **node:test** - unit tests for the pure logic (i18n, presets, period, roles, group, peer, bounds)
- **electron-builder** - NSIS installer for Windows
&nbsp;
&nbsp;

## ✅ Quality

- Tests: **38 passing** (`npm test`, `node --test`)
- Releases: **1**
- Windows installer size: ~**78 MB**
&nbsp;
&nbsp;

## 🛠️ Build from source

```sh
npm install       # first time
npm run dev       # run the app (electron .)
npm test          # run the unit tests (node --test)
npm run build     # build the Windows installer (electron-builder) -> dist/
```

&nbsp;

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

© 2025-2026 nondeletable
&nbsp;
&nbsp;

## ☎ Support & contacts

If you'd like to collaborate or discuss a job opportunity - use any of the contacts below.
For support/bugs, please use Discord or GitHub Issues. I usually reply within 24 hours.

- 🐙 **GitHub** page (docs, releases, source code)
  https://github.com/nondeletable
- 💬 **Discord** - news, support, questions, and bug reports
  https://discord.com/invite/6nvXwXp78u
- ✈️ **Telegram** - direct messages
  https://t.me/nondeletable
- 📧 **Email** - for formal or business inquiries
  nondeletable@gmail.com
- 💼 **LinkedIn** - professional profile
  https://www.linkedin.com/in/aleksandra-gicheva-3b0264341/
- ☕ **Boosty** - support my work and projects with donations
  https://boosty.to/codebird/donate
&nbsp;
&nbsp;

**Thank you for using Time Tracker!**
May your hours be well spent and your focus stay sharp. ⏱️✨🙂
