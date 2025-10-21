export interface ContextMenuItem {
    id: string;
    label: string;
}

export class ContextMenuView {
    private container: HTMLDivElement | null = null;
    private onDocMouseDown: ((e: MouseEvent) => void) | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    show(items: ContextMenuItem[], screenX: number, screenY: number, onSelect: (id: string) => void): void {
        this.hide();

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${screenX}px`;
        contextMenu.style.top = `${screenY}px`;
        contextMenu.style.background = 'rgba(43,43,43,0.92)';
        contextMenu.style.border = '1px solid #444';
        contextMenu.style.borderRadius = '6px';
        contextMenu.style.padding = '6px';
        contextMenu.style.zIndex = '9999';
        contextMenu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        contextMenu.style.minWidth = '180px';
        (contextMenu.style as any).backdropFilter = 'blur(4px)';

        const addButton = (label: string, id: string) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.background = 'rgba(58,58,58,0.95)';
            btn.style.color = '#fff';
            btn.style.border = 'none';
            btn.style.textAlign = 'left';
            btn.style.padding = '8px 10px';
            btn.style.margin = '2px 0';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.onmouseenter = () => { btn.style.background = 'rgba(74,74,74,0.98)'; };
            btn.onmouseleave = () => { btn.style.background = 'rgba(58,58,58,0.95)'; };
            btn.onclick = () => {
                try { onSelect(id); } finally { this.hide(); }
            };
            contextMenu.appendChild(btn);
        };

        for (const item of items) addButton(item.label, item.id);

        document.body.appendChild(contextMenu);
        this.container = contextMenu;

        // Hide on outside click
        this.onDocMouseDown = (e: MouseEvent) => {
            if (this.container && !this.container.contains(e.target as Node)) {
                this.hide();
            }
        };
        document.addEventListener('mousedown', this.onDocMouseDown, true);

        // Hide on Escape key
        this.onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') this.hide();
        };
        document.addEventListener('keydown', this.onKeyDown);
    }

    hide(): void {
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.container = null;
        if (this.onDocMouseDown) {
            document.removeEventListener('mousedown', this.onDocMouseDown, true);
            this.onDocMouseDown = null;
        }
        if (this.onKeyDown) {
            document.removeEventListener('keydown', this.onKeyDown);
            this.onKeyDown = null;
        }
    }
}


