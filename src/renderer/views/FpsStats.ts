export default class FpsStats {
    public readonly dom: HTMLDivElement;
    private lastTime = performance.now();
    private frames = 0;
    private fps = 0;

    constructor() {
        this.dom = document.createElement('div');
        this.dom.style.position = 'absolute';
        this.dom.style.top = '8px';
        this.dom.style.right = '8px';
        this.dom.style.padding = '4px 6px';
        this.dom.style.background = 'rgba(0,0,0,0.6)';
        this.dom.style.color = '#0f0';
        this.dom.style.fontFamily = 'IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace';
        this.dom.style.fontSize = '11px';
        this.dom.style.lineHeight = '1';
        this.dom.style.borderRadius = '4px';
        this.dom.style.pointerEvents = 'none';
        this.dom.textContent = 'FPS: 0';
    }

    begin(): void { }

    end(): void {
        this.frames++;
        const time = performance.now();
        // update fps once per second for stability
        if (time > this.lastTime + 1000) {
            this.fps = Math.round((this.frames * 1000) / (time - this.lastTime));
            this.lastTime = time;
            this.frames = 0;
            this.dom.textContent = `FPS: ${this.fps}`;
        }
    }
}


