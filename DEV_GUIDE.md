# Development Guide - Hot Reload Setup

## Quick Start

To run the app with hot reload for testing and development:

```bash
npm run dev
```

That's it! The app will now automatically reload whenever you save changes to your TypeScript files.

## What Happens When You Run `npm run dev`

The `dev` command starts two processes simultaneously:

1. **TypeScript Compiler in Watch Mode** (`tsc --watch`)
   - Monitors all `.ts` files in the `src/` directory
   - Automatically recompiles to JavaScript when you save
   - Outputs compiled files to the `dist/` directory
   - Shows compilation errors in the terminal

2. **Electron with Nodemon** (`nodemon + electron`)
   - Waits for `dist/main.js` to exist (first compile)
   - Watches the `dist/` directory for changes
   - Automatically restarts Electron when files change
   - Runs with `--dev` flag (opens DevTools)

## Development Workflow

### Standard Workflow
```bash
# 1. Start development mode
npm run dev

# 2. Open your editor and edit files in src/
# 3. Save your changes
# 4. Watch the terminal - TypeScript recompiles
# 5. Electron automatically restarts with your changes
```

### What You'll See

**Terminal Output:**
```
[0] > tsc --watch
[1] > nodemon --watch dist --exec "electron . --dev"
[0] Starting compilation in watch mode...
[0] Found 0 errors. Watching for file changes.
[1] [nodemon] starting `electron . --dev`
```

When you save a file:
```
[0] File change detected. Starting incremental compilation...
[0] Found 0 errors. Watching for file changes.
[1] [nodemon] restarting due to changes...
[1] [nodemon] starting `electron . --dev`
```

## File Change Behavior

### Main Process Changes (`src/main.ts`, `src/preload.ts`)
- TypeScript recompiles → Electron fully restarts
- App window closes and reopens
- All state is reset

### Renderer Process Changes (`src/renderer.ts`)
- TypeScript recompiles → Electron restarts
- With `electron-reload`, some changes may only refresh the window

### Other Files
- `index.html` - Requires restart (press `Ctrl+R` in app or wait for next TS change)
- `styles.css` - Requires restart (press `Ctrl+R` in app)
- `tsconfig.json` - Need to stop and restart `npm run dev`
- `package.json` - Need to run `npm install` and restart

## Manual Refresh

If you want to manually refresh without restarting:
- **Windows/Linux**: `Ctrl + R` in the Electron window
- **macOS**: `Cmd + R` in the Electron window

To manually restart without waiting for file changes:
- Type `rs` in the terminal running nodemon and press Enter

## Stopping Development Mode

To stop the dev server:
- **Windows/Linux**: `Ctrl + C` in the terminal
- **macOS**: `Cmd + C` in the terminal

This will stop both the TypeScript compiler and Electron.

## Alternative Commands

### Just Compile TypeScript (No Electron)
```bash
npm run watch
```
Use this if you want to compile TypeScript separately.

### Run Without Hot Reload
```bash
npm start
```
Compiles once and runs Electron. No auto-reload on changes.

### Build Production Package
```bash
npm run build        # Current platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Troubleshooting

### "Cannot find module" errors
The TypeScript might not have compiled yet. Wait a moment and it should restart.

### Changes not taking effect
1. Check the terminal for TypeScript compilation errors
2. Make sure you saved the file (`Ctrl+S` / `Cmd+S`)
3. Verify you're editing files in `src/` not `dist/`

### Too many restarts
If the app keeps restarting in a loop:
1. Check for TypeScript errors that cause constant recompilation
2. Make sure you're not editing files in `dist/` directory

### Port is already in use
Close any other instances of the app before running `npm run dev`

## Tips for Faster Development

1. **Keep DevTools open** - Already enabled in dev mode
2. **Use console.log** - Output appears in DevTools Console
3. **Check terminal** - TypeScript errors show there first
4. **Source maps** - Enable in tsconfig.json for debugging TypeScript in DevTools
5. **Split terminal** - Run in a terminal while editing in your IDE

## Customizing the Hot Reload

### Nodemon Configuration
Edit `nodemon.json` to customize:
- Which files to watch
- Restart delay
- File extensions to monitor

### TypeScript Compiler
Edit `tsconfig.json` to customize:
- Compilation target
- Strict checks
- Source maps

## Performance Notes

- **First compile** takes a few seconds
- **Incremental compiles** are very fast (< 1 second)
- **Electron restart** takes 1-2 seconds
- **Overall feedback loop** is typically 2-3 seconds from save to running

Enjoy fast, productive development! 🚀

