# USB Serial Plotter

A modern Electron application for plotting data from USB serial devices in real-time.

## Features

- 🔌 Easy serial port connection management
- 📊 Real-time data plotting (ready for implementation)
- ⚙️ Configurable baud rates (9600 - 921600)
- 🎨 Modern, dark-themed UI
- 🔒 Secure IPC communication with context isolation
- 📈 Adjustable plot settings

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

## Usage

### Development Mode with Hot Reload ⚡

The best way to develop is with hot reload enabled. This will automatically recompile TypeScript and restart Electron when you make changes:

```bash
npm run dev
```

This command runs two processes simultaneously:
- **TypeScript Watch** - Automatically recompiles `.ts` files when you save
- **Electron with Nodemon** - Automatically restarts the app when compiled files change

Simply edit your TypeScript files in `src/` and the app will reload automatically!

### Production Mode

To run the application normally (without hot reload):

```bash
npm start
```

### Manual TypeScript Compilation

If you need to manually compile TypeScript:

```bash
npm run build:ts    # Compile once
npm run watch       # Watch mode (compile on changes)
```

### Building

To build the application for your current platform:

```bash
npm run build
```

Platform-specific builds:

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Built applications will be in the `build` folder.

## Project Structure

```
.
├── src/
│   ├── main.ts       # Electron main process (TypeScript)
│   ├── preload.ts    # Preload script for secure IPC (TypeScript)
│   ├── renderer.ts   # Renderer process logic (TypeScript)
│   └── types.d.ts    # TypeScript type definitions
├── dist/             # Compiled JavaScript files (generated)
├── index.html        # Application UI
├── styles.css        # Application styles
├── tsconfig.json     # TypeScript configuration
├── package.json      # Project configuration
└── README.md         # This file
```

## Usage Guide

1. **Connect to Serial Device**
   - Plug in your USB serial device
   - Click "Refresh" to scan for available ports
   - Select your device from the dropdown
   - Choose the appropriate baud rate
   - Click "Connect"

2. **Plot Settings**
   - **Update Rate**: How often the plot refreshes (in milliseconds)
   - **Max Data Points**: Maximum number of data points to display
   - **Auto Scroll**: Automatically scroll the plot as new data arrives

3. **Data Display**
   - View received data statistics in real-time
   - Monitor sample rate and last value
   - Clear the plot anytime with "Clear Plot" button

## Serial Data Format

The plotter expects numeric data from the serial port. Each line should contain a single numeric value. Example:

```
123.45
234.56
345.67
```

## TypeScript Development

This application is now fully written in TypeScript for better type safety and developer experience. The TypeScript source files are in the `src/` directory and are compiled to JavaScript in the `dist/` directory.

### Hot Reload Workflow

The development setup includes hot reload for maximum productivity:

1. **Start dev mode**: `npm run dev`
2. **Edit TypeScript files** in `src/` folder
3. **Save your changes**
4. **App automatically reloads** with your changes!

The hot reload system:
- Watches TypeScript files and recompiles on save
- Automatically restarts Electron when compiled files change
- Opens DevTools by default in dev mode
- Provides instant feedback on your changes

### Benefits of TypeScript
- Type safety catches errors at compile time
- Better IDE autocomplete and IntelliSense
- Improved code maintainability
- Self-documenting code with type annotations

## Development Plan 📋

This project has a comprehensive development plan to transform it into a sophisticated SVG plotting application with MVC architecture. See the following documents:

### Planning Documents

- **[GETTING_STARTED.md](GETTING_STARTED.md)** - **Start here!** Quick start guide and development workflow
- **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)** - Complete 8-phase development plan with architecture and class designs
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Visual diagrams, data flow examples, and component interactions
- **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** - Granular task checklist (~200+ tasks) for tracking progress
- **[SVG_PROTOCOL.md](SVG_PROTOCOL.md)** - Serial protocol specification for SVG rendering commands

### Planned Features

The development plan includes:
- ✨ **SVG Rendering** - Render large, complex SVGs with draggable/resizable elements
- 🔍 **Pan & Zoom** - Smooth viewport navigation with mouse/keyboard controls
- 🎯 **Interactive Elements** - Click, drag, resize SVG shapes in real-time
- 📡 **Serial Protocol** - Text-based protocol for drawing commands (CIRCLE, PATH, etc.)
- 🏗️ **MVC Architecture** - Clean separation: Models (state), Views (rendering), Controllers (logic)
- 🧪 **Test Patterns** - Auto-generate circle, noise, and sine wave patterns
- ⚡ **Auto-connect** - Automatically connect to serial port on launch
- 🎨 **Grid System** - Optional grid overlay for alignment
- 📊 **Real-time Updates** - Stream SVG commands from serial devices

### Architecture Overview

```
Main Process:  SerialDriver → SerialController → SerialModel
                     ↓ (IPC)
Renderer:      PlotView ← PlotController → PlotModel
```

**Get started:** Read [GETTING_STARTED.md](GETTING_STARTED.md) for the complete development workflow.

## Next Steps

To implement the new features:
1. Review the planning documents (see above)
2. Follow the 8-phase implementation plan
3. Use the checklist to track progress
4. Reference the architecture diagrams as needed

## Dependencies

**Production Dependencies:**
- **electron**: Cross-platform desktop application framework
- **serialport**: Node.js library for serial port communication

**Development Dependencies:**
- **typescript**: TypeScript compiler for type-safe development
- **@types/node**: TypeScript type definitions for Node.js
- **electron-builder**: For building and packaging the application
- **concurrently**: Run multiple npm scripts simultaneously
- **nodemon**: Auto-restart Electron on file changes
- **electron-reload**: Hot reload for renderer process
- **wait-on**: Wait for files to exist before starting

## Security

This application follows Electron security best practices:
- Context isolation enabled
- Node integration disabled in renderer
- Secure IPC communication via preload script
- Content Security Policy in HTML

## Troubleshooting

### Serial Port Not Detected

- Ensure the device is properly connected
- Check if the device requires specific drivers
- Try unplugging and reconnecting the device
- Click the "Refresh" button after connecting

### Permission Errors (Linux/macOS)

On Linux, you may need to add your user to the dialout group:

```bash
sudo usermod -a -G dialout $USER
```

Then log out and log back in.

### Build Errors

If you encounter build errors:

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!

