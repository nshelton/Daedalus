// DOM Elements
const portSelect = document.getElementById('port-select') as HTMLSelectElement;
const refreshPortsBtn = document.getElementById('refresh-ports') as HTMLButtonElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const baudRateSelect = document.getElementById('baud-rate') as HTMLSelectElement;
const clearPlotBtn = document.getElementById('clear-plot') as HTMLButtonElement;
const updateRateInput = document.getElementById('update-rate') as HTMLInputElement;
const dataPointsInput = document.getElementById('data-points') as HTMLInputElement;
const autoScrollCheckbox = document.getElementById('auto-scroll') as HTMLInputElement;

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
    await refreshPorts();
    await autoConnectPlotter();
    console.log('USB Serial Plotter initialized');
}

// Setup event listeners
function setupEventListeners(): void {
    refreshPortsBtn.addEventListener('click', refreshPorts);
    connectBtn.addEventListener('click', toggleConnection);
    clearPlotBtn.addEventListener('click', clearPlot);

    portSelect.addEventListener('change', (e) => {
        selectedPort = (e.target as HTMLSelectElement).value;
    });

    // Settings change listeners
    updateRateInput.addEventListener('change', (e) => {
        console.log('Update rate changed to:', (e.target as HTMLInputElement).value);
    });

    dataPointsInput.addEventListener('change', (e) => {
        console.log('Max data points changed to:', (e.target as HTMLInputElement).value);
    });

    autoScrollCheckbox.addEventListener('change', (e) => {
        console.log('Auto scroll:', (e.target as HTMLInputElement).checked);
    });

    // Listen for serial data
    window.electronAPI.onSerialData(handleSerialData);
}

// Refresh available serial ports
async function refreshPorts(): Promise<void> {
    try {
        refreshPortsBtn.disabled = true;
        refreshPortsBtn.textContent = 'Loading...';

        const ports = await window.electronAPI.getSerialPorts();

        portSelect.innerHTML = '';

        if (ports.length === 0) {
            portSelect.innerHTML = '<option value="">No ports found</option>';
        } else {
            ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.path;
                option.textContent = `${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ''}`;
                portSelect.appendChild(option);
            });
            selectedPort = ports[0].path;
        }

        refreshPortsBtn.textContent = 'Refresh';
        refreshPortsBtn.disabled = false;
    } catch (error) {
        console.error('Error refreshing ports:', error);
        portSelect.innerHTML = '<option value="">Error loading ports</option>';
        refreshPortsBtn.textContent = 'Refresh';
        refreshPortsBtn.disabled = false;
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
            selectedPort = plotterPort.path;

            // Update port select to show the found port
            const option = Array.from(portSelect.options).find(opt => opt.value === plotterPort.path);
            if (option) {
                portSelect.value = plotterPort.path;
            }

            await connect();
        } else {
            console.log('No plotter port found');
            updateConnectionStatus(false, 'Disconnected');
        }
    } catch (error) {
        console.error('Auto-connect failed:', error);
        updateConnectionStatus(false, 'Disconnected');
    }
}

// Toggle serial connection
async function toggleConnection(): Promise<void> {
    if (isConnected) {
        await disconnect();
    } else {
        await connect();
    }
}

// Connect to serial port
async function connect(): Promise<void> {
    if (!selectedPort) {
        console.error('No port selected');
        return;
    }

    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        updateConnectionStatus(false, 'Connecting...');

        const baudRate = parseInt(baudRateSelect.value);
        const result = await window.electronAPI.connectSerial(selectedPort, baudRate);

        if (result.success) {
            isConnected = true;
            connectBtn.textContent = 'Disconnect';
            updateConnectionStatus(true, `Connected (${selectedPort})`);
            portSelect.disabled = true;
            baudRateSelect.disabled = true;
            console.log('Connected to', selectedPort);
        } else {
            console.error('Connection failed:', result.error);
            updateConnectionStatus(false, 'Connection Failed');
            connectBtn.textContent = 'Connect';
        }
    } catch (error) {
        console.error('Error connecting:', error);
        updateConnectionStatus(false, 'Error');
        connectBtn.textContent = 'Connect';
    } finally {
        connectBtn.disabled = false;
    }
}

// Disconnect from serial port
async function disconnect(): Promise<void> {
    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Disconnecting...';
        updateConnectionStatus(false, 'Disconnecting...');

        await window.electronAPI.disconnectSerial();

        isConnected = false;
        connectBtn.textContent = 'Connect';
        updateConnectionStatus(false, 'Disconnected');
        portSelect.disabled = false;
        baudRateSelect.disabled = false;
        console.log('Disconnected');
    } catch (error) {
        console.error('Error disconnecting:', error);
        connectBtn.textContent = 'Disconnect';
    } finally {
        connectBtn.disabled = false;
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

// Clear the plot
function clearPlot(): void {
    dataBuffer = [];
    totalBytesReceived = 0;
    sampleCount = 0;
    lastSampleTime = Date.now();

    dataReceivedSpan.textContent = '0 bytes';
    sampleRateSpan.textContent = '0 Hz';
    lastValueSpan.textContent = '—';

    console.log('Plot cleared');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

