/**
 * Application principale du compresseur d'images E-commerce
 * Suppression de fond + Compression intelligente
 * Support multi-images
 */

document.addEventListener('DOMContentLoaded', () => {
    // Éléments DOM
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadSection = document.getElementById('uploadSection');
    const settingsSection = document.getElementById('settingsSection');
    const progressSection = document.getElementById('progressSection');
    const comparisonSection = document.getElementById('comparisonSection');
    const multiResultsSection = document.getElementById('multiResultsSection');
    const selectedImagesContainer = document.getElementById('selectedImagesContainer');
    const selectedImagesList = document.getElementById('selectedImagesList');

    // Toggle des fonctionnalités
    const removeBgCheckbox = document.getElementById('removeBgCheckbox');
    const compressCheckbox = document.getElementById('compressCheckbox');
    const bgRemovalSettings = document.getElementById('bgRemovalSettings');
    const compressionSettings = document.getElementById('compressionSettings');
    const startProcessingBtn = document.getElementById('startProcessingBtn');

    // Options suppression de fond
    const bgColorSelect = document.getElementById('bgColor');
    const bgRemovalProviderSelect = document.getElementById('bgRemovalProvider');
    const removeBgApiKeyItem = document.getElementById('removeBgApiKeyItem');
    const removeBgApiKeyInput = document.getElementById('removeBgApiKey');
    const customColorItem = document.getElementById('customColorItem');
    const customBgColor = document.getElementById('customBgColor');
    const featherAmountInput = document.getElementById('featherAmount');
    const featherValue = document.getElementById('featherValue');
    const autoCropCheckbox = document.getElementById('autoCrop');

    // Éléments de paramètres compression
    const targetSizeInput = document.getElementById('targetSize');
    const outputFormatSelect = document.getElementById('outputFormat');
    const preserveResolutionCheckbox = document.getElementById('preserveResolution');
    const maxResolutionInput = document.getElementById('maxResolution');

    // Éléments de progression
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const progressDetail = document.getElementById('progressDetail');

    // Éléments de comparaison (mode 1 image)
    const originalSizeEl = document.getElementById('originalSize');
    const compressedSizeEl = document.getElementById('compressedSize');
    const originalDimensionsEl = document.getElementById('originalDimensions');
    const compressedDimensionsEl = document.getElementById('compressedDimensions');
    const compressionRatioEl = document.getElementById('compressionRatio');
    const qualityFill = document.getElementById('qualityFill');
    const qualityPercent = document.getElementById('qualityPercent');
    const originalImage = document.getElementById('originalImage');
    const compressedImage = document.getElementById('compressedImage');
    const badgeBgRemoved = document.getElementById('badgeBgRemoved');
    const badgeCompressed = document.getElementById('badgeCompressed');

    // Boutons
    const downloadBtn = document.getElementById('downloadBtn');
    const newImageBtn = document.getElementById('newImageBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const newImagesBtn = document.getElementById('newImagesBtn');

    // Slider de comparaison
    const comparisonSlider = document.getElementById('comparisonSlider');
    const sliderHandle = document.getElementById('sliderHandle');
    const compressedContainer = document.getElementById('compressedContainer');

    // Éléments multi-résultats
    const multiResultsSummary = document.getElementById('multiResultsSummary');
    const multiResultsGrid = document.getElementById('multiResultsGrid');

    // État de l'application
    let currentFiles = [];
    let currentResults = [];
    let customNames = []; // Noms personnalisés saisis par l'utilisateur
    let backgroundRemover = null;
    let compressor = null;
    let previewUrls = [];
    const REMOVE_BG_API_KEY_STORAGE = 'removebg_api_key';

    // Initialisation
    init();

    function init() {
        setupDropZone();
        setupSlider();
        setupButtons();
        setupSettings();
        trackAnalyticsEvent('app_loaded', { app_name: 'compresseur_image' });
    }

    /**
     * Configuration de la zone de dépôt
     */
    function setupDropZone() {
        // Click pour ouvrir le sélecteur de fichier
        dropZone.addEventListener('click', () => fileInput.click());

        // Gestion du drag & drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                handleFilesSelect(files);
            }
        });

        // Sélection de fichier
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                handleFilesSelect(files);
            }
        });
    }

    /**
     * Configuration des paramètres
     */
    function setupSettings() {
        // Toggle suppression de fond
        removeBgCheckbox.addEventListener('change', () => {
            bgRemovalSettings.style.display = removeBgCheckbox.checked ? 'block' : 'none';
            document.getElementById('toggleRemoveBg').classList.toggle('active', removeBgCheckbox.checked);
            updateFormatOptions();
            trackAnalyticsEvent('setting_changed', {
                setting_name: 'remove_background',
                setting_value: removeBgCheckbox.checked
            });
        });

        // Toggle compression
        compressCheckbox.addEventListener('change', () => {
            compressionSettings.style.display = compressCheckbox.checked ? 'block' : 'none';
            document.getElementById('toggleCompress').classList.toggle('active', compressCheckbox.checked);
            trackAnalyticsEvent('setting_changed', {
                setting_name: 'compress_image',
                setting_value: compressCheckbox.checked
            });
        });

        // Couleur de fond
        bgColorSelect.addEventListener('change', () => {
            customColorItem.style.display = bgColorSelect.value === 'custom' ? 'block' : 'none';
            updateFormatOptions();
            trackAnalyticsEvent('setting_changed', {
                setting_name: 'background_color_mode',
                setting_value: bgColorSelect.value
            });
        });

        // Moteur de suppression de fond
        bgRemovalProviderSelect.addEventListener('change', () => {
            updateBgProviderSettings();
            trackAnalyticsEvent('setting_changed', {
                setting_name: 'background_provider',
                setting_value: bgRemovalProviderSelect.value
            });
        });

        // Persister la clé API remove.bg côté navigateur
        removeBgApiKeyInput.addEventListener('input', () => {
            persistRemoveBgApiKey(removeBgApiKeyInput.value.trim());
        });

        // Slider feather
        featherAmountInput.addEventListener('input', () => {
            featherValue.textContent = `${featherAmountInput.value}px`;
        });

        // Restaurer la clé API et l'état des options au chargement
        removeBgApiKeyInput.value = readPersistedRemoveBgApiKey();
        customColorItem.style.display = bgColorSelect.value === 'custom' ? 'block' : 'none';
        featherValue.textContent = `${featherAmountInput.value}px`;
        updateBgProviderSettings();
        updateFormatOptions();

        // Bouton de lancement
        startProcessingBtn.addEventListener('click', processImages);
    }

    function updateBgProviderSettings() {
        const usesRemoveBgApi = bgRemovalProviderSelect.value === 'removebg';
        removeBgApiKeyItem.style.display = usesRemoveBgApi ? '' : 'none';
    }

    function readPersistedRemoveBgApiKey() {
        try {
            return localStorage.getItem(REMOVE_BG_API_KEY_STORAGE) || '';
        } catch (error) {
            console.warn('Impossible de lire la clé API remove.bg depuis localStorage:', error);
            return '';
        }
    }

    function persistRemoveBgApiKey(value) {
        try {
            if (value) {
                localStorage.setItem(REMOVE_BG_API_KEY_STORAGE, value);
            } else {
                localStorage.removeItem(REMOVE_BG_API_KEY_STORAGE);
            }
        } catch (error) {
            console.warn('Impossible de persister la clé API remove.bg:', error);
        }
    }

    /**
     * Mise à jour des options de format selon les paramètres
     */
    function updateFormatOptions() {
        const needsTransparency = removeBgCheckbox.checked && bgColorSelect.value === 'transparent';

        // Si on a besoin de transparence, forcer PNG ou WebP
        if (needsTransparency) {
            const jpegOption = outputFormatSelect.querySelector('option[value="jpeg"]');
            if (jpegOption) {
                jpegOption.disabled = true;
            }

            if (outputFormatSelect.value === 'jpeg') {
                outputFormatSelect.value = 'auto';
            }
        } else {
            const jpegOption = outputFormatSelect.querySelector('option[value="jpeg"]');
            if (jpegOption) {
                jpegOption.disabled = false;
            }
        }
    }

    function resolveCompressionFormat(doRemoveBg) {
        const needsTransparency = doRemoveBg && bgColorSelect.value === 'transparent';
        let format = outputFormatSelect.value;

        if (needsTransparency && format === 'jpeg') {
            format = 'auto';
        }

        return format;
    }

    /**
     * Configuration du slider de comparaison
     */
    function setupSlider() {
        let isDragging = false;

        const startDrag = (e) => {
            isDragging = true;
            updateSlider(e);
        };

        const stopDrag = () => {
            isDragging = false;
        };

        const drag = (e) => {
            if (isDragging) {
                updateSlider(e);
            }
        };

        const updateSlider = (e) => {
            const rect = comparisonSlider.getBoundingClientRect();
            let x = (e.clientX || e.touches[0].clientX) - rect.left;
            x = Math.max(0, Math.min(x, rect.width));

            const percent = (x / rect.width) * 100;
            compressedContainer.style.clipPath = `inset(0 0 0 ${percent}%)`;
            sliderHandle.style.left = `${percent}%`;
        };

        sliderHandle.addEventListener('mousedown', startDrag);
        sliderHandle.addEventListener('touchstart', startDrag);

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag);

        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);

        // Position initiale au milieu
        compressedContainer.style.clipPath = 'inset(0 0 0 50%)';
        sliderHandle.style.left = '50%';
    }

    /**
     * Configuration des boutons
     */
    function setupButtons() {
        downloadBtn.addEventListener('click', downloadSingleImage);
        newImageBtn.addEventListener('click', resetApp);
        downloadAllBtn.addEventListener('click', downloadAllImages);
        newImagesBtn.addEventListener('click', resetApp);
    }

    /**
     * Gérer la sélection de plusieurs fichiers
     */
    function handleFilesSelect(files) {
        // Filtrer les fichiers valides
        const validFiles = [];
        const rejectedFiles = [];

        for (const file of files) {
            if (file.type.match(/^image\/(jpeg|png|webp)$/)) {
                validFiles.push(file);
                trackAnalyticsEvent('image_file_selected', {
                    file_type: file.type,
                    file_extension: getFileExtension(file.name),
                    file_size_kb: bytesToKilobytes(file.size)
                });
            } else {
                rejectedFiles.push(file);
                trackAnalyticsEvent('image_file_rejected', {
                    file_type: file.type || 'unknown'
                });
            }
        }

        if (rejectedFiles.length > 0 && validFiles.length === 0) {
            alert('Format non supporté. Veuillez utiliser JPG, PNG ou WebP.');
            return;
        }

        if (rejectedFiles.length > 0) {
            alert(`${rejectedFiles.length} fichier(s) ignoré(s) (format non supporté). ${validFiles.length} image(s) retenue(s).`);
        }

        if (validFiles.length === 0) return;

        currentFiles = validFiles;
        showSelectedImagesPreviews(validFiles);

        // Afficher les paramètres
        settingsSection.style.display = 'block';
        comparisonSection.style.display = 'none';
        multiResultsSection.style.display = 'none';
        progressSection.style.display = 'none';

        // Scroll vers les paramètres
        settingsSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Afficher les aperçus des fichiers sélectionnés
     */
    function showSelectedImagesPreviews(files) {
        // Nettoyer les anciennes URLs
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        previewUrls = [];

        selectedImagesList.innerHTML = '';
        selectedImagesContainer.style.display = 'block';

        // Initialiser les noms personnalisés (garder les existants si possible)
        const oldNames = customNames.slice();
        customNames = files.map((file, i) => {
            // Garder l'ancien nom si le fichier est le même
            if (oldNames[i] !== undefined && oldNames[i] !== '') {
                return oldNames[i];
            }
            // Par défaut : nom du fichier sans extension
            return file.name.replace(/\.[^/.]+$/, '');
        });

        files.forEach((file, index) => {
            const url = URL.createObjectURL(file);
            previewUrls.push(url);

            const item = document.createElement('div');
            item.className = 'selected-image-preview';
            item.innerHTML = `
                <img src="${url}" alt="${file.name}">
                <div class="selected-image-meta">
                    <input type="text" class="rename-input" data-index="${index}" value="${customNames[index]}" placeholder="Nom du fichier">
                    <p class="selected-image-info">${formatSize(file.size)}</p>
                </div>
                <button class="btn-remove-image" data-index="${index}" title="Retirer cette image">&times;</button>
            `;
            selectedImagesList.appendChild(item);

            // Mettre à jour le nom personnalisé quand l'utilisateur tape
            const renameInput = item.querySelector('.rename-input');
            renameInput.addEventListener('input', () => {
                customNames[index] = renameInput.value;
            });

            // Charger les dimensions en arrière-plan
            loadImage(file).then(img => {
                const infoEl = item.querySelector('.selected-image-info');
                if (infoEl) {
                    infoEl.textContent = `${img.width} × ${img.height} px • ${formatSize(file.size)}`;
                }
            }).catch(() => {});
        });

        // Gestion du bouton supprimer
        selectedImagesList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.btn-remove-image');
            if (!removeBtn) return;

            const idx = parseInt(removeBtn.dataset.index);
            currentFiles.splice(idx, 1);

            if (currentFiles.length === 0) {
                resetApp();
            } else {
                showSelectedImagesPreviews(currentFiles);
            }
        });
    }

    /**
     * Traiter une seule image (fonction utilitaire)
     */
    async function processSingleFile(file, doRemoveBg, doCompress, outputFormat, backgroundProvider) {
        let processedBlob = file;
        let bgRemovalResult = null;
        let compressionResult = null;

        // Charger l'image pour obtenir les dimensions originales
        const tempImg = await loadImage(file);
        const originalDims = { width: tempImg.width, height: tempImg.height };

        // Étape 1: Suppression du fond
        if (doRemoveBg) {
            const removeBgApiKey = removeBgApiKeyInput.value.trim();

            // Déterminer la couleur de fond
            let backgroundColor = null;
            if (bgColorSelect.value === 'white') {
                backgroundColor = { r: 255, g: 255, b: 255 };
            } else if (bgColorSelect.value === 'custom') {
                const hex = customBgColor.value;
                backgroundColor = {
                    r: parseInt(hex.slice(1, 3), 16),
                    g: parseInt(hex.slice(3, 5), 16),
                    b: parseInt(hex.slice(5, 7), 16)
                };
            }

            backgroundRemover = new BackgroundRemover({
                provider: backgroundProvider,
                apiKey: removeBgApiKey,
                featherAmount: parseInt(featherAmountInput.value),
                backgroundColor: backgroundColor,
                autoCrop: autoCropCheckbox.checked,
                onProgress: () => {} // La progression est gérée au niveau global
            });

            bgRemovalResult = await backgroundRemover.removeBackground(file);
            processedBlob = bgRemovalResult.blob;
        }

        // Étape 2: Compression
        if (doCompress) {
            const format = outputFormat;

            compressor = new ImageCompressor({
                targetSize: parseInt(targetSizeInput.value) * 1024,
                maxResolution: parseInt(maxResolutionInput.value),
                preserveResolution: preserveResolutionCheckbox.checked,
                format: format,
                onProgress: () => {} // La progression est gérée au niveau global
            });

            // Convertir le blob en fichier si nécessaire
            const fileToCompress = processedBlob instanceof File ? processedBlob :
                new File([processedBlob], 'image.png', { type: processedBlob.type });

            compressionResult = await compressor.compress(fileToCompress);
            processedBlob = compressionResult.compressedBlob;
        }

        // Construire le résultat
        return {
            originalFile: file,
            originalSize: file.size,
            originalDimensions: originalDims,
            processedBlob: processedBlob,
            processedSize: processedBlob.size,
            processedDimensions: compressionResult ? compressionResult.compressedDimensions :
                { width: bgRemovalResult.width, height: bgRemovalResult.height },
            format: compressionResult ? compressionResult.format : (bgRemovalResult.format || 'png'),
            bgRemoved: doRemoveBg,
            compressed: doCompress,
            compressionRatio: ((1 - processedBlob.size / file.size) * 100).toFixed(1),
            qualityScore: compressionResult ? compressionResult.qualityScore : 95
        };
    }

    /**
     * Lancer le traitement de toutes les images
     */
    async function processImages() {
        if (currentFiles.length === 0) return;

        const doRemoveBg = removeBgCheckbox.checked;
        const doCompress = compressCheckbox.checked;
        const backgroundProvider = doRemoveBg ? bgRemovalProviderSelect.value : 'none';
        const outputFormat = doCompress ? resolveCompressionFormat(doRemoveBg) : 'none';

        if (!doRemoveBg && !doCompress) {
            trackAnalyticsEvent('processing_validation_failed', { reason: 'no_feature_enabled' });
            alert('Veuillez activer au moins une option de traitement.');
            return;
        }

        // Afficher la progression
        progressSection.style.display = 'block';
        startProcessingBtn.disabled = true;

        trackAnalyticsEvent('image_processing_started', {
            remove_background_enabled: doRemoveBg,
            compression_enabled: doCompress,
            background_provider: backgroundProvider,
            background_color_mode: doRemoveBg ? bgColorSelect.value : 'none',
            target_size_kb: doCompress ? parseInt(targetSizeInput.value) : null,
            requested_output_format: outputFormat,
            preserve_resolution: doCompress ? preserveResolutionCheckbox.checked : null,
            image_count: currentFiles.length
        });

        currentResults = [];
        const totalFiles = currentFiles.length;

        try {
            for (let i = 0; i < totalFiles; i++) {
                const file = currentFiles[i];
                const fileLabel = totalFiles > 1 ? `Image ${i + 1}/${totalFiles} : ${file.name}` : file.name;

                // Progression globale
                const globalPercent = Math.floor((i / totalFiles) * 100);
                updateProgress(globalPercent, `Traitement de ${fileLabel}...`);

                const result = await processSingleFile(file, doRemoveBg, doCompress, outputFormat, backgroundProvider);
                currentResults.push(result);

                trackAnalyticsEvent('image_processing_completed', {
                    remove_background_enabled: result.bgRemoved,
                    compression_enabled: result.compressed,
                    background_provider: backgroundProvider,
                    output_format: result.format,
                    original_size_kb: bytesToKilobytes(result.originalSize),
                    output_size_kb: bytesToKilobytes(result.processedSize),
                    compression_ratio_pct: Number(result.compressionRatio),
                    quality_score: result.qualityScore
                });
            }

            updateProgress(100, 'Traitement terminé !');

            // Afficher les résultats
            if (currentResults.length === 1) {
                showSingleResult(currentResults[0]);
            } else {
                showMultiResults(currentResults);
            }

        } catch (error) {
            trackAnalyticsEvent('image_processing_failed', {
                remove_background_enabled: doRemoveBg,
                compression_enabled: doCompress,
                background_provider: backgroundProvider,
                requested_output_format: outputFormat,
                error_message: truncateForAnalytics(error.message)
            });
            console.error('Erreur de traitement:', error);
            alert('Une erreur est survenue lors du traitement: ' + error.message);
        } finally {
            startProcessingBtn.disabled = false;
        }
    }

    /**
     * Charger une image
     */
    function loadImage(file) {
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
     * Mettre à jour la barre de progression
     */
    function updateProgress(percent, message) {
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressDetail.textContent = message;
    }

    /**
     * Afficher le résultat pour une seule image (mode comparaison)
     */
    function showSingleResult(result) {
        // Masquer la progression
        progressSection.style.display = 'none';
        multiResultsSection.style.display = 'none';

        // Afficher la section de comparaison
        comparisonSection.style.display = 'block';

        // Badges des opérations
        badgeBgRemoved.style.display = result.bgRemoved ? 'inline-flex' : 'none';
        badgeCompressed.style.display = result.compressed ? 'inline-flex' : 'none';

        // Statistiques
        originalSizeEl.textContent = formatSize(result.originalSize);
        compressedSizeEl.textContent = formatSize(result.processedSize);
        originalDimensionsEl.textContent = `${result.originalDimensions.width} × ${result.originalDimensions.height} px`;
        compressedDimensionsEl.textContent = `${result.processedDimensions.width} × ${result.processedDimensions.height} px`;
        compressionRatioEl.textContent = result.compressionRatio > 0 ? `-${result.compressionRatio}%` : '+' + Math.abs(result.compressionRatio) + '%';

        // Score de qualité
        qualityFill.style.width = `${result.qualityScore}%`;
        qualityPercent.textContent = `${result.qualityScore}%`;

        // Couleur du score de qualité
        if (result.qualityScore >= 90) {
            qualityFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        } else if (result.qualityScore >= 80) {
            qualityFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
        } else {
            qualityFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
        }

        // Adapter la hauteur du comparateur aux dimensions de l'image originale
        if (result.originalDimensions && result.originalDimensions.width > 0 && result.originalDimensions.height > 0) {
            comparisonSlider.style.aspectRatio = `${result.originalDimensions.width} / ${result.originalDimensions.height}`;
        }

        if (originalImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(originalImage.src);
        }

        if (compressedImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(compressedImage.src);
        }

        // Images de comparaison
        originalImage.src = URL.createObjectURL(result.originalFile);
        compressedImage.src = URL.createObjectURL(result.processedBlob);

        // Format de l'image dans le bouton
        const formatLabel = result.format.toUpperCase();
        downloadBtn.innerHTML = `💾 Télécharger (${formatLabel} - ${formatSize(result.processedSize)})`;

        // Scroll vers les résultats
        comparisonSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Afficher les résultats pour plusieurs images
     */
    function showMultiResults(results) {
        // Masquer la progression et la comparaison single
        progressSection.style.display = 'none';
        comparisonSection.style.display = 'none';

        // Afficher la section multi-résultats
        multiResultsSection.style.display = 'block';

        // Résumé global
        const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
        const totalProcessed = results.reduce((sum, r) => sum + r.processedSize, 0);
        const globalRatio = ((1 - totalProcessed / totalOriginal) * 100).toFixed(1);

        multiResultsSummary.innerHTML = `
            <div class="multi-summary-stats">
                <span>${results.length} images traitées</span>
                <span>${formatSize(totalOriginal)} → ${formatSize(totalProcessed)}</span>
                <span class="multi-summary-ratio">-${globalRatio}%</span>
            </div>
        `;

        // Grille des résultats
        multiResultsGrid.innerHTML = '';
        results.forEach((result, index) => {
            const previewUrl = URL.createObjectURL(result.processedBlob);
            const card = document.createElement('div');
            card.className = 'multi-result-card';
            const currentName = (customNames[index] && customNames[index].trim()) || result.originalFile.name.replace(/\.[^/.]+$/, '');
            card.innerHTML = `
                <div class="multi-result-preview">
                    <img src="${previewUrl}" alt="${result.originalFile.name}">
                </div>
                <div class="multi-result-info">
                    <input type="text" class="rename-input" data-index="${index}" value="${currentName}" placeholder="Nom du fichier">
                    <p class="multi-result-sizes">${formatSize(result.originalSize)} → ${formatSize(result.processedSize)} <span class="multi-result-ratio">(-${result.compressionRatio}%)</span></p>
                    <p class="multi-result-format">${result.format.toUpperCase()} • ${result.processedDimensions.width} × ${result.processedDimensions.height} px</p>
                </div>
                <button class="btn btn-small btn-primary multi-result-download" data-index="${index}">💾</button>
            `;

            // Mettre à jour le nom personnalisé
            const renameInput = card.querySelector('.rename-input');
            renameInput.addEventListener('input', () => {
                customNames[index] = renameInput.value;
            });
            multiResultsGrid.appendChild(card);
        });

        // Téléchargement individuel
        multiResultsGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.multi-result-download');
            if (!btn) return;
            const idx = parseInt(btn.dataset.index);
            downloadResultAt(idx);
        });

        // Taille totale dans le bouton
        downloadAllBtn.innerHTML = `💾 Tout télécharger (${results.length} images - ${formatSize(totalProcessed)})`;

        // Scroll vers les résultats
        multiResultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Générer le nom de fichier pour un résultat
     */
    function getResultFilename(result, index) {
        // Utiliser le nom personnalisé si disponible, sinon le nom original
        const baseName = (customNames[index] && customNames[index].trim())
            ? customNames[index].trim()
            : result.originalFile.name.replace(/\.[^/.]+$/, '');
        const extension = result.format === 'jpeg' ? 'jpg' : result.format;
        return `${baseName}.${extension}`;
    }

    /**
     * Télécharger un résultat par son index
     */
    function downloadResultAt(index) {
        const result = currentResults[index];
        if (!result) return;

        trackAnalyticsEvent('image_downloaded', {
            output_format: result.format,
            output_size_kb: bytesToKilobytes(result.processedSize),
            compression_ratio_pct: Number(result.compressionRatio),
            remove_background_enabled: result.bgRemoved,
            compression_enabled: result.compressed
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(result.processedBlob);
        link.download = getResultFilename(result, index);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Télécharger l'image traitée (mode single)
     */
    function downloadSingleImage() {
        if (currentResults.length === 0) return;
        downloadResultAt(0);
    }

    /**
     * Télécharger toutes les images traitées une par une
     */
    function downloadAllImages() {
        if (currentResults.length === 0) return;

        trackAnalyticsEvent('images_downloaded_all', {
            image_count: currentResults.length
        });

        // Télécharger chaque image avec un petit délai pour que le navigateur gère bien
        currentResults.forEach((_, index) => {
            setTimeout(() => {
                downloadResultAt(index);
            }, index * 300);
        });
    }

    /**
     * Réinitialiser l'application
     */
    function resetApp() {
        trackAnalyticsEvent('app_reset', {
            had_result: currentResults.length > 0
        });

        currentFiles = [];
        currentResults = [];
        customNames = [];
        backgroundRemover = null;
        compressor = null;

        // Réinitialiser les affichages
        uploadSection.style.display = 'block';
        settingsSection.style.display = 'none';
        progressSection.style.display = 'none';
        comparisonSection.style.display = 'none';
        multiResultsSection.style.display = 'none';

        // Réinitialiser la progression
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressDetail.textContent = 'Initialisation...';

        // Réinitialiser les checkboxes
        removeBgCheckbox.checked = true;
        compressCheckbox.checked = true;
        bgRemovalSettings.style.display = 'block';
        compressionSettings.style.display = 'block';
        document.getElementById('toggleRemoveBg').classList.add('active');
        document.getElementById('toggleCompress').classList.add('active');

        // Réinitialiser le slider
        compressedContainer.style.clipPath = 'inset(0 0 0 50%)';
        sliderHandle.style.left = '50%';
        comparisonSlider.style.removeProperty('aspect-ratio');

        // Réinitialiser le champ de fichier
        fileInput.value = '';
        selectedImagesContainer.style.display = 'none';
        selectedImagesList.innerHTML = '';

        // Libérer les URL d'objets
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        previewUrls = [];

        if (originalImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(originalImage.src);
        }

        if (compressedImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(compressedImage.src);
        }

        originalImage.src = '';
        compressedImage.src = '';

        // Scroll vers le haut
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Envoyer un événement analytics à GTM/GA4
     */
    function trackAnalyticsEvent(eventName, params = {}) {
        if (!eventName || typeof window === 'undefined') {
            return;
        }

        const sanitizedParams = sanitizeAnalyticsParams(params);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            ...sanitizedParams
        });
    }

    function sanitizeAnalyticsParams(params = {}) {
        const sanitized = {};

        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }

            if (typeof value === 'number' && !Number.isFinite(value)) {
                return;
            }

            sanitized[key] = value;
        });

        return sanitized;
    }

    function bytesToKilobytes(bytes) {
        return Math.round(bytes / 1024);
    }

    function getFileExtension(filename) {
        const parts = String(filename || '').toLowerCase().split('.');
        return parts.length > 1 ? parts.pop() : 'unknown';
    }

    function truncateForAnalytics(value, maxLength = 120) {
        const text = String(value || '');
        if (text.length <= maxLength) {
            return text;
        }

        return `${text.slice(0, maxLength)}...`;
    }

    /**
     * Formater la taille du fichier
     */
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
        return (bytes / (1024 * 1024)).toFixed(2) + ' Mo';
    }
});
