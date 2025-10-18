import { ControlPanelController } from "../controllers/ControlPanelController";

export class ControlPanelView {
    private statusIndicator: HTMLElement;
    private plotterControls: HTMLElement;

    private penUpBtn: HTMLButtonElement;
    private penDownBtn: HTMLButtonElement;
    private plotBtn: HTMLButtonElement;
    private stopBtn: HTMLButtonElement;
    private disengageBtn: HTMLButtonElement;
    private statusBtn: HTMLButtonElement;

    private penUpSlider: HTMLInputElement;
    private penDownSlider: HTMLInputElement;
    private speedSlider: HTMLInputElement;
    private movingSpeedSlider?: HTMLInputElement;

    private penUpValue: HTMLSpanElement;
    private penDownValue: HTMLSpanElement;
    private speedValue: HTMLSpanElement;
    private movingSpeedValue?: HTMLSpanElement;

    constructor(private controller: ControlPanelController) {
        this.controller = controller;
        this.statusIndicator = document.querySelector('.status-indicator') as HTMLElement;
        this.plotterControls = document.getElementById('plotter-controls') as HTMLElement;

        this.penUpBtn = document.getElementById('pen-up-btn') as HTMLButtonElement;
        this.penDownBtn = document.getElementById('pen-down-btn') as HTMLButtonElement;
        this.plotBtn = document.getElementById('plot-btn') as HTMLButtonElement;
        this.stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
        this.disengageBtn = document.getElementById('disengage-btn') as HTMLButtonElement;
        this.statusBtn = document.getElementById('status-btn') as HTMLButtonElement;

        this.penUpSlider = document.getElementById('pen-up-slider') as HTMLInputElement;
        this.penDownSlider = document.getElementById('pen-down-slider') as HTMLInputElement;
        this.speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
        this.movingSpeedSlider = document.getElementById('moving-speed-slider') as HTMLInputElement | null || undefined;

        this.penUpValue = document.getElementById('pen-up-value') as HTMLSpanElement;
        this.penDownValue = document.getElementById('pen-down-value') as HTMLSpanElement;
        this.speedValue = document.getElementById('speed-value') as HTMLSpanElement;
        this.movingSpeedValue = document.getElementById('moving-speed-value') as HTMLSpanElement | null || undefined;

        this.wireEvents();
    }

    private wireEvents(): void {
        // Buttons
        this.statusBtn.addEventListener('click', this.controller.onConnectClick.bind(this.controller));
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
        if (this.movingSpeedSlider) {
            this.movingSpeedSlider.addEventListener('input', (e) => {
                const value = (e.target as HTMLInputElement).value;
                if (this.movingSpeedValue) this.movingSpeedValue.textContent = value;
            });
        }

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

        if (this.movingSpeedSlider && this.controller.onSetMovingSpeed) {
            this.movingSpeedSlider.addEventListener('change', (e) => {
                const value = parseInt((e.target as HTMLInputElement).value);
                if (this.controller.onSetMovingSpeed) {
                    this.controller.onSetMovingSpeed(value);
                }
            });
        }
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

    setInitialSettings(penUp: number, penDown: number, speed: number): void {
        this.penUpSlider.value = String(penUp);
        this.penUpValue.textContent = String(penUp);
        this.penDownSlider.value = String(penDown);
        this.penDownValue.textContent = String(penDown);
        this.speedSlider.value = String(speed);
        this.speedValue.textContent = String(speed);
    }
}
