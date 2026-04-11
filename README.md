# Muse Dash Custom Album Editor

Desktop editor for Muse Dash custom album `.mdm` packages, built with Electron.

## Highlights

- Import MP3 and convert to in-project OGG automatically
- Auto-detect BPM after audio import
- Create and edit tap, hold, double, and spinner/burst notes
- Support keyboard tapping with `Z` / `X` and spacebar play-pause workflow
- Multi-select notes for batch editing
- Export complete `.mdm` packages with `music.ogg`, `demo.ogg`, `cover.png`, `info.json`, `map2.bms`, and `map2.talk`
- Generate circular transparent-corner `cover.png` with zoom, pan, and preview controls
- Preview and generate `demo.ogg` with timeline-based clip selection

## Tech Stack

- Electron
- JavaScript
- FFmpeg via `ffmpeg-static`

## Local Run

```bash
npm install
npm start
```

## Project Focus

This project is aimed at improving the full authoring flow for custom Muse Dash charts:

- faster charting interactions
- better export tooling
- less manual asset preparation
- stronger parity with existing community tooling

## Resume Summary

Built a desktop rhythm-game custom album editor with waveform-based note authoring, automatic BPM analysis, custom asset generation, and one-click packaging to a game-ready mod format.
