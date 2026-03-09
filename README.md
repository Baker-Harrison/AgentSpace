# AgentSpaces

AgentSpaces is a terminal-first Electron desktop app for running multiple real shells in a single workspace. It focuses on stable PTY-backed panes, layout presets, and command block capture without bundling IDE or agent panels into the interface.

## Stack

- Electron + TypeScript
- React + Vite
- `node-pty`
- `xterm.js`
- Zustand

## Development

```bash
pnpm install
pnpm dev
```

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Release builds

GitHub Actions publishes Windows and macOS artifacts when a `v*` tag is pushed.

- Windows: NSIS installer and portable executable
- macOS: DMG and ZIP

Local packaging commands:

```bash
pnpm package:win
pnpm package:mac
```
