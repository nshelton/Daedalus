import { PlotModel } from '../models/PlotModel.js';
import type { FilterInstance, FilterParamDef } from '../../types';
import FilterRegistry from '../controllers/FilterRegistry.js';
import FilterChainController from '../controllers/FilterChainController.js';
import HistogramController from '../controllers/HistogramController.js';

export class FilterPanelView {
    private readonly container: HTMLElement;
    private readonly model: PlotModel;
    private readonly registry: FilterRegistry;
    private readonly chain: FilterChainController;
    private readonly histogram: HistogramController;
    private isInteracting: boolean = false;
    private pendingRender: boolean = false;

    constructor(container: HTMLElement, model: PlotModel, registry: FilterRegistry, chain: FilterChainController, histogram: HistogramController) {
        this.container = container;
        this.model = model;
        this.registry = registry;
        this.chain = chain;
        this.histogram = histogram;
        this.model.subscribe(() => this.requestRender());
        this.render();
    }

    private render(): void {
        let root = document.getElementById('filter-panel');
        if (!root) {
            root = document.createElement('div');
            root.id = 'filter-panel';
            root.style.position = 'absolute';
            root.style.right = '12px';
            root.style.bottom = '12px';
            root.style.width = '280px';
            root.style.maxHeight = '70vh';
            root.style.overflow = 'auto';
            root.style.background = '#222';
            root.style.color = '#eee';
            root.style.padding = '8px';
            root.style.borderRadius = '8px';
            root.style.fontFamily = 'system-ui, sans-serif';
            this.container.appendChild(root);
            // Track pointer interaction to avoid destroying DOM while dragging sliders
            root.addEventListener('pointerdown', () => { this.isInteracting = true; });
            const end = () => {
                this.isInteracting = false;
                if (this.pendingRender) { this.pendingRender = false; this.render(); }
            };
            root.addEventListener('pointerup', end);
            root.addEventListener('pointercancel', end);
        }
        root.innerHTML = '';

        const selectedRasterId = this.model.getSelectedRasterId ? this.model.getSelectedRasterId() : null;
        if (!selectedRasterId) {
            root.textContent = 'Select a raster to edit filters';
            return;
        }
        const raster = this.model.getRasters().find(r => r.id === selectedRasterId);
        if (!raster) return;

        // Histogram section
        const histWrap = document.createElement('div');
        histWrap.style.marginBottom = '8px';
        const canvas = document.createElement('canvas');
        canvas.width = 260; canvas.height = 60;
        canvas.style.width = '260px';
        canvas.style.height = '60px';
        canvas.style.background = '#111';
        canvas.style.border = '1px solid #444';
        canvas.style.borderRadius = '4px';
        histWrap.appendChild(canvas);
        root.appendChild(histWrap);

        // Draw histogram asynchronously, skipping while interacting
        const selectedIdForHist = raster.id;
        if (!this.isInteracting) {
            this.histogram.getHistogram(selectedIdForHist).then(bins => {
                if (!bins) return;
                if (!canvas.isConnected) return;
                this.drawHistogram(canvas, bins);
            }).catch(() => { });
        }

        const header = document.createElement('div');
        header.textContent = 'Filters';
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '8px';
        root.appendChild(header);

        const addRow = document.createElement('div');
        const select = document.createElement('select');
        const byInput = this.registry.listByInput('raster');
        const alsoBitmap = this.registry.listByInput('bitmap');
        const all = [...byInput, ...alsoBitmap].filter(def => def.entityKind === 'bitmap');
        // Avoid duplicate entries when a filter supports both 'raster' and 'bitmap'
        const seen = new Set<string>();
        const unique = all.filter(def => {
            if (seen.has(def.id)) return false;
            seen.add(def.id);
            return true;
        });
        unique.forEach(def => {
            const opt = document.createElement('option');
            opt.value = def.id;
            opt.textContent = def.label;
            select.appendChild(opt);
        });
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.onclick = () => this.chain.addFilter(raster.id, select.value);
        addRow.appendChild(select);
        addRow.appendChild(addBtn);
        addRow.style.display = 'flex';
        addRow.style.gap = '6px';
        addRow.style.marginBottom = '8px';
        root.appendChild(addRow);

        const list = document.createElement('div');
        (raster.filters ?? []).forEach((f, index) => {
            list.appendChild(this.renderFilterItem(raster.id, f, index));
        });
        root.appendChild(list);
    }

