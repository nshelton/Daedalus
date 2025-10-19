import { PlotModel } from "../models/PlotModel.js";
import { PlotterControlView } from "../views/PlotterControlView.js";

export class PlotterInterfaceController {
    private isConnected = false;
    private selectedPort: string | null = null;

    constructor(private plotModel: PlotModel) {
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

    public async onPenUpClick(): Promise<void> {
        try {
            console.log('Sending pen up');
            await window.electronAPI.plotterPenUp();
        } catch (error) {
            console.error('Error sending pen up:', error);
        }
    }

    public async onPenDownClick(): Promise<void> {
        try {
            await window.electronAPI.plotterPenDown();
        } catch (error) {
            console.error('Error sending pen down:', error);
        }
    }

    public async onPlotClick(): Promise<void> {
        try {
            const entities = this.plotModel.getEntities();
            let paths = this.entitiesToPaths(entities);

            if (paths.length === 0) {
                alert('No entities to plot. Double-click on the canvas to add shapes.');
                return;
            }
            const result = await window.electronAPI.plotterPlotPath(paths, true);
            if (result.success) {
                await window.electronAPI.plotterStartQueue();
            } else {
                alert('Failed to plot: ' + result.error);
            }
        } catch (error) {
            console.error('Error plotting:', error);
            alert('Error plotting: ' + error);
        }
    }

    public async onStopClick(): Promise<void> {
        try {
            await window.electronAPI.plotterStopQueue();
            await window.electronAPI.plotterReset();
            await window.electronAPI.plotterPenUp();
        } catch (error) {
            console.error('Error stopping plot:', error);
            alert('Error stopping: ' + error);
        }
    }

    public async onDisengageClick(): Promise<void> {
        try {
            await window.electronAPI.plotterDisengage();
        } catch (error) {
            console.error('Error disengaging motors:', error);
        }
    }

    public async onSetPenUp(value: number): Promise<void> {
        try {
            await window.electronAPI.plotterSetPenUpValue(value);
        } catch (error) {
            console.error('Error setting pen up position:', error);
        }
    }

    public async onSetPenDown(value: number): Promise<void> {
        try {
            await window.electronAPI.plotterSetPenDownValue(value);
        } catch (error) {
            console.error('Error setting pen down position:', error);
        }
    }

    public async onSetSpeed(value: number): Promise<void> {
        try {
            await window.electronAPI.plotterSetSpeed(value);
        } catch (error) {
            console.error('Error setting speed:', error);
        }
    }

    public async onSetMovingSpeed(value: number): Promise<void> {
        try {
            await window.electronAPI.setMovingSpeed(value);
        } catch (error) {
            console.error('Failed to set moving speed:', error);
        }
    }

    private entitiesToPaths(entities: ReturnType<PlotModel['getEntities']>): [number, number][][] {
        const paths: [number, number][][] = [];
        entities.forEach(entity => {
            entity.paths.forEach(path => {
                if (path.length > 0) {
                    const roundedPath = path.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]);
                    paths.push(roundedPath);
                }
            });
        });
        return paths;
    }

    public async onConnectClick(view: PlotterControlView): Promise<void> {
        if (this.isConnected) {
            try {
                view.setConnected(false, 'Disconnecting...');
                const result = await window.electronAPI.disconnectSerial();
                if (result.success) {
                    this.isConnected = false;
                    this.selectedPort = null;
                    view.setConnected(false, 'Disconnected');
                } else {
                    view.setConnected(this.isConnected, this.selectedPort || 'Error');
                }
            } catch (error) {
                console.error('Disconnect error:', error);
                view.setConnected(this.isConnected, this.selectedPort || 'Error');
            }
            return;
        }

        try {
            view.setConnected(false, 'Searching...');
            const plotterPort = await window.electronAPI.findPlotterPort();
            if (!plotterPort) {
                view.setConnected(false, 'Not Found');
                return;
            }
            view.setConnected(false, 'Connecting...');
            const result = await window.electronAPI.connectSerial(plotterPort.path, 115200);
            if (result.success) {
                this.isConnected = true;
                this.selectedPort = plotterPort.path;
                view.setConnected(true, plotterPort.path);
                await this.initializePlotter(view);
            } else {
                view.setConnected(false, 'Failed');
            }
        } catch (error) {
            console.error('Connect failed:', error);
            view.setConnected(false, 'Error');
        }
    }

    private async initializePlotter(view: PlotterControlView): Promise<void> {
        try {
            const plotterSettings = await window.electronAPI.getPlotterSettings();
            if (!plotterSettings) {
                console.error('Failed to get plotter settings');
                return;
            }
            view.setInitialSettings(plotterSettings);
            const result = await window.electronAPI.plotterInitialize();
            if (result.success) {
                await window.electronAPI.plotterSetOrigin();
                const positionResult = await window.electronAPI.plotterGetPosition();
                if (!(positionResult.success && positionResult.position)) {
                    console.log('Could not query plotter position, assuming (0,0)');
                }
            } else {
                console.error('Plotter initialization failed:', result.error);
            }
        } catch (error) {
            console.error('Error initializing plotter:', error);
        }
    }
}
