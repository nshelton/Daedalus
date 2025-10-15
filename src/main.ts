import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SerialModel } from './models/SerialModel';
import { SerialController } from './controllers/SerialController';
import { PlotterModel } from './models/PlotterModel';
import { PlotterController } from './controllers/PlotterController';

// Note: Hot reload is handled by nodemon in dev mode (see package.json)
// No need for electron-reload here as it conflicts with nodemon

let mainWindow: BrowserWindow | null;

// Initialize serial and plotter controllers
const serialModel = new SerialModel();
const serialController = new SerialController(serialModel);
const plotterModel = new PlotterModel();
const plotterController = new PlotterController(plotterModel, serialController);

interface PlotterSettings {
  penUpPosition: number;
  penDownPosition: number;
  speed: number;
}

function getPlotterSettingsFile(): string {
  return path.join(app.getPath('userData'), 'plotter-settings.json');
}

function loadPlotterSettings(): PlotterSettings | null {
  try {
    const data = fs.readFileSync(getPlotterSettingsFile(), 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function savePlotterSettings(): void {
  const settings: PlotterSettings = {
    penUpPosition: plotterModel.getPenUpPosition(),
    penDownPosition: plotterModel.getPenDownPosition(),
    speed: plotterModel.getSpeed()
  };
  fs.writeFileSync(getPlotterSettingsFile(), JSON.stringify(settings, null, 2));
}

// Load plotter settings on startup
const savedSettings = loadPlotterSettings();
if (savedSettings) {
  plotterModel.setPenUpPosition(savedSettings.penUpPosition);
  plotterModel.setPenDownPosition(savedSettings.penDownPosition);
  plotterModel.setSpeed(savedSettings.speed);
}

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

function getWindowStateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const data = fs.readFileSync(getWindowStateFile(), 'utf8');
    return JSON.parse(data);
  } catch {
    return { width: 1200, height: 800 };
  }
}

function saveWindowState(window: BrowserWindow): void {
  const bounds = window.getBounds();
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: window.isMaximized()
  };
  fs.writeFileSync(getWindowStateFile(), JSON.stringify(state));
}

function createWindow(): void {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
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

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Save window state on move/resize
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', async () => {
    // Cleanup serial connection
    try {
      if (serialModel.isConnected()) {
        console.log('Cleaning up serial connection on window close...');
        await serialController.disconnect();
      }
    } catch (error) {
      console.error('Error cleaning up serial connection:', error);
    }
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

// Cleanup before app quits
app.on('before-quit', async (event) => {
  if (serialModel.isConnected()) {
    console.log('Cleaning up serial connection before quit...');
    event.preventDefault();

    try {
      await serialController.disconnect();
      console.log('Serial connection cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up serial connection:', error);
    } finally {
      app.exit(0);
    }
  }
});

// Additional cleanup on will-quit
app.on('will-quit', async () => {
  try {
    if (serialModel.isConnected()) {
      await serialController.disconnect();
    }
  } catch (error) {
    console.error('Error in will-quit cleanup:', error);
  }
});

// Serial port IPC handlers
ipcMain.handle('get-serial-ports', async () => {
  try {
    const ports = await serialController.listPorts();
    return ports;
  } catch (error) {
    console.error('Error listing ports:', error);
    return [];
  }
});

ipcMain.handle('find-plotter-port', async () => {
  try {
    const port = await serialController.findPlotterPort();
    return port || null;
  } catch (error) {
    console.error('Error finding plotter port:', error);
    return null;
  }
});

interface SerialConnectionResult {
  success: boolean;
  error?: string;
}

ipcMain.handle('connect-serial', async (_event, portPath: string, baudRate: number = 115200): Promise<SerialConnectionResult> => {
  try {
    await serialController.connect(portPath, baudRate);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Connection failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('disconnect-serial', async (): Promise<SerialConnectionResult> => {
  try {
    await serialController.disconnect();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Disconnection failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('get-serial-state', async () => {
  return serialModel.getState();
});

// Handle serial data streaming to renderer
serialController.onData((data: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('serial-data', data);
  }
});

// Plotter IPC handlers
ipcMain.handle('plotter-pen-up', async () => {
  try {
    await plotterController.penUp();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Pen up failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-pen-down', async () => {
  try {
    await plotterController.penDown();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Pen down failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-set-pen-up-value', async (_event, value: number) => {
  try {
    await plotterController.setPenUpValue(value);
    savePlotterSettings();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Set pen up value failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-set-pen-down-value', async (_event, value: number) => {
  try {
    await plotterController.setPenDownValue(value);
    savePlotterSettings();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Set pen down value failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-set-speed', async (_event, value: number) => {
  try {
    plotterController.setSpeedValue(value);
    savePlotterSettings();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Set speed failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-plot-path', async (_event, paths: [number, number][][], doLift: boolean = true) => {
  try {
    plotterController.plotPath(paths, doLift);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Plot path failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-move-to', async (_event, position: [number, number]) => {
  try {
    plotterController.moveTo(position);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Move to failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-pause', async () => {
  try {
    plotterController.pause();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Pause failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-resume', async () => {
  try {
    plotterController.resume();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Resume failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-disengage', async () => {
  try {
    await plotterController.disengage();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Disengage failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-start-queue', async () => {
  try {
    plotterController.startQueueConsumption();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Start queue failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-stop-queue', async () => {
  try {
    plotterController.stopQueueConsumption();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Stop queue failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-get-state', async () => {
  return plotterModel.getState();
});

ipcMain.handle('plotter-get-position', async () => {
  try {
    const position = await plotterController.getCurrentPosition();
    return { success: true, position };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Get position failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-reset', async () => {
  try {
    // Send EBB reset command to hardware
    await plotterController.reset();
    // Reset the software model
    plotterModel.reset();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Reset failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-set-origin', async () => {
  try {
    await plotterController.setPositionToOrigin();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Set origin failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-initialize', async () => {
  try {
    await plotterController.initialize();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Initialize failed';
    return { success: false, error: errorMsg };
  }
});

// Entity IPC handlers
ipcMain.handle('plotter-get-entities', async () => {
  return plotterModel.getEntities();
});

ipcMain.handle('plotter-add-entity', async (_event, entity: any) => {
  try {
    plotterModel.addEntity(entity);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Add entity failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-update-entity', async (_event, id: string, updates: any) => {
  try {
    plotterModel.updateEntity(id, updates);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Update entity failed';
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('plotter-remove-entity', async (_event, id: string) => {
  try {
    plotterModel.removeEntity(id);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Remove entity failed';
    return { success: false, error: errorMsg };
  }
});

