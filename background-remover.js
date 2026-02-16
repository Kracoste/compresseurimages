/**
 * Module de suppression de fond d'image - Version optimisée
 * Utilise une approche par seuil de couleur sans récursion
 */

class BackgroundRemover {
    constructor(options = {}) {
        this.threshold = options.threshold || 30;
        this.featherAmount = options.featherAmount || 2;
        this.backgroundColor = options.backgroundColor || null;
        this.onProgress = options.onProgress || (() => {});
    }

    /**
     * Supprimer le fond d'une image
     */
    async removeBackground(imageSource) {
        this.onProgress(5, 'Chargement de l\'image...');
        
        const img = await this.loadImage(imageSource);
        
        this.onProgress(10, 'Préparation...');
        
        // Créer le canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;
        
        this.onProgress(20, 'Détection de la couleur de fond...');
        
        // Détecter la couleur de fond (échantillonnage des bords)
        const bgColor = this.detectBackgroundColor(data, width, height);
        
        this.onProgress(40, 'Création du masque...');
        
        // Créer le masque de transparence (sans récursion)
        const mask = this.createMaskSimple(data, width, height, bgColor);
        
        this.onProgress(60, 'Lissage des bords...');
        
        // Appliquer un flou gaussien simple sur le masque pour les bords
        const smoothedMask = this.smoothMask(mask, width, height);
        
        this.onProgress(80, 'Application du masque...');
        
        // Appliquer le masque
        this.applyMaskToImage(data, smoothedMask, width, height);
        
        ctx.putImageData(imageData, 0, 0);
        
        this.onProgress(90, 'Recadrage...');
        
        // Recadrer
        const croppedCanvas = this.autoCrop(canvas);
        
        this.onProgress(100, 'Terminé !');
        
        return {
            canvas: croppedCanvas,
            width: croppedCanvas.width,
            height: croppedCanvas.height,
            blob: await this.canvasToBlob(croppedCanvas)
        };
    }

    /**
     * Charger une image
     */
    loadImage(source) {
        return new Promise((resolve, reject) => {
            if (source instanceof HTMLImageElement) {
                resolve(source);
                return;
            }
            
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            
            if (source instanceof File || source instanceof Blob) {
                img.src = URL.createObjectURL(source);
            } else if (typeof source === 'string') {
                img.src = source;
            }
        });
    }

