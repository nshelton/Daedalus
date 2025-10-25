import { PlotEntity, PlotModel } from "../models/PlotModel.js";
import { ContextMenuItem, ContextMenuView } from "../views/ContextMenuView.js";
import { PathTools } from "../PathTools.js";

export class ContextMenuController {
    private readonly model: PlotModel;
    private readonly view: ContextMenuView;

    constructor(model: PlotModel, view: ContextMenuView) {
        this.model = model;
        this.view = view;
    }

    show(screenX: number, screenY: number, worldX: number, worldY: number): void {
        // Layer-based hit test: check raster bounds first (top-most), then entities
        let hitLayerId: string | null = null;
        const layers = (this.model as any).getLayers ? (this.model as any).getLayers() as any[] : [];
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const b = (this.model as any).getLayerBounds ? (this.model as any).getLayerBounds(layer) : null;
            if (!b) continue;
            if (worldX >= b.x && worldX <= b.x + b.width && worldY >= b.y && worldY <= b.y + b.height) {
                hitLayerId = layer.id;
                break;
            }
        }

        const items: ContextMenuItem[] = hitLayerId
            ? [
                { id: 'rotate_cw', label: 'Rotate 90° CW' },
                { id: 'rotate_ccw', label: 'Rotate 90° CCW' },
                { id: 'flip_h', label: 'Flip Horizontal' },
                { id: 'flip_v', label: 'Flip Vertical' },
                { id: 'delete', label: 'Delete' },
            ]
            : [
                { id: 'add_square', label: 'Add Square' },
                { id: 'add_circle', label: 'Add Circle' },
                { id: 'add_axes', label: 'Add Axes' },
                { id: 'add_datetime', label: 'Add Date/Time' },
                { id: 'add_pikachu', label: 'Add Pikachu' },
            ];

        this.view.show(items, screenX, screenY, (id) => this.onSelect(id, worldX, worldY, hitLayerId));
    }

    hide(): void {
        this.view.hide();
    }

    private onSelect(id: string, worldX: number, worldY: number, layerId: string | null): void {
        if (layerId) {
            if (layerId.startsWith('e:')) {
                const entityId = layerId.slice(2);
                const entity = this.model.getEntity(entityId);
                if (!entity) return;
                switch (id) {
                    case 'rotate_cw':
                        this.rotateEntity(entity, 90);
                        break;
                    case 'rotate_ccw':
                        this.rotateEntity(entity, -90);
                        break;
                    case 'flip_h':
                        this.flipEntity(entity, 'h');
                        break;
                    case 'flip_v':
                        this.flipEntity(entity, 'v');
                        break;
                    case 'delete':
                        this.model.removeEntity(entity.id);
                        break;
                }
                return;
            }
            if (layerId.startsWith('r:')) {
                const rasterId = layerId.slice(2);
                if (id === 'delete') {
                    this.model.removeRaster(rasterId);
                    return;
                }
                // For rasters, transform operations omitted for now
                return;
            }
        }

        // Background actions
        switch (id) {
            case 'add_square': {
                this.model.addEntity({ id: `square${Date.now()}`, paths: PathTools.createSquarePath(worldX, worldY, 40) });
                break;
            }
            case 'add_circle': {
                this.model.addEntity({ id: `circle${Date.now()}`, paths: PathTools.createCirclePaths(worldX, worldY, 40) });
                break;
            }
            case 'add_axes': {
                this.model.addEntity({ id: `axes${Date.now()}`, paths: PathTools.createAxesPaths(worldX, worldY, 100, 10) });
                break;
            }
            case 'add_datetime': {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const hh = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                const text = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
                const textPaths = (PathTools as any).font.textToPaths(text, worldX, worldY, 12);
                this.model.addEntity({ id: `text${Date.now()}`, paths: textPaths });
                break;
            }
            case 'add_pikachu': {
                this.model.addEntity({ id: `pikachu${Date.now()}`, paths: PathTools.createPikachuPath(worldX, worldY, 40) });
                break;
            }
        }
    }

    private rotateEntity(entity: PlotEntity, angleDeg: number): void {
        const bounds = (this.model as any).getLayerBounds({ id: `e:${entity.id}`, kind: 'paths', x: 0, y: 0, paths: entity.paths });
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const rad = angleDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const newPaths = entity.paths.map(path => path.map(([x, y]) => {
            const dx = x - cx;
            const dy = y - cy;
            const nx = cx + dx * cos - dy * sin;
            const ny = cy + dx * sin + dy * cos;
            return [nx, ny] as [number, number];
        }));
        this.model.updateEntity(entity.id, { paths: newPaths });
    }

    private flipEntity(entity: PlotEntity, axis: 'h' | 'v'): void {
        const bounds = (this.model as any).getLayerBounds({ id: `e:${entity.id}`, kind: 'paths', x: 0, y: 0, paths: entity.paths });
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const newPaths = entity.paths.map(path => path.map(([x, y]) => {
            const nx = axis === 'h' ? cx - (x - cx) : x;
            const ny = axis === 'v' ? cy - (y - cy) : y;
            return [nx, ny] as [number, number];
        }));
        this.model.updateEntity(entity.id, { paths: newPaths });
    }

    // Entity helpers removed; layer-based bounds are provided by PlotModel
}


