import { PlotModel, PlotEntity } from "./models/PlotModel.js";
import { ContextMenuView } from "./views/ContextMenuView.js";
import { ContextMenuController } from "./controllers/ContextMenuController.js";
import { CanvasView } from "./views/CanvasView.js";
import { SerialView } from "./views/SerialView.js";
import { PlotterControlView } from "./views/PlotterControlView.js";
import { PlotterInterfaceController } from "./controllers/PlotterInterfaceController.js";

// Initialize the plot model and font
const plotModel = new PlotModel();
const contextMenuController = new ContextMenuController(plotModel, new ContextMenuView());
const canvasView = new CanvasView(plotModel, contextMenuController);
const plotterInterfaceController = new PlotterInterfaceController(plotModel);




const serialView = new SerialView(document.body);
const plotterControlView = new PlotterControlView(document.body, plotterInterfaceController);

// Initialize the application
async function init(): Promise<void> {
    canvasView.setupCanvas();

    serialView.updateConnectionStatus(false, 'Disconnected');
    console.log('Plotter interface initialized');

    // Start polling plotter state for UI metrics
    serialView.startPlotterStatePolling();

    setupEventListeners();
}

// Cleanup on page unload/reload
window.addEventListener('beforeunload', async () => {
    console.log('Cleaning up serial connection before unload...');
    try {
        await window.electronAPI.disconnectSerial();
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
});

function setupEventListeners(): void {
    window.electronAPI.onSerialData(serialView.handleSerialData);
}

// Convert plot entities to plotter paths (now just flatten and round coordinates)
// entitiesToPaths now exists in ControlPanelController

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

