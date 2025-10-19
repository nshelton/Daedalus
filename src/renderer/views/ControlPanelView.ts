import { ControlPanelController } from "../controllers/ControlPanelController";
import { PlotterSettings } from "../../preload";

export class ControlPanelView {
    private statusIndicator: HTMLElement;
    private plotterControls: HTMLElement;

    private penUpBtn: HTMLButtonElement;
    private penDownBtn: HTMLButtonElement;
    private plotBtn: HTMLButtonElement;
    private stopBtn: HTMLButtonElement;
    private disengageBtn!: HTMLButtonElement;
    private statusBtn: HTMLButtonElement;
    private loadPlotBtn?: HTMLButtonElement;

    private penUpSlider: HTMLInputElement;
    private penDownSlider: HTMLInputElement;
    private speedSlider: HTMLInputElement;
    private movingSpeedSlider: HTMLInputElement;

    private penUpValue: HTMLSpanElement;
    private penDownValue: HTMLSpanElement;
    private speedValue: HTMLSpanElement;
    private movingSpeedValue: HTMLSpanElement;

    constructor(private controller: ControlPanelController) {
        this.controller = controller;
        const root = document.getElementById('control-panel-root');
        if (!root) throw new Error('control-panel-root not found');

        const panel = document.createElement('div');
        panel.className = 'control-panel';

        const title = document.createElement('h2');
        title.className = 'panel-title';
        title.textContent = 'Plotter Controls';
        panel.appendChild(title);

        // Load button
        const loadGroup = document.createElement('div');
        loadGroup.className = 'button-group';
        this.loadPlotBtn = document.createElement('button');
        this.loadPlotBtn.id = 'load-plot-btn';
        this.loadPlotBtn.className = 'btn btn-primary';
        this.loadPlotBtn.textContent = 'Open';
        loadGroup.appendChild(this.loadPlotBtn);
        panel.appendChild(loadGroup);

        // Connection status
        const statusGroup = document.createElement('div');
        statusGroup.className = 'control-group';
        const statusWrap = document.createElement('div');
        statusWrap.className = 'connection-status';
        this.statusIndicator = document.createElement('span');
        this.statusIndicator.className = 'status-indicator disconnected';
        this.statusBtn = document.createElement('button');
        this.statusBtn.id = 'status-btn';
        this.statusBtn.className = 'status-btn';
        this.statusBtn.textContent = 'Disconnected';
        statusWrap.appendChild(this.statusIndicator);
        statusWrap.appendChild(this.statusBtn);
        statusGroup.appendChild(statusWrap);
        panel.appendChild(statusGroup);

        // Plotter controls container (hidden by default)
        this.plotterControls = document.createElement('div');
        this.plotterControls.id = 'plotter-controls';
        this.plotterControls.style.display = 'none';

        // Disengage
        this.plotterControls.appendChild(this.createButtonGroup('disengage-btn', 'Disengage Motors', (btn) => {
            this.disengageBtn = btn as HTMLButtonElement;
        }));

        // Pen up/down buttons
        const penButtonsGroup = document.createElement('div');
        penButtonsGroup.className = 'control-group';
        const penButtonsWrap = document.createElement('div');
        penButtonsWrap.className = 'button-group';
        this.penUpBtn = document.createElement('button');
        this.penUpBtn.id = 'pen-up-btn';
        this.penUpBtn.className = 'btn btn-primary';
        this.penUpBtn.textContent = 'Pen Up';
        this.penDownBtn = document.createElement('button');
        this.penDownBtn.id = 'pen-down-btn';
        this.penDownBtn.className = 'btn btn-primary';
        this.penDownBtn.textContent = 'Pen Down';
        penButtonsWrap.appendChild(this.penUpBtn);
        penButtonsWrap.appendChild(this.penDownBtn);
        penButtonsGroup.appendChild(penButtonsWrap);
        this.plotterControls.appendChild(penButtonsGroup);

        // Pen up slider
        const penUpGroup = document.createElement('div');
        penUpGroup.className = 'control-group';
        const penUpLabel = document.createElement('label');
        penUpLabel.setAttribute('for', 'pen-up-slider');
        penUpLabel.innerHTML = 'Pen Up Position: <span id="pen-up-value">20000</span>';
        this.penUpValue = penUpLabel.querySelector('#pen-up-value') as HTMLSpanElement;
        this.penUpSlider = document.createElement('input');
        this.penUpSlider.type = 'range';
        this.penUpSlider.id = 'pen-up-slider';
        this.penUpSlider.className = 'slider';
        this.penUpSlider.min = '10000';
        this.penUpSlider.max = '30000';
        this.penUpSlider.value = '20000';
        penUpGroup.appendChild(penUpLabel);
        penUpGroup.appendChild(this.penUpSlider);
        this.plotterControls.appendChild(penUpGroup);

        // Pen down slider
        const penDownGroup = document.createElement('div');
        penDownGroup.className = 'control-group';
        const penDownLabel = document.createElement('label');
        penDownLabel.setAttribute('for', 'pen-down-slider');
        penDownLabel.innerHTML = 'Pen Down Position: <span id="pen-down-value">15000</span>';
        this.penDownValue = penDownLabel.querySelector('#pen-down-value') as HTMLSpanElement;
        this.penDownSlider = document.createElement('input');
        this.penDownSlider.type = 'range';
        this.penDownSlider.id = 'pen-down-slider';
        this.penDownSlider.className = 'slider';
        this.penDownSlider.min = '10000';
        this.penDownSlider.max = '30000';
        this.penDownSlider.value = '15000';
        penDownGroup.appendChild(penDownLabel);
        penDownGroup.appendChild(this.penDownSlider);
        this.plotterControls.appendChild(penDownGroup);

        // Speed slider
        const speedGroup = document.createElement('div');
        speedGroup.className = 'control-group';
        const speedLabel = document.createElement('label');
        speedLabel.setAttribute('for', 'speed-slider');
        speedLabel.innerHTML = 'Plotting Speed: <span id="speed-value">50</span>%';
        this.speedValue = speedLabel.querySelector('#speed-value') as HTMLSpanElement;
        this.speedSlider = document.createElement('input');
        this.speedSlider.type = 'range';
        this.speedSlider.id = 'speed-slider';
        this.speedSlider.className = 'slider';
        this.speedSlider.min = '1';
        this.speedSlider.max = '100';
        this.speedSlider.value = '50';
        speedGroup.appendChild(speedLabel);
        speedGroup.appendChild(this.speedSlider);
        this.plotterControls.appendChild(speedGroup);

        // Moving speed slider
        const movingSpeedGroup = document.createElement('div');
        movingSpeedGroup.className = 'control-group';
        const movingSpeedLabel = document.createElement('label');
        movingSpeedLabel.setAttribute('for', 'moving-speed-slider');
        movingSpeedLabel.innerHTML = 'Moving Speed: <span id="moving-speed-value">75</span>%';
        this.movingSpeedValue = movingSpeedLabel.querySelector('#moving-speed-value') as HTMLSpanElement;
        this.movingSpeedSlider = document.createElement('input');
        this.movingSpeedSlider.type = 'range';
        this.movingSpeedSlider.id = 'moving-speed-slider';
        this.movingSpeedSlider.className = 'slider';
        this.movingSpeedSlider.min = '1';
        this.movingSpeedSlider.max = '100';
        this.movingSpeedSlider.value = '75';
        movingSpeedGroup.appendChild(movingSpeedLabel);
        movingSpeedGroup.appendChild(this.movingSpeedSlider);
        this.plotterControls.appendChild(movingSpeedGroup);

        // Plot/Stop buttons
        const plotButtonsGroup = document.createElement('div');
        plotButtonsGroup.className = 'control-group';
        const plotButtonsWrap = document.createElement('div');
        plotButtonsWrap.className = 'button-group';
        this.plotBtn = document.createElement('button');
        this.plotBtn.id = 'plot-btn';
        this.plotBtn.className = 'btn btn-primary';
        this.plotBtn.textContent = 'PLOT';
        this.stopBtn = document.createElement('button');
        this.stopBtn.id = 'stop-btn';
        this.stopBtn.className = 'btn btn-primary';
        this.stopBtn.textContent = 'STOP';
        plotButtonsWrap.appendChild(this.plotBtn);
        plotButtonsWrap.appendChild(this.stopBtn);
        plotButtonsGroup.appendChild(plotButtonsWrap);
        this.plotterControls.appendChild(plotButtonsGroup);

        panel.appendChild(this.plotterControls);
        root.appendChild(panel);

        this.wireEvents();
    }

