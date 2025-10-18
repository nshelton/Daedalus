export class ControlPanelView {
    constructor(controller) {
        this.controller = controller;
        this.controller = controller;
        this.statusIndicator = document.querySelector('.status-indicator');
        this.plotterControls = document.getElementById('plotter-controls');
        this.penUpBtn = document.getElementById('pen-up-btn');
        this.penDownBtn = document.getElementById('pen-down-btn');
        this.plotBtn = document.getElementById('plot-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.disengageBtn = document.getElementById('disengage-btn');
        this.statusBtn = document.getElementById('status-btn');
        this.penUpSlider = document.getElementById('pen-up-slider');
        this.penDownSlider = document.getElementById('pen-down-slider');
        this.speedSlider = document.getElementById('speed-slider');
        this.movingSpeedSlider = document.getElementById('moving-speed-slider');
        this.penUpValue = document.getElementById('pen-up-value');
        this.penDownValue = document.getElementById('pen-down-value');
        this.speedValue = document.getElementById('speed-value');
        this.movingSpeedValue = document.getElementById('moving-speed-value');
        this.wireEvents();
    }
    wireEvents() {
        // Buttons
        this.statusBtn.addEventListener('click', this.controller.onConnectClick.bind(this.controller));
        this.penUpBtn.addEventListener('click', this.controller.onPenUpClick.bind(this.controller));
        this.penDownBtn.addEventListener('click', this.controller.onPenDownClick.bind(this.controller));
        this.plotBtn.addEventListener('click', this.controller.onPlotClick.bind(this.controller));
        this.stopBtn.addEventListener('click', this.controller.onStopClick.bind(this.controller));
        this.disengageBtn.addEventListener('click', this.controller.onDisengageClick.bind(this.controller));
        // Sliders immediate UI feedback
        this.penUpSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.penUpValue.textContent = value;
        });
        this.penDownSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.penDownValue.textContent = value;
        });
        this.speedSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.speedValue.textContent = value;
        });
        this.movingSpeedSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            if (this.movingSpeedValue)
                this.movingSpeedValue.textContent = value;
        });
        // Sliders commit
        this.penUpSlider.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            this.controller.onSetPenUp(value);
        });
        this.penDownSlider.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            this.controller.onSetPenDown(value);
        });
        this.speedSlider.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            this.controller.onSetSpeed(value);
        });
        this.movingSpeedSlider.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            this.controller.onSetMovingSpeed(value);
        });
    }
    // Public API
    setConnected(connected, text) {
        if (connected) {
            this.statusIndicator.classList.remove('disconnected');
            this.statusIndicator.classList.add('connected');
            this.statusBtn.textContent = text || 'Connected';
            this.plotterControls.style.display = 'block';
        }
        else {
            this.statusIndicator.classList.remove('connected');
            this.statusIndicator.classList.add('disconnected');
            this.statusBtn.textContent = text || 'Disconnected';
            this.plotterControls.style.display = 'none';
        }
    }
    setInitialSettings(plotterSettings) {
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
