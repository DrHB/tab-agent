# Changelog

## [0.4.0] - 2026-03-14

### Added
- Auto-launch Chrome with profile detection, saved defaults, and `--profile`
- New browser commands: `hover`, `select`, `drag`, `get`, `find`, `cookies`, `storage`, and `pdf`
- Experimental Safari support with browser selection flags
- Auto-activate toggle and bulk activation support in the extension popup

### Fixed
- Published packages now ship a real `extension/manifest.json` for unpacked Chrome installs
- Setup can auto-detect unpacked Tab Agent extensions from Chrome profile preferences
- Status output shows the detected extension path and native host path for easier debugging
- README install steps now call out `@latest` usage to avoid stale cached `npx` installs

## [0.1.0] - 2026-01-30

### Added
- Chrome extension (Manifest V3)
- WebSocket relay server
- Native messaging host
- AI-readable page snapshots
- DOM actions: click, type, fill, press, select, hover, scroll
- Screenshot capture
- Multi-tab support
- Audit logging
- Claude Code skill
- Codex skill
