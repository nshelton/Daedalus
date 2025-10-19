import { ControlPanelController } from "../controllers/PlotterInterfaceController.js";
import { PlotterSettings } from "../../preload";

export class ControlPanelView {


    constructor(private controller: ControlPanelController) {
        this.controller = controller;
        const root = document.getElementById('control-panel-root');
        if (!root) throw new Error('control-panel-root not found');

        const panel = document.createElement('div');
        panel.className = 'control-panel';


        this.wireEvents();
    }


}