    private createButtonGroup(id: string, label: string, assign: (btn: HTMLButtonElement) => void): HTMLElement {
        const group = document.createElement('div');
        group.className = 'control-group';
        const wrap = document.createElement('div');
        wrap.className = 'button-group';
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'btn btn-secondary';
        btn.textContent = label;
        wrap.appendChild(btn);
        group.appendChild(wrap);
        assign(btn);
        return group;
    }

    private wireEvents(): void {
        // Buttons
        this.statusBtn.addEventListener('click', this.controller.onConnectClick.bind(this.controller));
        if (this.loadPlotBtn) {
            this.loadPlotBtn.addEventListener('click', this.controller.onLoadPlotClick.bind(this.controller));
        }
        this.penUpBtn.addEventListener('click', this.controller.onPenUpClick.bind(this.controller));
        this.penDownBtn.addEventListener('click', this.controller.onPenDownClick.bind(this.controller));
        this.plotBtn.addEventListener('click', this.controller.onPlotClick.bind(this.controller));
        this.stopBtn.addEventListener('click', this.controller.onStopClick.bind(this.controller));
        this.disengageBtn.addEventListener('click', this.controller.onDisengageClick.bind(this.controller));

        // Sliders immediate UI feedback
        this.penUpSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            this.penUpValue.textContent = value;
        });
        this.penDownSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            this.penDownValue.textContent = value;
        });
        this.speedSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            this.speedValue.textContent = value;
        });
        this.movingSpeedSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (this.movingSpeedValue) this.movingSpeedValue.textContent = value;
        });

        // Sliders commit
        this.penUpSlider.addEventListener('change', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            this.controller.onSetPenUp(value);
        });
        this.penDownSlider.addEventListener('change', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            this.controller.onSetPenDown(value);
        });
        this.speedSlider.addEventListener('change', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            this.controller.onSetSpeed(value);
        });
        this.movingSpeedSlider.addEventListener('change', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            this.controller.onSetMovingSpeed(value);
        });
    }

    // Public API
    setConnected(connected: boolean, text?: string): void {
        if (connected) {
            this.statusIndicator.classList.remove('disconnected');
            this.statusIndicator.classList.add('connected');
            this.statusBtn.textContent = text || 'Connected';
            this.plotterControls.style.display = 'block';
        } else {
            this.statusIndicator.classList.remove('connected');
            this.statusIndicator.classList.add('disconnected');
            this.statusBtn.textContent = text || 'Disconnected';
            this.plotterControls.style.display = 'none';
        }
    }

    setInitialSettings(plotterSettings: PlotterSettings): void {
        this.penUpSlider.value = String(plotterSettings.penUpPosition);
        this.penUpValue.textContent = String(plotterSettings.penUpPosition);
        this.penDownSlider.value = String(plotterSettings.penDownPosition);
        this.penDownValue.textContent = String(plotterSettings.penDownPosition);
        this.speedSlider.value = String(plotterSettings.speed);
        this.speedValue.textContent = String(plotterSettings.speed);
        this.movingSpeedSlider.value = String(plotterSettings.movingSpeed);
        this.movingSpeedValue.textContent = String(plotterSettings.movingSpeed);
    }
}
