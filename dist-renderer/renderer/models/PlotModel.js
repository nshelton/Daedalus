export class PlotModel {
    constructor() {
        this.state = {
            entities: [],
            viewport: {
                zoom: 1,
                panX: 0,
                panY: 0
            },
            selection: {
                selectedEntityId: null,
                isDraggingViewport: false,
                isDraggingEntity: false,
                isResizingEntity: false,
                dragStartX: 0,
                dragStartY: 0,
                resizeHandle: null
            }
        };
    }
    // === Entity Management ===
    getEntities() {
        return [...this.state.entities];
    }
    addEntity(entity) {
        this.state.entities.push(entity);
    }
    removeEntity(id) {
        this.state.entities = this.state.entities.filter(e => e.id !== id);
        if (this.state.selection.selectedEntityId === id) {
            this.state.selection.selectedEntityId = null;
        }
    }
    updateEntity(id, updates) {
        const idx = this.state.entities.findIndex(e => e.id === id);
        if (idx !== -1) {
            this.state.entities[idx] = { ...this.state.entities[idx], ...updates };
        }
    }
    getEntity(id) {
        return this.state.entities.find(e => e.id === id);
    }
    clearEntities() {
        this.state.entities = [];
        this.state.selection.selectedEntityId = null;
    }
    // === Viewport Management ===
    getViewport() {
        return { ...this.state.viewport };
    }
    setZoom(zoom) {
        this.state.viewport.zoom = Math.max(0.1, Math.min(10, zoom));
    }
    getZoom() {
        return this.state.viewport.zoom;
    }
    setPan(panX, panY) {
        this.state.viewport.panX = panX;
        this.state.viewport.panY = panY;
    }
    getPan() {
        return [this.state.viewport.panX, this.state.viewport.panY];
    }
    // === Selection Management ===
    getSelectedEntityId() {
        return this.state.selection.selectedEntityId;
    }
    setSelectedEntityId(id) {
        this.state.selection.selectedEntityId = id;
    }
    getSelectedEntity() {
        if (!this.state.selection.selectedEntityId)
            return undefined;
        return this.getEntity(this.state.selection.selectedEntityId);
    }
    // === Drag State Management ===
    setDraggingViewport(isDragging) {
        this.state.selection.isDraggingViewport = isDragging;
    }
    isDraggingViewport() {
        return this.state.selection.isDraggingViewport;
    }
    setDraggingEntity(isDragging) {
        this.state.selection.isDraggingEntity = isDragging;
    }
    isDraggingEntity() {
        return this.state.selection.isDraggingEntity;
    }
    setResizingEntity(isResizing) {
        this.state.selection.isResizingEntity = isResizing;
    }
    isResizingEntity() {
        return this.state.selection.isResizingEntity;
    }
    setDragStart(x, y) {
        this.state.selection.dragStartX = x;
        this.state.selection.dragStartY = y;
    }
    getDragStart() {
        return [this.state.selection.dragStartX, this.state.selection.dragStartY];
    }
    setResizeHandle(handle) {
        this.state.selection.resizeHandle = handle;
    }
    getResizeHandle() {
        return this.state.selection.resizeHandle;
    }
    // === Complete State ===
    getState() {
        return {
            entities: [...this.state.entities],
            viewport: { ...this.state.viewport },
            selection: { ...this.state.selection }
        };
    }
    reset() {
        this.state = {
            entities: [],
            viewport: {
                zoom: 1,
                panX: 0,
                panY: 0
            },
            selection: {
                selectedEntityId: null,
                isDraggingViewport: false,
                isDraggingEntity: false,
                isResizingEntity: false,
                dragStartX: 0,
                dragStartY: 0,
                resizeHandle: null
            }
        };
    }
}
