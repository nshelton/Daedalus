import { PlotModel } from "../models/PlotModel.js";
import type { PlotEntity, Raster } from "../models/PlotModel.js";
import { RasterUtils } from "../RasterUtils.js";
import { PathTools } from "../PathTools.js";
import { ContextMenuController } from "../controllers/ContextMenuController.js";
import FilterRegistry from '../controllers/FilterRegistry.js';
import FilterChainController from '../controllers/FilterChainController.js';
import type { PathLike } from '../../types';

export class CanvasView {

    // A3 dimensions in mm
    private A3_WIDTH_MM = 297;
    private A3_HEIGHT_MM = 420;

    // Render flags now come from PlotModel.render

    private plotModel: PlotModel;
    private canvas = document.getElementById('plot-canvas') as HTMLCanvasElement;
    private contextMenuController: ContextMenuController;
    private rasterBitmapCache: Map<string, ImageBitmap> = new Map();
    private rasterBitmapLoading: Set<string> = new Set();
    private filterRegistry?: FilterRegistry;
    private filterChain?: FilterChainController;
    private rasterPathPreview: Map<string, PathLike[]> = new Map();

    constructor(plotModel: PlotModel, contextMenuController: ContextMenuController, filterRegistry?: FilterRegistry, filterChain?: FilterChainController) {
        this.plotModel = plotModel;
        this.contextMenuController = contextMenuController;
        this.filterRegistry = filterRegistry;
        this.filterChain = filterChain;
    }

    setupEventListeners(): void {
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        this.canvas.addEventListener('dragover', this.handleDragOver.bind(this));
        this.canvas.addEventListener('drop', this.handleDrop.bind(this));
    }

