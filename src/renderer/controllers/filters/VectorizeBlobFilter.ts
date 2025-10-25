import type { FilterDefinition, FilterContext } from '../../../types';

type Params = { tolerance: number; turdSize: number };

function rdp(points: [number, number][], eps: number): [number, number][] {
    if (points.length <= 2 || eps <= 0) return points;
    const sq = (x: number) => x * x;
    let maxD = 0, idx = 0;
    const [x1, y1] = points[0], [x2, y2] = points[points.length - 1];
    const dx = x2 - x1, dy = y2 - y1, denom = dx * dx + dy * dy || 1e-12;
    for (let i = 1; i < points.length - 1; i++) {
        const [x0, y0] = points[i];
        const u = ((x0 - x1) * dx + (y0 - y1) * dy) / denom;
        const px = x1 + u * dx, py = y1 + u * dy;
        const d = sq(px - x0) + sq(py - y0);
        if (d > maxD) { maxD = d; idx = i; }
    }
    if (Math.sqrt(maxD) <= eps) return [points[0], points[points.length - 1]];
    const left = rdp(points.slice(0, idx + 1), eps);
    const right = rdp(points.slice(idx), eps);
    return left.slice(0, -1).concat(right);
}

async function bitmapToContours(img: ImageData, params: Params, ctx?: FilterContext): Promise<[number, number][][]> {
    const { width, height, data } = img;
    const idxOf = (x: number, y: number) => y * width + x;
    // Precompute binary mask once for speed
    const black = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const i = row + x;
            black[i] = data[i * 4] < 128 ? 1 : 0;
        }
    }
    const paths: [number, number][][] = [];
    const visited = new Uint8Array(width * height);
    const n4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const n8: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = idxOf(x, y);
            if (visited[idx]) continue;
            visited[idx] = 1;
            if (!black[idx]) continue;

            // Periodically yield and report progress to avoid blocking UI on large images
            if (((x & 127) === 0) && ((y & 7) === 0)) {
                try { ctx?.onProgress?.(Math.min(0.99, (y * width + x) / (width * height))); } catch { }
                await new Promise(r => setTimeout(r, 0));
                if (ctx?.abortSignal?.aborted) return paths;
            }

            // Collect component by BFS
            const q: number[] = [idx];
            const comp: number[] = [idx];
            let minX = x, minY = y, maxX = x, maxY = y;
            while (q.length) {
                const p = q.pop() as number;
                const py = Math.floor(p / width), px = p % width;
                for (const [dx, dy] of n4) {
                    const nx = px + dx, ny = py + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const ni = idxOf(nx, ny);
                    if (visited[ni]) continue;
                    visited[ni] = 1;
                    if (black[ni]) {
                        q.push(ni);
                        comp.push(ni);
                        if (nx < minX) minX = nx;
                        if (nx > maxX) maxX = nx;
                        if (ny < minY) minY = ny;
                        if (ny > maxY) maxY = ny;
                    }
                }
            }
            if (comp.length < params.turdSize) continue;
            // Local membership mask for this component bounding box
            const bw = maxX - minX + 1;
            const bh = maxY - minY + 1;
            const inComp = new Uint8Array(bw * bh);
            for (const p of comp) {
                const py = Math.floor(p / width), px = p % width;
                inComp[(py - minY) * bw + (px - minX)] = 1;
            }

            // Find a boundary pixel: top-most then left-most with a background 4-neighbor
            let startX = -1, startY = -1;
            for (const p of comp) {
                const py = Math.floor(p / width), px = p % width;
                const lx = px - minX, ly = py - minY;
                let boundary = false;
                for (const [dx, dy] of n4) {
                    const nx = lx + dx, ny = ly + dy;
                    if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) { boundary = true; break; }
                    if (!inComp[ny * bw + nx]) { boundary = true; break; }
                }
                if (boundary) {
                    if (startY === -1 || py < startY || (py === startY && px < startX)) {
                        startX = px; startY = py;
                    }
                }
            }
            if (startX === -1) continue;

            // Moore-neighbor tracing along pixel centers
            let cx = startX - minX, cy = startY - minY; // local coordinates
            let bx = startX - 1, by = startY; // global backtrack starts west
            let lbx = bx - minX, lby = by - minY; // local backtrack
            const sx = cx, sy = cy, sbx = lbx, sby = lby;
            const path: [number, number][] = [];

            const dirIndex = (px: number, py: number, qx: number, qy: number): number => {
                const dx = qx - px, dy = qy - py;
                for (let k = 0; k < 8; k++) if (n8[k][0] === dx && n8[k][1] === dy) return k;
                return 0;
            };

            const maxSteps = width * height * 8;
            let steps = 0;
            while (steps++ < maxSteps) {
                // Record in world coordinates: center of pixel; flip Y for bottom-left origin
                path.push([minX + cx + 0.5, height - (minY + cy + 0.5)]);

                const k = dirIndex(cx, cy, lbx, lby);
                let found = false;
                let nx = cx, ny = cy, nbx = lbx, nby = lby;
                for (let t = 1; t <= 8; t++) {
                    const j = (k + t) % 8;
                    const qx = cx + n8[j][0], qy = cy + n8[j][1];
                    if (qx < 0 || qy < 0 || qx >= bw || qy >= bh) continue;
                    if (inComp[qy * bw + qx]) {
                        const jp = (j + 7) % 8; // neighbor before j (clockwise)
                        nbx = cx + n8[jp][0]; nby = cy + n8[jp][1];
                        nx = qx; ny = qy;
                        found = true;
                        break;
                    }
                }
                if (!found) break;

                // close condition: returned to start with same backtrack
                if (nx === sx && ny === sy && nbx === sbx && nby === sby) break;

                cx = nx; cy = ny; lbx = nbx; lby = nby;
            }

            // Ensure closed polyline
            if (path.length > 1) {
                const [fx, fy] = path[0];
                const [lx, ly] = path[path.length - 1];
                if (fx !== lx || fy !== ly) path.push([fx, fy]);
            }

            const eps = Math.max(0, params.tolerance || 0);
            const simplified = (eps > 0 && path.length > 3) ? rdp(path, eps) : path;
            if (simplified.length >= 3) paths.push(simplified);
        }
    }
    try { ctx?.onProgress?.(1); } catch { }
    return paths;
}

export const VectorizeFilter: FilterDefinition<Params, 'bitmap', 'paths'> = {
    id: 'blobs',
    label: 'Blob',
    entityKind: 'paths',
    inputKinds: ['bitmap'],
    outputKind: 'paths',
    defaultParams: { tolerance: 1, turdSize: 8 },
    paramsSchema: [
        { key: 'tolerance', label: 'Tolerance', type: 'number', min: 0, max: 10, step: 0.5 },
        { key: 'turdSize', label: 'Min Area', type: 'number', min: 0, max: 10000, step: 1 }
    ],
    async apply(input, params, ctx) {
        const src = input as ImageData;
        const paths = await bitmapToContours(src, params, ctx);
        return paths as any;
    }
};

export default VectorizeFilter;


