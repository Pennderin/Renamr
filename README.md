<p align="center">
  <img src="assets/icon_512.png" width="128" height="128" alt="Renamr icon" />
</p>

<h1 align="center">Renamr</h1>

<p align="center">
  <strong>Free, open-source media file organizer</strong><br/>
  A modern alternative to FileBot — with audiobook support.
</p>

<p align="center">
  <a href="https://github.com/your-username/renamr/releases/latest"><img src="https://img.shields.io/github/v/release/your-username/renamr?style=flat-square&color=blue" alt="Latest Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/your-username/renamr?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-31-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
</p>

---

Rename and organize your **movies**, **TV shows**, and **audiobooks** with metadata from TMDB, OMDb, and OpenLibrary. Drag and drop your files, match them to the correct metadata, customize your naming format, and rename everything in one click.

## ✨ Features

**🎬 Movies** — Auto-match to TMDB/OMDb metadata, parse titles and years from filenames, manual search for tricky names, custom naming formats.

**📺 TV Shows** — Detect `S##E##` patterns automatically, fetch episode titles, batch-match entire seasons, organize into season folders.

**🎧 Audiobooks** — Read embedded audio metadata (ID3, M4B tags), lookup book info from OpenLibrary, display cover art, organize by Author/Title/Chapter. Supports MP3, M4A, M4B, FLAC, OGG, and more.

**📁 Batch Organize** — Sort files by type (Video, Audio, Images, Documents), by date modified, by file extension, or alphabetically. Preview everything before executing.

**⚙️ Format Editor** — Build custom naming expressions with live preview. Use variables like `{title}`, `{year}`, `{series}`, `{season}`, `{episode}`, `{author}`, `{track}`, `{narrator}`, and more. Zero-pad numbers with `{season:2}` → `02`.

**📜 History & Undo** — Full history of all rename operations with one-click undo for any batch.

## 📥 Installation

### Option 1: Download the Installer (Recommended)

Download the latest Windows installer from the **[Releases](https://github.com/your-username/renamr/releases/latest)** page. Run the `.exe` and follow the setup wizard.

### Option 2: Run from Source

Requires [Node.js](https://nodejs.org/) v18 or later.

```bash
git clone https://github.com/your-username/renamr.git
cd renamr
npm install
npm start
```

Or just double-click `START.bat` on Windows — it handles everything.

## 🔧 First-Time Setup

1. Open the app and go to **Settings**
2. Enter your **TMDB API key** — get one free at [themoviedb.org](https://www.themoviedb.org/settings/api)
3. *(Optional)* Add an OMDb API key for additional metadata source
4. *(Optional)* Set a default output directory
5. You're ready to go!

> **Note:** Audiobook lookups use OpenLibrary, which is free and requires no API key.

## 📖 Usage

### Renaming Media

1. Open the **Organize** tab
2. Click **Add Folder** or drag and drop your files
3. Select the media type (Movies, TV, or Audiobooks)
4. Click **Match All** to auto-match with metadata
5. Review the proposed names in the preview
6. Click **Rename All** to execute

### Batch Organizing

1. Open the **Batch Organize** tab
2. Select source and destination directories
3. Pick an organization rule (by type, date, extension, or alphabetical)
4. Preview the changes, then confirm

### Custom Naming Formats

Go to **Format Editor** to customize how files are named. Use `/` to create folder structure.

| Type | Variables |
|------|-----------|
| Movies | `{title}`, `{year}`, `{rating}` |
| TV Shows | `{series}`, `{season}`, `{episode}`, `{title}`, `{year}` |
| Audiobooks | `{author}`, `{title}`, `{year}`, `{track}`, `{narrator}`, `{genre}` |

**Examples:**

```
Movie:     {title} ({year})/{title} ({year})
           → The Matrix (1999)/The Matrix (1999).mkv

TV Show:   {series}/Season {season}/{series} - S{season:2}E{episode:2} - {title}
           → Breaking Bad/Season 02/Breaking Bad - S02E09 - 4 Days Out.mkv

Audiobook: {author}/{title}/{title} - Chapter {track:2}
           → Frank Herbert/Dune/Dune - Chapter 01.m4b
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` through `Ctrl+6` | Switch between tabs |
| `Escape` | Close modal |

## 🏗️ Building from Source

```bash
# Build for your current platform
npm run build

# Platform-specific builds
npm run build:win      # Windows (.exe installer)
npm run build:mac      # macOS (.dmg)
npm run build:linux    # Linux (.AppImage)
```

## 🛠️ Tech Stack

- **Electron 31** — Desktop framework
- **Vanilla JS** — No build step, no framework overhead
- **TMDB API** — Movie and TV metadata
- **OMDb API** — Additional movie metadata
- **OpenLibrary API** — Book and audiobook metadata
- **music-metadata** — Audio file tag reading
- **electron-store** — Persistent settings
- **ffprobe** — Media file analysis

## 📄 License

[MIT](LICENSE) — Free and open source.

---

<p align="center">
  Built as a free alternative to FileBot. If you find Renamr useful, consider giving it a ⭐
</p>
