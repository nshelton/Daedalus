import { PlotModel } from "../models/PlotModel.js";
import { makeButton, makeButtonGroup } from "./GUIKit.js";

export class LayerControlView {
    private rootElement: HTMLElement;
    private plotModel: PlotModel;
    private listContainer: HTMLDivElement;
    private darkModeToggle!: HTMLInputElement;
    private nodeDotsToggle!: HTMLInputElement;

    //buttons
    private loadPlotBtn: HTMLButtonElement;

    constructor(rootElement: HTMLElement, plotModel: PlotModel) {
        this.plotModel = plotModel;
        const panel = document.createElement('div');
        panel.id = 'layer-control';
        panel.style.position = 'fixed';
        panel.style.left = '16px';
        panel.style.bottom = '16px';
        panel.style.zIndex = '9999';
        panel.style.background = 'rgba(0,0,0,0.2)';
        panel.style.color = '#ffffff';
        panel.style.border = '1px solid #444';
        panel.style.borderRadius = '8px';
        panel.style.padding = '10px 12px';
        panel.style.fontFamily = 'ui-monospace, IBM Plex Mono, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        panel.style.fontSize = '12px';
        panel.style.minWidth = '220px';
        panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';

        this.rootElement = rootElement;
        this.rootElement.appendChild(panel);

        this.loadPlotBtn = makeButton({ id: 'load-plot-btn', label: 'Open', className: 'btn btn-primary' });

        // Load button
        const loadGroup = makeButtonGroup();
        loadGroup.appendChild(this.loadPlotBtn);
        panel.appendChild(loadGroup);

        // Rendering controls
        const renderHeader = document.createElement('div');
        renderHeader.textContent = 'Rendering';
        renderHeader.style.marginTop = '8px';
        renderHeader.style.marginBottom = '6px';
        renderHeader.style.fontWeight = '600';
        panel.appendChild(renderHeader);

        const renderControls = document.createElement('div');
        renderControls.style.display = 'flex';
        renderControls.style.flexDirection = 'column';
        renderControls.style.gap = '6px';

        // Dark mode toggle
        const darkRow = document.createElement('label');
        darkRow.style.display = 'flex';
        darkRow.style.alignItems = 'center';
        darkRow.style.gap = '8px';
        const darkInput = document.createElement('input');
        darkInput.type = 'checkbox';
        darkInput.checked = this.plotModel.isDarkMode ? this.plotModel.isDarkMode() : true;
        darkInput.addEventListener('change', () => this.plotModel.setDarkMode?.(darkInput.checked));
        const darkText = document.createElement('span');
        darkText.textContent = 'Dark mode';
        darkRow.appendChild(darkInput);
        darkRow.appendChild(darkText);
        this.darkModeToggle = darkInput;

        // Node dots toggle
        const dotsRow = document.createElement('label');
        dotsRow.style.display = 'flex';
        dotsRow.style.alignItems = 'center';
        dotsRow.style.gap = '8px';
        const dotsInput = document.createElement('input');
        dotsInput.type = 'checkbox';
        dotsInput.checked = this.plotModel.isShowNodeDots ? this.plotModel.isShowNodeDots() : true;
        dotsInput.addEventListener('change', () => this.plotModel.setShowNodeDots?.(dotsInput.checked));
        const dotsText = document.createElement('span');
        dotsText.textContent = 'Show node dots';
        dotsRow.appendChild(dotsInput);
        dotsRow.appendChild(dotsText);
        this.nodeDotsToggle = dotsInput;

        renderControls.appendChild(darkRow);
        renderControls.appendChild(dotsRow);
        panel.appendChild(renderControls);

        // Unified Layers list container
        const listHeader = document.createElement('div');
        listHeader.textContent = 'Layers';
        listHeader.style.marginTop = '8px';
        listHeader.style.marginBottom = '6px';
        listHeader.style.fontWeight = '600';
        panel.appendChild(listHeader);

        this.listContainer = document.createElement('div');
        this.listContainer.id = 'layers-list';
        this.listContainer.style.display = 'flex';
        this.listContainer.style.flexDirection = 'column';
        this.listContainer.style.gap = '4px';
        this.listContainer.style.maxHeight = '360px';
        this.listContainer.style.overflowY = 'auto';
        this.listContainer.style.paddingRight = '4px';
        panel.appendChild(this.listContainer);

        this.loadPlotBtn.addEventListener('click', this.onLoadPlotClick.bind(this));

        // Subscribe to model changes to re-render lists
        this.plotModel.subscribe(() => this.renderAll());
        // Initial render
        this.renderAll();

    }

