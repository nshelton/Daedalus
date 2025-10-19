import { PathTools } from "./renderer/PathTools";
const statusIndicator = document.querySelector('.status-indicator');
const plotterControls = document.getElementById('plotter-controls');
const plotCanvas = document.getElementById('plot-canvas');
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
    // Add handler for setting moving speed
    // Canvas interactions
    plotCanvas.addEventListener('wheel', handleWheel, { passive: false });
    plotCanvas.addEventListener('mousedown', handleMouseDown);
    plotCanvas.addEventListener('mousemove', handleMouseMove);
    plotCanvas.addEventListener('mouseup', handleMouseUp);
    plotCanvas.addEventListener('mouseleave', handleMouseUp);
    plotCanvas.addEventListener('contextmenu', (e) => PathTools.showContextMenu(e.clientX, e.clientY, e.offsetX, e.offsetY, (entity) => entities.push(entity)));
    // Listen for serial data
    window.electronAPI.onSerialData(handleSerialData);
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
