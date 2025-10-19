import { PlotModel, PlotEntity } from "./models/PlotModel.js";
import { PathTools } from "./PathTools.js";
import { ContextMenuView } from "./views/ContextMenuView.js";
import { ContextMenuController } from "./controllers/ContextMenuController.js";
import { PlotterGUIController } from "./controllers/PlotterGUIController.js";
import { CanvasView } from "./views/CanvasView.js";

// Initialize the plot model and font
const plotModel = new PlotModel();
const contextMenuController = new ContextMenuController(plotModel, new ContextMenuView());
const guiController = new PlotterGUIController(plotModel);
const canvasView = new CanvasView(plotModel);

// Controls are managed by ControlPanelView

const dataReceivedSpan = document.getElementById('data-received') as HTMLSpanElement;
const sampleRateSpan = document.getElementById('sample-rate') as HTMLSpanElement;
const lastValueSpan = document.getElementById('last-value') as HTMLSpanElement;
const distanceDrawnSpan = document.getElementById('distance-drawn') as HTMLSpanElement;
const commandsSentSpan = document.getElementById('commands-sent') as HTMLSpanElement;
const commandsCompletedSpan = document.getElementById('commands-completed') as HTMLSpanElement;
const queueLengthSpan = document.getElementById('queue-length') as HTMLSpanElement;
const progressCompleted = document.getElementById('progress-completed') as HTMLDivElement;
const progressCompletedText = document.getElementById('progress-completed-text') as HTMLSpanElement;
const progressQueued = document.getElementById('progress-queued') as HTMLDivElement;
const progressQueuedText = document.getElementById('progress-queued-text') as HTMLSpanElement;

// Add new slider and value elements
// Controls are managed by ControlPanelView

// State
let dataBuffer: number[] = [];
let totalBytesReceived: number = 0;
let lastSampleTime: number = Date.now();
let sampleCount: number = 0;

// Initialize the application
async function init(): Promise<void> {
    canvasView.setupCanvas();


    updateConnectionStatus(false, 'Disconnected');
    console.log('Plotter interface initialized');

    // Start polling plotter state for UI metrics
    startPlotterStatePolling();

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

    // Listen for serial data
    window.electronAPI.onSerialData(handleSerialData);
}


// Update connection status display
function updateConnectionStatus(connected: boolean, text?: string): void {
    guiController.setConnected(connected, text);
}

// Handle incoming serial data
function handleSerialData(data: any): void {
    totalBytesReceived += data.length;
    dataReceivedSpan.textContent = `${totalBytesReceived} bytes`;

    // Update sample rate
    sampleCount++;
    const now = Date.now();
    const elapsed = (now - lastSampleTime) / 1000;
    if (elapsed >= 1.0) {
        const rate = sampleCount / elapsed;
        sampleRateSpan.textContent = `${rate.toFixed(1)} Hz`;
        sampleCount = 0;
        lastSampleTime = now;
    }

    // Parse and store data (placeholder for actual plotting logic)
    try {
        const value = parseFloat(data.toString().trim());
        if (!isNaN(value)) {
            lastValueSpan.textContent = value.toFixed(2);
            dataBuffer.push(value);

            // Limit buffer size
            const maxPoints = 1000;
            if (dataBuffer.length > maxPoints) {
                dataBuffer.shift();
            }
        }
    } catch (error) {
        console.error('Error parsing data:', error);
    }
}

function startPlotterStatePolling(): void {
    const poll = async () => {
        try {
            const state = await window.electronAPI.plotterGetState();
            // Numbers
            commandsSentSpan.textContent = String(state.commandsSent ?? 0);
            commandsCompletedSpan.textContent = String(state.commandsCompleted ?? 0);
            queueLengthSpan.textContent = String(state.queueLength ?? 0);
            const dist = state.totalDistanceDrawnMm ?? 0;
            distanceDrawnSpan.textContent = `${dist.toFixed(1)} mm`;

            const planned = state.totalPlannedCommands ?? 0;
            const completed = state.commandsCompleted ?? 0;
            const queued = state.queueLength ?? 0;

            const completedPct = planned > 0 ? Math.min(100, Math.max(0, (completed / planned) * 100)) : 0;
            const queuedPct = planned > 0 ? Math.min(100, Math.max(0, (queued / planned) * 100)) : 0;

            progressCompleted.style.width = `${completedPct.toFixed(1)}%`;
            progressCompletedText.textContent = `${completedPct.toFixed(0)}%`;
            progressQueued.style.width = `${queuedPct.toFixed(1)}%`;
            progressQueuedText.textContent = `${queuedPct.toFixed(0)}%`;
        } catch (e) {
            // Swallow transient errors
        }
    };
    setInterval(poll, 200);
}




// Convert plot entities to plotter paths (now just flatten and round coordinates)
// entitiesToPaths now exists in ControlPanelController

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

