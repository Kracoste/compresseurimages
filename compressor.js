/**
 * Compresseur d'Image HD Intelligent
 * Objectif : Compresser à ≤300Ko tout en préservant la qualité HD
 * 
 * Stratégie de compression :
 * 1. Analyse de l'image source
 * 2. Sélection du meilleur format (WebP > JPEG > PNG)
 * 3. Recherche binaire du niveau de qualité optimal
 * 4. Redimensionnement intelligent si nécessaire
 * 5. Validation de la qualité visuelle
 */

class ImageCompressor {
    constructor(options = {}) {
        this.targetSize = options.targetSize || 300 * 1024; // 300 Ko en bytes
        this.maxIterations = options.maxIterations || 15;
        this.tolerance = options.tolerance || 5 * 1024; // Tolérance de 5 Ko
        this.preserveResolution = options.preserveResolution !== false;
        this.maxResolution = options.maxResolution || 1920;
        this.preferredFormat = options.format || 'auto';
        this.onProgress = options.onProgress || (() => {});
    }

    /**
     * Point d'entrée principal de la compression
     */
    async compress(file) {
        this.onProgress(0, 'Chargement de l\'image...');
        
        // Charger l'image
        const originalImage = await this.loadImage(file);
        const originalSize = file.size;
        
        this.onProgress(10, 'Analyse de l\'image...');
        
        // Analyser l'image
        const analysis = this.analyzeImage(originalImage, file);
        
        this.onProgress(20, 'Sélection du format optimal...');
        
        // Déterminer le meilleur format
        const bestFormat = await this.determineBestFormat(originalImage, analysis);
        
        this.onProgress(30, 'Compression intelligente en cours...');
        
        // Compression avec recherche binaire
        const result = await this.binarySearchCompression(originalImage, bestFormat, analysis);
        
        this.onProgress(100, 'Compression terminée !');
        
        return {
            originalFile: file,
            originalSize: originalSize,
            originalDimensions: { width: originalImage.width, height: originalImage.height },
            compressedBlob: result.blob,
            compressedSize: result.blob.size,
            compressedDimensions: result.dimensions,
            format: result.format,
            quality: result.quality,
            compressionRatio: ((1 - result.blob.size / originalSize) * 100).toFixed(1),
            qualityScore: result.qualityScore
        };
    }

