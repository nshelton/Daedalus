import type { AxidrawState } from "../../preload";

export class SerialView {

    // State
    private dataBuffer: number[] = [];
    private totalBytesReceived: number = 0;
    private lastSampleTime: number = Date.now();
    private sampleCount: number = 0;
    // sampleRateHz can be wired to UI later if needed
    // UI elements for diagnostics
    private diagnosticsPanel!: HTMLDivElement;
    private diagnosticsValues: Record<string, HTMLDivElement> = {};


    constructor(rootElement: HTMLElement) {
        // Floating diagnostics panel
        const panel = document.createElement('div');
        panel.id = 'serial-diagnostics';
        panel.style.position = 'fixed';
        panel.style.right = '16px';
        panel.style.top = '60px';
        panel.style.zIndex = '9999';
        panel.style.background = 'rgba(0,0,0,0.5)';
        panel.style.borderRadius = '4px';
        panel.style.color = '#88ff88';
        panel.style.padding = '10px';
        panel.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        panel.style.fontSize = '12px';

        const makeRow = (label: string, key: string) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.gap = '12px';
            row.style.padding = '2px 0';

            const keyEl = document.createElement('div');
            keyEl.textContent = label;
            keyEl.style.opacity = '0.8';

            const valueEl = document.createElement('div');
            valueEl.textContent = '-';
            valueEl.style.fontWeight = '600';
            valueEl.style.textAlign = 'right';

            row.appendChild(keyEl);
            row.appendChild(valueEl);
            this.diagnosticsValues[key] = valueEl;
            return row;
        };

        const rows = [
            'commandsSent',
            'commandsCompleted',
            'isPaused',
            'speed',
            'movingSpeed',
            'penUpPosition',
            'penDownPosition',
            'position',
            'queueLength',
            'queue',
            'totalPlannedCommands',
            'totalDistanceDrawnMm',
            'startTime',
        ];

        rows.forEach(k => panel.appendChild(makeRow(k, k)));

        rootElement.appendChild(panel);
        this.diagnosticsPanel = panel as HTMLDivElement;
    }


    // Update connection status display
    updateConnectionStatus(connected: boolean, text?: string): void {
        if (this.diagnosticsPanel) {
            this.diagnosticsPanel.dataset.connected = String(connected);
            this.diagnosticsPanel.title = text || '';
        }
    }

    // Handle incoming serial data
    handleSerialData(data: any): void {
        this.totalBytesReceived += data.length;
        // dataReceivedSpan.textContent = `${this.totalBytesReceived} bytes`;

        // Update sample rate
        this.sampleCount++;
        const now = Date.now();
        const elapsed = (now - this.lastSampleTime) / 1000;
        if (elapsed >= 1.0) {
            this.sampleCount = 0;
            this.lastSampleTime = now;
        }

        // Parse and store data (placeholder for actual plotting logic)
        try {
            const value = parseFloat(data.toString().trim());
            if (!isNaN(value)) {
                // this.lastValueSpan.textContent = value.toFixed(2);
                this.dataBuffer.push(value);

                // Limit buffer size
                const maxPoints = 1000;
                if (this.dataBuffer.length > maxPoints) {
                    this.dataBuffer.shift();
                }
            }
        } catch (error) {
            console.error('Error parsing data:', error);
        }
    }

    startPlotterStatePolling(): void {
        const poll = async () => {
            try {
                const state = await window.electronAPI.plotterGetState();
                this.updateDiagnostics(state as unknown as Partial<AxidrawState> & { queue?: unknown[] });
            } catch (e) {
                // Swallow transient errors
            }
        };
        setInterval(poll, 200);
    }

    private updateDiagnostics(state: Partial<AxidrawState> & { queue?: unknown[] }): void {
        const setValue = (key: string, value: string) => {
            const el = this.diagnosticsValues[key];
            if (el) el.textContent = value;
        };

        if (typeof state.commandsSent !== 'undefined') setValue('commandsSent', String(state.commandsSent));
        if (typeof state.commandsCompleted !== 'undefined') setValue('commandsCompleted', String(state.commandsCompleted));
        if (typeof state.isPaused !== 'undefined') setValue('isPaused', String(Boolean(state.isPaused)));
        if (typeof state.speed !== 'undefined') setValue('speed', String(state.speed));
        if (typeof state.movingSpeed !== 'undefined') setValue('movingSpeed', String(state.movingSpeed));
        if (typeof state.penUpPosition !== 'undefined') setValue('penUpPosition', String(state.penUpPosition));
        if (typeof state.penDownPosition !== 'undefined') setValue('penDownPosition', String(state.penDownPosition));
        if (typeof state.position !== 'undefined' && Array.isArray(state.position)) {
            const [x, y] = state.position as [number, number];
            setValue('position', `[${x}, ${y}]`);
        }
        if (typeof state.queueLength !== 'undefined') setValue('queueLength', String(state.queueLength));
        if (typeof state.queue !== 'undefined') setValue('queue', `${Array.isArray(state.queue) ? state.queue.length : 0} items`);
        if (typeof state.totalPlannedCommands !== 'undefined') setValue('totalPlannedCommands', String(state.totalPlannedCommands));
        if (typeof state.totalDistanceDrawnMm !== 'undefined') setValue('totalDistanceDrawnMm', `${state.totalDistanceDrawnMm}`);
        if (typeof state.startTime !== 'undefined') {
            const v = state.startTime as unknown as string | Date | null;
            const d = v ? new Date(v) : null;
            setValue('startTime', d ? d.toLocaleTimeString() : 'null');
        }
    }



}
