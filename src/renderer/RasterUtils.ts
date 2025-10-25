import { Raster } from "./models/PlotModel.js";

export class RasterUtils {
    static async imageBitmapFromFile(file: File): Promise<ImageBitmap> {
        // Use the File directly to preserve type; fall back to ArrayBuffer if needed
        try {
            return await createImageBitmap(file);
        } catch {
            const arrayBuffer = await file.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
            return await createImageBitmap(blob);
        }
    }

    static rasterFromImageBitmap(image: ImageBitmap, options?: { xMm?: number; yMm?: number; pixelSizeMm?: number }): Raster {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Convert to grayscale (luma) in 0..255
        const gray = new Uint8ClampedArray(canvas.width * canvas.height);
        for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
            const r = imgData.data[j];
            const g = imgData.data[j + 1];
            const b = imgData.data[j + 2];
            // Rec. 601 luma
            const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            gray[i] = v;
        }

        const xMm = options?.xMm ?? 0;
        const yMm = options?.yMm ?? 0;
        const pixelSizeMm = Math.max(0.05, options?.pixelSizeMm ?? 0.2);

        const raster: Raster = {
            id: `raster-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            width: canvas.width,
            height: canvas.height,
            data: gray,
            x: xMm,
            y: yMm,
            pixelSizeMm
        };
        return raster;
    }

    static rasterToImageData(raster: Raster): ImageData {
        const { width, height, data } = raster;
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < data.length; i++, j += 4) {
            const v = data[i];
            rgba[j] = v;
            rgba[j + 1] = v;
            rgba[j + 2] = v;
            // Treat pure white pixels as transparent (alpha 0)
            rgba[j + 3] = (v === 255) ? 0 : 255;
        }
        return new ImageData(rgba, width, height);
    }

    static async rasterToImageBitmap(raster: Raster): Promise<ImageBitmap> {
        const imageData = RasterUtils.rasterToImageData(raster);
        // Some Electron/Chromium versions may not support createImageBitmap(ImageData)
        // Draw into a canvas and create the bitmap from the canvas for maximum compatibility
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);
        return await createImageBitmap(canvas);
    }
}


