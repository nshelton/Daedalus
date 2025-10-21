import { PlotModel } from "../models/PlotModel.js";
import { PlotterControlView } from "../views/PlotterControlView.js";
import { planTrajectory, PlannerSettings } from "./MotionPlanner.js";
import type { Vertex } from "../utils/geom.js";
import { optimizePathOrder } from "../utils/pathOpt.js";

export class PlotterInterfaceController {
    private isConnected = false;
    private selectedPort: string | null = null;

    constructor(private plotModel: PlotModel) {
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
            // Build planner settings (units: inches and seconds)
            const settings = await window.electronAPI.getPlotterSettings();
            const speedPct = settings?.speed ?? 1000; // plotting speed percent-like
            const movePct = settings?.movingSpeed ?? 2000;

            // Hardware constants mirrored from main AxidrawController
            const STEPS_PER_MM = 80;
            const STEPS_PER_INCH = STEPS_PER_MM * 25.4; // 2032
            const MAX_STEPS_PER_SECOND = 5000;

            const speedPenDown_in_s = (speedPct / 100) * MAX_STEPS_PER_SECOND / STEPS_PER_INCH;
            const speedPenUp_in_s = (movePct / 100) * MAX_STEPS_PER_SECOND / STEPS_PER_INCH;

            const plannerSettings: PlannerSettings = {
                speedPenDown: Math.max(0.1, speedPenDown_in_s),
                speedPenUp: Math.max(0.1, speedPenUp_in_s),
                accelPenDown: Math.max(0.5, speedPenDown_in_s * 4), // reach v in ~0.25s
                accelPenUp: Math.max(0.5, speedPenUp_in_s * 4),
                cornering: 60,
                timeSliceMs: 10,
                maxStepRate: 5, // steps/ms
                bounds: [[0, 0], [100, 100]], // inches, placeholder workspace
                stepScale: STEPS_PER_INCH,
                resolution: 1,
                maxStepDistHr: 2 / STEPS_PER_INCH,
                maxStepDistLr: 2 / STEPS_PER_INCH,
                constSpeed: false,
            };

            const mmToIn = (mm: number) => mm / 25.4;
            const toVertexIn = ([xmm, ymm]: [number, number]): Vertex => ({ x: mmToIn(xmm), y: mmToIn(ymm) });

            // Initial state from device
            const posRes = await window.electronAPI.plotterGetPosition();
            let currentMm: [number, number] = posRes.success && posRes.position ? posRes.position : [0, 0];
            let currentIn = toVertexIn(currentMm);

            // Reorder paths to minimize pen-up travel (greedy nearest neighbor with flips)
            const pathsOptimized = optimizePathOrder(paths, { x: currentMm[0], y: currentMm[1] });
            paths = pathsOptimized;

            // Ensure pen up before travel moves
            await window.electronAPI.enqueuePen(true);
            let queueStarted = false;

            for (const path of paths) {
                if (path.length < 1) continue;

                // Travel move to start (pen up)
                const startIn = toVertexIn(path[0]);
                const travelTrajectory = planTrajectory(
                    plannerSettings,
                    [currentIn, startIn],
                    { x: currentIn.x, y: currentIn.y, penUp: true }
                );
                if (travelTrajectory && travelTrajectory.moves.length) {
                    const batch = travelTrajectory.moves.map(m => [m.dtMs, m.s1, m.s2] as [number, number, number]);
                    await window.electronAPI.enqueueSmBatch(batch);
                    if (!queueStarted) {
                        await window.electronAPI.plotterStartQueue();
                        queueStarted = true;
                    }
                    currentIn = { x: travelTrajectory.final.x, y: travelTrajectory.final.y } as Vertex;
                } else {
                    currentIn = startIn;
                }

                // Pen down for drawing
                await window.electronAPI.enqueuePen(false);

                // Draw path (pen down)
                // Do not round user points when planning; rounding can inject jitter
                const vertsIn: Vertex[] = path.map(p => toVertexIn(p));
                const drawTrajectory = planTrajectory(
                    plannerSettings,
                    vertsIn,
                    { x: currentIn.x, y: currentIn.y, penUp: false }
                );
                if (drawTrajectory && drawTrajectory.moves.length) {
                    const batch = drawTrajectory.moves.map(m => [m.dtMs, m.s1, m.s2] as [number, number, number]);
                    await window.electronAPI.enqueueSmBatch(batch);
                    if (!queueStarted) {
                        await window.electronAPI.plotterStartQueue();
                        queueStarted = true;
                    }
                    currentIn = { x: drawTrajectory.final.x, y: drawTrajectory.final.y } as Vertex;
                } else if (vertsIn.length > 0) {
                    currentIn = vertsIn[vertsIn.length - 1];
                }

                // Pen up after path
                await window.electronAPI.enqueuePen(true);
            }

            // Return to origin (pen up) after all paths
            await window.electronAPI.enqueuePen(true);
            const originIn: Vertex = { x: 0, y: 0 };
            if (Math.hypot(currentIn.x - originIn.x, currentIn.y - originIn.y) > 0) {
                const returnTrajectory = planTrajectory(
                    plannerSettings,
                    [currentIn, originIn],
                    { x: currentIn.x, y: currentIn.y, penUp: true }
                );
                if (returnTrajectory && returnTrajectory.moves.length) {
                    const batch = returnTrajectory.moves.map(m => [m.dtMs, m.s1, m.s2] as [number, number, number]);
                    await window.electronAPI.enqueueSmBatch(batch);
                    if (!queueStarted) {
                        await window.electronAPI.plotterStartQueue();
                        queueStarted = true;
                    }
                }
            }
            if (!queueStarted) await window.electronAPI.plotterStartQueue();
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
                    // Preserve original precision; rounding to integers causes 1 mm quantization
                    paths.push(path.map(([x, y]) => [x, y] as [number, number]));
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
