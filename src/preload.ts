import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
export interface ElectronAPI {
  getSerialPorts: () => Promise<any[]>;
  connectSerial: (portPath: string, baudRate: number) => Promise<{ success: boolean }>;
  disconnectSerial: () => Promise<{ success: boolean }>;
  onSerialData: (callback: (data: any) => void) => void;
  removeSerialDataListener: () => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Serial port operations
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (portPath: string, baudRate: number) => ipcRenderer.invoke('connect-serial', portPath, baudRate),
  disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
  
  // Serial data listener
  onSerialData: (callback: (data: any) => void) => {
    ipcRenderer.on('serial-data', (_event, data) => callback(data));
  },
  
  // Remove listener
  removeSerialDataListener: () => {
    ipcRenderer.removeAllListeners('serial-data');
  }
} as ElectronAPI);