    public async onLoadPlotClick(): Promise<void> {
        try {
            const result = await window.electronAPI.openPlotFile();
            if (!result || result.canceled) return;
            if (result.error) {
                alert('Failed to open plot file: ' + result.error);
                return;
            }

            const file = result.json as any;
            if (!file || !Array.isArray(file.plot_models)) {
                alert('Invalid plot file: missing plot_models array');
                return;
            }

            // Optional viewport application
            if (typeof file.zoom === 'number') {
                this.plotModel.setZoom(file.zoom);
            }
            if (Array.isArray(file.camera_position) && file.camera_position.length >= 2) {
                const [px, py] = file.camera_position;
                this.plotModel.setPan(px, py);
            }

            for (const pm of file.plot_models) {
                if (!pm || !Array.isArray(pm.paths)) continue;
                const scale: number = typeof pm.scale === 'number' ? pm.scale : 1;
                const posX: number = pm.position && typeof pm.position.x === 'number' ? pm.position.x : 0;
                const posY: number = pm.position && typeof pm.position.y === 'number' ? pm.position.y : 0;
                const id: string = typeof pm.id === 'string' ? pm.id : `imported-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

                const paths: [number, number][][] = [];
                for (const path of pm.paths) {
                    if (!Array.isArray(path)) continue;
                    const mapped = path
                        .filter((p: any) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
                        .map(([x, y]: [number, number]) => [posX + x * scale, posY + y * scale] as [number, number]);
                    if (mapped.length > 0) paths.push(mapped);
                }

                if (paths.length > 0) {
                    this.plotModel.addEntity({ id, paths });
                }
            }
        } catch (error) {
            console.error('Error loading plot:', error);
            alert('Error loading plot: ' + error);
        }
    }

    private renderLayersList(): void {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';
        const layers = (this.plotModel as any).getLayers ? (this.plotModel as any).getLayers() as any[] : [];
        const selected = (this.plotModel as any).getSelectedLayerId ? (this.plotModel as any).getSelectedLayerId() as string | null : null;
        if (layers.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No layers';
            empty.style.opacity = '0.8';
            this.listContainer.appendChild(empty);
            return;
        }
        for (const layer of layers) {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.padding = '6px 8px';
            item.style.border = '1px solid #333';
            item.style.borderRadius = '6px';
            item.style.background = selected === layer.id ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.15)';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.flexDirection = 'column';
            left.style.minWidth = '0';

            const title = document.createElement('div');
            title.textContent = layer.id;
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.style.maxWidth = '160px';
            left.appendChild(title);

            const meta = document.createElement('div');
            if (layer.kind === 'paths') {
                const numPaths = (layer.paths?.length ?? 0);
                const numPoints = (layer.paths ?? []).reduce((acc: number, p: any[]) => acc + p.length, 0);
                meta.textContent = `${numPaths} paths · ${numPoints} pts`;
            } else {
                const w = layer.width ?? 0, h = layer.height ?? 0, ps = layer.pixelSizeMm ?? 1;
                meta.textContent = `${w}×${h} px · ${ps.toFixed(2)} mm/px`;
            }
            meta.style.opacity = '0.8';
            meta.style.marginTop = '2px';
            left.appendChild(meta);

            const actions = document.createElement('div');
            const delBtn = document.createElement('button');
            delBtn.textContent = 'x';
            delBtn.title = 'Delete';
            delBtn.style.border = 'none';
            delBtn.style.background = 'transparent';
            delBtn.style.color = '#f0f';
            delBtn.style.cursor = 'pointer';
            delBtn.style.fontSize = '14px';
            delBtn.style.padding = '4px 6px';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (layer.id.startsWith('e:')) this.plotModel.removeEntity(layer.id.slice(2));
                else if (layer.id.startsWith('r:')) this.plotModel.removeRaster(layer.id.slice(2));
            });
            actions.appendChild(delBtn);

            item.onclick = () => (this.plotModel as any).setSelectedLayerId?.(layer.id);

            item.appendChild(left);
            item.appendChild(actions);
            this.listContainer.appendChild(item);
        }
    }

    private renderAll(): void {
        // sync toggles
        if (this.darkModeToggle) this.darkModeToggle.checked = this.plotModel.isDarkMode ? this.plotModel.isDarkMode() : this.darkModeToggle.checked;
        if (this.nodeDotsToggle) this.nodeDotsToggle.checked = this.plotModel.isShowNodeDots ? this.plotModel.isShowNodeDots() : this.nodeDotsToggle.checked;
        this.renderLayersList();
    }
}