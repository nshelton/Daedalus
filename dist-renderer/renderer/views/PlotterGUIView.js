export class PlotterGUIView {
    constructor(rootId = 'gui-root') {
        const el = document.getElementById(rootId);
        if (!el)
            throw new Error(`${rootId} not found`);
        this.root = el;
    }
    addPanel(title) {
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
        this.root.appendChild(section);
        return content;
    }
    hideAll() {
        const contents = this.root.querySelectorAll('.gui-section-content');
        const headers = this.root.querySelectorAll('.gui-section-header span');
        contents.forEach(c => { c.style.display = 'none'; });
        headers.forEach(h => { h.textContent = '▸'; });
    }
    showAll() {
        const contents = this.root.querySelectorAll('.gui-section-content');
        const headers = this.root.querySelectorAll('.gui-section-header span');
        contents.forEach(c => { c.style.display = 'block'; });
        headers.forEach(h => { h.textContent = '▾'; });
    }
}
