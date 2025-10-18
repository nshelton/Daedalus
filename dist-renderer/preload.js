import { contextBridge, ipcRenderer } from 'electron';
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Serial port operations
    getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
    findPlotterPort: () => ipcRenderer.invoke('find-plotter-port'),
    connectSerial: (portPath, baudRate) => ipcRenderer.invoke('connect-serial', portPath, baudRate),
    disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
    getSerialState: () => ipcRenderer.invoke('get-serial-state'),
    // Serial data listener
    onSerialData: (callback) => {
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
    plotterSetPenUpValue: (value) => ipcRenderer.invoke('plotter-set-pen-up-value', value),
    plotterSetPenDownValue: (value) => ipcRenderer.invoke('plotter-set-pen-down-value', value),
    plotterSetSpeed: (value) => ipcRenderer.invoke('plotter-set-speed', value),
    plotterPlotPath: (paths, doLift = true) => ipcRenderer.invoke('plotter-plot-path', paths, doLift),
    plotterMoveTo: (position) => ipcRenderer.invoke('plotter-move-to', position),
    plotterPause: () => ipcRenderer.invoke('plotter-pause'),
    plotterResume: () => ipcRenderer.invoke('plotter-resume'),
    plotterDisengage: () => ipcRenderer.invoke('plotter-disengage'),
    plotterStartQueue: () => ipcRenderer.invoke('plotter-start-queue'),
    plotterStopQueue: () => ipcRenderer.invoke('plotter-stop-queue'),
    plotterGetState: () => ipcRenderer.invoke('plotter-get-state'),
    plotterGetPosition: () => ipcRenderer.invoke('plotter-get-position'),
    plotterReset: () => ipcRenderer.invoke('plotter-reset'),
    plotterSetOrigin: () => ipcRenderer.invoke('plotter-set-origin'),
    setMovingSpeed: (value) => ipcRenderer.invoke('set-moving-speed', value)
});
