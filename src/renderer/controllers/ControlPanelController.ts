import { ControlPanelView } from "../views/ControlPanelView.js";
import { PlotModel } from "../models/PlotModel.js";

export class ControlPanelController {
    private view: ControlPanelView;
    private isConnected = false;
    private selectedPort: string | null = null;

    constructor(private plotModel: PlotModel) {
        this.view = new ControlPanelView(this);
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

    public async onConnectClick(): Promise<void> {
        if (this.isConnected) {
            try {
                this.view.setConnected(false, 'Disconnecting...');
                const result = await window.electronAPI.disconnectSerial();
                if (result.success) {
                    this.isConnected = false;
                    this.selectedPort = null;
                    this.view.setConnected(false, 'Disconnected');
                } else {
                    this.view.setConnected(this.isConnected, this.selectedPort || 'Error');
                }
            } catch (error) {
                console.error('Disconnect error:', error);
                this.view.setConnected(this.isConnected, this.selectedPort || 'Error');
            }
            return;
        }

        try {
            this.view.setConnected(false, 'Searching...');
            const plotterPort = await window.electronAPI.findPlotterPort();
            if (!plotterPort) {
                this.view.setConnected(false, 'Not Found');
                return;
            }
            this.view.setConnected(false, 'Connecting...');
            const result = await window.electronAPI.connectSerial(plotterPort.path, 115200);
            if (result.success) {
                this.isConnected = true;
                this.selectedPort = plotterPort.path;
                this.view.setConnected(true, plotterPort.path);
                await this.initializePlotter();
            } else {
                this.view.setConnected(false, 'Failed');
            }
        } catch (error) {
            console.error('Connect failed:', error);
            this.view.setConnected(false, 'Error');
        }
    }

    private async initializePlotter(): Promise<void> {
        try {
            const plotterSettings = await window.electronAPI.getPlotterSettings();
            if (!plotterSettings) {
                console.error('Failed to get plotter settings');
                return;
            }
            this.view.setInitialSettings(plotterSettings);
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
