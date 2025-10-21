export interface Vertex {
    x: number;
    y: number;
}

export function distance(dx: number, dy: number): number {
    return Math.hypot(dx, dy);
}

export function dotProductXY(a: [number, number], b: [number, number]): number {
    return a[0] * b[0] + a[1] * b[1];
}

export function unitVector(from: Vertex, to: Vertex): [number, number] {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
}

export function dist2(a: Vertex, b: Vertex): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}


