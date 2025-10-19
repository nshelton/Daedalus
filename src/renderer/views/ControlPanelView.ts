import { ControlPanelController } from "../controllers/ControlPanelController.js";
import { PlotterSettings } from "../../preload";
import { makeButton, makeButtonGroup, makeGroup, makeSlider } from "./GUIKit.js";

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

        // Load button
        const loadGroup = makeButtonGroup();
        this.loadPlotBtn = makeButton({ id: 'load-plot-btn', label: 'Open', className: 'btn btn-primary' });
        loadGroup.appendChild(this.loadPlotBtn);
        panel.appendChild(loadGroup);

        // Connection status
        const statusGroup = makeGroup();
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
        const penButtonsGroup = makeGroup();
        const penButtonsWrap = makeButtonGroup();
        this.penUpBtn = makeButton({ id: 'pen-up-btn', label: 'Pen Up' });
        this.penDownBtn = makeButton({ id: 'pen-down-btn', label: 'Pen Down' });
        penButtonsWrap.appendChild(this.penUpBtn);
        penButtonsWrap.appendChild(this.penDownBtn);
        penButtonsGroup.appendChild(penButtonsWrap);
        this.plotterControls.appendChild(penButtonsGroup);

        // Pen up slider
        {
            const { group, slider, valueSpan } = makeSlider({ id: 'pen-up-slider', label: 'Pen Up Position', min: 10000, max: 30000, value: 20000, onInput: (v) => { this.penUpValue.textContent = String(v); } });
            this.penUpSlider = slider;
            this.penUpValue = valueSpan;
            this.plotterControls.appendChild(group);
        }

        // Pen down slider
        {
            const { group, slider, valueSpan } = makeSlider({ id: 'pen-down-slider', label: 'Pen Down Position', min: 10000, max: 30000, value: 15000, onInput: (v) => { this.penDownValue.textContent = String(v); } });
            this.penDownSlider = slider;
            this.penDownValue = valueSpan;
            this.plotterControls.appendChild(group);
        }

        // Speed slider
        {
            const { group, slider, valueSpan } = makeSlider({ id: 'speed-slider', label: 'Plotting Speed', min: 1, max: 100, value: 50, onInput: (v) => { this.speedValue.textContent = String(v); } });
            this.speedSlider = slider;
            this.speedValue = valueSpan;
            this.plotterControls.appendChild(group);
        }

        // Moving speed slider
        {
            const { group, slider, valueSpan } = makeSlider({ id: 'moving-speed-slider', label: 'Moving Speed', min: 1, max: 100, value: 75, onInput: (v) => { if (this.movingSpeedValue) this.movingSpeedValue.textContent = String(v); } });
            this.movingSpeedSlider = slider;
            this.movingSpeedValue = valueSpan;
            this.plotterControls.appendChild(group);
        }

        // Plot/Stop buttons
        const plotButtonsGroup = makeGroup();
        const plotButtonsWrap = makeButtonGroup();
        this.plotBtn = makeButton({ id: 'plot-btn', label: 'PLOT' });
        this.stopBtn = makeButton({ id: 'stop-btn', label: 'STOP' });
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
