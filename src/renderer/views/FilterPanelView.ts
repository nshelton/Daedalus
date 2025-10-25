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
    private addMenuOpen: boolean = false;
    private addMenuEl: HTMLDivElement | null = null;
    private addMenuAnchorEl: HTMLButtonElement | null = null;
    private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

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
            root.style.backgroundColor = 'rgba(0,0,0,0.5)';
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

        // Prefer unified layer selection; fall back to legacy raster selection
        let selectedRasterId: string | null = null;
        const selLayerId = (this.model as any).getSelectedLayerId ? (this.model as any).getSelectedLayerId() as string | null : null;
        if (selLayerId && selLayerId.startsWith('r:')) selectedRasterId = selLayerId.slice(2);
        if (!selectedRasterId && this.model.getSelectedRasterId) selectedRasterId = this.model.getSelectedRasterId();

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

        // Progress bar (future: driven by model progress state)
        const prog = document.createElement('div');
        prog.style.height = '6px';
        prog.style.background = '#111';
        prog.style.border = '1px solid #333';
        prog.style.borderRadius = '3px';
        prog.style.overflow = 'hidden';
        prog.style.margin = '6px 0 8px 0';
        const bar = document.createElement('div');
        bar.style.height = '100%';
        bar.style.width = '0%';
        bar.style.background = '#3b82f6';
        prog.appendChild(bar);
        root.appendChild(prog);

        const header = document.createElement('div');
        header.textContent = 'Filters';
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '8px';

        // Add (+) button to open filter menu
        const addBtn = document.createElement('button');
        addBtn.textContent = '+';
        addBtn.title = 'Add filter';
        addBtn.style.background = 'transparent';
        addBtn.style.border = 'none';
        addBtn.style.color = '#eee';
        addBtn.style.fontSize = '18px';
        addBtn.style.lineHeight = '1';
        addBtn.style.padding = '2px 6px';
        addBtn.style.float = 'right';
        addBtn.style.cursor = 'pointer';
        addBtn.style.marginBottom = '8px';
        addBtn.style.borderRadius = '4px';
        addBtn.onmouseenter = () => { addBtn.style.background = '#333'; };
        addBtn.onmouseleave = () => { addBtn.style.background = 'transparent'; };
        addBtn.onclick = (ev) => {
            ev.stopPropagation();
            if (this.addMenuOpen) {
                this.closeAddMenu();
            } else {
                this.addMenuAnchorEl = addBtn;
                this.openAddMenu(root, raster.id);
            }
        };
        header.appendChild(addBtn);

        // Bake Paths button
        const bakeBtn = document.createElement('button');
        bakeBtn.textContent = 'Bake Paths';
        bakeBtn.title = 'Evaluate chain to paths and add as plot entity';
        bakeBtn.style.background = 'transparent';
        bakeBtn.style.border = '1px solid #555';
        bakeBtn.style.color = '#eee';
        bakeBtn.style.fontSize = '12px';
        bakeBtn.style.lineHeight = '1';
        bakeBtn.style.padding = '2px 6px';
        bakeBtn.style.float = 'right';
        bakeBtn.style.cursor = 'pointer';
        bakeBtn.style.margin = '0 6px 8px 0';
        bakeBtn.style.borderRadius = '4px';
        bakeBtn.onmouseenter = () => { bakeBtn.style.background = '#333'; };
        bakeBtn.onmouseleave = () => { bakeBtn.style.background = 'transparent'; };
        bakeBtn.onclick = async (ev) => {
            ev.stopPropagation();
            try {
                const id = await this.chain.bakePathsToEntity(raster.id);
                if (!id) alert('No paths produced by the current filter chain.');
            } catch (e) {
                console.error('Bake paths failed', e);
                alert('Bake paths failed');
            }
        };
        header.appendChild(bakeBtn);
        root.appendChild(header);

        const list = document.createElement('div');
        (raster.filters ?? []).forEach((f) => {
            list.appendChild(this.renderFilterItem(raster.id, f));
        });
        root.appendChild(list);

        // Re-open menu if render() re-ran while menu was open
        if (this.addMenuOpen && !this.addMenuEl) {
            this.addMenuAnchorEl = addBtn;
            this.openAddMenu(root, raster.id);
        }
    }

    private requestRender(): void {
        if (this.isInteracting) {
            this.pendingRender = true;
            return;
        }
        this.render();
    }

    private renderFilterItem(rasterId: string, inst: FilterInstance): HTMLElement {
        const def = this.registry.get(inst.defId);
        const row = document.createElement('div');
        const borderColor = def?.entityKind === 'bitmap' ? '#22c55e' : '#3b82f6';
        row.style.border = `1px solid ${borderColor}`;
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
        enable.style.width = '16px';
        enable.style.height = '16px';
        enable.style.accentColor = '#888';
        enable.checked = !!inst.enabled;
        enable.title = 'Enabled';
        enable.onchange = () => this.chain.setEnabled(rasterId, inst.instanceId, enable.checked);
        controls.appendChild(enable);

        const del = document.createElement('button');
        del.textContent = 'x';
        del.style.width = '16px';
        del.style.height = '16px';
        del.style.accentColor = '#888';
        del.style.display = 'flex';
        del.style.alignItems = 'center';
        del.style.justifyContent = 'center';
        del.style.padding = '0';
        del.style.lineHeight = '1';
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
        for (const p of schema) {

            let input: HTMLElement;

            if (p.type === 'number') {
                // Render param label & value
                const label = document.createElement('label');
                // label.style.position = 'absolute';
                // label.style.top = '-12px';
                // label.style.left = '2px';
                label.style.fontSize = '11px';
                label.style.position = 'absolute';
                label.textContent = p.label;

                const el = document.createElement('input');
                el.style.background = 'transparent';
                el.style.appearance = 'none';
                el.style.height = '1px';
                el.style.borderRadius = '0';
                el.style.backgroundColor = '#fff';
                el.style.outline = 'none';
                el.style.margin = ' 20px 0 0 0';
                el.style.padding = '0';
                el.style.position = 'relative';
                el.style.flex = '1 1 auto';
                el.style.accentColor = '#fff';
                // Custom slider track and thumb for Chrome/Safari/Edge
                el.style.setProperty('accent-color', '#fff');
                el.addEventListener('input', () => el.style.setProperty('--val', el.value));

                el.style.setProperty('--track-color', '#fff');
                el.style.setProperty('--thumb-color', '#fff');
                el.style.setProperty('--thumb-border', '1px solid #000');

                el.oninput = () => display.textContent = el.value;

                el.onchange = () => this.updateParam(rasterId, inst, p.key, parseFloat(el.value));

                el.addEventListener('focus', () => el.style.outline = 'none');

                // Inline styles for WebKit browsers
                el.style.setProperty('box-shadow', 'none');
                el.style.setProperty('background-image', 'none');

                // Create raw CSS rules for slider
                el.style.cursor = 'pointer';

                el.addEventListener('mousedown', () => el.style.opacity = '0.85');
                el.addEventListener('mouseup', () => el.style.opacity = '1');

                // Dynamically inject slider track/thumb styles
                el.onmousemove = () => { }; // force render for some browsers

                el.style.width = '100%';
                el.type = 'range';
                el.min = String(p.min ?? 0);
                el.max = String(p.max ?? 1);
                el.step = String(p.step ?? 0.01);
                const v = (inst.params as any)?.[p.key];
                el.value = String(typeof v === 'number' ? v : p.min ?? 0);

                // Value display
                const display = document.createElement('span');
                display.style.minWidth = '38px';
                display.style.position = 'absolute';
                display.style.right = '0';
                display.style.fontSize = '11px';
                display.style.opacity = '0.8';
                display.textContent = el.value;

                // put slider and value display in a horizontal layout
                const sliderWrap = document.createElement('div');
                sliderWrap.style.display = 'flex';
                sliderWrap.style.alignItems = 'center';
                sliderWrap.style.gap = '6px';
                sliderWrap.style.marginTop = '10px';
                sliderWrap.appendChild(label);
                sliderWrap.appendChild(el);
                sliderWrap.appendChild(display);

                input = sliderWrap;
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

                // Value display for select
                const display = document.createElement('span');
                display.style.fontSize = '11px';
                display.style.opacity = '0.8';
                display.textContent = el.options[el.selectedIndex]?.textContent || '';
                el.onchange = () => {
                    display.textContent = el.options[el.selectedIndex]?.textContent || '';
                    this.updateParam(rasterId, inst, p.key, el.value);
                };

                // horizontal layout
                const selectWrap = document.createElement('div');
                selectWrap.style.display = 'flex';
                selectWrap.style.alignItems = 'center';
                selectWrap.style.gap = '6px';
                selectWrap.appendChild(el);
                selectWrap.appendChild(display);

                input = selectWrap;
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

    private openAddMenu(root: HTMLElement, rasterId: string): void {
        // Build unique list of filters that can take raster/bitmap/paths
        const inRaster = this.registry.listByInput('raster');
        const inBitmap = this.registry.listByInput('bitmap');
        const inPaths = this.registry.listByInput('paths');
        const all = [...inRaster, ...inBitmap, ...inPaths];
        const seen = new Set<string>();
        const unique = all.filter(def => {
            if (seen.has(def.id)) return false;
            seen.add(def.id);
            return true;
        });

        const menu = document.createElement('div');
        menu.style.position = 'absolute';
        menu.style.background = '#111';
        menu.style.border = '1px solid #444';

        // Give raster filters a green outline, plot filters a blue outline in the menu buttons
        // We'll style the buttons when we create them in the next lines.
        menu.style.borderRadius = '6px';
        menu.style.padding = '6px';
        menu.style.display = 'grid';
        menu.style.gap = '6px';
        menu.style.maxHeight = '40vh';
        menu.style.overflow = 'auto';
        menu.style.zIndex = '1000';

        // Position under the (+) button, relative to root
        const parentRect = root.getBoundingClientRect();
        const anchor = this.addMenuAnchorEl;
        const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
        let top = anchorRect ? (anchorRect.bottom - parentRect.top + 4) : 28;
        let left = anchorRect ? (anchorRect.left - parentRect.left) : 0;

        unique.forEach(def => {
            const btn = document.createElement('button');
            btn.textContent = def.label;
            btn.style.background = '#222';
            btn.style.color = '#eee';
            const borderColor = def.entityKind === 'bitmap' ? '#22c55e' : '#3b82f6';
            btn.style.border = `1px solid ${borderColor}`;
            btn.style.borderRadius = '4px';
            btn.style.padding = '6px 8px';
            btn.style.cursor = 'pointer';
            btn.onmouseenter = () => { btn.style.background = '#2a2a2a'; };
            btn.onmouseleave = () => { btn.style.background = '#222'; };
            btn.onclick = (e) => {
                e.stopPropagation();
                this.chain.addFilter(rasterId, def.id);
                this.closeAddMenu();
            };
            menu.appendChild(btn);
        });

        root.appendChild(menu);

        // Keep menu within root bounds after it's in the DOM (to know its size)
        const maxLeft = Math.max(0, root.clientWidth - menu.offsetWidth - 4);
        const maxTop = Math.max(0, root.clientHeight - menu.offsetHeight - 4);
        if (left > maxLeft) left = maxLeft;
        if (top > maxTop) top = maxTop;
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        this.addMenuEl = menu;
        this.addMenuOpen = true;

        // Outside click to close
        this.outsideClickHandler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (this.addMenuEl && !this.addMenuEl.contains(target) && this.addMenuAnchorEl && !this.addMenuAnchorEl.contains(target)) {
                this.closeAddMenu();
            }
        };
        document.addEventListener('mousedown', this.outsideClickHandler, { capture: true });
    }

    private closeAddMenu(): void {
        this.addMenuOpen = false;
        if (this.addMenuEl && this.addMenuEl.parentElement) {
            this.addMenuEl.parentElement.removeChild(this.addMenuEl);
        }
        this.addMenuEl = null;
        if (this.outsideClickHandler) {
            document.removeEventListener('mousedown', this.outsideClickHandler, { capture: true } as any);
            this.outsideClickHandler = null;
        }
    }
}

export default FilterPanelView;


