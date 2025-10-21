export interface PlotEntity {
    id: string;
    paths: [number, number][][]; // Array of paths, each path is array of [x, y] points
}

export interface Raster {
    id: string;
    width: number;
    height: number;
    data: Uint8ClampedArray; // grayscale, length = width * height
    x: number; // world mm, bottom-left origin
    y: number; // world mm
    pixelSizeMm: number; // mm per pixel
}

interface ViewportState {
    zoom: number;
    panX: number;
    panY: number;
}

interface SelectionState {
    selectedEntityId: string | null;
    selectedRasterId: string | null;
    isDraggingViewport: boolean;
    isDraggingEntity: boolean;
    isDraggingRaster: boolean;
    isResizingEntity: boolean;
    dragStartX: number;
    dragStartY: number;
    resizeHandle: string | null;
}

interface PlotState {
    entities: PlotEntity[];
    rasters: Raster[];
    viewport: ViewportState;
    selection: SelectionState;
}

export class PlotModel {
    private state: PlotState = {
        entities: [],
        rasters: [],
        viewport: {
            zoom: 1,
            panX: 0,
            panY: 0
        },
        selection: {
            selectedEntityId: null,
            selectedRasterId: null,
            isDraggingViewport: false,
            isDraggingEntity: false,
            isDraggingRaster: false,
            isResizingEntity: false,
            dragStartX: 0,
            dragStartY: 0,
            resizeHandle: null
        }
    };

