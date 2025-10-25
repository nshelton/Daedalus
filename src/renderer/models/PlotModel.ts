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
    // Filter chain state
    filters?: import('../../types').FilterInstance[];
    previewIndex?: number | null;
}

// Unified layer abstraction (derived from legacy rasters/entities for now)
export interface Layer {
    id: string; // 'r:<rasterId>' or 'e:<entityId>'
    kind: 'raster' | 'paths';
    x: number;
    y: number;
    // Raster-only
    width?: number;
    height?: number;
    pixelSizeMm?: number;
    filters?: import('../../types').FilterInstance[];
    previewIndex?: number | null;
    // Paths-only
    paths?: [number, number][][];
}

interface ViewportState {
    zoom: number;
    panX: number;
    panY: number;
}

interface SelectionState {
    selectedLayerId: string | null;
    isDraggingViewport: boolean;
    isDraggingSelected: boolean;
    isResizingSelected: boolean;
    dragStartX: number;
    dragStartY: number;
    resizeHandle: string | null;
}

interface RenderOptions {
    darkMode: boolean;
    showNodeDots: boolean;
}

interface PlotState {
    entities: PlotEntity[];
    rasters: Raster[];
    viewport: ViewportState;
    selection: SelectionState;
    render: RenderOptions;
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
            selectedLayerId: null,
            isDraggingViewport: false,
            isDraggingSelected: false,
            isResizingSelected: false,
            dragStartX: 0,
            dragStartY: 0,
            resizeHandle: null
        },
        render: {
            darkMode: true,
            showNodeDots: true
        }
    };

    // Simple pub/sub for views to react to model changes
    private listeners: Set<() => void> = new Set();
    // Runtime flag: not serialized; indicates whether viewport came from user/persisted state
    private viewportInitialized: boolean = false;

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
        if (this.state.selection.selectedLayerId === `e:${id}`) {
            this.state.selection.selectedLayerId = null;
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
        if (this.state.selection.selectedLayerId?.startsWith('e:')) {
            this.state.selection.selectedLayerId = null;
        }
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
        if (this.state.selection.selectedLayerId === `r:${id}`) {
            this.state.selection.selectedLayerId = null;
        }
        this.notify();
    }

    clearRasters(): void {
        this.state.rasters = [];
        if (this.state.selection.selectedLayerId?.startsWith('r:')) {
            this.state.selection.selectedLayerId = null;
        }
        this.notify();
    }

    // === Viewport Management ===

    getViewport(): ViewportState {
        return { ...this.state.viewport };
    }

    setZoom(zoom: number): void {
        this.viewportInitialized = true;
        this.state.viewport.zoom = Math.max(0.1, Math.min(100, zoom));
        this.notify();
    }

    getZoom(): number {
        return this.state.viewport.zoom;
    }

    setPan(panX: number, panY: number): void {
        this.viewportInitialized = true;
        this.state.viewport.panX = panX;
        this.state.viewport.panY = panY;
        this.notify();
    }

    getPan(): [number, number] {
        return [this.state.viewport.panX, this.state.viewport.panY];
    }

    // === Selection Management ===

    // === Drag State Management ===

    setDraggingViewport(isDragging: boolean): void {
        this.state.selection.isDraggingViewport = isDragging;
        this.notify();
    }

    isDraggingViewport(): boolean {
        return this.state.selection.isDraggingViewport;
    }

    isDraggingSelected(): boolean {
        return this.state.selection.isDraggingSelected;
    }

    setDraggingSelected(isDragging: boolean): void {
        this.state.selection.isDraggingSelected = isDragging;
        this.notify();
    }

    isResizingSelected(): boolean {
        return this.state.selection.isResizingSelected;
    }

    setResizingSelected(isResizing: boolean): void {
        this.state.selection.isResizingSelected = isResizing;
        this.notify();
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

    // === Selected Layer Id ===

    // === Complete State ===

    getState(): Readonly<PlotState> {
        return {
            entities: [...this.state.entities],
            rasters: [...this.state.rasters],
            viewport: { ...this.state.viewport },
            selection: { ...this.state.selection },
            render: { ...this.state.render }
        };
    }

    isViewportInitialized(): boolean {
        return this.viewportInitialized;
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
                selectedLayerId: null,
                isDraggingViewport: false,
                isDraggingSelected: false,
                isResizingSelected: false,
                dragStartX: 0,
                dragStartY: 0,
                resizeHandle: null
            },
            render: {
                darkMode: true,
                showNodeDots: true
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
                    filters: Array.isArray(r.filters) ? r.filters.map((f: any) => ({
                        instanceId: String(f.instanceId ?? ''),
                        defId: String(f.defId ?? ''),
                        enabled: Boolean(f.enabled ?? true),
                        visible: Boolean(f.visible ?? false),
                        params: f.params ?? {},
                        io: { input: (f.io?.input ?? 'raster'), output: (f.io?.output ?? 'bitmap') }
                    })) : [],
                    previewIndex: (typeof r.previewIndex === 'number' ? r.previewIndex : null)
                })) : [],
                viewport: {
                    zoom: Math.max(0.1, Math.min(100, Number(raw?.viewport?.zoom ?? 1))),
                    panX: Number(raw?.viewport?.panX ?? 0),
                    panY: Number(raw?.viewport?.panY ?? 0),
                },
                selection: {
                    selectedLayerId: (typeof raw?.selection?.selectedLayerId === 'string') ? raw.selection.selectedLayerId : null,
                    isDraggingViewport: false,
                    isDraggingSelected: false,
                    isResizingSelected: false,
                    dragStartX: 0,
                    dragStartY: 0,
                    resizeHandle: null,
                },
                render: {
                    darkMode: Boolean(raw?.render?.darkMode ?? true),
                    showNodeDots: Boolean(raw?.render?.showNodeDots ?? true)
                }
            };
            // Loaded from persisted state; respect provided viewport
            this.viewportInitialized = true;
            this.state = next;
            this.notify();
        } catch {
            // If anything goes wrong, keep current state
        }
    }

    // === Render Options ===
    getRenderOptions(): Readonly<RenderOptions> {
        return { ...this.state.render };
    }

    isDarkMode(): boolean {
        return this.state.render.darkMode;
    }

    isShowNodeDots(): boolean {
        return this.state.render.showNodeDots;
    }

    setDarkMode(value: boolean): void {
        this.state.render.darkMode = Boolean(value);
        this.notify();
    }

    setShowNodeDots(value: boolean): void {
        this.state.render.showNodeDots = Boolean(value);
        this.notify();
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

    // ===== Unified Layer API (derived view) =====
    getLayers(): Layer[] {
        const layers: Layer[] = [];
        for (const r of this.state.rasters) {
            layers.push({ id: `r:${r.id}`, kind: 'raster', x: r.x, y: r.y, width: r.width, height: r.height, pixelSizeMm: r.pixelSizeMm, filters: r.filters, previewIndex: r.previewIndex });
        }
        for (const e of this.state.entities) {
            layers.push({ id: `e:${e.id}`, kind: 'paths', x: 0, y: 0, paths: e.paths });
        }
        return layers;
    }

    getSelectedLayerId(): string | null {
        return this.state.selection.selectedLayerId ?? null;
    }

    setSelectedLayerId(layerId: string | null): void {
        this.state.selection.selectedLayerId = layerId;
        this.notify();
    }

    getLayerBounds(layer: Layer): { x: number; y: number; width: number; height: number } {
        if (layer.kind === 'raster') {
            const widthMm = (layer.width ?? 0) * (layer.pixelSizeMm ?? 1);
            const heightMm = (layer.height ?? 0) * (layer.pixelSizeMm ?? 1);
            return { x: layer.x, y: layer.y, width: widthMm, height: heightMm };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const path of (layer.paths ?? [])) {
            for (const [x, y] of path) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        if (!isFinite(minX) || !isFinite(minY)) return { x: 0, y: 0, width: 0, height: 0 };
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
}

