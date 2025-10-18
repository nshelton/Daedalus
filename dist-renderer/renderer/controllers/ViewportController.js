export class ViewportController {
    constructor() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.1;
        this.maxZoom = 10;
    }
    getState() {
        return { zoom: this.zoom, panX: this.panX, panY: this.panY };
    }
    setZoom(zoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }
    getZoom() {
        return this.zoom;
    }
    setPan(x, y) {
        this.panX = x;
        this.panY = y;
    }
    getPan() {
        return [this.panX, this.panY];
    }
    adjustPan(dx, dy) {
        this.panX += dx;
        this.panY += dy;
    }
    adjustZoom(delta, centerX, centerY) {
        const oldZoom = this.zoom;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * (1 + delta)));
        // Adjust pan to zoom toward the cursor position
        this.panX = centerX - (centerX - this.panX) * (newZoom / oldZoom);
        this.panY = centerY - (centerY - this.panY) * (newZoom / oldZoom);
        this.zoom = newZoom;
    }
    screenToWorld(screenX, screenY) {
        return [
            (screenX - this.panX) / this.zoom,
            (screenY - this.panY) / this.zoom
        ];
    }
    worldToScreen(worldX, worldY) {
        return [
            worldX * this.zoom + this.panX,
            worldY * this.zoom + this.panY
        ];
    }
    reset() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
    }
}
