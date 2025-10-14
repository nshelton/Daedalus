// DOM Elements
const portSelect = document.getElementById('port-select') as HTMLSelectElement;
const refreshPortsBtn = document.getElementById('refresh-ports') as HTMLButtonElement;
const baudRateSelect = document.getElementById('baud-rate') as HTMLSelectElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
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
    await refreshPorts();
    setupEventListeners();
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
}

// Refresh available serial ports
async function refreshPorts(): Promise<void> {
    try {
        refreshPortsBtn.disabled = true;
        refreshPortsBtn.textContent = 'Refreshing...';
        
        const ports = await window.electronAPI.getSerialPorts();
        
        portSelect.innerHTML = '';
        
        if (ports.length === 0) {
            portSelect.innerHTML = '<option value="">No ports available</option>';
        } else {
            ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.path;
                option.textContent = `${port.path}${port.manufacturer ? ' - ' + port.manufacturer : ''}`;
                portSelect.appendChild(option);
            });
            selectedPort = ports[0].path;
        }
        
        refreshPortsBtn.disabled = false;
        refreshPortsBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
        `;
    } catch (error) {
        console.error('Error refreshing ports:', error);
        portSelect.innerHTML = '<option value="">Error loading ports</option>';
        refreshPortsBtn.disabled = false;
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
        alert('Please select a serial port');
        return;
    }

    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        
        const baudRate = parseInt(baudRateSelect.value);
        const result = await window.electronAPI.connectSerial(selectedPort, baudRate);
        
        if (result.success) {
            isConnected = true;
            updateConnectionStatus(true);
            connectBtn.textContent = 'Disconnect';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-secondary');
            
            // Disable port selection while connected
            portSelect.disabled = true;
            baudRateSelect.disabled = true;
            refreshPortsBtn.disabled = true;
            
            // Show plot canvas
            plotPlaceholder.style.display = 'none';
            plotCanvas.classList.add('active');
            
            // Setup data listener
            window.electronAPI.onSerialData(handleSerialData);
            
            console.log(`Connected to ${selectedPort} at ${baudRate} baud`);
        } else {
            throw new Error('Connection failed');
        }
        
        connectBtn.disabled = false;
    } catch (error) {
        console.error('Error connecting:', error);
        alert('Failed to connect to serial port');
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
    }
}

// Disconnect from serial port
async function disconnect(): Promise<void> {
    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Disconnecting...';
        
        const result = await window.electronAPI.disconnectSerial();
        
        if (result.success) {
            isConnected = false;
            updateConnectionStatus(false);
            connectBtn.textContent = 'Connect';
            connectBtn.classList.remove('btn-secondary');
            connectBtn.classList.add('btn-primary');
            
            // Enable port selection
            portSelect.disabled = false;
            baudRateSelect.disabled = false;
            refreshPortsBtn.disabled = false;
            
            // Hide plot canvas
            plotCanvas.classList.remove('active');
            plotPlaceholder.style.display = 'flex';
            
            // Remove data listener
            window.electronAPI.removeSerialDataListener();
            
            console.log('Disconnected from serial port');
        }
        
        connectBtn.disabled = false;
    } catch (error) {
        console.error('Error disconnecting:', error);
        connectBtn.disabled = false;
    }
}

// Update connection status display
function updateConnectionStatus(connected: boolean): void {
    if (connected) {
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
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

