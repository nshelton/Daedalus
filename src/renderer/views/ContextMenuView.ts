export interface ContextMenuItem {
    id: string;
    label: string;
}

export class ContextMenuView {
    private container: HTMLDivElement | null = null;

    show(items: ContextMenuItem[], screenX: number, screenY: number, onSelect: (id: string) => void): void {
        this.hide();

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${screenX}px`;
        contextMenu.style.top = `${screenY}px`;
        contextMenu.style.background = '#2b2b2b';
        contextMenu.style.border = '1px solid #444';
        contextMenu.style.borderRadius = '6px';
        contextMenu.style.padding = '6px';
        contextMenu.style.zIndex = '9999';
        contextMenu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        contextMenu.style.minWidth = '180px';

        const addButton = (label: string, id: string) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.background = '#3a3a3a';
            btn.style.color = '#fff';
            btn.style.border = 'none';
            btn.style.textAlign = 'left';
            btn.style.padding = '8px 10px';
            btn.style.margin = '2px 0';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.onmouseenter = () => { btn.style.background = '#4a4a4a'; };
            btn.onmouseleave = () => { btn.style.background = '#3a3a3a'; };
            btn.onclick = () => {
                try { onSelect(id); } finally { this.hide(); }
            };
            contextMenu.appendChild(btn);
        };

        for (const item of items) addButton(item.label, item.id);

        document.body.appendChild(contextMenu);
        this.container = contextMenu;
    }

    hide(): void {
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.container = null;
    }
}


