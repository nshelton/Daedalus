import { PlotModel } from "../models/PlotModel.js";
import { ControlPanelController } from "./ControlPanelController.js";

export class PlotterGUIController {
    private readonly plotModel: PlotModel;
    private readonly guiRoot: HTMLElement;
    private readonly panels: Map<string, HTMLElement> = new Map();
    private controlPanelController: ControlPanelController;
    private controlPanelView: any;

    constructor(model: PlotModel) {
        this.plotModel = model;
        const root = document.getElementById('gui-root');
        if (!root) throw new Error('gui-root not found');
        this.guiRoot = root;

        // Create Plotter Controls panel
        const content = this.addPanel('Plotter Controls');

        // Provide a mount point for the existing ControlPanelView
        const controlPanelRoot = document.createElement('div');
        controlPanelRoot.id = 'control-panel-root';
        content.appendChild(controlPanelRoot);

        // Instantiate the existing ControlPanelController which will populate its UI
        this.controlPanelController = new ControlPanelController(this.plotModel);
        this.controlPanelView = (this.controlPanelController as any)["view"];
    }

    addPanel(title: string): HTMLElement {
        const section = document.createElement('section');
        section.className = 'gui-section';

        const header = document.createElement('div');
        header.className = 'gui-section-header';
        header.textContent = title;

        const toggleIcon = document.createElement('span');
        toggleIcon.textContent = '▾';
        toggleIcon.style.marginLeft = '8px';
        header.appendChild(toggleIcon);

        const content = document.createElement('div');
        content.className = 'gui-section-content';
        content.style.display = 'block';

        header.onclick = () => {
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'block';
            toggleIcon.textContent = isOpen ? '▸' : '▾';
        };

        section.appendChild(header);
        section.appendChild(content);
        this.guiRoot.appendChild(section);
        this.panels.set(title, content);
        return content;
    }

    // Surface subset of control-panel view API for renderer usage
    setConnected(connected: boolean, text?: string): void {
        if (this.controlPanelView && typeof this.controlPanelView.setConnected === 'function') {
            this.controlPanelView.setConnected(connected, text);
        }
    }
}


