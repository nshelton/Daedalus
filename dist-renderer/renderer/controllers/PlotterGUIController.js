import { ControlPanelController } from "./ControlPanelController.js";
import { PlotterGUIView } from "../views/PlotterGUIView.js";
export class PlotterGUIController {
    constructor(model) {
        this.plotModel = model;
        this.view = new PlotterGUIView('gui-root');
        // Create Plotter Controls panel via view
        const content = this.view.addPanel('Plotter');
        // Provide a mount point for the existing ControlPanelView
        const controlPanelRoot = document.createElement('div');
        controlPanelRoot.id = 'control-panel-root';
        content.appendChild(controlPanelRoot);
        // Instantiate the existing ControlPanelController which will populate its UI
        this.controlPanelController = new ControlPanelController(this.plotModel);
        this.controlPanelView = this.controlPanelController["view"];
    }
    // Surface subset of control-panel view API for renderer usage
    setConnected(connected, text) {
        if (this.controlPanelView && typeof this.controlPanelView.setConnected === 'function') {
            this.controlPanelView.setConnected(connected, text);
        }
    }
}
