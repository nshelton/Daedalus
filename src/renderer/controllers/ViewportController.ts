export interface ViewportState {
    zoom: number;
    panX: number;
    panY: number;
}

export class ViewportController {
    private zoom = 1;
    private panX = 0;
    private panY = 0;
    private minZoom = 0.1;
    private maxZoom = 100;

    getState(): ViewportState {
        return { zoom: this.zoom, panX: this.panX, panY: this.panY };
    }

    setZoom(zoom: number): void {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }

    getZoom(): number {
        return this.zoom;
    }

    setPan(x: number, y: number): void {
        this.panX = x;
        this.panY = y;
    }

    getPan(): [number, number] {
        return [this.panX, this.panY];
    }

    adjustPan(dx: number, dy: number): void {
        this.panX += dx;
        this.panY += dy;
    }

    adjustZoom(delta: number, centerX: number, centerY: number): void {
        const oldZoom = this.zoom;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * (1 + delta)));

        // Adjust pan to zoom toward the cursor position
        this.panX = centerX - (centerX - this.panX) * (newZoom / oldZoom);
        this.panY = centerY - (centerY - this.panY) * (newZoom / oldZoom);
        this.zoom = newZoom;
    }

    screenToWorld(screenX: number, screenY: number): [number, number] {
        return [
            (screenX - this.panX) / this.zoom,
            (screenY - this.panY) / this.zoom
        ];
    }

    worldToScreen(worldX: number, worldY: number): [number, number] {
        return [
            worldX * this.zoom + this.panX,
            worldY * this.zoom + this.panY
        ];
    }

    reset(): void {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
    }
}

