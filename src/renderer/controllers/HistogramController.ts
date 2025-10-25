import { PlotModel } from '../models/PlotModel.js';
import FilterRegistry from './FilterRegistry.js';
import FilterChainController from './FilterChainController.js';
import { RasterUtils } from '../RasterUtils.js';
import type { FilterIoKind, FilterInputMap, FilterOutputMap, FilterContext } from '../../types.js';

/**
 * Encapsulated histogram computation for the current preview output of a raster's filter chain.
 * - Produces a 256-bin grayscale histogram (Uint32Array)
 * - Does not mutate or persist any application state
 * - Uses the filter chain output cache when possible via FilterChainController
 */
export class HistogramController {
    private readonly model: PlotModel;
    private readonly registry: FilterRegistry;
    private readonly chain: FilterChainController;

    constructor(model: PlotModel, registry: FilterRegistry, chain: FilterChainController) {
        this.model = model;
        this.registry = registry;
        this.chain = chain;
    }

    async getHistogram(rasterId: string, sampleMax: number = 300_000): Promise<Uint32Array | null> {
        const image = await this.evaluateToImageData(rasterId);
        if (!image) return null;
        return this.computeHistogram(image, sampleMax);
    }

    /**
     * Returns ImageData for the stage currently previewed; if the stage is paths,
     * falls back to the last image-producing stage; if none, returns the original raster.
     */
    private async evaluateToImageData(rasterId: string): Promise<ImageData | null> {
        const raster = this.model.getRasters().find(r => r.id === rasterId);
        if (!raster) return null;

        // Try to leverage existing cached evaluation first
        const preview = await this.chain.evaluatePreview(rasterId);
        if (preview && (preview.kind === 'raster' || preview.kind === 'bitmap')) {
            return preview.value as ImageData;
        }

        // Fallback: re-run locally to get the last image-producing stage
        const filters = (raster.filters ?? []).filter(f => f.enabled);
        const targetIndex = (typeof raster.previewIndex === 'number') ? raster.previewIndex : (filters.length - 1);

        const original = RasterUtils.rasterToImageData(raster);
        if (filters.length === 0 || targetIndex < 0) {
            return original;
        }

        let current: { kind: FilterIoKind; value: FilterInputMap[FilterIoKind] } = { kind: 'raster', value: original } as any;
        let lastImage: ImageData | null = original;

        for (let i = 0; i <= targetIndex; i++) {
            const inst = filters[i];
            const def = this.registry.get(inst.defId);
            if (!def) break;
            if (!def.inputKinds.includes(current.kind as any)) break;
            const ctx: FilterContext = { rasterSize: { width: raster.width, height: raster.height }, dpi: undefined, pixelSizeMm: raster.pixelSizeMm };
            const out = await def.apply(current.value as any, inst.params as any, ctx);
            current = { kind: def.outputKind, value: out as FilterOutputMap[FilterIoKind] } as any;
            if (current.kind === 'raster' || current.kind === 'bitmap') {
                lastImage = current.value as ImageData;
            }
        }

        return lastImage ?? original;
    }

    /**
     * Compute a 256-bin grayscale histogram. Uses optional sub-sampling for large images.
     */
    private computeHistogram(image: ImageData, sampleMax: number = 300_000): Uint32Array {
        const bins = new Uint32Array(256);
        const data = image.data;
        const numPixels = (data.length / 4) | 0;
        const stride = Math.max(1, Math.ceil(numPixels / Math.max(1, sampleMax)));

        for (let p = 0; p < numPixels; p += stride) {
            const i = p * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Rec. 601 luma in 0..255
            const v = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
            bins[v]++;
        }
        return bins;
    }
}

export default HistogramController;


