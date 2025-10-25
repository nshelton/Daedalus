import { PlotModel } from '../models/PlotModel.js';
import FilterRegistry from './FilterRegistry.js';
import type { FilterInstance, FilterIoKind, FilterOutputMap, FilterContext, PathLike } from '../../types';
import { RasterUtils } from '../RasterUtils.js';

type CachedStage = {
    stageIndex: number;
    inputHash: string;
    kind: FilterIoKind;
    output: FilterOutputMap[FilterIoKind];
};

export class FilterChainController {
    private readonly model: PlotModel;
    private readonly registry: FilterRegistry;
    private cache: Map<string, CachedStage[]> = new Map(); // rasterId -> stages

    constructor(model: PlotModel, registry: FilterRegistry) {
        this.model = model;
        this.registry = registry;
    }

    // ===== Mutations =====
    addFilter(rasterId: string, defId: string, index?: number): void {
        const rasters = this.model.getRasters();
        const r = rasters.find(x => x.id === rasterId);
        if (!r) return;
        const def = this.registry.get(defId);
        if (!def) return;
        const inst: FilterInstance = {
            instanceId: this.generateId('f'),
            defId: def.id,
            enabled: true,
            visible: false,
            params: def.defaultParams,
            io: { input: def.inputKinds[0], output: def.outputKind }
        };
        const arr = r.filters ?? (r.filters = []);
        if (index !== undefined && index >= 0 && index <= arr.length) arr.splice(index, 0, inst);
        else arr.push(inst);
        this.invalidateFrom(rasterId, index ?? arr.length - 1);
        this.model.updateRaster(rasterId, { filters: arr });
    }

    removeFilter(rasterId: string, instanceId: string): void {
        const rasters = this.model.getRasters();
        const r = rasters.find(x => x.id === rasterId);
        if (!r || !r.filters) return;
        const idx = r.filters.findIndex(f => f.instanceId === instanceId);
        if (idx === -1) return;
        r.filters.splice(idx, 1);
        this.invalidateFrom(rasterId, idx);
        this.model.updateRaster(rasterId, { filters: r.filters });
    }

    moveFilter(rasterId: string, from: number, to: number): void {
        const r = this.model.getRasters().find(x => x.id === rasterId);
        if (!r || !r.filters) return;
        const arr = r.filters;
        if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        this.invalidateFrom(rasterId, Math.min(from, to));
        this.model.updateRaster(rasterId, { filters: arr });
    }

    setParams(rasterId: string, instanceId: string, params: unknown): void {
        const r = this.model.getRasters().find(x => x.id === rasterId);
        if (!r || !r.filters) return;
        const idx = r.filters.findIndex(f => f.instanceId === instanceId);
        if (idx === -1) return;
        const def = this.registry.get(r.filters[idx].defId);
        if (!def) return;
        if (!this.registry.validateParams(def.id, params)) return;
        r.filters[idx] = { ...r.filters[idx], params };
        this.invalidateFrom(rasterId, idx);
        this.model.updateRaster(rasterId, { filters: r.filters });
    }

    setEnabled(rasterId: string, instanceId: string, enabled: boolean): void {
        const r = this.model.getRasters().find(x => x.id === rasterId);
        if (!r || !r.filters) return;
        const idx = r.filters.findIndex(f => f.instanceId === instanceId);
        if (idx === -1) return;
        r.filters[idx] = { ...r.filters[idx], enabled };
        this.invalidateFrom(rasterId, idx);
        this.model.updateRaster(rasterId, { filters: r.filters });
    }

    setVisibleStage(rasterId: string, index: number | null): void {
        const r = this.model.getRasters().find(x => x.id === rasterId);
        if (!r) return;
        const nextIndex = (index === null ? null : Math.max(0, Math.min((r.filters?.length ?? 0) - 1, index)));
        this.model.updateRaster(rasterId, { previewIndex: nextIndex });
    }

    clearPreview(rasterId: string): void {
        this.setVisibleStage(rasterId, null);
    }

    // ===== Evaluation =====
    async evaluateToPaths(rasterId: string): Promise<PathLike[] | null> {
        const r = this.model.getRasters().find(x => x.id === rasterId);
        if (!r) return null;
        const filters = (r.filters ?? []).filter(f => f.enabled);
        const targetIndex = (typeof r.previewIndex === 'number') ? r.previewIndex : (filters.length - 1);
        if (filters.length === 0) return [];

        // Build initial input from raster
        const rasterImageData = RasterUtils.rasterToImageData(r);
        let current: { kind: FilterIoKind; value: any } = { kind: 'raster', value: rasterImageData };

        for (let i = 0; i <= targetIndex; i++) {
            const f = filters[i];
            const def = this.registry.get(f.defId);
            if (!def) return null;
            if (!def.inputKinds.includes(current.kind as any)) return null;
            const ctx: FilterContext = {
                rasterSize: { width: r.width, height: r.height },
                dpi: undefined,
                pixelSizeMm: r.pixelSizeMm,
                onProgress: (p) => {
                    // TODO: publish progress to model for UI display
                },
            };
            const inputHash = this.hashStage(i, f, current.value);
            const cached = this.getCached(rasterId, i, inputHash);
            if (cached) {
                current = { kind: cached.kind, value: cached.output };
            } else {
                const t0 = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
                const output = await def.apply(current.value, f.params as any, ctx);
                const t1 = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
                def.lastExecutionMs = t1 - t0;
                current = { kind: def.outputKind, value: output };
                this.setCached(rasterId, i, inputHash, def.outputKind, output as any);
            }
        }

        if (current.kind === 'paths') return current.value as PathLike[];
        // Not paths: preview mode allowed (bitmap); normal render expects paths
        return null;
    }

