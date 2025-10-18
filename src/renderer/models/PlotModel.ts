export interface PlotEntity {
    id: string;
    paths: [number, number][][]; // Array of paths, each path is array of [x, y] points
}

interface ViewportState {
    zoom: number;
    panX: number;
    panY: number;
}

interface SelectionState {
    selectedEntityId: string | null;
    isDraggingViewport: boolean;
    isDraggingEntity: boolean;
    isResizingEntity: boolean;
    dragStartX: number;
    dragStartY: number;
    resizeHandle: string | null;
}

interface PlotState {
    entities: PlotEntity[];
    viewport: ViewportState;
    selection: SelectionState;
}

export class PlotModel {
    private state: PlotState = {
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

    // === Entity Management ===

    getEntities(): PlotEntity[] {
        return [...this.state.entities];
    }

    addEntity(entity: PlotEntity): void {
        this.state.entities.push(entity);
    }

    removeEntity(id: string): void {
        this.state.entities = this.state.entities.filter(e => e.id !== id);
        if (this.state.selection.selectedEntityId === id) {
            this.state.selection.selectedEntityId = null;
        }
    }

    updateEntity(id: string, updates: Partial<PlotEntity>): void {
        const idx = this.state.entities.findIndex(e => e.id === id);
        if (idx !== -1) {
            this.state.entities[idx] = { ...this.state.entities[idx], ...updates };
        }
    }

    getEntity(id: string): PlotEntity | undefined {
        return this.state.entities.find(e => e.id === id);
    }

    clearEntities(): void {
        this.state.entities = [];
        this.state.selection.selectedEntityId = null;
    }

    // === Viewport Management ===

    getViewport(): ViewportState {
        return { ...this.state.viewport };
    }

    setZoom(zoom: number): void {
        this.state.viewport.zoom = Math.max(0.1, Math.min(10, zoom));
    }

    getZoom(): number {
        return this.state.viewport.zoom;
    }

    setPan(panX: number, panY: number): void {
        this.state.viewport.panX = panX;
        this.state.viewport.panY = panY;
    }

    getPan(): [number, number] {
        return [this.state.viewport.panX, this.state.viewport.panY];
    }

    // === Selection Management ===

    getSelectedEntityId(): string | null {
        return this.state.selection.selectedEntityId;
    }

    setSelectedEntityId(id: string | null): void {
        this.state.selection.selectedEntityId = id;
    }

    getSelectedEntity(): PlotEntity | undefined {
        if (!this.state.selection.selectedEntityId) return undefined;
        return this.getEntity(this.state.selection.selectedEntityId);
    }

    // === Drag State Management ===

    setDraggingViewport(isDragging: boolean): void {
        this.state.selection.isDraggingViewport = isDragging;
    }

    isDraggingViewport(): boolean {
        return this.state.selection.isDraggingViewport;
    }

    setDraggingEntity(isDragging: boolean): void {
        this.state.selection.isDraggingEntity = isDragging;
    }

    isDraggingEntity(): boolean {
        return this.state.selection.isDraggingEntity;
    }

    setResizingEntity(isResizing: boolean): void {
        this.state.selection.isResizingEntity = isResizing;
    }

    isResizingEntity(): boolean {
        return this.state.selection.isResizingEntity;
    }

    setDragStart(x: number, y: number): void {
        this.state.selection.dragStartX = x;
        this.state.selection.dragStartY = y;
    }

    getDragStart(): [number, number] {
        return [this.state.selection.dragStartX, this.state.selection.dragStartY];
    }

    setResizeHandle(handle: string | null): void {
        this.state.selection.resizeHandle = handle;
    }

    getResizeHandle(): string | null {
        return this.state.selection.resizeHandle;
    }

    // === Complete State ===

    getState(): Readonly<PlotState> {
        return {
            entities: [...this.state.entities],
            viewport: { ...this.state.viewport },
            selection: { ...this.state.selection }
        };
    }

    reset(): void {
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

