import { PathTools } from "./renderer/PathTools";
// DOM Elements
const penUpBtn = document.getElementById('pen-up-btn');
const penDownBtn = document.getElementById('pen-down-btn');
const plotBtn = document.getElementById('plot-btn');
const stopBtn = document.getElementById('stop-btn');
const disengageBtn = document.getElementById('disengage-btn');
const statusBtn = document.getElementById('status-btn');
const debugAxesCheckbox = document.getElementById('debug-axes-checkbox');
const penUpSlider = document.getElementById('pen-up-slider');
const penDownSlider = document.getElementById('pen-down-slider');
const speedSlider = document.getElementById('speed-slider');
const penUpValue = document.getElementById('pen-up-value');
const penDownValue = document.getElementById('pen-down-value');
const speedValue = document.getElementById('speed-value');
const statusIndicator = document.querySelector('.status-indicator');
const plotterControls = document.getElementById('plotter-controls');
const plotCanvas = document.getElementById('plot-canvas');
const plotPlaceholder = document.querySelector('.plot-placeholder');
const dataReceivedSpan = document.getElementById('data-received');
const sampleRateSpan = document.getElementById('sample-rate');
const lastValueSpan = document.getElementById('last-value');
// Add new slider and value elements
const movingSpeedSlider = document.getElementById('moving-speed-slider');
const movingSpeedValue = document.getElementById('moving-speed-value');
// A3 dimensions in mm
const A3_WIDTH_MM = 297;
const A3_HEIGHT_MM = 420;
// State
let isConnected = false;
let selectedPort = null;
let dataBuffer = [];
let totalBytesReceived = 0;
let lastSampleTime = Date.now();
let sampleCount = 0;
// Viewport state
let zoom = 1;
let panX = 0;
let panY = 0;
let isDraggingViewport = false;
let isDraggingEntity = false;
let isResizingEntity = false;
let dragStartX = 0;
let dragStartY = 0;
let selectedEntityId = null;
let resizeHandle = null;
let entities = [];
// Initialize the application
async function init() {
    setupEventListeners();
    setupCanvas();
    updateConnectionStatus(false, 'Disconnected');
    console.log('Plotter interface initialized');
}
// Cleanup on page unload/reload
window.addEventListener('beforeunload', async () => {
    if (isConnected) {
        console.log('Cleaning up serial connection before unload...');
        try {
            await window.electronAPI.disconnectSerial();
        }
        catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
});
// Setup event listeners
function setupEventListeners() {
    // Status button (acts as connect/disconnect)
    statusBtn.addEventListener('click', handleConnect);
    // Plotter control buttons
    penUpBtn.addEventListener('click', handlePenUp);
    penDownBtn.addEventListener('click', handlePenDown);
    plotBtn.addEventListener('click', handlePlot);
    stopBtn.addEventListener('click', handleStop);
    disengageBtn.addEventListener('click', handleDisengage);
    // Slider listeners
    penUpSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        penUpValue.textContent = value;
    });
    penUpSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        await handleSetPenUpPosition(value);
    });
    penDownSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        penDownValue.textContent = value;
    });
    penDownSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        await handleSetPenDownPosition(value);
    });
    speedSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        speedValue.textContent = value;
    });
    speedSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        await handleSetSpeed(value);
    });
    // Add event listener for moving speed slider
    movingSpeedSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        movingSpeedValue.textContent = value;
    });
    // Add handler for setting moving speed
    async function handleSetMovingSpeed(value) {
        try {
            await window.electronAPI.setMovingSpeed(value);
            console.log('Moving speed set to:', value);
        }
        catch (error) {
            console.error('Failed to set moving speed:', error);
        }
    }
    // Add event listener for moving speed slider change
    movingSpeedSlider.addEventListener('change', async (e) => {
        const value = parseInt(e.target.value);
        await handleSetMovingSpeed(value);
    });
    // Canvas interactions
    plotCanvas.addEventListener('wheel', handleWheel, { passive: false });
    plotCanvas.addEventListener('mousedown', handleMouseDown);
    plotCanvas.addEventListener('mousemove', handleMouseMove);
    plotCanvas.addEventListener('mouseup', handleMouseUp);
    plotCanvas.addEventListener('mouseleave', handleMouseUp);
    plotCanvas.addEventListener('contextmenu', (e) => PathTools.showContextMenu(e.clientX, e.clientY, e.offsetX, e.offsetY, (entity) => entities.push(entity)));
    // Hide context menu on any left-click or scroll elsewhere
    document.addEventListener('click', () => PathTools.hideContextMenu());
    plotCanvas.addEventListener('wheel', () => PathTools.hideContextMenu());
    // Listen for serial data
    window.electronAPI.onSerialData(handleSerialData);
}
// Plotter Control Functions
async function handlePenUp() {
    try {
        penUpBtn.disabled = true;
        const result = await window.electronAPI.plotterPenUp();
        if (!result.success) {
            console.error('Pen up failed:', result.error);
        }
    }
    catch (error) {
        console.error('Error sending pen up:', error);
    }
    finally {
        penUpBtn.disabled = false;
    }
}
async function handlePenDown() {
    try {
        penDownBtn.disabled = true;
        const result = await window.electronAPI.plotterPenDown();
        if (!result.success) {
            console.error('Pen down failed:', result.error);
        }
    }
    catch (error) {
        console.error('Error sending pen down:', error);
    }
    finally {
        penDownBtn.disabled = false;
    }
}
async function handlePlot() {
    try {
        plotBtn.disabled = true;
        plotBtn.textContent = 'Plotting...';
        // Convert entities to paths
        let paths = entitiesToPaths(entities);
        // Add debug axes if enabled
        if (debugAxesCheckbox.checked) {
            console.log('Adding debug axes (10cm X and Y)');
            const xAxisPath = [[0, 0], [100, 0]]; // 10cm along X
            const yAxisPath = [[0, 0], [0, 100]]; // 10cm along Y
            // Prepend axes to the beginning
            paths = [xAxisPath, yAxisPath, ...paths];
        }
        if (paths.length === 0) {
            console.warn('No entities to plot');
            alert('No entities to plot. Double-click on the canvas to add circles.');
            return;
        }
        console.log(`Plotting ${paths.length} paths from ${entities.length} entities`);
        // Send paths to plotter
        const result = await window.electronAPI.plotterPlotPath(paths, true);
        if (result.success) {
            console.log('Paths queued successfully');
            // Start queue consumption
            await window.electronAPI.plotterStartQueue();
            console.log('Queue consumption started');
        }
        else {
            console.error('Plot path failed:', result.error);
            alert('Failed to plot: ' + result.error);
        }
    }
    catch (error) {
        console.error('Error plotting:', error);
        alert('Error plotting: ' + error);
    }
    finally {
        plotBtn.disabled = false;
        plotBtn.textContent = 'PLOT';
    }
}
async function handleStop() {
    try {
        stopBtn.disabled = true;
        stopBtn.textContent = 'Stopping...';
        console.log('Stopping plot...');
        // Stop queue consumption
        await window.electronAPI.plotterStopQueue();
        // Reset the plotter state
        await window.electronAPI.plotterReset();
        // Pen up
        await window.electronAPI.plotterPenUp();
        console.log('Plot stopped and reset');
    }
    catch (error) {
        console.error('Error stopping plot:', error);
        alert('Error stopping: ' + error);
    }
    finally {
        stopBtn.disabled = false;
        stopBtn.textContent = 'STOP';
    }
}
async function handleDisengage() {
    try {
        disengageBtn.disabled = true;
        const result = await window.electronAPI.plotterDisengage();
        if (!result.success) {
            console.error('Disengage failed:', result.error);
        }
    }
    catch (error) {
        console.error('Error disengaging motors:', error);
    }
    finally {
        disengageBtn.disabled = false;
    }
}
async function handleSetPenUpPosition(value) {
    try {
        const result = await window.electronAPI.plotterSetPenUpValue(value);
        if (!result.success) {
            console.error('Set pen up position failed:', result.error);
        }
    }
    catch (error) {
        console.error('Error setting pen up position:', error);
    }
}
async function handleSetPenDownPosition(value) {
    try {
        const result = await window.electronAPI.plotterSetPenDownValue(value);
        if (!result.success) {
            console.error('Set pen down position failed:', result.error);
        }
    }
    catch (error) {
        console.error('Error setting pen down position:', error);
    }
}
async function handleSetSpeed(value) {
    try {
        const result = await window.electronAPI.plotterSetSpeed(value);
        if (!result.success) {
            console.error('Set speed failed:', result.error);
        }
    }
    catch (error) {
        console.error('Error setting speed:', error);
    }
}
// Manual connect/disconnect handler
async function handleConnect() {
    if (isConnected) {
        // Disconnect
        try {
            statusBtn.disabled = true;
            updateConnectionStatus(false, 'Disconnecting...');
            const result = await window.electronAPI.disconnectSerial();
            if (result.success) {
                isConnected = false;
                selectedPort = null;
                updateConnectionStatus(false, 'Disconnected');
                console.log('Disconnected from plotter');
            }
            else {
                console.error('Disconnect failed:', result.error);
                updateConnectionStatus(isConnected, selectedPort || 'Error');
            }
        }
        catch (error) {
            console.error('Disconnect error:', error);
            updateConnectionStatus(isConnected, selectedPort || 'Error');
        }
        finally {
            statusBtn.disabled = false;
        }
    }
    else {
        // Connect
        try {
            statusBtn.disabled = true;
            updateConnectionStatus(false, 'Searching...');
            const plotterPort = await window.electronAPI.findPlotterPort();
            if (plotterPort) {
                console.log('Found plotter port:', plotterPort.path);
                updateConnectionStatus(false, 'Connecting...');
                const result = await window.electronAPI.connectSerial(plotterPort.path, 115200);
                if (result.success) {
                    isConnected = true;
                    selectedPort = plotterPort.path;
                    updateConnectionStatus(true, plotterPort.path);
                    console.log('Connected to plotter:', plotterPort.path);
                    // Initialize plotter with servo settings
                    await initializePlotter();
                }
                else {
                    console.error('Connection failed:', result.error);
                    updateConnectionStatus(false, 'Failed');
                }
            }
            else {
                console.log('No plotter port found');
                updateConnectionStatus(false, 'Not Found');
            }
        }
        catch (error) {
            console.error('Connect failed:', error);
            updateConnectionStatus(false, 'Error');
        }
        finally {
            statusBtn.disabled = false;
        }
    }
}
// Initialize plotter with current slider values
async function initializePlotter() {
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
            // Reset position to (0,0) on connection
            console.log('Setting plotter position to origin (0,0)...');
            await window.electronAPI.plotterSetOrigin();
            // Query actual position from EBB to sync with hardware
            const positionResult = await window.electronAPI.plotterGetPosition();
            if (positionResult.success && positionResult.position) {
                console.log(`Plotter actual position: [${positionResult.position[0].toFixed(2)}, ${positionResult.position[1].toFixed(2)}]mm`);
            }
            else {
                console.log('Could not query plotter position, assuming (0,0)');
            }
        }
        else {
            console.error('Plotter initialization failed:', result.error);
        }
    }
    catch (error) {
        console.error('Error initializing plotter:', error);
    }
}
// Update connection status display
function updateConnectionStatus(connected, text) {
    if (connected) {
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusBtn.textContent = text || 'Connected';
        plotterControls.style.display = 'block';
    }
    else {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusBtn.textContent = text || 'Disconnected';
        plotterControls.style.display = 'none';
    }
}
// Handle incoming serial data
function handleSerialData(data) {
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
    }
    catch (error) {
        console.error('Error parsing data:', error);
    }
}
// Clear data buffers
// function clearData(): void {
//     dataBuffer = [];
//     totalBytesReceived = 0;
//     sampleCount = 0;
//     lastSampleTime = Date.now();
//     dataReceivedSpan.textContent = '0 bytes';
//     sampleRateSpan.textContent = '0 Hz';
//     lastValueSpan.textContent = '—';
//     console.log('Data cleared');
// }
// Canvas setup and rendering
function setupCanvas() {
    const container = plotCanvas.parentElement;
    plotCanvas.width = container.clientWidth;
    plotCanvas.height = container.clientHeight;
    // Hide placeholder, show canvas
    plotPlaceholder.style.display = 'none';
    plotCanvas.style.display = 'block';
    // Position viewport so (0,0) is bottom-left of A3 paper
    // Center the paper on screen with some padding
    const padding = 50;
    panX = padding;
    panY = plotCanvas.height - padding;
    zoom = Math.min((plotCanvas.width - padding * 2) / A3_WIDTH_MM, (plotCanvas.height - padding * 2) / A3_HEIGHT_MM);
    // Remove the test circle - the 1cm grid is already drawn in drawA3Paper()
    // entities.push({
    //     id: 'circle1',
    //     paths: createCirclePaths(60, 60, 40) // Circle at (60, 60) from bottom-left with radius 40
    // });
    // Start render loop
    requestAnimationFrame(render);
    // Handle window resize
    window.addEventListener('resize', () => {
        plotCanvas.width = container.clientWidth;
        plotCanvas.height = container.clientHeight;
        render();
    });
}
function render() {
    const ctx = plotCanvas.getContext('2d');
    ctx.clearRect(0, 0, plotCanvas.width, plotCanvas.height);
    // Fill background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, plotCanvas.width, plotCanvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    // Draw A3 paper
    drawA3Paper(ctx);
    // Draw entities
    entities.forEach(entity => {
        drawEntity(ctx, entity, entity.id === selectedEntityId);
    });
    ctx.restore();
    requestAnimationFrame(render);
}
function drawA3Paper(ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2 / zoom;
    // Paper origin at (0, 0) - bottom-left corner in plotter coordinates
    // Canvas Y increases downward, so we need to flip for plotter coords
    ctx.save();
    ctx.scale(1, -1); // Flip Y axis so plotter (0,0) is bottom-left
    const x = 0;
    const y = 0;
    ctx.fillRect(x, y, A3_WIDTH_MM, A3_HEIGHT_MM);
    ctx.strokeRect(x, y, A3_WIDTH_MM, A3_HEIGHT_MM);
    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5 / zoom;
    const gridSize = 10; // 10mm grid
    for (let i = x; i <= x + A3_WIDTH_MM; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, y);
        ctx.lineTo(i, y + A3_HEIGHT_MM);
        ctx.stroke();
    }
    for (let i = y; i <= y + A3_HEIGHT_MM; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, i);
        ctx.lineTo(x + A3_WIDTH_MM, i);
        ctx.stroke();
    }
    // Draw origin marker
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();
}
function drawEntity(ctx, entity, isSelected) {
    ctx.save();
    // Flip Y axis to match plotter coordinates (0,0 at bottom-left)
    ctx.scale(1, -1);
    // Draw all paths in the entity
    entity.paths.forEach(path => {
        if (path.length === 0)
            return;
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i][0], path[i][1]);
        }
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
    });
    if (isSelected) {
        // Draw bounding box
        const bounds = getEntityBounds(entity);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        // Draw resize handles
        const handleSize = 8 / zoom;
        ctx.fillStyle = '#ef4444';
        const handles = getResizeHandles(bounds);
        handles.forEach(h => {
            ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        });
    }
    ctx.restore();
}
// Calculate bounding box for entity
function getEntityBounds(entity) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entity.paths.forEach(path => {
        path.forEach(([x, y]) => {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
    });
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}
function getResizeHandles(bounds) {
    return [
        { id: 'nw', x: bounds.x, y: bounds.y },
        { id: 'ne', x: bounds.x + bounds.width, y: bounds.y },
        { id: 'sw', x: bounds.x, y: bounds.y + bounds.height },
        { id: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ];
}
// Mouse interaction handlers
function handleWheel(e) {
    e.preventDefault();
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY * 0.001;
    const oldZoom = zoom;
    zoom = Math.max(0.1, Math.min(10, zoom * (1 + delta)));
    // Zoom toward mouse position
    panX = mouseX - (mouseX - panX) * (zoom / oldZoom);
    panY = mouseY - (mouseY - panY) * (zoom / oldZoom);
}
function handleMouseDown(e) {
    // Ignore right-click for dragging; it's reserved for context menu
    if (e.button === 2) {
        return;
    }
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(mouseX, mouseY);
    dragStartX = mouseX;
    dragStartY = mouseY;
    // Check if clicking on resize handle
    if (selectedEntityId) {
        const entity = entities.find(ent => ent.id === selectedEntityId);
        if (entity) {
            const bounds = getEntityBounds(entity);
            const handle = getHandleAtPosition(bounds, worldX, worldY);
            if (handle) {
                isResizingEntity = true;
                resizeHandle = handle;
                return;
            }
        }
    }
    // Check if clicking on entity
    const clickedEntity = getEntityAtPosition(worldX, worldY);
    if (clickedEntity) {
        selectedEntityId = clickedEntity.id;
        isDraggingEntity = true;
    }
    else {
        selectedEntityId = null;
        isDraggingViewport = true;
    }
}
function handleMouseMove(e) {
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(mouseX, mouseY);
    if (isDraggingViewport) {
        panX += mouseX - dragStartX;
        panY += mouseY - dragStartY;
        dragStartX = mouseX;
        dragStartY = mouseY;
    }
    else if (isDraggingEntity && selectedEntityId) {
        const entity = entities.find(e => e.id === selectedEntityId);
        if (entity) {
            const dx = (mouseX - dragStartX) / zoom;
            const dy = -(mouseY - dragStartY) / zoom; // Flip Y to match coordinate system
            translateEntity(entity, dx, dy);
            dragStartX = mouseX;
            dragStartY = mouseY;
        }
    }
    else if (isResizingEntity && selectedEntityId && resizeHandle) {
        const entity = entities.find(e => e.id === selectedEntityId);
        if (entity) {
            scaleEntity(entity, resizeHandle, worldX, worldY);
        }
    }
    // Update cursor
    updateCursor(worldX, worldY);
}
function handleMouseUp() {
    isDraggingViewport = false;
    isDraggingEntity = false;
    isResizingEntity = false;
    resizeHandle = null;
}
function screenToWorld(screenX, screenY) {
    // Convert screen to plotter coordinates (0,0 at bottom-left)
    // Screen Y increases downward, plotter Y increases upward
    return [
        (screenX - panX) / zoom,
        -(screenY - panY) / zoom // Flip Y
    ];
}
function getEntityAtPosition(x, y) {
    for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        const bounds = getEntityBounds(entity);
        // Simple bounding box check
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
            return entity;
        }
    }
    return null;
}
function getHandleAtPosition(bounds, x, y) {
    const handleSize = 8 / zoom;
    const handles = getResizeHandles(bounds);
    for (const handle of handles) {
        if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
            return handle.id;
        }
    }
    return null;
}
// Translate (move) an entity
function translateEntity(entity, dx, dy) {
    entity.paths = entity.paths.map(path => path.map(([x, y]) => [x + dx, y + dy]));
}
// Scale an entity from a resize handle (maintains aspect ratio)
function scaleEntity(entity, handle, worldX, worldY) {
    const oldBounds = getEntityBounds(entity);
    const minSize = 10;
    let newBounds = { ...oldBounds };
    let scaleFactor;
    switch (handle) {
        case 'se':
            // Calculate scale based on distance from opposite corner
            const seDistance = Math.sqrt(Math.pow(worldX - oldBounds.x, 2) + Math.pow(worldY - oldBounds.y, 2));
            const seOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), seDistance / seOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            break;
        case 'sw':
            // Calculate scale based on distance from opposite corner
            const swDistance = Math.sqrt(Math.pow(oldBounds.x + oldBounds.width - worldX, 2) + Math.pow(worldY - oldBounds.y, 2));
            const swOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), swDistance / swOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            newBounds.x = oldBounds.x + oldBounds.width - newBounds.width;
            break;
        case 'ne':
            // Calculate scale based on distance from opposite corner
            const neDistance = Math.sqrt(Math.pow(worldX - oldBounds.x, 2) + Math.pow(oldBounds.y + oldBounds.height - worldY, 2));
            const neOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), neDistance / neOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            newBounds.y = oldBounds.y + oldBounds.height - newBounds.height;
            break;
        case 'nw':
            // Calculate scale based on distance from opposite corner
            const nwDistance = Math.sqrt(Math.pow(oldBounds.x + oldBounds.width - worldX, 2) + Math.pow(oldBounds.y + oldBounds.height - worldY, 2));
            const nwOriginalDistance = Math.sqrt(Math.pow(oldBounds.width, 2) + Math.pow(oldBounds.height, 2));
            scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), nwDistance / nwOriginalDistance);
            newBounds.width = oldBounds.width * scaleFactor;
            newBounds.height = oldBounds.height * scaleFactor;
            newBounds.x = oldBounds.x + oldBounds.width - newBounds.width;
            newBounds.y = oldBounds.y + oldBounds.height - newBounds.height;
            break;
    }
    // Transform all paths using uniform scaling
    entity.paths = entity.paths.map(path => path.map(([x, y]) => {
        const relX = (x - oldBounds.x) * scaleFactor;
        const relY = (y - oldBounds.y) * scaleFactor;
        return [newBounds.x + relX, newBounds.y + relY];
    }));
}
function updateCursor(worldX, worldY) {
    if (selectedEntityId) {
        const entity = entities.find(e => e.id === selectedEntityId);
        if (entity) {
            const bounds = getEntityBounds(entity);
            const handle = getHandleAtPosition(bounds, worldX, worldY);
            if (handle) {
                plotCanvas.style.cursor = getCursorForHandle(handle);
                return;
            }
        }
    }
    const entity = getEntityAtPosition(worldX, worldY);
    plotCanvas.style.cursor = entity ? 'move' : 'grab';
}
function getCursorForHandle(handle) {
    const cursors = {
        'nw': 'ne-resize', // Dragging NW corner - cursor should point NW
        'ne': 'nw-resize', // Dragging NE corner - cursor should point NE
        'sw': 'se-resize', // Dragging SW corner - cursor should point SW
        'se': 'sw-resize' // Dragging SE corner - cursor should point SE
    };
    return cursors[handle] || 'default';
}
// Convert plot entities to plotter paths (now just flatten and round coordinates)
function entitiesToPaths(entities) {
    const paths = [];
    entities.forEach(entity => {
        entity.paths.forEach(path => {
            if (path.length > 0) {
                // Round all coordinates for the plotter
                const roundedPath = path.map(([x, y]) => [Math.round(x), Math.round(y)]);
                paths.push(roundedPath);
            }
        });
    });
    return paths;
}
// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
