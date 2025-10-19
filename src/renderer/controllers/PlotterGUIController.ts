import { PlotModel } from "../models/PlotModel.js";
import { ControlPanelController } from "./ControlPanelController.js";
import { PlotterGUIView } from "../views/PlotterGUIView.js";

export class PlotterGUIController {
    private readonly plotModel: PlotModel;
    private readonly view: PlotterGUIView;
    private controlPanelController: ControlPanelController;
    private controlPanelView: any;

    constructor(model: PlotModel) {
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
        this.controlPanelView = (this.controlPanelController as any)["view"];
    }

    // Surface subset of control-panel view API for renderer usage
    setConnected(connected: boolean, text?: string): void {
        if (this.controlPanelView && typeof this.controlPanelView.setConnected === 'function') {
            this.controlPanelView.setConnected(connected, text);
        }
    }
}


