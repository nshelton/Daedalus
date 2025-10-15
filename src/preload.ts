import { contextBridge, ipcRenderer } from 'electron';

interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

export interface SerialConnectionResult {
  success: boolean;
  error?: string;
}

export interface SerialState {
  isConnected: boolean;
  portPath: string | null;
  baudRate: number;
  availablePorts: PortInfo[];
  lastError: string | null;
}

export interface PlotEntity {
  id: string;
  paths: [number, number][][]; // Array of paths, each path is array of [x, y] points
}

export interface PlotterState {
  position: [number, number];
  penUpPosition: number;
  penDownPosition: number;
  speed: number;
  isPaused: boolean;
  commandsSent: number;
  commandsCompleted: number;
  queueLength: number;
  startTime: Date | null;
  entities: PlotEntity[];
}

export interface OperationResult {
  success: boolean;
  error?: string;
}

export interface PositionResult {
  success: boolean;
  position?: [number, number];
  error?: string;
}

// Define the API interface
export interface ElectronAPI {
  // Serial operations
  getSerialPorts: () => Promise<PortInfo[]>;
  findPlotterPort: () => Promise<PortInfo | null>;
  connectSerial: (portPath: string, baudRate: number) => Promise<SerialConnectionResult>;
  disconnectSerial: () => Promise<SerialConnectionResult>;
  getSerialState: () => Promise<SerialState>;
  onSerialData: (callback: (data: string) => void) => void;
  removeSerialDataListener: () => void;

  // Plotter operations
  plotterInitialize: () => Promise<OperationResult>;
  plotterPenUp: () => Promise<OperationResult>;
  plotterPenDown: () => Promise<OperationResult>;
  plotterSetPenUpValue: (value: number) => Promise<OperationResult>;
  plotterSetPenDownValue: (value: number) => Promise<OperationResult>;
  plotterSetSpeed: (value: number) => Promise<OperationResult>;
  plotterPlotPath: (paths: [number, number][][], doLift?: boolean) => Promise<OperationResult>;
  plotterMoveTo: (position: [number, number]) => Promise<OperationResult>;
  plotterPause: () => Promise<OperationResult>;
  plotterResume: () => Promise<OperationResult>;
  plotterDisengage: () => Promise<OperationResult>;
  plotterStartQueue: () => Promise<OperationResult>;
  plotterStopQueue: () => Promise<OperationResult>;
  plotterGetState: () => Promise<PlotterState>;
  plotterGetPosition: () => Promise<PositionResult>;
  plotterReset: () => Promise<OperationResult>;
  plotterSetOrigin: () => Promise<OperationResult>;

  // Entity operations
  plotterGetEntities: () => Promise<PlotEntity[]>;
  plotterAddEntity: (entity: PlotEntity) => Promise<OperationResult>;
  plotterUpdateEntity: (id: string, updates: Partial<PlotEntity>) => Promise<OperationResult>;
  plotterRemoveEntity: (id: string) => Promise<OperationResult>;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Serial port operations
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  findPlotterPort: () => ipcRenderer.invoke('find-plotter-port'),
  connectSerial: (portPath: string, baudRate: number) => ipcRenderer.invoke('connect-serial', portPath, baudRate),
  disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
  getSerialState: () => ipcRenderer.invoke('get-serial-state'),

  // Serial data listener
  onSerialData: (callback: (data: string) => void) => {
    ipcRenderer.on('serial-data', (_event, data) => callback(data));
  },

  // Remove listener
  removeSerialDataListener: () => {
    ipcRenderer.removeAllListeners('serial-data');
  },

  // Plotter operations
  plotterInitialize: () => ipcRenderer.invoke('plotter-initialize'),
  plotterPenUp: () => ipcRenderer.invoke('plotter-pen-up'),
  plotterPenDown: () => ipcRenderer.invoke('plotter-pen-down'),
  plotterSetPenUpValue: (value: number) => ipcRenderer.invoke('plotter-set-pen-up-value', value),
  plotterSetPenDownValue: (value: number) => ipcRenderer.invoke('plotter-set-pen-down-value', value),
  plotterSetSpeed: (value: number) => ipcRenderer.invoke('plotter-set-speed', value),
  plotterPlotPath: (paths: [number, number][][], doLift = true) => ipcRenderer.invoke('plotter-plot-path', paths, doLift),
  plotterMoveTo: (position: [number, number]) => ipcRenderer.invoke('plotter-move-to', position),
  plotterPause: () => ipcRenderer.invoke('plotter-pause'),
  plotterResume: () => ipcRenderer.invoke('plotter-resume'),
  plotterDisengage: () => ipcRenderer.invoke('plotter-disengage'),
  plotterStartQueue: () => ipcRenderer.invoke('plotter-start-queue'),
  plotterStopQueue: () => ipcRenderer.invoke('plotter-stop-queue'),
  plotterGetState: () => ipcRenderer.invoke('plotter-get-state'),
  plotterGetPosition: () => ipcRenderer.invoke('plotter-get-position'),
  plotterReset: () => ipcRenderer.invoke('plotter-reset'),
  plotterSetOrigin: () => ipcRenderer.invoke('plotter-set-origin'),

  // Entity operations
  plotterGetEntities: () => ipcRenderer.invoke('plotter-get-entities'),
  plotterAddEntity: (entity: PlotEntity) => ipcRenderer.invoke('plotter-add-entity', entity),
  plotterUpdateEntity: (id: string, updates: Partial<PlotEntity>) => ipcRenderer.invoke('plotter-update-entity', id, updates),
  plotterRemoveEntity: (id: string) => ipcRenderer.invoke('plotter-remove-entity', id)
} as ElectronAPI);

