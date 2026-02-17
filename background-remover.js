/**
 * Module de suppression de fond d'image
 * - Mode remove.bg (API officielle, optionnel)
 * - Mode local avancé (sans API)
 */

const IMGLY_CDN_ESM_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal/+esm';
let imglyModulePromise = null;
let imglyRemoveBackgroundFn = null;

class BackgroundRemover {
    constructor(options = {}) {
        this.provider = options.provider || 'local';
        this.apiKey = options.apiKey || '';
        this.threshold = options.threshold || 30;
        this.featherAmount = options.featherAmount || 2;
        this.backgroundColor = options.backgroundColor || null;
        this.shouldAutoCrop = options.autoCrop !== false;
        this.onProgress = options.onProgress || (() => {});
        this.maxProcessingSide = options.maxProcessingSide || 1200;
    }

    /**
     * Supprimer le fond d'une image
     */
    async removeBackground(imageSource) {
        if (this.provider === 'removebg' && this.apiKey) {
            return this.removeBackgroundWithRemoveBgApi(imageSource);
        }

        if (this.provider === 'removebg' && !this.apiKey) {
            this.onProgress(8, 'Clé remove.bg absente, bascule en mode local...');
        }

        return this.removeBackgroundLocally(imageSource);
    }

    /**
     * Mode remove.bg (résultat identique au moteur remove.bg)
     */
    async removeBackgroundWithRemoveBgApi(imageSource) {
        this.onProgress(5, 'Préparation de l\'envoi à remove.bg...');
        const file = await this.sourceToFile(imageSource);

        const formData = new FormData();
        formData.append('image_file', file, file.name || 'image.png');
        formData.append('size', 'auto');
        formData.append('crop', this.shouldAutoCrop ? 'true' : 'false');

        if (this.backgroundColor) {
            formData.append('bg_color', this.rgbToHex(this.backgroundColor));
            formData.append('format', 'jpg');
        } else {
            formData.append('format', 'png');
        }

        this.onProgress(25, 'Envoi à remove.bg...');
        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
                'X-Api-Key': this.apiKey
            },
            body: formData
        });

        if (!response.ok) {
            const rawError = await response.text();
            throw new Error(this.parseRemoveBgError(rawError, response.status));
        }

        this.onProgress(80, 'Réception du résultat...');
        const blob = await response.blob();

        if (!blob || blob.size === 0) {
            throw new Error('Réponse remove.bg invalide (image vide).');
        }

        const img = await this.loadImage(blob);

        this.onProgress(100, 'Suppression du fond terminée.');

        return {
            canvas: null,
            width: img.width,
            height: img.height,
            blob,
            format: this.getFormatFromMime(blob.type)
        };
    }

    /**
     * Mode local avancé (sans API)
     * 1) IA locale (IMG.LY)
     * 2) Fallback heuristique si indisponible
     */
    async removeBackgroundLocally(imageSource) {
        try {
            return await this.removeBackgroundWithImgly(imageSource);
        } catch (error) {
            console.warn('Moteur IA local indisponible, fallback heuristique:', error);
            this.onProgress(18, 'Fallback sur segmentation locale...');
            return this.removeBackgroundHeuristic(imageSource);
        }
    }

    async removeBackgroundWithImgly(imageSource) {
        this.onProgress(8, 'Chargement du moteur IA local...');
        const removeBackground = await this.loadImglyRemoveBackground();

        const sourceBlob = await this.sourceToBlob(imageSource);

        const inferenceConfig = {
            model: 'isnet_fp16',
            output: {
                format: 'image/png',
                quality: 1,
                type: 'foreground'
            },
            progress: (key, current, total) => {
                if (!total || total <= 0) return;
                const percent = Math.round((current / total) * 100);
                const mapped = 10 + Math.floor(percent * 0.45);
                this.onProgress(mapped, `Téléchargement modèle IA (${percent}%)...`);
            }
        };

        this.onProgress(35, 'Inférence IA en cours...');
        const aiBlob = await removeBackground(sourceBlob, inferenceConfig);

        if (!aiBlob || aiBlob.size === 0) {
            throw new Error('Le moteur IA local a renvoyé une image vide.');
        }

        this.onProgress(70, 'Post-traitement...');
        let outputCanvas = await this.blobToCanvas(aiBlob);

        if (this.shouldAutoCrop) {
            const alphaMask = this.extractAlphaMaskFromCanvas(outputCanvas);
            const cropBounds = this.computeCropBoundsFromMask(alphaMask, outputCanvas.width, outputCanvas.height);
            if (cropBounds) {
                outputCanvas = this.cropCanvasWithBounds(outputCanvas, cropBounds, 10);
            }
        }

        if (this.backgroundColor) {
            outputCanvas = this.compositeCanvasOnColor(outputCanvas, this.backgroundColor);
        }

        this.onProgress(100, 'Terminé !');

        return {
            canvas: outputCanvas,
            width: outputCanvas.width,
            height: outputCanvas.height,
            blob: await this.canvasToBlob(outputCanvas, 'image/png'),
            format: 'png'
        };
    }

    async loadImglyRemoveBackground() {
        if (imglyRemoveBackgroundFn) {
            return imglyRemoveBackgroundFn;
        }

        if (!imglyModulePromise) {
            imglyModulePromise = import(IMGLY_CDN_ESM_URL)
                .then((module) => {
                    const removeBackground = module.default;
                    if (typeof removeBackground !== 'function') {
                        throw new Error('Le module IMG.LY ne contient pas de fonction de suppression.');
                    }
                    imglyRemoveBackgroundFn = removeBackground;
                    return removeBackground;
                })
                .catch((error) => {
                    imglyModulePromise = null;
                    throw error;
                });
        }

        return imglyModulePromise;
    }

    async blobToCanvas(blob) {
        const img = await this.loadImage(blob);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    extractAlphaMaskFromCanvas(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const mask = new Float32Array(canvas.width * canvas.height);

        for (let i = 0; i < mask.length; i++) {
            mask[i] = imageData.data[i * 4 + 3] / 255;
        }

        return mask;
    }

    compositeCanvasOnColor(canvas, color) {
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;

        const ctx = out.getContext('2d');
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);

        return out;
    }

    /**
     * Segmentation heuristique (fallback local)
     */
    async removeBackgroundHeuristic(imageSource) {
        this.onProgress(5, 'Chargement de l\'image...');
        const img = await this.loadImage(imageSource);

        this.onProgress(12, 'Préparation du canevas...');
        const originalCanvas = document.createElement('canvas');
        const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        originalCtx.drawImage(img, 0, 0);

        const originalImageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);

        this.onProgress(20, 'Analyse du fond...');
        const working = this.createWorkingImageData(originalImageData, originalCanvas.width, originalCanvas.height);

        this.onProgress(35, 'Segmentation locale...');
        const smallMask = this.buildLocalForegroundMask(working.data, working.width, working.height);

        this.onProgress(65, 'Affinage des bords...');
        const fullMask = working.scale < 1
            ? this.resizeMask(smallMask, working.width, working.height, originalCanvas.width, originalCanvas.height)
            : smallMask;

        const cropBounds = this.shouldAutoCrop
            ? this.computeCropBoundsFromMask(fullMask, originalCanvas.width, originalCanvas.height)
            : null;

        this.onProgress(82, 'Application du détourage...');
        this.applyMaskToImage(originalImageData.data, fullMask, originalCanvas.width, originalCanvas.height);
        originalCtx.putImageData(originalImageData, 0, 0);

        let outputCanvas = originalCanvas;
        if (this.shouldAutoCrop && cropBounds) {
            this.onProgress(90, 'Recadrage...');
            outputCanvas = this.cropCanvasWithBounds(originalCanvas, cropBounds, 10);
        }

        this.onProgress(100, 'Terminé !');

        return {
            canvas: outputCanvas,
            width: outputCanvas.width,
            height: outputCanvas.height,
            blob: await this.canvasToBlob(outputCanvas, 'image/png'),
            format: 'png'
        };
    }

    createWorkingImageData(imageData, width, height) {
        const maxSide = Math.max(width, height);
        const scale = Math.min(1, this.maxProcessingSide / maxSide);

        if (scale >= 1) {
            return {
                width,
                height,
                scale: 1,
                data: imageData.data
            };
        }

        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width;
        srcCanvas.height = height;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.putImageData(imageData, 0, 0);

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = targetWidth;
        dstCanvas.height = targetHeight;

        const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.imageSmoothingQuality = 'high';
        dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

        const downscaled = dstCtx.getImageData(0, 0, targetWidth, targetHeight);

        return {
            width: targetWidth,
            height: targetHeight,
            scale,
            data: downscaled.data
        };
    }

    buildLocalForegroundMask(data, width, height) {
        const model = this.estimateBackgroundModel(data, width, height);
        const gradient = this.computeGradientMap(data, width, height);
        const seeds = this.collectBorderSeeds(data, width, height, model, gradient);

        const backgroundRegion = this.growBackgroundRegion(data, width, height, model, gradient, seeds);
        let foregroundMask = this.invertBinaryMask(backgroundRegion);

        foregroundMask = this.keepMainForegroundRegions(foregroundMask, width, height);
        foregroundMask = this.fillMaskHoles(foregroundMask, width, height);

        // Légère fermeture puis ouverture pour stabiliser le contour
        foregroundMask = this.dilateBinary(this.erodeBinary(foregroundMask, width, height, 1), width, height, 1);
        foregroundMask = this.erodeBinary(this.dilateBinary(foregroundMask, width, height, 1), width, height, 1);

        const blurRadius = Math.max(1, this.featherAmount + 1);
        return this.softenBinaryMask(foregroundMask, width, height, blurRadius);
    }

    estimateBackgroundModel(data, width, height) {
        const border = Math.max(6, Math.min(18, Math.round(Math.min(width, height) * 0.025)));
        const step = Math.max(1, Math.round(Math.min(width, height) / 320));

        const bins = new Map();
        const samples = [];

        const addSample = (x, y) => {
            const idx = (y * width + x) * 4;
            const a = data[idx + 3];
            if (a < 16) return;

            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            samples.push([r, g, b]);

            const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
            const bin = bins.get(key);
            if (bin) {
                bin.count++;
                bin.r += r;
                bin.g += g;
                bin.b += b;
            } else {
                bins.set(key, { count: 1, r, g, b });
            }
        };

        for (let y = 0; y < border; y += step) {
            for (let x = 0; x < width; x += step) {
                addSample(x, y);
                addSample(x, height - 1 - y);
            }
        }

        for (let x = 0; x < border; x += step) {
            for (let y = border; y < height - border; y += step) {
                addSample(x, y);
                addSample(width - 1 - x, y);
            }
        }

        if (samples.length === 0) {
            return { r: 245, g: 245, b: 245, tolerance: 30, expansionTolerance: 42 };
        }

        let dominant = null;
        for (const value of bins.values()) {
            if (!dominant || value.count > dominant.count) {
                dominant = value;
            }
        }

        let center = {
            r: Math.round(dominant.r / dominant.count),
            g: Math.round(dominant.g / dominant.count),
            b: Math.round(dominant.b / dominant.count)
        };

        const nearSamples = [];
        for (const sample of samples) {
            const dist = this.rgbDistance(sample[0], sample[1], sample[2], center.r, center.g, center.b);
            if (dist < 42) {
                nearSamples.push(sample);
            }
        }

        const refinedPool = nearSamples.length >= 50 ? nearSamples : samples;
        center = this.averageColor(refinedPool);

        const distances = refinedPool.map((sample) =>
            this.rgbDistance(sample[0], sample[1], sample[2], center.r, center.g, center.b)
        );
        distances.sort((a, b) => a - b);

        const p80 = this.percentileSorted(distances, 0.8);
        const p95 = this.percentileSorted(distances, 0.95);

        const tolerance = this.clamp(Math.max(24, p80 * 1.25), 24, 110);
        const expansionTolerance = this.clamp(Math.max(32, p95 * 1.35), 32, 135);

        return {
            r: center.r,
            g: center.g,
            b: center.b,
            tolerance,
            expansionTolerance
        };
    }

    computeGradientMap(data, width, height) {
        const total = width * height;
        const luma = new Float32Array(total);

        for (let i = 0; i < total; i++) {
            const idx = i * 4;
            luma[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        }

        const gradient = new Float32Array(total);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;

                const left = x > 0 ? idx - 1 : idx;
                const right = x < width - 1 ? idx + 1 : idx;
                const up = y > 0 ? idx - width : idx;
                const down = y < height - 1 ? idx + width : idx;

                const gx = Math.abs(luma[right] - luma[left]);
                const gy = Math.abs(luma[down] - luma[up]);

                gradient[idx] = gx + gy;
            }
        }

        return gradient;
    }

    collectBorderSeeds(data, width, height, model, gradient) {
        const borderThickness = Math.max(1, Math.round(Math.min(width, height) * 0.01));
        const seeds = [];
        const candidates = [];

        const consider = (idx) => {
            const dist = this.rgbDistanceAt(data, idx, model.r, model.g, model.b);
            const grad = gradient[idx];
            candidates.push({ idx, dist, grad });

            if (dist <= model.tolerance && grad <= 85) {
                seeds.push(idx);
            }
        };

        for (let y = 0; y < borderThickness; y++) {
            for (let x = 0; x < width; x++) {
                consider(y * width + x);
                consider((height - 1 - y) * width + x);
            }
        }

        for (let x = 0; x < borderThickness; x++) {
            for (let y = borderThickness; y < height - borderThickness; y++) {
                consider(y * width + x);
                consider(y * width + (width - 1 - x));
            }
        }

        if (seeds.length > 0) {
            return seeds;
        }

        // Fallback: prendre les meilleurs candidats sur les bords
        candidates.sort((a, b) => (a.dist + a.grad * 0.2) - (b.dist + b.grad * 0.2));
        const fallbackCount = Math.max(40, Math.round(Math.min(width, height) * 0.3));

        for (let i = 0; i < Math.min(fallbackCount, candidates.length); i++) {
            seeds.push(candidates[i].idx);
        }

        return seeds;
    }

    growBackgroundRegion(data, width, height, model, gradient, seeds) {
        const total = width * height;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);

        let head = 0;
        let tail = 0;

        for (const seed of seeds) {
            if (!visited[seed]) {
                visited[seed] = 1;
                queue[tail++] = seed;
            }
        }

        const tryPush = (nIdx, pIdx) => {
            if (visited[nIdx]) return;

            const distBg = this.rgbDistanceAt(data, nIdx, model.r, model.g, model.b);
            const grad = gradient[nIdx];
            const distParent = this.rgbDistanceBetweenIndices(data, nIdx, pIdx);

            const dynamicThreshold = model.expansionTolerance + Math.min(28, grad * 0.12);
            const shouldExpand =
                distBg <= dynamicThreshold &&
                distParent <= 74 &&
                (grad <= 125 || distBg <= model.tolerance * 0.95);

            if (!shouldExpand) return;

            visited[nIdx] = 1;
            queue[tail++] = nIdx;
        };

        while (head < tail) {
            const idx = queue[head++];
            const x = idx % width;
            const y = Math.floor(idx / width);

            if (x > 0) tryPush(idx - 1, idx);
            if (x < width - 1) tryPush(idx + 1, idx);
            if (y > 0) tryPush(idx - width, idx);
            if (y < height - 1) tryPush(idx + width, idx);
        }

        return visited;
    }

    invertBinaryMask(mask) {
        const out = new Uint8Array(mask.length);
        for (let i = 0; i < mask.length; i++) {
            out[i] = mask[i] ? 0 : 1;
        }
        return out;
    }

    keepMainForegroundRegions(mask, width, height) {
        const total = width * height;
        const labels = new Int32Array(total);
        const queue = new Int32Array(total);

        const centerMinX = Math.floor(width * 0.25);
        const centerMaxX = Math.ceil(width * 0.75);
        const centerMinY = Math.floor(height * 0.25);
        const centerMaxY = Math.ceil(height * 0.75);

        const componentAreas = [0];
        const componentTouchesCenter = [false];

        let componentId = 0;

        for (let i = 0; i < total; i++) {
            if (!mask[i] || labels[i] !== 0) continue;

            componentId++;
            let head = 0;
            let tail = 0;
            queue[tail++] = i;
            labels[i] = componentId;

            let area = 0;
            let touchesCenter = false;

            while (head < tail) {
                const idx = queue[head++];
                area++;

                const x = idx % width;
                const y = Math.floor(idx / width);

                if (x >= centerMinX && x <= centerMaxX && y >= centerMinY && y <= centerMaxY) {
                    touchesCenter = true;
                }

                const tryLabel = (nIdx) => {
                    if (!mask[nIdx] || labels[nIdx] !== 0) return;
                    labels[nIdx] = componentId;
                    queue[tail++] = nIdx;
                };

                if (x > 0) tryLabel(idx - 1);
                if (x < width - 1) tryLabel(idx + 1);
                if (y > 0) tryLabel(idx - width);
                if (y < height - 1) tryLabel(idx + width);
            }

            componentAreas[componentId] = area;
            componentTouchesCenter[componentId] = touchesCenter;
        }

        if (componentId <= 1) {
            return mask;
        }

        const minArea = Math.max(120, Math.round(total * 0.0018));
        let bestId = 1;
        let bestScore = -1;

        for (let id = 1; id <= componentId; id++) {
            const score = componentAreas[id] + (componentTouchesCenter[id] ? total * 0.2 : 0);
            if (score > bestScore) {
                bestScore = score;
                bestId = id;
            }
        }

        const keep = new Uint8Array(componentId + 1);
        keep[bestId] = 1;

        const bestArea = componentAreas[bestId];
        for (let id = 1; id <= componentId; id++) {
            if (id === bestId) continue;

            const area = componentAreas[id];
            const touchesCenter = componentTouchesCenter[id];

            if (touchesCenter && area >= Math.max(minArea, Math.round(bestArea * 0.12))) {
                keep[id] = 1;
            }
        }

        const result = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
            const id = labels[i];
            result[i] = id > 0 && keep[id] ? 1 : 0;
        }

        return result;
    }

    fillMaskHoles(mask, width, height) {
        const total = width * height;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);

        let head = 0;
        let tail = 0;

        const enqueueIfBackground = (idx) => {
            if (visited[idx] || mask[idx] === 1) return;
            visited[idx] = 1;
            queue[tail++] = idx;
        };

        for (let x = 0; x < width; x++) {
            enqueueIfBackground(x);
            enqueueIfBackground((height - 1) * width + x);
        }

        for (let y = 0; y < height; y++) {
            enqueueIfBackground(y * width);
            enqueueIfBackground(y * width + (width - 1));
        }

        while (head < tail) {
            const idx = queue[head++];
            const x = idx % width;
            const y = Math.floor(idx / width);

            if (x > 0) enqueueIfBackground(idx - 1);
            if (x < width - 1) enqueueIfBackground(idx + 1);
            if (y > 0) enqueueIfBackground(idx - width);
            if (y < height - 1) enqueueIfBackground(idx + width);
        }

        const result = new Uint8Array(mask);
        for (let i = 0; i < total; i++) {
            if (mask[i] === 0 && !visited[i]) {
                result[i] = 1;
            }
        }

        return result;
    }

    dilateBinary(mask, width, height, radius = 1) {
        const out = new Uint8Array(mask.length);

        for (let y = 0; y < height; y++) {
            const minY = Math.max(0, y - radius);
            const maxY = Math.min(height - 1, y + radius);

            for (let x = 0; x < width; x++) {
                const minX = Math.max(0, x - radius);
                const maxX = Math.min(width - 1, x + radius);

                let value = 0;
                for (let ny = minY; ny <= maxY && !value; ny++) {
                    const rowOffset = ny * width;
                    for (let nx = minX; nx <= maxX; nx++) {
                        if (mask[rowOffset + nx]) {
                            value = 1;
                            break;
                        }
                    }
                }

                out[y * width + x] = value;
            }
        }

        return out;
    }

    erodeBinary(mask, width, height, radius = 1) {
        const out = new Uint8Array(mask.length);

        for (let y = 0; y < height; y++) {
            const minY = Math.max(0, y - radius);
            const maxY = Math.min(height - 1, y + radius);

            for (let x = 0; x < width; x++) {
                const minX = Math.max(0, x - radius);
                const maxX = Math.min(width - 1, x + radius);

                let value = 1;
                for (let ny = minY; ny <= maxY && value; ny++) {
                    const rowOffset = ny * width;
                    for (let nx = minX; nx <= maxX; nx++) {
                        if (!mask[rowOffset + nx]) {
                            value = 0;
                            break;
                        }
                    }
                }

                out[y * width + x] = value;
            }
        }

        return out;
    }

    softenBinaryMask(mask, width, height, radius) {
        const floatMask = new Float32Array(mask.length);
        for (let i = 0; i < mask.length; i++) {
            floatMask[i] = mask[i];
        }

        if (radius <= 0) {
            return floatMask;
        }

        const blurred = this.boxBlur(floatMask, width, height, radius);

        const soft = new Float32Array(blurred.length);
        for (let i = 0; i < blurred.length; i++) {
            const normalized = this.clamp((blurred[i] - 0.16) / 0.72, 0, 1);
            soft[i] = normalized * normalized * (3 - 2 * normalized);
        }

        return soft;
    }

    boxBlur(mask, width, height, radius) {
        const horizontal = new Float32Array(mask.length);
        const vertical = new Float32Array(mask.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;

                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx;
                    if (nx < 0 || nx >= width) continue;
                    sum += mask[y * width + nx];
                    count++;
                }

                horizontal[y * width + x] = sum / count;
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;

                for (let dy = -radius; dy <= radius; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= height) continue;
                    sum += horizontal[ny * width + x];
                    count++;
                }

                vertical[y * width + x] = sum / count;
            }
        }

        return vertical;
    }

    resizeMask(mask, srcWidth, srcHeight, dstWidth, dstHeight) {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcWidth;
        srcCanvas.height = srcHeight;

        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        const srcData = srcCtx.createImageData(srcWidth, srcHeight);

        for (let i = 0; i < mask.length; i++) {
            const alpha = Math.round(this.clamp(mask[i], 0, 1) * 255);
            const idx = i * 4;
            srcData.data[idx] = 255;
            srcData.data[idx + 1] = 255;
            srcData.data[idx + 2] = 255;
            srcData.data[idx + 3] = alpha;
        }

        srcCtx.putImageData(srcData, 0, 0);

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = dstWidth;
        dstCanvas.height = dstHeight;

        const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.imageSmoothingQuality = 'high';
        dstCtx.drawImage(srcCanvas, 0, 0, dstWidth, dstHeight);

        const resized = dstCtx.getImageData(0, 0, dstWidth, dstHeight).data;
        const out = new Float32Array(dstWidth * dstHeight);

        for (let i = 0; i < out.length; i++) {
            out[i] = resized[i * 4 + 3] / 255;
        }

        return out;
    }

    computeCropBoundsFromMask(mask, width, height) {
        const alphaThreshold = 0.08;

        let top = height;
        let bottom = -1;
        let left = width;
        let right = -1;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const value = mask[y * width + x];
                if (value <= alphaThreshold) continue;

                if (y < top) top = y;
                if (y > bottom) bottom = y;
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }

        if (bottom < top || right < left) {
            return null;
        }

        return { top, bottom, left, right };
    }

    cropCanvasWithBounds(canvas, bounds, margin = 10) {
        const top = Math.max(0, bounds.top - margin);
        const left = Math.max(0, bounds.left - margin);
        const bottom = Math.min(canvas.height - 1, bounds.bottom + margin);
        const right = Math.min(canvas.width - 1, bounds.right + margin);

        const cropWidth = right - left + 1;
        const cropHeight = bottom - top + 1;

        if (cropWidth <= 0 || cropHeight <= 0) {
            return canvas;
        }

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;

        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        return croppedCanvas;
    }

    /**
     * Appliquer le masque à l'image
     */
    applyMaskToImage(data, mask, width, height) {
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const sourceAlpha = data[idx + 3] / 255;
            const matte = this.clamp(mask[i], 0, 1) * sourceAlpha;

            if (this.backgroundColor) {
                const blend = 1 - matte;
                data[idx] = Math.round(data[idx] * matte + this.backgroundColor.r * blend);
                data[idx + 1] = Math.round(data[idx + 1] * matte + this.backgroundColor.g * blend);
                data[idx + 2] = Math.round(data[idx + 2] * matte + this.backgroundColor.b * blend);
                data[idx + 3] = 255;
            } else {
                data[idx + 3] = Math.round(255 * matte);
            }
        }
    }

    /**
     * Charger une image depuis File/Blob/URL/<img>
     */
    loadImage(source) {
        return new Promise((resolve, reject) => {
            if (source instanceof HTMLImageElement) {
                if (source.complete && source.naturalWidth > 0) {
                    resolve(source);
                    return;
                }

                source.onload = () => resolve(source);
                source.onerror = reject;
                return;
            }

            const img = new Image();

            img.onload = () => {
                if (source instanceof File || source instanceof Blob) {
                    URL.revokeObjectURL(img.src);
                }
                resolve(img);
            };

            img.onerror = (error) => {
                if (source instanceof File || source instanceof Blob) {
                    URL.revokeObjectURL(img.src);
                }
                reject(error);
            };

            if (source instanceof File || source instanceof Blob) {
                img.src = URL.createObjectURL(source);
                return;
            }

            if (typeof source === 'string') {
                img.src = source;
                return;
            }

            reject(new Error('Source d\'image non supportée.'));
        });
    }

    /**
     * Normaliser une source vers un File
     */
    async sourceToFile(source) {
        if (source instanceof File) {
            return source;
        }

        const blob = await this.sourceToBlob(source);
        const type = blob.type || 'image/png';
        const extension = this.extensionFromMime(type);
        return new File([blob], `image.${extension}`, { type });
    }

    /**
     * Normaliser une source vers un Blob
     */
    async sourceToBlob(source) {
        if (source instanceof Blob) {
            return source;
        }

        if (source instanceof HTMLImageElement) {
            const canvas = document.createElement('canvas');
            canvas.width = source.naturalWidth || source.width;
            canvas.height = source.naturalHeight || source.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0);
            return this.canvasToBlob(canvas, 'image/png');
        }

        if (typeof source === 'string') {
            const response = await fetch(source);
            if (!response.ok) {
                throw new Error(`Impossible de charger l'image source (${response.status}).`);
            }
            return response.blob();
        }

        throw new Error('Source d\'image non supportée.');
    }

    extensionFromMime(mimeType) {
        const map = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp'
        };

        return map[mimeType] || 'png';
    }

    getFormatFromMime(mimeType) {
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpeg';
        if (mimeType === 'image/webp') return 'webp';
        return 'png';
    }

    rgbToHex(color) {
        const toHex = (value) => value.toString(16).padStart(2, '0');
        return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    }

    parseRemoveBgError(rawError, status) {
        try {
            const parsed = JSON.parse(rawError);
            if (parsed.errors && parsed.errors.length > 0) {
                const firstError = parsed.errors[0];
                if (firstError.title) {
                    return `remove.bg (${status}): ${firstError.title}`;
                }
            }
        } catch (error) {
            // Ignore parsing errors, fallback to raw text
        }

        return `remove.bg (${status}): ${rawError || 'erreur inconnue.'}`;
    }

    rgbDistance(r1, g1, b1, r2, g2, b2) {
        const dr = r1 - r2;
        const dg = g1 - g2;
        const db = b1 - b2;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    rgbDistanceAt(data, pixelIndex, r, g, b) {
        const idx = pixelIndex * 4;
        return this.rgbDistance(data[idx], data[idx + 1], data[idx + 2], r, g, b);
    }

    rgbDistanceBetweenIndices(data, firstPixelIndex, secondPixelIndex) {
        const a = firstPixelIndex * 4;
        const b = secondPixelIndex * 4;
        return this.rgbDistance(data[a], data[a + 1], data[a + 2], data[b], data[b + 1], data[b + 2]);
    }

    averageColor(samples) {
        if (samples.length === 0) {
            return { r: 0, g: 0, b: 0 };
        }

        let r = 0;
        let g = 0;
        let b = 0;

        for (const sample of samples) {
            r += sample[0];
            g += sample[1];
            b += sample[2];
        }

        return {
            r: Math.round(r / samples.length),
            g: Math.round(g / samples.length),
            b: Math.round(b / samples.length)
        };
    }

    percentileSorted(sortedValues, percentile) {
        if (sortedValues.length === 0) return 0;
        const index = Math.min(
            sortedValues.length - 1,
            Math.max(0, Math.floor((sortedValues.length - 1) * percentile))
        );
        return sortedValues[index];
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Convertir un canvas en Blob
     */
    canvasToBlob(canvas, mimeType = 'image/png', quality = 1) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Impossible de générer un Blob image.'));
                    return;
                }

                resolve(blob);
            }, mimeType, quality);
        });
    }

    /**
     * Mettre à jour les options
     */
    updateOptions(options) {
        if (options.provider !== undefined) this.provider = options.provider;
        if (options.apiKey !== undefined) this.apiKey = options.apiKey;
        if (options.threshold !== undefined) this.threshold = options.threshold;
        if (options.featherAmount !== undefined) this.featherAmount = options.featherAmount;
        if (options.backgroundColor !== undefined) this.backgroundColor = options.backgroundColor;
        if (options.autoCrop !== undefined) this.shouldAutoCrop = options.autoCrop;
        if (options.maxProcessingSide !== undefined) this.maxProcessingSide = options.maxProcessingSide;
    }
}

window.BackgroundRemover = BackgroundRemover;