    /**
     * Détecter la couleur de fond en échantillonnant les bords
     */
    detectBackgroundColor(data, width, height) {
        const samples = [];
        const borderSize = 10;
        
        // Échantillonner les 4 bords
        for (let x = 0; x < width; x += 5) {
            // Haut
            for (let y = 0; y < borderSize; y++) {
                const idx = (y * width + x) * 4;
                samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
            }
            // Bas
            for (let y = height - borderSize; y < height; y++) {
                const idx = (y * width + x) * 4;
                samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
            }
        }
        
        for (let y = 0; y < height; y += 5) {
            // Gauche
            for (let x = 0; x < borderSize; x++) {
                const idx = (y * width + x) * 4;
                samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
            }
            // Droite
            for (let x = width - borderSize; x < width; x++) {
                const idx = (y * width + x) * 4;
                samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
            }
        }
        
        // Calculer la moyenne
        let r = 0, g = 0, b = 0;
        for (const sample of samples) {
            r += sample.r;
            g += sample.g;
            b += sample.b;
        }
        
        const count = samples.length;
        return {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count)
        };
    }

    /**
     * Créer un masque simple basé sur la distance de couleur (SANS RECURSION)
     */
    createMaskSimple(data, width, height, bgColor) {
        const mask = new Float32Array(width * height);
        const tolerance = this.threshold;
        
        // Première passe : marquer les pixels similaires au fond
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // Distance euclidienne
            const dist = Math.sqrt(
                (r - bgColor.r) ** 2 +
                (g - bgColor.g) ** 2 +
                (b - bgColor.b) ** 2
            );
            
            // Normaliser : 0 = fond, 1 = premier plan
            if (dist < tolerance) {
                mask[i] = 0; // Fond certain
            } else if (dist > tolerance * 2) {
                mask[i] = 1; // Premier plan certain
            } else {
                // Zone de transition
                mask[i] = (dist - tolerance) / tolerance;
            }
        }
        
        // Deuxième passe : propager le fond depuis les bords (itératif, pas récursif)
        const isBackground = new Uint8Array(width * height);
        
        // Marquer les bords comme fond s'ils correspondent à la couleur
        for (let x = 0; x < width; x++) {
            // Bord supérieur
            if (mask[x] < 0.5) isBackground[x] = 1;
            // Bord inférieur
            const bottomIdx = (height - 1) * width + x;
            if (mask[bottomIdx] < 0.5) isBackground[bottomIdx] = 1;
        }
        for (let y = 0; y < height; y++) {
            // Bord gauche
            const leftIdx = y * width;
            if (mask[leftIdx] < 0.5) isBackground[leftIdx] = 1;
            // Bord droit
            const rightIdx = y * width + (width - 1);
            if (mask[rightIdx] < 0.5) isBackground[rightIdx] = 1;
        }
        
        // Propagation itérative (plusieurs passes au lieu de récursion)
        const numPasses = Math.min(50, Math.max(width, height) / 20);
        
        for (let pass = 0; pass < numPasses; pass++) {
            let changed = false;
            
            // Parcourir de gauche à droite, haut en bas
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    
                    if (!isBackground[idx] && mask[idx] < 0.5) {
                        // Vérifier les voisins
                        const neighbors = [
                            idx - 1,           // gauche
                            idx + 1,           // droite
                            idx - width,       // haut
                            idx + width        // bas
                        ];
                        
                        for (const nIdx of neighbors) {
                            if (isBackground[nIdx]) {
                                isBackground[idx] = 1;
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }
            
            // Parcourir de droite à gauche, bas en haut
            for (let y = height - 2; y > 0; y--) {
                for (let x = width - 2; x > 0; x--) {
                    const idx = y * width + x;
                    
                    if (!isBackground[idx] && mask[idx] < 0.5) {
                        const neighbors = [
                            idx - 1,
                            idx + 1,
                            idx - width,
                            idx + width
                        ];
                        
                        for (const nIdx of neighbors) {
                            if (isBackground[nIdx]) {
                                isBackground[idx] = 1;
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (!changed) break;
        }
        
        // Appliquer la propagation au masque
        for (let i = 0; i < mask.length; i++) {
            if (isBackground[i]) {
                mask[i] = 0;
            }
        }
        
        return mask;
    }

    /**
     * Lisser le masque avec un flou simple
     */
    smoothMask(mask, width, height) {
        const result = new Float32Array(mask);
        const radius = this.featherAmount;
        
        if (radius === 0) return result;
        
        // Flou horizontal
        const temp = new Float32Array(mask.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;
                
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx;
                    if (nx >= 0 && nx < width) {
                        sum += mask[y * width + nx];
                        count++;
                    }
                }
                temp[y * width + x] = sum / count;
            }
        }
        
        // Flou vertical
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;
                
                for (let dy = -radius; dy <= radius; dy++) {
                    const ny = y + dy;
                    if (ny >= 0 && ny < height) {
                        sum += temp[ny * width + x];
                        count++;
                    }
                }
                result[y * width + x] = sum / count;
            }
        }
        
        return result;
    }

    /**
     * Appliquer le masque à l'image
     */
    applyMaskToImage(data, mask, width, height) {
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const alpha = Math.round(mask[i] * 255);
            
            if (this.backgroundColor) {
                // Mélanger avec la couleur de fond
                const blend = 1 - mask[i];
                data[idx] = Math.round(data[idx] * mask[i] + this.backgroundColor.r * blend);
                data[idx + 1] = Math.round(data[idx + 1] * mask[i] + this.backgroundColor.g * blend);
                data[idx + 2] = Math.round(data[idx + 2] * mask[i] + this.backgroundColor.b * blend);
                data[idx + 3] = 255;
            } else {
                // Transparence
                data[idx + 3] = alpha;
            }
        }
    }

    /**
     * Recadrer automatiquement l'image
     */
    autoCrop(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;
        
        let top = height, bottom = 0, left = width, right = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const alpha = data[(y * width + x) * 4 + 3];
                if (alpha > 20) {
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                    left = Math.min(left, x);
                    right = Math.max(right, x);
                }
            }
        }
        
        // Ajouter une marge
        const margin = 10;
        top = Math.max(0, top - margin);
        bottom = Math.min(height - 1, bottom + margin);
        left = Math.max(0, left - margin);
        right = Math.min(width - 1, right + margin);
        
        const cropWidth = right - left + 1;
        const cropHeight = bottom - top + 1;
        
        if (cropWidth <= 0 || cropHeight <= 0) {
            return canvas; // Retourner l'original si le recadrage échoue
        }
        
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        
        return croppedCanvas;
    }

    /**
     * Convertir le canvas en Blob
     */
    canvasToBlob(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });
    }

    /**
     * Mettre à jour les options
     */
    updateOptions(options) {
        if (options.threshold !== undefined) this.threshold = options.threshold;
        if (options.featherAmount !== undefined) this.featherAmount = options.featherAmount;
        if (options.backgroundColor !== undefined) this.backgroundColor = options.backgroundColor;
    }
}

window.BackgroundRemover = BackgroundRemover;
