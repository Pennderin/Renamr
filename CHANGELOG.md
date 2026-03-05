# Changelog

## v1.1.0 — ROM Renamer

### New Features

#### 🎮 ROM Renamer
- **IGDB Integration** — Search the IGDB (Internet Game Database) for ROM metadata including title, year, platform, genre, and developer. Requires a free Twitch Developer account for Client ID + Client Secret.
- **No-Intro Filename Parsing** — Automatically cleans up No-Intro formatted filenames, stripping region tags, revision markers, and other parenthetical groups to produce a clean search query.
- **Platform Auto-Detection** — File extension maps to platform automatically (e.g. `.sfc` → SNES, `.gba` → Game Boy Advance, `.nsp` → Nintendo Switch). Supports 30+ platforms.
- **Multi-Disc Support** — Detects `(Disc 1)`, `(Disc 2)`, etc. from No-Intro filenames and exposes a `{disc}` format token. Right-click any ROM row to manually set or override the disc number.
- **DLC & Update Detection** — Automatically identifies DLC add-ons and game updates from filename tags (`[DLC]`, `[Update]`, `[UPD]`, `[Add-On]`) and bracket patterns. Nintendo Switch TitleIDs are parsed to detect updates (`800`-ending hex) and DLC automatically.
- **Switch Version Parsing** — Recognizes both human-readable versions (`v1.1.0` inline in filename) and Nintendo decimal versions (`v65536` in brackets). Human-readable takes precedence.
- **Separate Format Strings for Game / DLC / Update** — Each content type has its own naming format under the ROM heading in Format Editor:
  - Game: `{platform}/{title} ({year})`
  - DLC: `{platform}/DLC/{title}`
  - Update: `{platform}/Update/{title} ({version})`
- **New Format Tokens**: `{disc}`, `{contentType}`, `{version}`, `{platformShort}`, `{esdeSystem}`, `{region}`, `{developer}`
- **ES-DE System Names** — Toggle in Settings to use EmulationStation Desktop Edition folder names (e.g. `snes`, `gba`, `switch`) instead of full platform names. Applies to all content types (games, DLC, updates).
- **Right-Click Row Menu** — Right-click any ROM file row to manually set disc number (None / Disc 1–4) and content type (Game / DLC / Update).
- **Bulk Content Type Assignment** — Right-click menu includes "Set Selected As" and "Set All As" sections to tag multiple files at once.
- **Platform Filter in Search** — Search modal includes a platform dropdown to narrow IGDB results when a title spans multiple platforms (e.g. a game available on both Switch and Switch 2).
- **Article Suffix Support** — ROM files respect the "Move leading article to suffix" setting in Format Editor (e.g. "The Legend of Zelda" → "Legend of Zelda, The").

#### 📜 History Improvements
- **Undo Confirmation Dialog** — History undo now shows a confirmation modal before executing, preventing accidental reversals.
- **Failure Handling** — Undo no longer removes a history entry when all rename operations fail (e.g. files already moved or deleted). Shows a specific error message instead.

### Settings
- New **IGDB Credentials** card — enter Client ID and Client Secret, test connection, view status.
- New **ROM** row in Article Sorting section.
- New **ES-DE System Names** toggle for ROM platform folder naming.

### Format Editor
- New **ROM Format**, **ROM DLC Format**, and **ROM Update Format** config cards with live preview and example format buttons.
- Updated help text documents all ROM-specific tokens and right-click workflow.

---

## v1.0.0 — Initial Release

### Features
- **Unified Organize Tab** — Movies, TV Shows, and Audiobooks in one streamlined interface
- **Movie Matching** — Auto-match movie files to TMDB metadata with manual search fallback
- **TV Show Matching** — Detect S##E## patterns, fetch episode titles from TMDB, batch-match seasons
- **Audiobook Support** — Read embedded audio metadata (ID3/M4B), lookup via OpenLibrary, display cover art
- **Batch Organize** — Sort files by type, date, extension, or alphabetically with live preview
- **Format Editor** — Customize naming expressions with live preview and variable support
- **History & Undo** — Full operation history with one-click undo for any batch
- **Custom Titlebar** — Frameless window with integrated controls
- **Dark Theme** — Modern dark UI built with vanilla CSS
- **Drag & Drop** — Drop files and folders directly into the app
- **TMDB + OMDb** — Dual metadata source support with configurable preference
- **OpenLibrary** — Free audiobook metadata with no API key required
