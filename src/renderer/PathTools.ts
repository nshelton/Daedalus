import { Font } from "./Font.js";

export class PathTools {

    private static font = new Font();

    // Helper to create a simple Pikachu character for testing
    static createPikachuPath(cx: number, cy: number, size: number): [number, number][][] {
        const paths: [number, number][][] = [];
        const scale = size / 100; // Scale factor

        // Head (circle with slight oval shape)
        const headPath: [number, number][] = [];
        for (let i = 0; i <= 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            const x = cx + Math.cos(angle) * 25 * scale;
            const y = cy + Math.sin(angle) * 22 * scale; // Slightly oval
            headPath.push([x, y]);
        }
        paths.push(headPath);

        // Left ear
        const leftEarPath: [number, number][] = [];
        leftEarPath.push([cx - 20 * scale, cy - 15 * scale]);
        leftEarPath.push([cx - 25 * scale, cy - 25 * scale]);
        leftEarPath.push([cx - 15 * scale, cy - 20 * scale]);
        leftEarPath.push([cx - 20 * scale, cy - 15 * scale]);
        paths.push(leftEarPath);

        // Right ear
        const rightEarPath: [number, number][] = [];
        rightEarPath.push([cx + 20 * scale, cy - 15 * scale]);
        rightEarPath.push([cx + 25 * scale, cy - 25 * scale]);
        rightEarPath.push([cx + 15 * scale, cy - 20 * scale]);
        rightEarPath.push([cx + 20 * scale, cy - 15 * scale]);
        paths.push(rightEarPath);

        // Left eye
        const leftEyePath: [number, number][] = [];
        for (let i = 0; i <= 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const x = cx - 8 * scale + Math.cos(angle) * 3 * scale;
            const y = cy - 5 * scale + Math.sin(angle) * 3 * scale;
            leftEyePath.push([x, y]);
        }
        paths.push(leftEyePath);

        // Right eye
        const rightEyePath: [number, number][] = [];
        for (let i = 0; i <= 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const x = cx + 8 * scale + Math.cos(angle) * 3 * scale;
            const y = cy - 5 * scale + Math.sin(angle) * 3 * scale;
            rightEyePath.push([x, y]);
        }
        paths.push(rightEyePath);

        // Nose (triangle)
        const nosePath: [number, number][] = [];
        nosePath.push([cx, cy + 2 * scale]);
        nosePath.push([cx - 2 * scale, cy + 5 * scale]);
        nosePath.push([cx + 2 * scale, cy + 5 * scale]);
        nosePath.push([cx, cy + 2 * scale]);
        paths.push(nosePath);

        // Mouth (smile)
        const mouthPath: [number, number][] = [];
        for (let i = 0; i <= 16; i++) {
            const angle = Math.PI + (i / 16) * Math.PI; // Half circle
            const x = cx + Math.cos(angle) * 8 * scale;
            const y = cy + 8 * scale + Math.sin(angle) * 4 * scale;
            mouthPath.push([x, y]);
        }
        paths.push(mouthPath);

        // Body (oval)
        const bodyPath: [number, number][] = [];
        for (let i = 0; i <= 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            const x = cx + Math.cos(angle) * 18 * scale;
            const y = cy + 25 * scale + Math.sin(angle) * 15 * scale;
            bodyPath.push([x, y]);
        }
        paths.push(bodyPath);

        // Left arm
        const leftArmPath: [number, number][] = [];
        leftArmPath.push([cx - 18 * scale, cy + 20 * scale]);
        leftArmPath.push([cx - 30 * scale, cy + 35 * scale]);
        leftArmPath.push([cx - 25 * scale, cy + 40 * scale]);
        leftArmPath.push([cx - 15 * scale, cy + 30 * scale]);
        paths.push(leftArmPath);

        // Right arm
        const rightArmPath: [number, number][] = [];
        rightArmPath.push([cx + 18 * scale, cy + 20 * scale]);
        rightArmPath.push([cx + 30 * scale, cy + 35 * scale]);
        rightArmPath.push([cx + 25 * scale, cy + 40 * scale]);
        rightArmPath.push([cx + 15 * scale, cy + 30 * scale]);
        paths.push(rightArmPath);

        // Left leg
        const leftLegPath: [number, number][] = [];
        leftLegPath.push([cx - 8 * scale, cy + 40 * scale]);
        leftLegPath.push([cx - 12 * scale, cy + 55 * scale]);
        leftLegPath.push([cx - 5 * scale, cy + 60 * scale]);
        leftLegPath.push([cx - 2 * scale, cy + 50 * scale]);
        paths.push(leftLegPath);

        // Right leg
        const rightLegPath: [number, number][] = [];
        rightLegPath.push([cx + 8 * scale, cy + 40 * scale]);
        rightLegPath.push([cx + 12 * scale, cy + 55 * scale]);
        rightLegPath.push([cx + 5 * scale, cy + 60 * scale]);
        rightLegPath.push([cx + 2 * scale, cy + 50 * scale]);
        paths.push(rightLegPath);

        // Tail (zigzag)
        const tailPath: [number, number][] = [];
        tailPath.push([cx + 18 * scale, cy + 25 * scale]);
        tailPath.push([cx + 35 * scale, cy + 15 * scale]);
        tailPath.push([cx + 30 * scale, cy + 5 * scale]);
        tailPath.push([cx + 45 * scale, cy - 5 * scale]);
        tailPath.push([cx + 40 * scale, cy - 15 * scale]);
        paths.push(tailPath);

        return paths;
    }
    // Helper to create a circle as paths
    static createCirclePaths(cx: number, cy: number, radius: number): [number, number][][] {
        const path: [number, number][] = [];
        const segments = 64;

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            path.push([x, y]);
        }

        return [path]; // Return as array of paths (single path for a circle)
    }

    static createSquarePath(cx: number, cy: number, size: number): [number, number][][] {
        const path: [number, number][] = [];
        path.push([cx, cy]);
        path.push([cx + size, cy]);
        path.push([cx + size, cy + size]);
        path.push([cx, cy + size]);
        path.push([cx, cy]);
        return [path];
    }

    // Helper to create axes with arrowheads
    static createAxesPaths(cx: number, cy: number, length: number = 100, arrow: number = 10): [number, number][][] {
        const paths: [number, number][][] = [];

        // X axis line
        const xEnd: [number, number] = [cx + length, cy];
        paths.push([[cx, cy], xEnd]);
        // X axis arrowheads
        paths.push([xEnd, [xEnd[0] - arrow, xEnd[1] + arrow * 0.3]]);
        paths.push([xEnd, [xEnd[0] - arrow, xEnd[1] - arrow * 0.3]]);

        // Y axis line
        const yEnd: [number, number] = [cx, cy + length];
        paths.push([[cx, cy], yEnd]);
        // Y axis arrowheads
        paths.push([yEnd, [yEnd[0] + arrow * 0.3, yEnd[1] - arrow]]);
        paths.push([yEnd, [yEnd[0] - arrow * 0.3, yEnd[1] - arrow]]);

        return paths;
    }


    // Context menu responsibilities moved to ContextMenuView/Controller
}