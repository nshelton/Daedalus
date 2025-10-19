import { PlotModel } from "./models/PlotModel.js";
import { PathTools } from "./PathTools.js";
import { ControlPanelController } from "./controllers/ControlPanelController.js";
// Initialize the plot model and font
const plotModel = new PlotModel();
let controlPanel;
let controlPanelController;
// Controls are managed by ControlPanelView
const plotCanvas = document.getElementById('plot-canvas');
const plotPlaceholder = document.querySelector('.plot-placeholder');
const dataReceivedSpan = document.getElementById('data-received');
const sampleRateSpan = document.getElementById('sample-rate');
const lastValueSpan = document.getElementById('last-value');
const distanceDrawnSpan = document.getElementById('distance-drawn');
const commandsSentSpan = document.getElementById('commands-sent');
const commandsCompletedSpan = document.getElementById('commands-completed');
const queueLengthSpan = document.getElementById('queue-length');
const progressCompleted = document.getElementById('progress-completed');
const progressCompletedText = document.getElementById('progress-completed-text');
const progressQueued = document.getElementById('progress-queued');
const progressQueuedText = document.getElementById('progress-queued-text');
// Add new slider and value elements
// Controls are managed by ControlPanelView
// A3 dimensions in mm
const A3_WIDTH_MM = 297;
const A3_HEIGHT_MM = 420;
// State
let dataBuffer = [];
let totalBytesReceived = 0;
let lastSampleTime = Date.now();
let sampleCount = 0;
// Initialize the application
async function init() {
    setupEventListeners();
    setupCanvas();
    updateConnectionStatus(false, 'Disconnected');
    console.log('Plotter interface initialized');
    // Start polling plotter state for UI metrics
    startPlotterStatePolling();
}
// Cleanup on page unload/reload
window.addEventListener('beforeunload', async () => {
    console.log('Cleaning up serial connection before unload...');
    try {
        await window.electronAPI.disconnectSerial();
    }
    catch (error) {
        console.error('Error during cleanup:', error);
    }
});
// Setup event listeners
function setupEventListeners() {
    controlPanelController = new ControlPanelController(plotModel);
    // Controller creates its own view; capture for status updates
    controlPanel = controlPanelController["view"];
    // Canvas interactions
    plotCanvas.addEventListener('wheel', handleWheel, { passive: false });
    plotCanvas.addEventListener('mousedown', handleMouseDown);
    plotCanvas.addEventListener('mousemove', handleMouseMove);
    plotCanvas.addEventListener('mouseup', handleMouseUp);
    plotCanvas.addEventListener('mouseleave', handleMouseUp);
    plotCanvas.addEventListener('dblclick', handleDoubleClick);
    plotCanvas.addEventListener('contextmenu', handleContextMenu);
    // Hide context menu on any left-click or scroll elsewhere
    document.addEventListener('click', () => PathTools.hideContextMenu());
    plotCanvas.addEventListener('wheel', () => PathTools.hideContextMenu());
    // Listen for serial data
    window.electronAPI.onSerialData(handleSerialData);
}
// Update connection status display
function updateConnectionStatus(connected, text) {
    controlPanel.setConnected(connected, text);
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
function startPlotterStatePolling() {
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
        }
        catch (e) {
            // Swallow transient errors
        }
    };
    setInterval(poll, 200);
}
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
    const panX = padding;
    const panY = plotCanvas.height - padding;
    const zoom = Math.min((plotCanvas.width - padding * 2) / A3_WIDTH_MM, (plotCanvas.height - padding * 2) / A3_HEIGHT_MM);
    plotModel.setPan(panX, panY);
    plotModel.setZoom(zoom);
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
    const [panX, panY] = plotModel.getPan();
    const zoom = plotModel.getZoom();
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    // Draw A3 paper
    drawA3Paper(ctx, zoom);
    // Draw entities
    const entities = plotModel.getEntities();
    const selectedEntityId = plotModel.getSelectedEntityId();
    entities.forEach(entity => {
        drawEntity(ctx, entity, entity.id === selectedEntityId, zoom);
    });
    ctx.restore();
    requestAnimationFrame(render);
}
function drawA3Paper(ctx, zoom) {
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
function drawEntity(ctx, entity, isSelected, zoom) {
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
    const oldZoom = plotModel.getZoom();
    const newZoom = Math.max(0.1, Math.min(10, oldZoom * (1 + delta)));
    plotModel.setZoom(newZoom);
    // Zoom toward mouse position
    const [panX, panY] = plotModel.getPan();
    const newPanX = mouseX - (mouseX - panX) * (newZoom / oldZoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / oldZoom);
    plotModel.setPan(newPanX, newPanY);
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
    plotModel.setDragStart(mouseX, mouseY);
    // Check if clicking on resize handle
    const selectedEntityId = plotModel.getSelectedEntityId();
    if (selectedEntityId) {
        const entity = plotModel.getEntity(selectedEntityId);
        if (entity) {
            const bounds = getEntityBounds(entity);
            const handle = getHandleAtPosition(bounds, worldX, worldY);
            if (handle) {
                plotModel.setResizingEntity(true);
                plotModel.setResizeHandle(handle);
                return;
            }
        }
    }
    // Check if clicking on entity
    const clickedEntity = getEntityAtPosition(worldX, worldY);
    if (clickedEntity) {
        plotModel.setSelectedEntityId(clickedEntity.id);
        plotModel.setDraggingEntity(true);
    }
    else {
        plotModel.setSelectedEntityId(null);
        plotModel.setDraggingViewport(true);
    }
}
function handleMouseMove(e) {
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(mouseX, mouseY);
    if (plotModel.isDraggingViewport()) {
        const [panX, panY] = plotModel.getPan();
        const [dragStartX, dragStartY] = plotModel.getDragStart();
        plotModel.setPan(panX + mouseX - dragStartX, panY + mouseY - dragStartY);
        plotModel.setDragStart(mouseX, mouseY);
    }
    else if (plotModel.isDraggingEntity()) {
        const selectedEntityId = plotModel.getSelectedEntityId();
        if (selectedEntityId) {
            const entity = plotModel.getEntity(selectedEntityId);
            if (entity) {
                const [dragStartX, dragStartY] = plotModel.getDragStart();
                const zoom = plotModel.getZoom();
                const dx = (mouseX - dragStartX) / zoom;
                const dy = -(mouseY - dragStartY) / zoom; // Flip Y to match coordinate system
                translateEntity(entity, dx, dy);
                plotModel.updateEntity(selectedEntityId, entity);
                plotModel.setDragStart(mouseX, mouseY);
            }
        }
    }
    else if (plotModel.isResizingEntity()) {
        const selectedEntityId = plotModel.getSelectedEntityId();
        const resizeHandle = plotModel.getResizeHandle();
        if (selectedEntityId && resizeHandle) {
            const entity = plotModel.getEntity(selectedEntityId);
            if (entity) {
                scaleEntity(entity, resizeHandle, worldX, worldY);
                plotModel.updateEntity(selectedEntityId, entity);
            }
        }
    }
    // Update cursor
    updateCursor(worldX, worldY);
}
function handleMouseUp() {
    plotModel.setDraggingViewport(false);
    plotModel.setDraggingEntity(false);
    plotModel.setResizingEntity(false);
    plotModel.setResizeHandle(null);
}
function handleDoubleClick(e) {
    const rect = plotCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(mouseX, mouseY);
    // Add new square at click position
    const newSquare = {
        id: `square${Date.now()}`,
        paths: PathTools.createSquarePath(worldX, worldY, 40)
    };
    plotModel.addEntity(newSquare);
}
function handleContextMenu(e) {
    e.preventDefault();
    const rect = plotCanvas.getBoundingClientRect();
    const contextClickScreenX = e.clientX - rect.left;
    const contextClickScreenY = e.clientY - rect.top;
    const [worldX, worldY] = screenToWorld(contextClickScreenX, contextClickScreenY);
    PathTools.showContextMenu(e.clientX, e.clientY, worldX, worldY, (entity) => plotModel.addEntity(entity));
}
function screenToWorld(screenX, screenY) {
    // Convert screen to plotter coordinates (0,0 at bottom-left)
    // Screen Y increases downward, plotter Y increases upward
    const [panX, panY] = plotModel.getPan();
    const zoom = plotModel.getZoom();
    return [
        (screenX - panX) / zoom,
        -(screenY - panY) / zoom // Flip Y
    ];
}
function getEntityAtPosition(x, y) {
    const entities = plotModel.getEntities();
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
    const zoom = plotModel.getZoom();
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
    const selectedEntityId = plotModel.getSelectedEntityId();
    if (selectedEntityId) {
        const entity = plotModel.getEntity(selectedEntityId);
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
// entitiesToPaths now exists in ControlPanelController
// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
