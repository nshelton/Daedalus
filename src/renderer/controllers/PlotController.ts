import { PlotModel, PlotEntity } from '../models/PlotModel';
import { ViewportController } from '../controllers/ViewportController';

export type ResizeHandleId = 'nw' | 'ne' | 'sw' | 'se';

export interface PlotControllerOptions {
    onChange?: () => void;
    gridEnabled?: boolean;
    gridSizeMm?: number;
}

/**
 * PlotController (Renderer)
 *
 * Controller responsible for manipulating plot entities in the renderer process.
 * It wires the model to the view (canvas) by attaching input handlers and
 * exposes high-level operations for creation, selection, transform, and viewport.
 */
export class PlotController {
    private readonly model: PlotModel;
    private readonly viewport: ViewportController;
    private readonly canvas: HTMLCanvasElement;
    private readonly onChange?: () => void;

    // Selection & interaction state
    private selectedEntityId: string | null = null;
    private isDraggingViewport = false;
    private isDraggingEntity = false;
    private isResizingEntity = false;
    private activeResizeHandle: ResizeHandleId | null = null;
    private dragStartScreenX = 0;
    private dragStartScreenY = 0;

    // Grid state (rendering left to the view; controller stores settings)
    private gridEnabled: boolean;
    private gridSizeMm: number;

    constructor(model: PlotModel, viewport: ViewportController, canvas: HTMLCanvasElement, options: PlotControllerOptions = {}) {
        this.model = model;
        this.viewport = viewport;
        this.canvas = canvas;
        this.onChange = options.onChange;
        this.gridEnabled = options.gridEnabled ?? true;
        this.gridSizeMm = options.gridSizeMm ?? 10;

        this.attachEventListeners();
    }

    // ===== Public getters =====
    getSelectedEntityId(): string | null {
        return this.selectedEntityId;
    }

    getGridEnabled(): boolean {
        return this.gridEnabled;
    }

    getGridSizeMm(): number {
        return this.gridSizeMm;
    }

