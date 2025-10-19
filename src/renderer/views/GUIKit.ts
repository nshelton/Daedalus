export class GUIPanel {
    static create(root: HTMLElement, title: string) {
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
        root.appendChild(section);
        return { section, header, content, toggle(open?: boolean) { const isOpen = open ?? (content.style.display === 'none'); content.style.display = isOpen ? 'block' : 'none'; toggleIcon.textContent = isOpen ? '▾' : '▸'; } };
    }
}

export function makeGroup(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'control-group';
    return el;
}

export function makeButtonGroup(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'button-group';
    return el;
}

export function makeButton(opts: { id?: string; label: string; className?: string; onClick?: (e: MouseEvent) => void; }): HTMLButtonElement {
    const btn = document.createElement('button');
    if (opts.id) btn.id = opts.id;
    btn.className = opts.className || 'btn btn-primary';
    btn.textContent = opts.label;
    if (opts.onClick) btn.addEventListener('click', opts.onClick);
    return btn;
}

export function makeSlider(opts: { id: string; label: string; min: number; max: number; value: number; step?: number; onInput?: (val: number) => void; onChange?: (val: number) => void; }): { group: HTMLDivElement; slider: HTMLInputElement; valueSpan: HTMLSpanElement; } {
    const group = makeGroup();
    const label = document.createElement('label');
    label.setAttribute('for', opts.id);
    const valueSpan = document.createElement('span');
    valueSpan.id = `${opts.id}-value`;
    valueSpan.textContent = String(opts.value);
    label.innerHTML = `${opts.label}: `;
    label.appendChild(valueSpan);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = opts.id;
    slider.className = 'slider';
    slider.min = String(opts.min);
    slider.max = String(opts.max);
    slider.value = String(opts.value);
    if (opts.step != null) slider.step = String(opts.step);

    slider.addEventListener('input', () => {
        valueSpan.textContent = slider.value;
        if (opts.onInput) opts.onInput(parseInt(slider.value));
    });
    slider.addEventListener('change', () => {
        if (opts.onChange) opts.onChange(parseInt(slider.value));
    });

    group.appendChild(label);
    group.appendChild(slider);
    return { group, slider, valueSpan };
}

export function setVisible(el: HTMLElement, visible: boolean): void {
    el.style.display = visible ? 'block' : 'none';
}


