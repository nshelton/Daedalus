export interface VectorizeOptions {
    threshold: number; // 0-255
}

import { PlotModel, Raster, PlotEntity } from "../models/PlotModel.js";

export class RasterController {
    private plotModel: PlotModel;

    constructor(plotModel: PlotModel) {
        this.plotModel = plotModel;
    }

    // Stub: converts raster to a single rectangular outline entity around non-empty pixels
    // Real implementation will perform thresholding + contour tracing
    vectorizeRaster(rasterId: string, options: VectorizeOptions = { threshold: 128 }): PlotEntity | null {
        const raster = this.plotModel.getRasters().find(r => r.id === rasterId);
        if (!raster) return null;

        const { width, height, data, x, y, pixelSizeMm } = raster;
        const t = options.threshold;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const v = data[py * width + px];
                if (v <= t) {
                    const wx = x + px * pixelSizeMm;
                    const wy = y + py * pixelSizeMm;
                    if (wx < minX) minX = wx;
                    if (wy < minY) minY = wy;
                    if (wx > maxX) maxX = wx;
                    if (wy > maxY) maxY = wy;
                }
            }
        }

        if (!isFinite(minX)) return null; // nothing below threshold

        const pad = 0;
        const left = minX - pad;
        const right = maxX + pixelSizeMm + pad;
        const bottom = minY - pad;
        const top = maxY + pixelSizeMm + pad;

        const id = `raster-outline-${rasterId}`;
        const paths: [number, number][][] = [[
            [left, bottom],
            [right, bottom],
            [right, top],
            [left, top],
            [left, bottom]
        ]];

        const entity: PlotEntity = { id, paths };
        this.plotModel.addEntity(entity);
        return entity;
    }
}