    // ===== Element operations =====
    createCircle(cx: number, cy: number, radius: number): string {
        const path: [number, number][] = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            path.push([x, y]);
        }
        const entity: PlotEntity = { id: this.generateId('circle'), paths: [path] };
        this.model.addEntity(entity);
        this.selectedEntityId = entity.id;
        this.requestRender();
        return entity.id;
    }

    createRect(x: number, y: number, width: number, height: number): string {
        const path: [number, number][] = [];
        path.push([x, y]);
        path.push([x + width, y]);
        path.push([x + width, y + height]);
        path.push([x, y + height]);
        path.push([x, y]);
        const entity: PlotEntity = { id: this.generateId('rect'), paths: [path] };
        this.model.addEntity(entity);
        this.selectedEntityId = entity.id;
        this.requestRender();
        return entity.id;
    }

    createPath(paths: [number, number][][]): string {
        const nonEmpty = paths.filter(p => p.length > 0);
        const entity: PlotEntity = { id: this.generateId('path'), paths: nonEmpty };
        this.model.addEntity(entity);
        this.selectedEntityId = entity.id;
        this.requestRender();
        return entity.id;
    }

    deleteSelected(): void {
        if (!this.selectedEntityId) return;
        this.model.removeEntity(this.selectedEntityId);
        this.selectedEntityId = null;
        this.requestRender();
    }

    // ===== Drag operations =====
    startDrag(screenX: number, screenY: number): void {
        const [worldX, worldY] = this.screenToWorld(screenX, screenY);
        this.dragStartScreenX = screenX;
        this.dragStartScreenY = screenY;

        // Check if starting resize on selected entity
        if (this.selectedEntityId) {
            const entity = this.model.getEntity(this.selectedEntityId);
            if (entity) {
                const bounds = this.getEntityBounds(entity);
                const handle = this.getHandleAtPosition(bounds, worldX, worldY);
                if (handle) {
                    this.isResizingEntity = true;
                    this.activeResizeHandle = handle;
                    return;
                }
            }
        }

        // Otherwise, test selection or start panning
        const entity = this.getEntityAt(worldX, worldY);
        if (entity) {
            this.selectedEntityId = entity.id;
            this.isDraggingEntity = true;
        } else {
            this.selectedEntityId = null;
            this.isDraggingViewport = true;
        }
    }

    drag(screenX: number, screenY: number): void {
        const [worldX, worldY] = this.screenToWorld(screenX, screenY);

        if (this.isDraggingViewport) {
            const dx = screenX - this.dragStartScreenX;
            const dy = screenY - this.dragStartScreenY;
            this.viewport.adjustPan(dx, dy);
            this.dragStartScreenX = screenX;
            this.dragStartScreenY = screenY;
            this.requestRender();
            return;
        }

        if (this.isDraggingEntity && this.selectedEntityId) {
            const entity = this.model.getEntity(this.selectedEntityId);
            if (!entity) return;
            const [prevWorldX, prevWorldY] = this.screenToWorld(this.dragStartScreenX, this.dragStartScreenY);
            const dx = worldX - prevWorldX;
            const dy = worldY - prevWorldY;
            entity.paths = entity.paths.map((path: [number, number][]) => path.map(([x, y]: [number, number]) => [x + dx, y + dy] as [number, number]));
            this.model.updateEntity(entity.id, { paths: entity.paths });
            this.dragStartScreenX = screenX;
            this.dragStartScreenY = screenY;
            this.requestRender();
            return;
        }

        if (this.isResizingEntity && this.selectedEntityId && this.activeResizeHandle) {
            const entity = this.model.getEntity(this.selectedEntityId);
            if (!entity) return;
            this.applyResize(entity, this.activeResizeHandle, worldX, worldY);
            this.model.updateEntity(entity.id, { paths: entity.paths });
            this.requestRender();
            return;
        }
    }

    endDrag(): void {
        this.isDraggingViewport = false;
        this.isDraggingEntity = false;
        this.isResizingEntity = false;
        this.activeResizeHandle = null;
    }

    // ===== Resize operations =====
    startResize(handle: ResizeHandleId): void {
        if (!this.selectedEntityId) return;
        this.isResizingEntity = true;
        this.activeResizeHandle = handle;
    }

    resize(screenX: number, screenY: number): void {
        if (!this.isResizingEntity || !this.selectedEntityId || !this.activeResizeHandle) return;
        const entity = this.model.getEntity(this.selectedEntityId);
        if (!entity) return;
        const [worldX, worldY] = this.screenToWorld(screenX, screenY);
        this.applyResize(entity, this.activeResizeHandle, worldX, worldY);
        this.model.updateEntity(entity.id, { paths: entity.paths });
        this.requestRender();
    }

    endResize(): void {
        this.isResizingEntity = false;
        this.activeResizeHandle = null;
    }

    // ===== Viewport operations =====
    pan(deltaScreenX: number, deltaScreenY: number): void {
        this.viewport.adjustPan(deltaScreenX, deltaScreenY);
        this.requestRender();
    }

    zoom(delta: number, centerScreenX: number, centerScreenY: number): void {
        this.viewport.adjustZoom(delta, centerScreenX, centerScreenY);
        this.requestRender();
    }

    resetView(): void {
        this.viewport.reset();
        this.requestRender();
    }

    // ===== Selection =====
    selectElementAt(screenX: number, screenY: number): string | null {
        const [worldX, worldY] = this.screenToWorld(screenX, screenY);
        const entity = this.getEntityAt(worldX, worldY);
        this.selectedEntityId = entity ? entity.id : null;
        this.requestRender();
        return this.selectedEntityId;
    }

    clearSelection(): void {
        this.selectedEntityId = null;
        this.requestRender();
    }

    // ===== Grid =====
    toggleGrid(): void {
        this.gridEnabled = !this.gridEnabled;
        this.requestRender();
    }

    setGridSize(sizeMm: number): void {
        this.gridSizeMm = Math.max(1, Math.round(sizeMm));
        this.requestRender();
    }

    // ===== Test pattern =====
    generateTestPattern(originX: number, originY: number): string {
        const paths: [number, number][][] = [];
        // Axes
        const axisLen = 100;
        const arrow = 10;
        const xEnd: [number, number] = [originX + axisLen, originY];
        paths.push([[originX, originY], xEnd]);
        paths.push([xEnd, [xEnd[0] - arrow, xEnd[1] + arrow * 0.3]]);
        paths.push([xEnd, [xEnd[0] - arrow, xEnd[1] - arrow * 0.3]]);
        const yEnd: [number, number] = [originX, originY + axisLen];
        paths.push([[originX, originY], yEnd]);
        paths.push([yEnd, [yEnd[0] + arrow * 0.3, yEnd[1] - arrow]]);
        paths.push([yEnd, [yEnd[0] - arrow * 0.3, yEnd[1] - arrow]]);
        // Concentric circles
        for (let r = 10; r <= 40; r += 10) {
            const circleId = this.createCircle(originX, originY, r);
            // Merge circle paths into the pattern entity after creation
            const circleEntity = this.model.getEntity(circleId);
            if (circleEntity) paths.push(...circleEntity.paths);
            this.model.removeEntity(circleId);
        }
        return this.createPath(paths);
    }

    // ===== Keyboard shortcuts =====
    private handleKeyDown = (e: KeyboardEvent): void => {
        // Delete selection
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelected();
            return;
        }
        // Toggle grid Ctrl/Cmd+G
        if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
            e.preventDefault();
            this.toggleGrid();
            return;
        }
        // Reset view (0)
        if (e.key === '0') {
            this.resetView();
            return;
        }
        // Pan with arrow keys
        const panStep = 20;
        if (e.key === 'ArrowLeft') { this.pan(-panStep, 0); return; }
        if (e.key === 'ArrowRight') { this.pan(panStep, 0); return; }
        if (e.key === 'ArrowUp') { this.pan(0, -panStep); return; }
        if (e.key === 'ArrowDown') { this.pan(0, panStep); return; }
        // Zoom +/-
        if (e.key === '+' || e.key === '=') { this.zoom(0.1, this.canvas.width / 2, this.canvas.height / 2); return; }
        if (e.key === '-' || e.key === '_') { this.zoom(-0.1, this.canvas.width / 2, this.canvas.height / 2); return; }
    };

    // ===== Private helpers =====
    private attachEventListeners(): void {
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const delta = -e.deltaY * 0.001;
            this.zoom(delta, x, y);
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) return; // right-click reserved for context menus
            const rect = this.canvas.getBoundingClientRect();
            this.startDrag(e.clientX - rect.left, e.clientY - rect.top);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.drag(e.clientX - rect.left, e.clientY - rect.top);
        });

        const endDrag = () => this.endDrag();
        this.canvas.addEventListener('mouseup', endDrag);
        this.canvas.addEventListener('mouseleave', endDrag);

        document.addEventListener('keydown', this.handleKeyDown);
    }

    private requestRender(): void {
        if (this.onChange) this.onChange();
    }

    private screenToWorld(screenX: number, screenY: number): [number, number] {
        const [panX, panY] = this.viewport.getPan();
        const zoom = this.viewport.getZoom();
        return [
            (screenX - panX) / zoom,
            -(screenY - panY) / zoom
        ];
    }

    private getEntityAt(xWorld: number, yWorld: number): PlotEntity | null {
        const entities = this.model.getEntities();
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            const b = this.getEntityBounds(entity);
            if (xWorld >= b.x && xWorld <= b.x + b.width && yWorld >= b.y && yWorld <= b.y + b.height) {
                return entity;
            }
        }
        return null;
    }

    private getEntityBounds(entity: PlotEntity): { x: number; y: number; width: number; height: number } {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        entity.paths.forEach((path: [number, number][]) => {
            path.forEach(([x, y]: [number, number]) => {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            });
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    private getResizeHandles(bounds: { x: number; y: number; width: number; height: number }): { id: ResizeHandleId; x: number; y: number }[] {
        return [
            { id: 'nw', x: bounds.x, y: bounds.y },
            { id: 'ne', x: bounds.x + bounds.width, y: bounds.y },
            { id: 'sw', x: bounds.x, y: bounds.y + bounds.height },
            { id: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        ];
    }

    private getHandleAtPosition(bounds: { x: number; y: number; width: number; height: number }, x: number, y: number): ResizeHandleId | null {
        const handleSizeWorld = 8 / this.viewport.getZoom();
        const handles = this.getResizeHandles(bounds);
        for (const h of handles) {
            if (Math.abs(x - h.x) < handleSizeWorld && Math.abs(y - h.y) < handleSizeWorld) {
                return h.id;
            }
        }
        return null;
    }

    private applyResize(entity: PlotEntity, handle: ResizeHandleId, worldX: number, worldY: number): void {
        const oldBounds = this.getEntityBounds(entity);
        const minSize = 10;
        let newBounds = { ...oldBounds };
        let scaleFactor: number = 1;

        const dist = (x0: number, y0: number, x1: number, y1: number) => Math.hypot(x1 - x0, y1 - y0);

        switch (handle) {
            case 'se': {
                const d = dist(worldX, worldY, oldBounds.x, oldBounds.y);
                const d0 = dist(oldBounds.x + oldBounds.width, oldBounds.y + oldBounds.height, oldBounds.x, oldBounds.y);
                scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), d / d0);
                newBounds.width = oldBounds.width * scaleFactor;
                newBounds.height = oldBounds.height * scaleFactor;
                break;
            }
            case 'sw': {
                const d = dist(oldBounds.x + oldBounds.width, worldY, worldX, oldBounds.y);
                const d0 = dist(oldBounds.x + oldBounds.width, oldBounds.y + oldBounds.height, oldBounds.x + oldBounds.width, oldBounds.y);
                scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), d / d0);
                newBounds.width = oldBounds.width * scaleFactor;
                newBounds.height = oldBounds.height * scaleFactor;
                newBounds.x = oldBounds.x + oldBounds.width - newBounds.width;
                break;
            }
            case 'ne': {
                const d = dist(worldX, oldBounds.y + oldBounds.height, oldBounds.x, worldY);
                const d0 = dist(oldBounds.x + oldBounds.width, oldBounds.y + oldBounds.height, oldBounds.x, oldBounds.y + oldBounds.height);
                scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), d / d0);
                newBounds.width = oldBounds.width * scaleFactor;
                newBounds.height = oldBounds.height * scaleFactor;
                newBounds.y = oldBounds.y + oldBounds.height - newBounds.height;
                break;
            }
            case 'nw': {
                const d = dist(oldBounds.x + oldBounds.width, oldBounds.y + oldBounds.height, worldX, worldY);
                const d0 = dist(oldBounds.x + oldBounds.width, oldBounds.y + oldBounds.height, oldBounds.x, oldBounds.y);
                scaleFactor = Math.max(minSize / Math.min(oldBounds.width, oldBounds.height), d / d0);
                newBounds.width = oldBounds.width * scaleFactor;
                newBounds.height = oldBounds.height * scaleFactor;
                newBounds.x = oldBounds.x + oldBounds.width - newBounds.width;
                newBounds.y = oldBounds.y + oldBounds.height - newBounds.height;
                break;
            }
        }

        entity.paths = entity.paths.map((path: [number, number][]) => path.map(([x, y]: [number, number]) => {
            const relX = (x - oldBounds.x) * scaleFactor;
            const relY = (y - oldBounds.y) * scaleFactor;
            return [newBounds.x + relX, newBounds.y + relY] as [number, number];
        }));
    }

    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    }
}

export default PlotController;