    // Simple pub/sub for views to react to model changes
    private listeners: Set<() => void> = new Set();

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch {
                // Ignore listener errors to avoid breaking notifications
            }
        }
    }

    // === Entity Management ===

    getEntities(): PlotEntity[] {
        return [...this.state.entities];
    }

    addEntity(entity: PlotEntity): void {
        this.state.entities.push(entity);
        this.notify();
    }

    removeEntity(id: string): void {
        this.state.entities = this.state.entities.filter(e => e.id !== id);
        if (this.state.selection.selectedEntityId === id) {
            this.state.selection.selectedEntityId = null;
        }
        this.notify();
    }

    updateEntity(id: string, updates: Partial<PlotEntity>): void {
        const idx = this.state.entities.findIndex(e => e.id === id);
        if (idx !== -1) {
            this.state.entities[idx] = { ...this.state.entities[idx], ...updates };
            this.notify();
        }
    }

    getEntity(id: string): PlotEntity | undefined {
        return this.state.entities.find(e => e.id === id);
    }

    clearEntities(): void {
        this.state.entities = [];
        this.state.selection.selectedEntityId = null;
        this.notify();
    }

    // === Raster Management ===

    getRasters(): Raster[] {
        return [...this.state.rasters];
    }

    addRaster(raster: Raster): void {
        this.state.rasters.push(raster);
        this.notify();
    }

    updateRaster(id: string, updates: Partial<Raster>): void {
        const idx = this.state.rasters.findIndex(r => r.id === id);
        if (idx !== -1) {
            this.state.rasters[idx] = { ...this.state.rasters[idx], ...updates };
            this.notify();
        }
    }

    removeRaster(id: string): void {
        this.state.rasters = this.state.rasters.filter(r => r.id !== id);
        if (this.state.selection.selectedRasterId === id) {
            this.state.selection.selectedRasterId = null;
        }
        this.notify();
    }

    clearRasters(): void {
        this.state.rasters = [];
        this.notify();
    }

    // === Viewport Management ===

    getViewport(): ViewportState {
        return { ...this.state.viewport };
    }

    setZoom(zoom: number): void {
        this.state.viewport.zoom = Math.max(0.1, Math.min(10, zoom));
        this.notify();
    }

    getZoom(): number {
        return this.state.viewport.zoom;
    }

    setPan(panX: number, panY: number): void {
        this.state.viewport.panX = panX;
        this.state.viewport.panY = panY;
        this.notify();
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
        if (id !== null) {
            this.state.selection.selectedRasterId = null;
        }
        this.notify();
    }

    getSelectedEntity(): PlotEntity | undefined {
        if (!this.state.selection.selectedEntityId) return undefined;
        return this.getEntity(this.state.selection.selectedEntityId);
    }

    // === Drag State Management ===

    setDraggingViewport(isDragging: boolean): void {
        this.state.selection.isDraggingViewport = isDragging;
        this.notify();
    }

    isDraggingViewport(): boolean {
        return this.state.selection.isDraggingViewport;
    }

    setDraggingEntity(isDragging: boolean): void {
        this.state.selection.isDraggingEntity = isDragging;
        this.notify();
    }

    isDraggingEntity(): boolean {
        return this.state.selection.isDraggingEntity;
    }

    setResizingEntity(isResizing: boolean): void {
        this.state.selection.isResizingEntity = isResizing;
        this.notify();
    }

    isResizingEntity(): boolean {
        return this.state.selection.isResizingEntity;
    }

    setDragStart(x: number, y: number): void {
        this.state.selection.dragStartX = x;
        this.state.selection.dragStartY = y;
        this.notify();
    }

    getDragStart(): [number, number] {
        return [this.state.selection.dragStartX, this.state.selection.dragStartY];
    }

    setResizeHandle(handle: string | null): void {
        this.state.selection.resizeHandle = handle;
        this.notify();
    }

    getResizeHandle(): string | null {
        return this.state.selection.resizeHandle;
    }

    // === Raster Selection & Dragging ===

    getSelectedRasterId(): string | null {
        return this.state.selection.selectedRasterId;
    }

    setSelectedRasterId(id: string | null): void {
        this.state.selection.selectedRasterId = id;
        if (id !== null) {
            this.state.selection.selectedEntityId = null;
        }
        this.notify();
    }

    isDraggingRaster(): boolean {
        return this.state.selection.isDraggingRaster;
    }

    setDraggingRaster(isDragging: boolean): void {
        this.state.selection.isDraggingRaster = isDragging;
        this.notify();
    }

    // === Complete State ===

    getState(): Readonly<PlotState> {
        return {
            entities: [...this.state.entities],
            rasters: [...this.state.rasters],
            viewport: { ...this.state.viewport },
            selection: { ...this.state.selection }
        };
    }

    reset(): void {
        this.state = {
            entities: [],
            rasters: [],
            viewport: {
                zoom: 1,
                panX: 0,
                panY: 0
            },
            selection: {
                selectedEntityId: null,
                selectedRasterId: null,
                isDraggingViewport: false,
                isDraggingEntity: false,
                isDraggingRaster: false,
                isResizingEntity: false,
                dragStartX: 0,
                dragStartY: 0,
                resizeHandle: null
            }
        };
        this.notify();
    }

    // Replace entire state from a plain object (e.g. loaded from disk)
    replaceState(raw: any): void {
        try {
            const next: PlotState = {
                entities: Array.isArray(raw?.entities) ? raw.entities.map((e: any) => ({ id: String(e.id), paths: Array.isArray(e.paths) ? e.paths.map((p: any) => Array.isArray(p) ? p.map((pt: any) => [Number(pt[0]), Number(pt[1])] as [number, number]) : []) : [] })) : [],
                rasters: Array.isArray(raw?.rasters) ? raw.rasters.map((r: any) => ({
                    id: String(r.id),
                    width: Number(r.width) || 0,
                    height: Number(r.height) || 0,
                    data: this.deserializeTypedArray(r.data) as Uint8ClampedArray,
                    x: Number(r.x) || 0,
                    y: Number(r.y) || 0,
                    pixelSizeMm: Number(r.pixelSizeMm) || 1,
                })) : [],
                viewport: {
                    zoom: Math.max(0.1, Math.min(10, Number(raw?.viewport?.zoom ?? 1))),
                    panX: Number(raw?.viewport?.panX ?? 0),
                    panY: Number(raw?.viewport?.panY ?? 0),
                },
                selection: {
                    selectedEntityId: raw?.selection?.selectedEntityId ?? null,
                    selectedRasterId: raw?.selection?.selectedRasterId ?? null,
                    isDraggingViewport: false,
                    isDraggingEntity: false,
                    isDraggingRaster: false,
                    isResizingEntity: false,
                    dragStartX: 0,
                    dragStartY: 0,
                    resizeHandle: null,
                }
            };
            this.state = next;
            this.notify();
        } catch {
            // If anything goes wrong, keep current state
        }
    }

    private deserializeTypedArray(input: any): Uint8ClampedArray {
        // Accept either already a typed array, a plain array, or an encoded object
        if (input instanceof Uint8ClampedArray) return input;
        if (Array.isArray(input)) return new Uint8ClampedArray(input);
        if (input && typeof input === 'object') {
            // Handle encoded form { __type: 'TypedArray', constructor: 'Uint8ClampedArray', data: number[] }
            if (input.__type === 'TypedArray' && input.constructorName === 'Uint8ClampedArray' && Array.isArray(input.data)) {
                return new Uint8ClampedArray(input.data);
            }
        }
        return new Uint8ClampedArray();
    }
}