    /**
     * Charger une image à partir d'un fichier
     */
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };

            img.onerror = (error) => {
                URL.revokeObjectURL(objectUrl);
                reject(error);
            };

            img.src = objectUrl;
        });
    }

    /**
     * Analyser les caractéristiques de l'image
     */
    analyzeImage(img, file) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Échantillonner l'image pour analyse
        const sampleSize = 100;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;
        
        // Calculer les statistiques de l'image
        let totalVariance = 0;
        let hasTransparency = false;
        let colorHistogram = new Map();
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a < 255) hasTransparency = true;
            
            // Calculer la variance locale
            if (i > 0) {
                const prevR = data[i - 4];
                const prevG = data[i - 3];
                const prevB = data[i - 2];
                totalVariance += Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
            }
            
            // Histogramme des couleurs (simplifié)
            const colorKey = `${Math.floor(r/32)}-${Math.floor(g/32)}-${Math.floor(b/32)}`;
            colorHistogram.set(colorKey, (colorHistogram.get(colorKey) || 0) + 1);
        }
        
        const avgVariance = totalVariance / (data.length / 4);
        const uniqueColors = colorHistogram.size;
        const isPhotographic = avgVariance > 30 && uniqueColors > 200;
        const isGraphic = uniqueColors < 100;
        const complexity = Math.min(100, avgVariance);
        
        return {
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height,
            hasTransparency,
            isPhotographic,
            isGraphic,
            complexity,
            uniqueColors,
            originalType: file.type,
            megapixels: (img.width * img.height) / 1000000
        };
    }

    /**
     * Déterminer le meilleur format de sortie
     */
    async determineBestFormat(img, analysis) {
        if (this.preferredFormat !== 'auto') {
            return this.preferredFormat;
        }

        // Si l'image a de la transparence, utiliser WebP ou PNG
        if (analysis.hasTransparency) {
            if (await this.isWebPSupported()) {
                return 'webp';
            }
            return 'png';
        }

        // Pour les photos, WebP > JPEG
        if (analysis.isPhotographic) {
            if (await this.isWebPSupported()) {
                return 'webp';
            }
            return 'jpeg';
        }

        // Pour les graphiques simples, PNG peut être meilleur
        if (analysis.isGraphic && analysis.uniqueColors < 50) {
            return 'png';
        }

        // Par défaut, WebP offre le meilleur ratio
        if (await this.isWebPSupported()) {
            return 'webp';
        }
        
        return 'jpeg';
    }

    /**
     * Vérifier le support WebP
     */
    async isWebPSupported() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    /**
     * Compression par recherche binaire pour atteindre la taille cible
     */
    async binarySearchCompression(img, format, analysis) {
        let minQuality = 0.1;
        let maxQuality = 1.0;
        let bestResult = null;
        let iterations = 0;
        
        // Calculer les dimensions optimales
        let dimensions = this.calculateOptimalDimensions(img, analysis);
        
        // Créer le canvas de travail
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        
        // Dessiner avec antialiasing de qualité
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
        
        const mimeType = this.getMimeType(format);
        
        // Recherche binaire
        while (iterations < this.maxIterations) {
            const currentQuality = (minQuality + maxQuality) / 2;
            
            this.onProgress(
                30 + Math.floor((iterations / this.maxIterations) * 60),
                `Optimisation qualité: ${Math.round(currentQuality * 100)}%`
            );
            
            const blob = await this.canvasToBlob(canvas, mimeType, currentQuality);
            
            if (blob.size <= this.targetSize) {
                // Taille OK, essayer une meilleure qualité
                bestResult = {
                    blob,
                    quality: currentQuality,
                    format,
                    dimensions
                };
                
                // Si on est dans la tolérance, c'est parfait
                if (blob.size >= this.targetSize - this.tolerance) {
                    break;
                }
                
                minQuality = currentQuality;
            } else {
                // Trop gros, réduire la qualité
                maxQuality = currentQuality;
            }
            
            iterations++;
            
            // Éviter les boucles infinies
            if (maxQuality - minQuality < 0.01) {
                break;
            }
        }
        
        // Si on n'a pas réussi, essayer avec des dimensions réduites
        if (!bestResult || bestResult.blob.size > this.targetSize) {
            this.onProgress(85, 'Ajustement des dimensions...');
            bestResult = await this.compressWithResize(img, format, analysis, canvas, ctx);
        }
        
        // Calculer le score de qualité
        bestResult.qualityScore = this.calculateQualityScore(bestResult, analysis);
        
        return bestResult;
    }

    /**
     * Compression avec redimensionnement progressif
     */
    async compressWithResize(img, format, analysis, canvas, ctx) {
        const mimeType = this.getMimeType(format);
        let scaleFactor = 1.0;
        let bestResult = null;
        
        while (scaleFactor >= 0.3) {
            const width = Math.round(img.width * scaleFactor);
            const height = Math.round(img.height * scaleFactor);
            
            // Ne pas descendre en dessous de 800px pour le HD
            if (Math.max(width, height) < 800) break;
            
            canvas.width = width;
            canvas.height = height;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            
            // Essayer avec la meilleure qualité possible
            for (let quality = 0.95; quality >= 0.5; quality -= 0.05) {
                const blob = await this.canvasToBlob(canvas, mimeType, quality);
                
                if (blob.size <= this.targetSize) {
                    bestResult = {
                        blob,
                        quality,
                        format,
                        dimensions: { width, height }
                    };
                    
                    // On a trouvé une bonne combinaison
                    if (blob.size >= this.targetSize - this.tolerance) {
                        return bestResult;
                    }
                    break;
                }
            }
            
            if (bestResult) break;
            scaleFactor -= 0.1;
        }
        
        // Dernier recours : compression maximale
        if (!bestResult) {
            const width = Math.min(1280, img.width);
            const height = Math.round(width / (img.width / img.height));
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const blob = await this.canvasToBlob(canvas, mimeType, 0.6);
            bestResult = {
                blob,
                quality: 0.6,
                format,
                dimensions: { width, height }
            };
        }
        
        return bestResult;
    }

    /**
     * Calculer les dimensions optimales en préservant le HD
     */
    calculateOptimalDimensions(img, analysis) {
        let width = img.width;
        let height = img.height;
        
        // Si on doit préserver la résolution et que l'image est plus petite que max
        if (this.preserveResolution && Math.max(width, height) <= this.maxResolution) {
            return { width, height };
        }
        
        // Redimensionner si nécessaire
        if (Math.max(width, height) > this.maxResolution) {
            const ratio = this.maxResolution / Math.max(width, height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }
        
        return { width, height };
    }

    /**
     * Convertir le canvas en Blob
     */
    canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('La compression a échoué: blob vide.'));
                    return;
                }

                resolve(blob);
            }, mimeType, quality);
        });
    }

    /**
     * Obtenir le type MIME
     */
    getMimeType(format) {
        const mimeTypes = {
            'webp': 'image/webp',
            'jpeg': 'image/jpeg',
            'jpg': 'image/jpeg',
            'png': 'image/png'
        };
        return mimeTypes[format] || 'image/jpeg';
    }

    /**
     * Calculer un score de qualité estimé
     */
    calculateQualityScore(result, analysis) {
        // Score basé sur plusieurs facteurs
        let score = 100;
        
        // Pénalité pour réduction de qualité
        score -= (1 - result.quality) * 30;
        
        // Pénalité pour redimensionnement
        const originalPixels = analysis.width * analysis.height;
        const newPixels = result.dimensions.width * result.dimensions.height;
        const resizeRatio = newPixels / originalPixels;
        
        if (resizeRatio < 1) {
            score -= (1 - resizeRatio) * 20;
        }
        
        // Bonus pour WebP (meilleure qualité à taille égale)
        if (result.format === 'webp') {
            score += 5;
        }
        
        return Math.max(70, Math.min(100, Math.round(score)));
    }

    /**
     * Mettre à jour les options
     */
    updateOptions(options) {
        if (options.targetSize) this.targetSize = options.targetSize * 1024;
        if (options.maxResolution) this.maxResolution = options.maxResolution;
        if (options.preserveResolution !== undefined) this.preserveResolution = options.preserveResolution;
        if (options.format) this.preferredFormat = options.format;
    }
}

// Export pour utilisation
window.ImageCompressor = ImageCompressor;