    // Evaluate current filter chain to paths and add them as a new plot entity in world mm.
    async bakePathsToEntity(rasterId: string): Promise<string | null> {
        const r = this.model.getRasters().find(x => x.id === rasterId);
        if (!r) return null;
        const paths = await this.evaluateToPaths(rasterId);
        if (!paths || paths.length === 0) return null;
        const worldPaths: [number, number][][] = paths.map(p => p.map(([x, y]) => [r.x + x * r.pixelSizeMm, r.y + y * r.pixelSizeMm] as [number, number]));
        const id = this.generateId('plot');
        this.model.addEntity({ id, paths: worldPaths });
        this.model.setSelectedEntityId(id);
        return id;
    }

    async evaluatePreview(rasterId: string): Promise<{ kind: FilterIoKind; value: any } | null> {
        const r = this.model.getRasters().find(x => x.id === rasterId);
        if (!r) return null;
        const filters = (r.filters ?? []).filter(f => f.enabled);
        if (filters.length === 0) return { kind: 'raster', value: RasterUtils.rasterToImageData(r) };
        const targetIndex = (typeof r.previewIndex === 'number') ? r.previewIndex : (filters.length - 1);
        const rasterImageData = RasterUtils.rasterToImageData(r);
        let current: { kind: FilterIoKind; value: any } = { kind: 'raster', value: rasterImageData };
        for (let i = 0; i <= targetIndex; i++) {
            const f = filters[i];
            const def = this.registry.get(f.defId);
            if (!def) return null;
            if (!def.inputKinds.includes(current.kind as any)) return null;
            const ctx: FilterContext = {
                rasterSize: { width: r.width, height: r.height },
                dpi: undefined,
                pixelSizeMm: r.pixelSizeMm,
                onProgress: (p) => {
                    // TODO: publish progress to model for UI display
                },
            };
            const inputHash = this.hashStage(i, f, current.value);
            const cached = this.getCached(rasterId, i, inputHash);
            if (cached) {
                current = { kind: cached.kind, value: cached.output };
            } else {
                const t0 = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
                const output = await def.apply(current.value, f.params as any, ctx);
                const t1 = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
                def.lastExecutionMs = t1 - t0;
                current = { kind: def.outputKind, value: output };
                this.setCached(rasterId, i, inputHash, def.outputKind, output as any);
            }
        }
        return current;
    }

    // ===== Cache helpers =====
    private getCached(rasterId: string, stageIndex: number, inputHash: string): CachedStage | null {
        const list = this.cache.get(rasterId);
        if (!list) return null;
        return list.find(e => e.stageIndex === stageIndex && e.inputHash === inputHash) ?? null;
    }

    private setCached(rasterId: string, stageIndex: number, inputHash: string, kind: FilterIoKind, output: any): void {
        const list = this.cache.get(rasterId) ?? [];
        const existingIdx = list.findIndex(e => e.stageIndex === stageIndex && e.inputHash === inputHash);
        const entry: CachedStage = { stageIndex, inputHash, kind, output };
        if (existingIdx >= 0) list[existingIdx] = entry; else list.push(entry);
        this.cache.set(rasterId, list);
    }

    private invalidateFrom(rasterId: string, stageIndex: number): void {
        const list = this.cache.get(rasterId);
        if (!list) return;
        this.cache.set(rasterId, list.filter(e => e.stageIndex < stageIndex));
    }

    // Lightweight deterministic hash of stage + params + input summary
    private hashStage(stageIndex: number, inst: FilterInstance, input: any): string {
        const parts: string[] = [String(stageIndex), inst.defId, JSON.stringify(inst.params ?? {})];
        try {
            if (typeof ImageData !== 'undefined' && input instanceof ImageData) {
                const w = input.width | 0, h = input.height | 0, len = input.data?.length | 0;
                let acc = (w * 73856093) ^ (h * 19349663) ^ (len * 83492791);
                const stride = Math.max(1, Math.floor(len / 97));
                for (let i = 0; i < len; i += stride) acc = (acc * 16777619) ^ input.data[i];
                parts.push(w.toString(36), h.toString(36), len.toString(36), (acc >>> 0).toString(36));
            } else if (Array.isArray(input)) {
                // paths summary
                const paths = input as any[];
                const count = paths.length | 0;
                let acc = count * 1315423911;
                for (let p = 0; p < Math.min(count, 5); p++) {
                    const path = paths[p] as any[];
                    const l = path?.length | 0;
                    acc ^= (l + p * 31);
                    if (l > 0) {
                        const [x0, y0] = path[0] ?? [0, 0];
                        const [x1, y1] = path[l - 1] ?? [0, 0];
                        acc ^= ((x0 * 1000) | 0) ^ ((y0 * 1000) | 0) ^ ((x1 * 1000) | 0) ^ ((y1 * 1000) | 0);
                    }
                }
                parts.push(count.toString(36), (acc >>> 0).toString(36));
            } else if (input && typeof input === 'object') {
                // generic object summary
                parts.push(JSON.stringify({ keys: Object.keys(input).slice(0, 8).sort() }));
            } else {
                parts.push(String(input));
            }
        } catch {
            // ignore hashing errors; fall back to params-only
        }
        return parts.join('|');
    }

    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    }
}

export default FilterChainController;


