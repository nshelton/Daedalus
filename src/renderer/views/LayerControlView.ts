import { PlotModel } from "../models/PlotModel.js";
import { makeButton, makeButtonGroup } from "./GUIKit.js";

export class LayerControlView {
    private rootElement: HTMLElement;
    private plotModel: PlotModel;
    private listContainer: HTMLDivElement;
    private rastersListContainer: HTMLDivElement;

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

        // Entity list container
        const listHeader = document.createElement('div');
        listHeader.textContent = 'Entities';
        listHeader.style.marginTop = '8px';
        listHeader.style.marginBottom = '6px';
        listHeader.style.fontWeight = '600';
        panel.appendChild(listHeader);

        this.listContainer = document.createElement('div');
        this.listContainer.id = 'entity-list';
        this.listContainer.style.display = 'flex';
        this.listContainer.style.flexDirection = 'column';
        this.listContainer.style.gap = '4px';
        this.listContainer.style.maxHeight = '240px';
        this.listContainer.style.overflowY = 'auto';
        this.listContainer.style.paddingRight = '4px';
        panel.appendChild(this.listContainer);

        // Rasters list container
        const rastersHeader = document.createElement('div');
        rastersHeader.textContent = 'Rasters';
        rastersHeader.style.marginTop = '10px';
        rastersHeader.style.marginBottom = '6px';
        rastersHeader.style.fontWeight = '600';
        panel.appendChild(rastersHeader);

        this.rastersListContainer = document.createElement('div');
        this.rastersListContainer.id = 'raster-list';
        this.rastersListContainer.style.display = 'flex';
        this.rastersListContainer.style.flexDirection = 'column';
        this.rastersListContainer.style.gap = '4px';
        this.rastersListContainer.style.maxHeight = '160px';
        this.rastersListContainer.style.overflowY = 'auto';
        this.rastersListContainer.style.paddingRight = '4px';
        panel.appendChild(this.rastersListContainer);

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

    private renderEntityList(): void {
        if (!this.listContainer) return;
        // Clear existing
        this.listContainer.innerHTML = '';

        const entities = this.plotModel.getEntities();
        if (entities.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No entities';
            empty.style.opacity = '0.8';
            this.listContainer.appendChild(empty);
            return;
        }

        for (const entity of entities) {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.padding = '6px 8px';
            item.style.border = '1px solid #333';
            item.style.borderRadius = '6px';
            item.style.background = 'rgba(0,0,0,0.15)';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.flexDirection = 'column';
            left.style.minWidth = '0';

            const title = document.createElement('div');
            title.textContent = entity.id;
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.style.maxWidth = '160px';
            left.appendChild(title);

            const meta = document.createElement('div');
            const numPaths = entity.paths.length;
            const numPoints = entity.paths.reduce((acc, p) => acc + p.length, 0);
            meta.textContent = `${numPaths} paths · ${numPoints} pts`;
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
                this.plotModel.removeEntity(entity.id);
            });
            actions.appendChild(delBtn);

            item.appendChild(left);
            item.appendChild(actions);

            this.listContainer.appendChild(item);
        }
    }

    private renderRastersList(): void {
        if (!this.rastersListContainer) return;
        this.rastersListContainer.innerHTML = '';

        const rasters = this.plotModel.getRasters();
        if (rasters.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No rasters';
            empty.style.opacity = '0.8';
            this.rastersListContainer.appendChild(empty);
            return;
        }

        for (const r of rasters) {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.padding = '6px 8px';
            item.style.border = '1px solid #333';
            item.style.borderRadius = '6px';
            item.style.background = 'rgba(0,0,0,0.15)';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.flexDirection = 'column';
            left.style.minWidth = '0';

            const title = document.createElement('div');
            title.textContent = r.id;
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.style.maxWidth = '160px';
            left.appendChild(title);

            const meta = document.createElement('div');
            meta.textContent = `${r.width}×${r.height} px · ${Number(r.pixelSizeMm).toFixed(2)} mm/px`;
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
                this.plotModel.removeRaster(r.id);
            });
            actions.appendChild(delBtn);

            item.appendChild(left);
            item.appendChild(actions);

            this.rastersListContainer.appendChild(item);
        }
    }

    private renderAll(): void {
        this.renderEntityList();
        this.renderRastersList();
    }
}