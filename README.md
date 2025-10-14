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

## Next Steps

This is a boilerplate application with placeholders for:
- Actual plotting implementation (consider using Chart.js, Plotly.js, or canvas-based plotting)
- Serial port data parsing logic (customize based on your device's data format)
- Additional features like data logging, export, etc.

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

