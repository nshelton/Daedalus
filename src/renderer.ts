// DOM Elements
const penUpBtn = document.getElementById('pen-up-btn') as HTMLButtonElement;
const penDownBtn = document.getElementById('pen-down-btn') as HTMLButtonElement;
const disengageBtn = document.getElementById('disengage-btn') as HTMLButtonElement;

const penUpSlider = document.getElementById('pen-up-slider') as HTMLInputElement;
const penDownSlider = document.getElementById('pen-down-slider') as HTMLInputElement;
const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;

const penUpValue = document.getElementById('pen-up-value') as HTMLSpanElement;
const penDownValue = document.getElementById('pen-down-value') as HTMLSpanElement;
const speedValue = document.getElementById('speed-value') as HTMLSpanElement;

const statusIndicator = document.querySelector('.status-indicator') as HTMLElement;
const statusText = document.querySelector('.status-text') as HTMLElement;
const plotCanvas = document.getElementById('plot-canvas') as HTMLCanvasElement;
const plotPlaceholder = document.querySelector('.plot-placeholder') as HTMLElement;

const dataReceivedSpan = document.getElementById('data-received') as HTMLSpanElement;
const sampleRateSpan = document.getElementById('sample-rate') as HTMLSpanElement;
const lastValueSpan = document.getElementById('last-value') as HTMLSpanElement;

// State
let isConnected: boolean = false;
let selectedPort: string | null = null;
let dataBuffer: number[] = [];
let totalBytesReceived: number = 0;
let lastSampleTime: number = Date.now();
let sampleCount: number = 0;

// Initialize the application
async function init(): Promise<void> {
    setupEventListeners();
    await autoConnectPlotter();
    console.log('Plotter interface initialized');
}

// Setup event listeners
function setupEventListeners(): void {
    // Plotter control buttons
    penUpBtn.addEventListener('click', handlePenUp);
    penDownBtn.addEventListener('click', handlePenDown);
    disengageBtn.addEventListener('click', handleDisengage);

    // Slider listeners
    penUpSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        penUpValue.textContent = value;
    });

    penUpSlider.addEventListener('change', async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        await handleSetPenUpPosition(value);
    });

    penDownSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        penDownValue.textContent = value;
    });

    penDownSlider.addEventListener('change', async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        await handleSetPenDownPosition(value);
    });

    speedSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        speedValue.textContent = value;
    });

    speedSlider.addEventListener('change', async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        await handleSetSpeed(value);
    });

    // Listen for serial data
    window.electronAPI.onSerialData(handleSerialData);
}

// Plotter Control Functions
async function handlePenUp(): Promise<void> {
    try {
        penUpBtn.disabled = true;
        const result = await window.electronAPI.plotterPenUp();
        if (!result.success) {
            console.error('Pen up failed:', result.error);
        }
    } catch (error) {
        console.error('Error sending pen up:', error);
    } finally {
        penUpBtn.disabled = false;
    }
}

async function handlePenDown(): Promise<void> {
    try {
        penDownBtn.disabled = true;
        const result = await window.electronAPI.plotterPenDown();
        if (!result.success) {
            console.error('Pen down failed:', result.error);
        }
    } catch (error) {
        console.error('Error sending pen down:', error);
    } finally {
        penDownBtn.disabled = false;
    }
}

async function handleDisengage(): Promise<void> {
    try {
        disengageBtn.disabled = true;
        const result = await window.electronAPI.plotterDisengage();
        if (!result.success) {
            console.error('Disengage failed:', result.error);
        }
    } catch (error) {
        console.error('Error disengaging motors:', error);
    } finally {
        disengageBtn.disabled = false;
    }
}

async function handleSetPenUpPosition(value: number): Promise<void> {
    try {
        const result = await window.electronAPI.plotterSetPenUpValue(value);
        if (!result.success) {
            console.error('Set pen up position failed:', result.error);
        }
    } catch (error) {
        console.error('Error setting pen up position:', error);
    }
}

async function handleSetPenDownPosition(value: number): Promise<void> {
    try {
        const result = await window.electronAPI.plotterSetPenDownValue(value);
        if (!result.success) {
            console.error('Set pen down position failed:', result.error);
        }
    } catch (error) {
        console.error('Error setting pen down position:', error);
    }
}

async function handleSetSpeed(value: number): Promise<void> {
    try {
        const result = await window.electronAPI.plotterSetSpeed(value);
        if (!result.success) {
            console.error('Set speed failed:', result.error);
        }
    } catch (error) {
        console.error('Error setting speed:', error);
    }
}

// Auto-connect to plotter on startup
async function autoConnectPlotter(): Promise<void> {
    try {
        console.log('Attempting to auto-connect to plotter...');
        updateConnectionStatus(false, 'Searching...');

        const plotterPort = await window.electronAPI.findPlotterPort();

        if (plotterPort) {
            console.log('Found plotter port:', plotterPort.path);

            const result = await window.electronAPI.connectSerial(plotterPort.path, 115200);

            if (result.success) {
                isConnected = true;
                updateConnectionStatus(true, `Connected (${plotterPort.path})`);
                console.log('Connected to plotter:', plotterPort.path);

                // Initialize plotter with servo settings
                await initializePlotter();
            } else {
                console.error('Connection failed:', result.error);
                updateConnectionStatus(false, 'Connection Failed');
            }
        } else {
            console.log('No plotter port found');
            updateConnectionStatus(false, 'No Plotter Found');
        }
    } catch (error) {
        console.error('Auto-connect failed:', error);
        updateConnectionStatus(false, 'Error');
    }
}

// Initialize plotter with current slider values
async function initializePlotter(): Promise<void> {
    try {
        // Get current plotter state
        const state = await window.electronAPI.plotterGetState();

        // Update sliders to match plotter state
        penUpSlider.value = state.penUpPosition.toString();
        penUpValue.textContent = state.penUpPosition.toString();

        penDownSlider.value = state.penDownPosition.toString();
        penDownValue.textContent = state.penDownPosition.toString();

        speedSlider.value = state.speed.toString();
        speedValue.textContent = state.speed.toString();

        // Send initialization commands to plotter
        const result = await window.electronAPI.plotterInitialize();

        if (result.success) {
            console.log('Plotter initialized successfully');
        } else {
            console.error('Plotter initialization failed:', result.error);
        }
    } catch (error) {
        console.error('Error initializing plotter:', error);
    }
}

// Update connection status display
function updateConnectionStatus(connected: boolean, text?: string): void {
    if (connected) {
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusText.textContent = text || 'Connected';
    } else {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusText.textContent = text || 'Disconnected';
    }
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
            const maxPoints = parseInt(dataPointsInput.value);
            if (dataBuffer.length > maxPoints) {
                dataBuffer.shift();
            }
        }
    } catch (error) {
        console.error('Error parsing data:', error);
    }
}

// Clear data buffers
function clearData(): void {
    dataBuffer = [];
    totalBytesReceived = 0;
    sampleCount = 0;
    lastSampleTime = Date.now();

    dataReceivedSpan.textContent = '0 bytes';
    sampleRateSpan.textContent = '0 Hz';
    lastValueSpan.textContent = '—';

    console.log('Data cleared');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

