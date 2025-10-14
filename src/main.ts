import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

// Enable hot reload in development
if (process.argv.includes('--dev')) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (err) {
    // electron-reload not installed, skip
  }
}

let mainWindow: BrowserWindow | null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false, // Don't show until ready-to-show
    title: 'USB Serial Plotter'
  });

  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers will be added here for serial port communication
ipcMain.handle('get-serial-ports', async () => {
  // Placeholder for serial port enumeration
  return [];
});

interface SerialConnectionResult {
  success: boolean;
}

ipcMain.handle('connect-serial', async (_event, _portPath: string, _baudRate: number): Promise<SerialConnectionResult> => {
  // Placeholder for serial port connection
  return { success: true };
});

ipcMain.handle('disconnect-serial', async (): Promise<SerialConnectionResult> => {
  // Placeholder for serial port disconnection
  return { success: true };
});

