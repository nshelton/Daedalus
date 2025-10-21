import { Raster } from "./models/PlotModel.js";

export class RasterUtils {
    static async imageBitmapFromFile(file: File): Promise<ImageBitmap> {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
        const imageBitmap = await createImageBitmap(blob);
        return imageBitmap;
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
            rgba[j + 3] = 255;
        }
        return new ImageData(rgba, width, height);
    }

    static async rasterToImageBitmap(raster: Raster): Promise<ImageBitmap> {
        const imageData = RasterUtils.rasterToImageData(raster);
        return await createImageBitmap(imageData);
    }
}