    private requestRender(): void {
        if (this.isInteracting) {
            this.pendingRender = true;
            return;
        }
        this.render();
    }

    private renderFilterItem(rasterId: string, inst: FilterInstance, index: number): HTMLElement {
        const def = this.registry.get(inst.defId);
        const row = document.createElement('div');
        row.style.border = '1px solid #444';
        row.style.borderRadius = '6px';
        row.style.padding = '6px';
        row.style.marginBottom = '6px';

        const title = document.createElement('div');
        title.textContent = `${def?.label ?? inst.defId}`;
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.justifyContent = 'space-between';
        title.style.gap = '6px';

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '6px';

        const enable = document.createElement('input');
        enable.type = 'checkbox';
        enable.checked = !!inst.enabled;
        enable.title = 'Enabled';
        enable.onchange = () => this.chain.setEnabled(rasterId, inst.instanceId, enable.checked);
        controls.appendChild(enable);

        const del = document.createElement('button');
        del.textContent = '✖';
        del.onclick = () => this.chain.removeFilter(rasterId, inst.instanceId);
        controls.appendChild(del);

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '8px';
        if (def && typeof def.lastExecutionMs === 'number') {
            const dur = document.createElement('span');
            dur.textContent = `${def.lastExecutionMs.toFixed(1)} ms`;
            dur.style.color = '#aaa';
            dur.style.fontSize = '12px';
            right.appendChild(dur);
        }
        right.appendChild(controls);
        title.appendChild(right);
        row.appendChild(title);

        if (def) {
            row.appendChild(this.renderParams(rasterId, inst, def.paramsSchema));
        }
        return row;
    }

    private renderParams(rasterId: string, inst: FilterInstance, schema: FilterParamDef[]): HTMLElement {
        const wrap = document.createElement('div');
        wrap.style.display = 'grid';
        wrap.style.gridTemplateColumns = '1fr 1fr';
        wrap.style.gap = '6px';
        for (const p of schema) {
            const label = document.createElement('label');
            label.textContent = p.label;
            wrap.appendChild(label);
            let input: HTMLElement;
            if (p.type === 'number') {
                const el = document.createElement('input');
                el.type = 'range';
                el.min = String(p.min ?? 0);
                el.max = String(p.max ?? 1);
                el.step = String(p.step ?? 0.01);
                const v = (inst.params as any)?.[p.key];
                el.value = String(typeof v === 'number' ? v : p.min ?? 0);
                el.oninput = () => this.updateParam(rasterId, inst, p.key, Number(el.value));
                input = el;
            } else if (p.type === 'boolean') {
                const el = document.createElement('input');
                el.type = 'checkbox';
                const v = !!(inst.params as any)?.[p.key];
                el.checked = v;
                el.onchange = () => this.updateParam(rasterId, inst, p.key, el.checked);
                input = el;
            } else {
                const el = document.createElement('select');
                (p.options ?? []).forEach(opt => {
                    const o = document.createElement('option');
                    o.value = String(opt.value);
                    o.textContent = opt.label;
                    el.appendChild(o);
                });
                const v = (inst.params as any)?.[p.key];
                if (v !== undefined) el.value = String(v);
                el.onchange = () => this.updateParam(rasterId, inst, p.key, el.value);
                input = el;
            }
            wrap.appendChild(input);
        }
        return wrap;
    }

    private updateParam(rasterId: string, inst: FilterInstance, key: string, value: unknown): void {
        const next = { ...(inst.params as any), [key]: value };
        this.chain.setParams(rasterId, inst.instanceId, next);
    }

    private drawHistogram(canvas: HTMLCanvasElement, bins: Uint32Array): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const w = canvas.width, h = canvas.height;
        const max = Math.max(1, bins.reduce((m, v) => v > m ? v : m, 0));
        const barW = w / 256;
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 256; i++) {
            const v = bins[i];
            const bh = Math.max(1, Math.round((v / max) * (h - 2)));
            const x = Math.floor(i * barW);
            const y = h - bh - 1;
            ctx.fillRect(x, y, Math.ceil(barW), bh);
        }
    }
}

export default FilterPanelView;