    // Canvas setup and rendering
    setupCanvas(): void {
        this.canvas = document.getElementById('plot-canvas') as HTMLCanvasElement;
        const container = this.canvas.parentElement!;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        // Hide placeholder, show canvas
        this.canvas.style.display = 'block';
        // Hint: crisp when zooming in; we'll still switch dynamically per draw
        (this.canvas.style as any).imageRendering = 'auto';

        // Position viewport so (0,0) is bottom-left of A3 paper
        // Center the paper on screen with some padding
        const padding = 50;
        const panX = padding;
        const panY = this.canvas.height - padding;
        const zoom = Math.min(
            (this.canvas.width - padding * 2) / this.A3_WIDTH_MM,
            (this.canvas.height - padding * 2) / this.A3_HEIGHT_MM
        );
        this.plotModel.setPan(panX, panY);
        this.plotModel.setZoom(zoom);

        // Start render loop
        requestAnimationFrame(() => this.render());

        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.render();
        });

        this.setupEventListeners();
    }

    render(): void {
        const ctx = this.canvas.getContext('2d')!;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Fill background (theme)
        const dark = this.plotModel.isDarkMode ? this.plotModel.isDarkMode() : true;
        ctx.fillStyle = dark ? '#0b0b0b' : '#ffffff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const [panX, panY] = this.plotModel.getPan();
        const zoom = this.plotModel.getZoom();

        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);

        // Draw A3 paper
        this.drawA3Paper(zoom, ctx);

        // Draw rasters first (with filter preview if available)
        this.drawRasters(ctx);

        // Draw entities
        const entities = this.plotModel.getEntities();
        const selectedEntityId = this.plotModel.getSelectedEntityId();
        entities.forEach(entity => {
            this.drawEntity(entity, entity.id === selectedEntityId, zoom, ctx);
        });

        ctx.restore();

        requestAnimationFrame(this.render.bind(this));
    }

    async ensureRasterBitmap(id: string): Promise<void> {
        if (this.rasterBitmapCache.has(id) || this.rasterBitmapLoading.has(id)) return;
        this.rasterBitmapLoading.add(id);
        try {
            const raster = this.plotModel.getRasters().find(r => r.id === id);
            if (!raster) return;
            const bmp = await RasterUtils.rasterToImageBitmap(raster);
            this.rasterBitmapCache.set(id, bmp);
        } catch (err) {
            console.error('Failed to build raster bitmap', err);
        } finally {
            this.rasterBitmapLoading.delete(id);
        }
    }

    drawRasters(ctx: CanvasRenderingContext2D): void {
        const rasters = this.plotModel.getRasters();
        const selectedRasterId = this.plotModel.getSelectedRasterId?.() ? this.plotModel.getSelectedRasterId() : null;
        const dark = this.plotModel.isDarkMode ? this.plotModel.isDarkMode() : true;
        for (const r of rasters) {
            // If previewing a bitmap stage via filter chain, draw that instead
            let bmp = this.rasterBitmapCache.get(r.id);
            let baseKey = r.id;
            if (this.filterChain) {
                // async fetch preview but draw cached while waiting
                this.filterChain.evaluatePreview(r.id).then(preview => {
                    if (!preview) return;
                    if (preview.kind === 'paths') {
                        this.rasterPathPreview.set(r.id, preview.value as PathLike[]);
                        // Clear any bitmap preview
                        this.rasterBitmapCache.delete(r.id + ':preview');
                    } else {
                        this.rasterPathPreview.delete(r.id);
                        // convert ImageData to ImageBitmap and cache under special key
                        const imageData = preview.value as ImageData;
                        (async () => {
                            // Force grayscale
                            const gray = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
                            const d = gray.data;
                            for (let i = 0; i < d.length; i += 4) {
                                const rr = d[i], gg = d[i + 1], bb = d[i + 2];
                                const v = Math.round(0.299 * rr + 0.587 * gg + 0.114 * bb);
                                d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = (v === 255) ? 0 : 255;
                            }
                            const cv = document.createElement('canvas');
                            cv.width = gray.width; cv.height = gray.height;
                            const c2 = cv.getContext('2d')!;
                            c2.putImageData(gray, 0, 0);
                            const b = await createImageBitmap(cv);
                            this.rasterBitmapCache.set(r.id + ':preview', b);
                        })();
                    }
                }).catch(() => { });
                // If we have path preview, draw the paths and also selection outline/handles
                const p = this.rasterPathPreview.get(r.id);
                if (p && p.length) {
                    this.drawPathsForRaster(ctx, r, p);

                    // Draw selection outline for rasters even in path-preview mode
                    if (selectedRasterId === r.id) {
                        ctx.save();
                        const zoomSel = this.plotModel.getZoom();
                        const widthMmSel = r.width * r.pixelSizeMm;
                        const heightMmSel = r.height * r.pixelSizeMm;
                        ctx.strokeStyle = '#22c55e';
                        ctx.lineWidth = 2 / zoomSel;
                        ctx.strokeRect(r.x, -(r.y + heightMmSel), widthMmSel, heightMmSel);
                        const handleSize = 8 / zoomSel;
                        ctx.fillStyle = '#22c55e';
                        const nw = { x: r.x, y: r.y + heightMmSel };
                        const ne = { x: r.x + widthMmSel, y: r.y + heightMmSel };
                        const sw = { x: r.x, y: r.y };
                        const se = { x: r.x + widthMmSel, y: r.y };
                        const corners = [nw, ne, sw, se];
                        for (const c of corners) {
                            ctx.fillRect(c.x - handleSize / 2, -c.y - handleSize / 2, handleSize, handleSize);
                        }
                        ctx.restore();
                    }
                    continue;
                }
                const pbmp = this.rasterBitmapCache.get(r.id + ':preview');
                if (pbmp) { bmp = pbmp; baseKey = r.id + ':preview'; }
            }
            if (!bmp) { this.ensureRasterBitmap(r.id); continue; }

            // Dark-mode variant tinting (white ink)
            if (dark) {
                const darkKey = baseKey + ':dark';
                const darkBmp = this.rasterBitmapCache.get(darkKey);
                if (darkBmp) {
                    bmp = darkBmp;
                    baseKey = darkKey;
                } else {
                    // Build lazily
                    this.ensureDarkTintedBitmap(baseKey);
                }
            }
            const widthMm = r.width * r.pixelSizeMm;
            const heightMm = r.height * r.pixelSizeMm;
            const zoom = this.plotModel.getZoom();
            const screenPxPerSrcPx = r.pixelSizeMm * zoom; // <1 downscale, >1 upscale
            // Choose mip level for strong downscale to reduce aliasing
            let level = 0;
            if (screenPxPerSrcPx < 0.5) {
                level = Math.min(8, Math.max(1, Math.floor(Math.log2(1 / screenPxPerSrcPx))));
                const mipKey = baseKey + '@' + level;
                const mipBmp = this.rasterBitmapCache.get(mipKey);
                if (mipBmp) {
                    bmp = mipBmp;
                } else {
                    if (baseKey.endsWith(':preview') || baseKey.endsWith(':dark')) {
                        this.ensureBitmapMipmap(baseKey, level);
                    } else {
                        this.ensureRasterMipmap(r.id, level);
                    }
                }
            }

            ctx.save();
            // Flip Y to match world coordinates (0,0 bottom-left)
            // ctx.scale(1, -1);
            // Dynamic sampling: point when zooming in, smooth when zooming out
            const smoothing = screenPxPerSrcPx < 1;
            (ctx as any).imageSmoothingEnabled = smoothing;
            if ('imageSmoothingQuality' in ctx) (ctx as any).imageSmoothingQuality = smoothing ? 'high' : 'low';
            ctx.drawImage(bmp, r.x, -(r.y + heightMm), widthMm, heightMm);
            // Selection outline for rasters
            if (selectedRasterId === r.id) {
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2 / this.plotModel.getZoom();
                ctx.strokeRect(r.x, -(r.y + heightMm), widthMm, heightMm);

                // Draw resize handles (nw, ne, sw, se) similar to entities
                const handleSize = 8 / this.plotModel.getZoom();
                ctx.fillStyle = '#22c55e';
                // world corners
                const nw = { x: r.x, y: r.y + heightMm };
                const ne = { x: r.x + widthMm, y: r.y + heightMm };
                const sw = { x: r.x, y: r.y };
                const se = { x: r.x + widthMm, y: r.y };
                const corners = [nw, ne, sw, se];
                for (const c of corners) {
                    const cx = c.x;
                    const cyCanvas = -c.y;
                    ctx.fillRect(cx - handleSize / 2, cyCanvas - handleSize / 2, handleSize, handleSize);
                }
            }
            ctx.restore();
        }
    }

    private async ensureRasterMipmap(id: string, level: number): Promise<void> {
        await this.ensureBitmapMipmap(id, level);
    }

    private async ensureBitmapMipmap(baseKey: string, level: number): Promise<void> {
        const key = baseKey + '@' + level;
        if (this.rasterBitmapCache.has(key) || this.rasterBitmapLoading.has(key)) return;
        this.rasterBitmapLoading.add(key);
        try {
            // Ensure base bitmap exists for rasters
            if (!this.rasterBitmapCache.has(baseKey)) {
                // If it refers to a raw raster id, try building it
                if (!baseKey.endsWith(':preview') && !baseKey.endsWith(':dark')) {
                    await this.ensureRasterBitmap(baseKey);
                } else {
                    // For preview, skip until it exists
                    return;
                }
            }
            const base = this.rasterBitmapCache.get(baseKey);
            if (!base) return;
            const scale = Math.pow(0.5, level);
            const targetW = Math.max(1, Math.floor(base.width * scale));
            const targetH = Math.max(1, Math.floor(base.height * scale));
            const cv = document.createElement('canvas');
            cv.width = targetW; cv.height = targetH;
            const c2 = cv.getContext('2d')!;
            (c2 as any).imageSmoothingEnabled = true;
            if ('imageSmoothingQuality' in c2) (c2 as any).imageSmoothingQuality = 'high';
            c2.drawImage(base, 0, 0, targetW, targetH);
            const mip = await createImageBitmap(cv);
            this.rasterBitmapCache.set(key, mip);
        } catch {
            // ignore
        } finally {
            this.rasterBitmapLoading.delete(key);
        }
    }

    private async ensureDarkTintedBitmap(baseKey: string): Promise<void> {
        const darkKey = baseKey + ':dark';
        if (this.rasterBitmapCache.has(darkKey) || this.rasterBitmapLoading.has(darkKey)) return;
        this.rasterBitmapLoading.add(darkKey);
        try {
            // Make sure base bitmap exists
            if (!this.rasterBitmapCache.has(baseKey)) {
                if (!baseKey.endsWith(':preview')) {
                    await this.ensureRasterBitmap(baseKey);
                } else {
                    return;
                }
            }
            const base = this.rasterBitmapCache.get(baseKey);
            if (!base) return;
            const cv = document.createElement('canvas');
            cv.width = base.width; cv.height = base.height;
            const c2 = cv.getContext('2d')!;
            c2.clearRect(0, 0, cv.width, cv.height);
            c2.drawImage(base, 0, 0);
            c2.globalCompositeOperation = 'source-in';
            c2.fillStyle = '#ffffff';
            c2.fillRect(0, 0, cv.width, cv.height);
            const tinted = await createImageBitmap(cv);
            this.rasterBitmapCache.set(darkKey, tinted);
        } catch {
            // ignore
        } finally {
            this.rasterBitmapLoading.delete(darkKey);
        }
    }

    private drawPathsForRaster(ctx: CanvasRenderingContext2D, r: Raster, paths: PathLike[]): void {
        ctx.save();
        ctx.scale(1, -1);
        const zoom = this.plotModel.getZoom();
        const dark = this.plotModel.isDarkMode ? this.plotModel.isDarkMode() : true;
        ctx.strokeStyle = dark ? '#ffffff' : '#000000';
        ctx.lineWidth = 1.5 / zoom;
        for (const path of paths) {
            if (!path.length) continue;
            ctx.beginPath();
            const [x0, y0] = path[0];
            ctx.moveTo(r.x + x0 * r.pixelSizeMm, r.y + y0 * r.pixelSizeMm);
            for (let i = 1; i < path.length; i++) {
                const [px, py] = path[i];
                ctx.lineTo(r.x + px * r.pixelSizeMm, r.y + py * r.pixelSizeMm);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    drawA3Paper(zoom: number, ctx: CanvasRenderingContext2D): void {
        const dark = this.plotModel.isDarkMode ? this.plotModel.isDarkMode() : true;
        const paperFill = dark ? '#0f0f0f' : '#ffffff';
        const paperStroke = dark ? '#444444' : '#666666';
        const gridStroke = dark ? '#2a2a2a' : '#e0e0e0';
        ctx.fillStyle = paperFill;
        ctx.strokeStyle = paperStroke;
        ctx.lineWidth = 2 / zoom;

        // Paper origin at (0, 0) - bottom-left corner in plotter coordinates
        // Canvas Y increases downward, so we need to flip for plotter coords
        ctx.save();
        ctx.scale(1, -1); // Flip Y axis so plotter (0,0) is bottom-left

        const x = 0;
        const y = 0;

        ctx.fillRect(x, y, this.A3_WIDTH_MM, this.A3_HEIGHT_MM);
        ctx.strokeRect(x, y, this.A3_WIDTH_MM, this.A3_HEIGHT_MM);

        // Draw grid
        ctx.strokeStyle = gridStroke;
        ctx.lineWidth = 0.5 / zoom;

        const gridSize = 10; // 10mm grid
        for (let i = x; i <= x + this.A3_WIDTH_MM; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, y);
            ctx.lineTo(i, y + this.A3_HEIGHT_MM);
            ctx.stroke();
        }

        for (let i = y; i <= y + this.A3_HEIGHT_MM; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, i);
            ctx.lineTo(x + this.A3_WIDTH_MM, i);
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

    drawEntity(entity: PlotEntity, isSelected: boolean, zoom: number, ctx: CanvasRenderingContext2D): void {
        ctx.save();

        // Flip Y axis to match plotter coordinates (0,0 at bottom-left)
        ctx.scale(1, -1);

        // Draw all paths in the entity
        const showDots = this.plotModel.isShowNodeDots ? this.plotModel.isShowNodeDots() : false;
        const dark = this.plotModel.isDarkMode ? this.plotModel.isDarkMode() : true;
        entity.paths.forEach(path => {
            if (path.length === 0) return;

            if (showDots) {
                ctx.fillStyle = dark ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 0, 0, 1)';
                for (let i = 0; i < path.length; i++) {
                    ctx.beginPath();

                    ctx.arc(path[i][0], path[i][1], 3 / zoom, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }

            ctx.beginPath();
            ctx.moveTo(path[0][0], path[0][1]);

            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(path[i][0], path[i][1]);
            }

            // ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            // ctx.fill();
            ctx.strokeStyle = dark ? '#ffffff' : '#000000';
            ctx.lineWidth = 1.5 / zoom;
            ctx.stroke();

        });

        if (isSelected) {
            // Draw bounding box
            const bounds = this.getEntityBounds(entity);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2 / zoom;
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

            // Draw resize handles
            const handleSize = 8 / zoom;
            ctx.fillStyle = '#ef4444';
            const handles = this.getResizeHandles(bounds);
            handles.forEach(h => {
                ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
            });
        }

        ctx.restore();
    }

    // Calculate bounding box for entity
    getEntityBounds(entity: PlotEntity): { x: number; y: number; width: number; height: number } {
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

    getResizeHandles(bounds: { x: number; y: number; width: number; height: number }): { id: string; x: number; y: number }[] {
        return [
            { id: 'nw', x: bounds.x, y: bounds.y },
            { id: 'ne', x: bounds.x + bounds.width, y: bounds.y },
            { id: 'sw', x: bounds.x, y: bounds.y + bounds.height },
            { id: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        ];
    }

    // Mouse interaction handlers
    handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = -e.deltaY * 0.001;
        const oldZoom = this.plotModel.getZoom();
        const newZoom = Math.max(0.1, Math.min(10, oldZoom * (1 + delta)));
        this.plotModel.setZoom(newZoom);

        // Zoom toward mouse position
        const [panX, panY] = this.plotModel.getPan();
        const newPanX = mouseX - (mouseX - panX) * (newZoom / oldZoom);
        const newPanY = mouseY - (mouseY - panY) * (newZoom / oldZoom);
        this.plotModel.setPan(newPanX, newPanY);
    }

    handleMouseDown(e: MouseEvent): void {
        // Ignore right-click for dragging; it's reserved for context menu
        if (e.button === 2) {
            return;
        }
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const [worldX, worldY] = this.screenToWorld(mouseX, mouseY);

        // Middle-click pans the whole plot (viewport)
        if (e.button === 1) {
            e.preventDefault();
            this.plotModel.setDragStart(mouseX, mouseY);
            this.plotModel.setDraggingViewport(true);
            return;
        }

        this.plotModel.setDragStart(mouseX, mouseY);

        // Check if clicking on resize handle
        const selectedEntityId = this.plotModel.getSelectedEntityId();
        if (selectedEntityId) {
            const entity = this.plotModel.getEntity(selectedEntityId);
            if (entity) {
                const bounds = this.getEntityBounds(entity);
                const handle = this.getHandleAtPosition(bounds, worldX, worldY);
                if (handle) {
                    this.plotModel.setResizingEntity(true);
                    this.plotModel.setResizeHandle(handle);
                    return;
                }
            }
        }

        // Check raster resize handles if a raster is selected
        const selectedRasterId = this.plotModel.getSelectedRasterId ? this.plotModel.getSelectedRasterId() : null;
        if (selectedRasterId) {
            const r = this.plotModel.getRasters().find(x => x.id === selectedRasterId);
            if (r) {
                const bounds = { x: r.x, y: r.y, width: r.width * r.pixelSizeMm, height: r.height * r.pixelSizeMm };
                const handle = this.getHandleAtPosition(bounds, worldX, worldY);
                if (handle) {
                    this.plotModel.setResizingRaster?.(true);
                    this.plotModel.setResizeHandle(handle);
                    return;
                }
            }
        }

        // Check if clicking on raster first (above entities visually)
        const clickedRaster = this.getRasterAtScreenPosition(mouseX, mouseY);
        if (clickedRaster) {
            this.plotModel.setSelectedRasterId(clickedRaster.id);
            this.plotModel.setDraggingRaster(true);
            return;
        }

        // Check if clicking on entity
        const clickedEntity = this.getEntityAtPosition(worldX, worldY);
        if (clickedEntity) {
            this.plotModel.setSelectedEntityId(clickedEntity.id);
            this.plotModel.setDraggingEntity(true);
        } else {
            // Left-click empty space: clear selection and pan the viewport
            this.plotModel.setSelectedEntityId(null);
            if (this.plotModel.setSelectedRasterId) this.plotModel.setSelectedRasterId(null);
            this.plotModel.setDraggingViewport(true);
        }
    }

    handleMouseMove(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const [worldX, worldY] = this.screenToWorld(mouseX, mouseY);

        if (this.plotModel.isDraggingViewport()) {
            const [panX, panY] = this.plotModel.getPan();
            const [dragStartX, dragStartY] = this.plotModel.getDragStart();
            this.plotModel.setPan(panX + mouseX - dragStartX, panY + mouseY - dragStartY);
            this.plotModel.setDragStart(mouseX, mouseY);
        } else if (this.plotModel.isDraggingEntity()) {
            const selectedEntityId = this.plotModel.getSelectedEntityId();
            if (selectedEntityId) {
                const entity = this.plotModel.getEntity(selectedEntityId);
                if (entity) {
                    const [dragStartX, dragStartY] = this.plotModel.getDragStart();
                    const zoom = this.plotModel.getZoom();
                    const dx = (mouseX - dragStartX) / zoom;
                    const dy = -(mouseY - dragStartY) / zoom; // Flip Y to match coordinate system
                    this.translateEntity(entity, dx, dy);
                    this.plotModel.updateEntity(selectedEntityId, entity);
                    this.plotModel.setDragStart(mouseX, mouseY);
                }
            }
        } else if (this.plotModel.isDraggingRaster && this.plotModel.isDraggingRaster()) {
            const selectedRasterId = this.plotModel.getSelectedRasterId ? this.plotModel.getSelectedRasterId() : null;
            if (selectedRasterId) {
                const rasters = this.plotModel.getRasters();
                const r = rasters.find(x => x.id === selectedRasterId);
                if (r) {
                    const [dragStartX, dragStartY] = this.plotModel.getDragStart();
                    const zoom = this.plotModel.getZoom();
                    const dx = (mouseX - dragStartX) / zoom;
                    const dy = -(mouseY - dragStartY) / zoom;
                    this.plotModel.updateRaster(selectedRasterId, { x: r.x + dx, y: r.y + dy });
                    this.plotModel.setDragStart(mouseX, mouseY);
                }
            }
        } else if (this.plotModel.isResizingRaster && this.plotModel.isResizingRaster()) {
            const rId = this.plotModel.getSelectedRasterId ? this.plotModel.getSelectedRasterId() : null;
            const handle = this.plotModel.getResizeHandle();
            if (rId && handle) {
                const r = this.plotModel.getRasters().find(x => x.id === rId);
                if (r) {
                    this.scaleRaster(r, handle, worldX, worldY);
                }
            }
        } else if (this.plotModel.isResizingEntity()) {
            const selectedEntityId = this.plotModel.getSelectedEntityId();
            const resizeHandle = this.plotModel.getResizeHandle();
            if (selectedEntityId && resizeHandle) {
                const entity = this.plotModel.getEntity(selectedEntityId);
                if (entity) {
                    this.scaleEntity(entity, resizeHandle, worldX, worldY);
                    this.plotModel.updateEntity(selectedEntityId, entity);
                }
            }
        }

        // Update cursor
        this.updateCursor(worldX, worldY);

        // Simple hover tooltip for raster/entity
        const [panX, panY] = this.plotModel.getPan();
        const zoom = this.plotModel.getZoom();
        const rasterHover = this.getRasterAtScreenPosition(panX + worldX * zoom, panY - worldY * zoom);
        if (rasterHover) {
            this.canvas.title = `Raster: ${rasterHover.id}`;
        } else {
            const entityHover = this.getEntityAtPosition(worldX, worldY);
            this.canvas.title = entityHover ? `Entity: ${entityHover.id}` : '';
        }
    }

    handleMouseUp(): void {
        this.plotModel.setDraggingViewport(false);
        this.plotModel.setDraggingEntity(false);
        if (this.plotModel.setDraggingRaster) this.plotModel.setDraggingRaster(false);
        if (this.plotModel.setResizingRaster) this.plotModel.setResizingRaster(false);
        this.plotModel.setResizingEntity(false);
        this.plotModel.setResizeHandle(null);
    }

    handleDoubleClick(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const [worldX, worldY] = this.screenToWorld(mouseX, mouseY);

        // Add new square at click position
        const newSquare: PlotEntity = {
            id: `square${Date.now()}`,
            paths: PathTools.createSquarePath(worldX, worldY, 40)
        };
        this.plotModel.addEntity(newSquare);
    }

    handleContextMenu(e: MouseEvent): void {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const contextClickScreenX = e.clientX - rect.left;
        const contextClickScreenY = e.clientY - rect.top;
        const [worldX, worldY] = this.screenToWorld(contextClickScreenX, contextClickScreenY);
        this.contextMenuController.show(e.clientX, e.clientY, worldX, worldY);
    }


    private isImageFile(file: File): boolean {
        const type = (file.type || '').toLowerCase();
        if (type.startsWith('image/')) return true;
        const name = file.name.toLowerCase();
        return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.bmp');
    }

    handleDragOver(e: DragEvent): void {
        // Always prevent default so drop is allowed in Electron
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }

    async handleDrop(e: DragEvent): Promise<void> {
        if (!e.dataTransfer) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const screenX = (e.clientX ?? 0) - rect.left;
        const screenY = (e.clientY ?? 0) - rect.top;
        const [worldX, worldY] = this.screenToWorld(screenX, screenY);

        const files: File[] = [];
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
                const item = e.dataTransfer.items[i];
                if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f && this.isImageFile(f)) files.push(f);
                }
            }
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const f = e.dataTransfer.files[i];
                if (this.isImageFile(f)) files.push(f);
            }
        }

        for (const file of files) {
            try {
                const bitmap = await RasterUtils.imageBitmapFromFile(file);
                const raster = RasterUtils.rasterFromImageBitmap(bitmap, { xMm: worldX, yMm: worldY, pixelSizeMm: 0.2 });
                // Cache grayscale bitmap derived from raster data, not the original colored bitmap
                const grayBmp = await RasterUtils.rasterToImageBitmap(raster);
                this.rasterBitmapCache.set(raster.id, grayBmp);
                this.plotModel.addRaster(raster);
            } catch (err) {
                console.error('Failed to import dropped image', err);
            }
        }
    }


    screenToWorld(screenX: number, screenY: number): [number, number] {
        // Convert screen to plotter coordinates (0,0 at bottom-left)
        // Screen Y increases downward, plotter Y increases upward
        const [panX, panY] = this.plotModel.getPan();
        const zoom = this.plotModel.getZoom();
        return [
            (screenX - panX) / zoom,
            -(screenY - panY) / zoom  // Flip Y
        ];
    }

    getEntityAtPosition(x: number, y: number): PlotEntity | null {
        const entities = this.plotModel.getEntities();
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            const bounds = this.getEntityBounds(entity);

            // Simple bounding box check
            if (x >= bounds.x && x <= bounds.x + bounds.width &&
                y >= bounds.y && y <= bounds.y + bounds.height) {
                return entity;
            }
        }
        return null;
    }

    getHandleAtPosition(bounds: { x: number; y: number; width: number; height: number }, x: number, y: number): string | null {
        const zoom = this.plotModel.getZoom();
        const handleSize = 8 / zoom;
        const handles = this.getResizeHandles(bounds);

        for (const handle of handles) {
            if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
                return handle.id;
            }
        }
        return null;
    }

    getRasterAtPosition(x: number, y: number): { id: string } | null {
        const rasters = this.plotModel.getRasters();
        for (let i = rasters.length - 1; i >= 0; i--) {
            const r = rasters[i];
            const widthMm = r.width * r.pixelSizeMm;
            const heightMm = r.height * r.pixelSizeMm;
            const xMin = Math.min(r.x, r.x + widthMm);
            const xMax = Math.max(r.x, r.x + widthMm);
            const yMin = Math.min(r.y, r.y + heightMm);
            const yMax = Math.max(r.y, r.y + heightMm);
            if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
                return { id: r.id };
            }
        }
        return null;
    }

    getRasterAtScreenPosition(screenX: number, screenY: number): { id: string } | null {
        const [panX, panY] = this.plotModel.getPan();
        const zoom = this.plotModel.getZoom();
        const rasters = this.plotModel.getRasters();
        for (let i = rasters.length - 1; i >= 0; i--) {
            const r = rasters[i];
            const widthPx = r.width * r.pixelSizeMm * zoom;
            const heightPx = r.height * r.pixelSizeMm * zoom;
            const left = panX + r.x * zoom;
            const top = panY - (r.y + r.height * r.pixelSizeMm) * zoom;
            if (screenX >= left && screenX <= left + widthPx && screenY >= top && screenY <= top + heightPx) {
                return { id: r.id };
            }
        }
        return null;
    }

    // Translate (move) an entity
    translateEntity(entity: PlotEntity, dx: number, dy: number): void {
        entity.paths = entity.paths.map(path =>
            path.map(([x, y]) => [x + dx, y + dy] as [number, number])
        );
    }

    // Scale an entity from a resize handle (maintains aspect ratio)
    scaleEntity(entity: PlotEntity, handle: string, worldX: number, worldY: number): void {
        const oldBounds = this.getEntityBounds(entity);
        const minSize = 1;

        let newBounds = { ...oldBounds };
        let scaleFactor: number;

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
        entity.paths = entity.paths.map(path =>
            path.map(([x, y]) => {
                const relX = (x - oldBounds.x) * scaleFactor;
                const relY = (y - oldBounds.y) * scaleFactor;
                return [newBounds.x + relX, newBounds.y + relY] as [number, number];
            })
        );
    }

    updateCursor(worldX: number, worldY: number): void {
        const selectedEntityId = this.plotModel.getSelectedEntityId();
        if (selectedEntityId) {
            const entity = this.plotModel.getEntity(selectedEntityId);
            if (entity) {
                const bounds = this.getEntityBounds(entity);
                const handle = this.getHandleAtPosition(bounds, worldX, worldY);
                if (handle) {
                    this.canvas.style.cursor = this.getCursorForHandle(handle);
                    return;
                }
            }
        }

        // Raster cursor feedback: show resize cursor on handles, move inside raster
        const selectedRasterId = this.plotModel.getSelectedRasterId ? this.plotModel.getSelectedRasterId() : null;
        if (selectedRasterId) {
            const r = this.plotModel.getRasters().find(x => x.id === selectedRasterId);
            if (r) {
                const bounds = { x: r.x, y: r.y, width: r.width * r.pixelSizeMm, height: r.height * r.pixelSizeMm };
                const handle = this.getHandleAtPosition(bounds, worldX, worldY);
                if (handle) {
                    this.canvas.style.cursor = this.getCursorForHandle(handle);
                    return;
                }
            }
        }

        // Fallback: hover inside any raster -> move
        const [panX, panY] = this.plotModel.getPan();
        const zoom = this.plotModel.getZoom();
        const screenX = panX + worldX * zoom;
        const screenY = panY - worldY * zoom;
        const raster = this.getRasterAtScreenPosition(screenX, screenY);
        if (raster) {
            this.canvas.style.cursor = 'move';
            return;
        }

        const entity = this.getEntityAtPosition(worldX, worldY);
        this.canvas.style.cursor = entity ? 'move' : 'grab';
    }

    getCursorForHandle(handle: string): string {
        const cursors: Record<string, string> = {
            'nw': 'ne-resize',  // Dragging NW corner - cursor should point NW
            'ne': 'nw-resize',  // Dragging NE corner - cursor should point NE
            'sw': 'se-resize',  // Dragging SW corner - cursor should point SW
            'se': 'sw-resize'   // Dragging SE corner - cursor should point SE
        };
        return cursors[handle] || 'default';
    }

    private scaleRaster(raster: Raster, handle: string, worldX: number, worldY: number): void {
        const oldWidthMm = raster.width * raster.pixelSizeMm;
        const oldHeightMm = raster.height * raster.pixelSizeMm;
        const minSize = 1;
        // Determine opposite corner and the dragged corner in world coords
        // Raster bounds use bottom-left (x, y). Handle labels come from getResizeHandles()
        // mapping: 'nw'->BL, 'ne'->BR, 'sw'->TL, 'se'->TR
        let ox = raster.x; // opposite corner x
        let oy = raster.y; // opposite corner y
        let cx = raster.x; // dragged corner start x
        let cy = raster.y; // dragged corner start y
        switch (handle) {
            case 'nw': // dragging bottom-left, opposite is top-right
                cx = raster.x; cy = raster.y;
                ox = raster.x + oldWidthMm; oy = raster.y + oldHeightMm;
                break;
            case 'ne': // dragging bottom-right, opposite is top-left
                cx = raster.x + oldWidthMm; cy = raster.y;
                ox = raster.x; oy = raster.y + oldHeightMm;
                break;
            case 'sw': // dragging top-left, opposite is bottom-right
                cx = raster.x; cy = raster.y + oldHeightMm;
                ox = raster.x + oldWidthMm; oy = raster.y;
                break;
            case 'se': // dragging top-right, opposite is bottom-left
                cx = raster.x + oldWidthMm; cy = raster.y + oldHeightMm;
                ox = raster.x; oy = raster.y;
                break;
        }

        const dist = (x0: number, y0: number, x1: number, y1: number) => Math.hypot(x1 - x0, y1 - y0);
        const d = dist(worldX, worldY, ox, oy);
        const d0 = dist(cx, cy, ox, oy);
        const scale = Math.max(minSize / Math.min(oldWidthMm, oldHeightMm), d0 === 0 ? 1 : d / d0);

        const newWidthMm = oldWidthMm * scale;
        const newHeightMm = oldHeightMm * scale;
        const newPixelSize = Math.max(0.01, raster.pixelSizeMm * scale);

        // Adjust origin so the opposite corner stays fixed
        let newX = raster.x;
        let newY = raster.y;
        switch (handle) {
            case 'nw': // opposite TR fixed
                newX = raster.x + oldWidthMm - newWidthMm;
                newY = raster.y + oldHeightMm - newHeightMm;
                break;
            case 'ne': // opposite TL fixed
                newX = raster.x;
                newY = raster.y + oldHeightMm - newHeightMm;
                break;
            case 'sw': // opposite BR fixed
                newX = raster.x + oldWidthMm - newWidthMm;
                newY = raster.y;
                break;
            case 'se': // opposite BL fixed
                newX = raster.x;
                newY = raster.y;
                break;
        }

        this.plotModel.updateRaster(raster.id, { x: newX, y: newY, pixelSizeMm: newPixelSize });
    }
}