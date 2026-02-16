/**
 * Application principale du compresseur d'images E-commerce
 * Suppression de fond + Compression intelligente
 */

document.addEventListener('DOMContentLoaded', () => {
    // Éléments DOM
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadSection = document.getElementById('uploadSection');
    const settingsSection = document.getElementById('settingsSection');
    const progressSection = document.getElementById('progressSection');
    const comparisonSection = document.getElementById('comparisonSection');
    
    // Toggle des fonctionnalités
    const removeBgCheckbox = document.getElementById('removeBgCheckbox');
    const compressCheckbox = document.getElementById('compressCheckbox');
    const bgRemovalSettings = document.getElementById('bgRemovalSettings');
    const compressionSettings = document.getElementById('compressionSettings');
    const startProcessingBtn = document.getElementById('startProcessingBtn');
    
    // Options suppression de fond
    const bgColorSelect = document.getElementById('bgColor');
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
    
    // Éléments de comparaison
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
    
    // Slider de comparaison
    const comparisonSlider = document.getElementById('comparisonSlider');
    const sliderHandle = document.getElementById('sliderHandle');
    const compressedContainer = document.getElementById('compressedContainer');
    
    // État de l'application
    let currentFile = null;
    let currentResult = null;
    let backgroundRemover = null;
    let compressor = null;
    
    // Initialisation
    init();
    
    function init() {
        setupDropZone();
        setupSlider();
        setupButtons();
        setupSettings();
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
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
        
        // Sélection de fichier
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
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
        });
        
        // Toggle compression
        compressCheckbox.addEventListener('change', () => {
            compressionSettings.style.display = compressCheckbox.checked ? 'block' : 'none';
            document.getElementById('toggleCompress').classList.toggle('active', compressCheckbox.checked);
        });
        
        // Couleur de fond
        bgColorSelect.addEventListener('change', () => {
            customColorItem.style.display = bgColorSelect.value === 'custom' ? 'block' : 'none';
            updateFormatOptions();
        });
        
        // Slider feather
        featherAmountInput.addEventListener('input', () => {
            featherValue.textContent = `${featherAmountInput.value}px`;
        });
        
        // Bouton de lancement
        startProcessingBtn.addEventListener('click', processImage);
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
        downloadBtn.addEventListener('click', downloadImage);
        newImageBtn.addEventListener('click', resetApp);
    }
    
    /**
     * Gérer la sélection de fichier
     */
    function handleFileSelect(file) {
        // Vérifier le type de fichier
        if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
            alert('Format non supporté. Veuillez utiliser JPG, PNG ou WebP.');
            return;
        }
        
        currentFile = file;
        
        // Afficher les paramètres
        settingsSection.style.display = 'block';
        comparisonSection.style.display = 'none';
        progressSection.style.display = 'none';
        
        // Scroll vers les paramètres
        settingsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    /**
     * Lancer le traitement de l'image
     */
    async function processImage() {
        if (!currentFile) return;
        
        const doRemoveBg = removeBgCheckbox.checked;
        const doCompress = compressCheckbox.checked;
        
        if (!doRemoveBg && !doCompress) {
            alert('Veuillez activer au moins une option de traitement.');
            return;
        }
        
        // Afficher la progression
        progressSection.style.display = 'block';
        startProcessingBtn.disabled = true;
        
        try {
            let processedBlob = currentFile;
            let bgRemovalResult = null;
            let compressionResult = null;
            let originalDims = null;
            
            // Charger l'image pour obtenir les dimensions originales
            const tempImg = await loadImage(currentFile);
            originalDims = { width: tempImg.width, height: tempImg.height };
            
            // Étape 1: Suppression du fond
            if (doRemoveBg) {
                updateProgress(0, 'Suppression du fond en cours...');
                
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
                    featherAmount: parseInt(featherAmountInput.value),
                    backgroundColor: backgroundColor,
                    onProgress: (percent, message) => {
                        // Mapper à 0-50%
                        updateProgress(Math.floor(percent * 0.5), message);
                    }
                });
                
                bgRemovalResult = await backgroundRemover.removeBackground(currentFile);
                processedBlob = bgRemovalResult.blob;
            }
            
            // Étape 2: Compression
            if (doCompress) {
                updateProgress(50, 'Compression en cours...');
                
                // Déterminer le format
                let format = outputFormatSelect.value;
                if (format === 'auto' && doRemoveBg && bgColorSelect.value === 'transparent') {
                    format = 'webp'; // WebP supporte la transparence et compresse bien
                }
                
                compressor = new ImageCompressor({
                    targetSize: parseInt(targetSizeInput.value) * 1024,
                    maxResolution: parseInt(maxResolutionInput.value),
                    preserveResolution: preserveResolutionCheckbox.checked,
                    format: format,
                    onProgress: (percent, message) => {
                        // Mapper à 50-100%
                        const mappedPercent = doRemoveBg ? 50 + Math.floor(percent * 0.5) : percent;
                        updateProgress(mappedPercent, message);
                    }
                });
                
                // Convertir le blob en fichier si nécessaire
                const fileToCompress = processedBlob instanceof File ? processedBlob : 
                    new File([processedBlob], 'image.png', { type: processedBlob.type });
                
                compressionResult = await compressor.compress(fileToCompress);
                processedBlob = compressionResult.compressedBlob;
            }
            
            // Construire le résultat final
            currentResult = {
                originalFile: currentFile,
                originalSize: currentFile.size,
                originalDimensions: originalDims,
                processedBlob: processedBlob,
                processedSize: processedBlob.size,
                processedDimensions: compressionResult ? compressionResult.compressedDimensions :
                    { width: bgRemovalResult.width, height: bgRemovalResult.height },
                format: compressionResult ? compressionResult.format : 'png',
                bgRemoved: doRemoveBg,
                compressed: doCompress,
                compressionRatio: ((1 - processedBlob.size / currentFile.size) * 100).toFixed(1),
                qualityScore: compressionResult ? compressionResult.qualityScore : 95
            };
            
            // Afficher les résultats
            showResults(currentResult);
            
        } catch (error) {
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
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
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
     * Afficher les résultats de traitement
     */
    function showResults(result) {
        // Masquer la progression
        progressSection.style.display = 'none';
        
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
     * Télécharger l'image traitée
     */
    function downloadImage() {
        if (!currentResult) return;
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(currentResult.processedBlob);
        
        // Nom du fichier
        const originalName = currentResult.originalFile.name.replace(/\.[^/.]+$/, '');
        const suffix = currentResult.bgRemoved && currentResult.compressed ? '_nobg_compressed' :
            currentResult.bgRemoved ? '_nobg' : '_compressed';
        const extension = currentResult.format === 'jpeg' ? 'jpg' : currentResult.format;
        link.download = `${originalName}${suffix}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Réinitialiser l'application
     */
    function resetApp() {
        currentFile = null;
        currentResult = null;
        backgroundRemover = null;
        compressor = null;
        
        // Réinitialiser les affichages
        uploadSection.style.display = 'block';
        settingsSection.style.display = 'none';
        progressSection.style.display = 'none';
        comparisonSection.style.display = 'none';
        
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
        
        // Réinitialiser le champ de fichier
        fileInput.value = '';
        
        // Libérer les URL d'objets
        if (originalImage.src) URL.revokeObjectURL(originalImage.src);
        if (compressedImage.src) URL.revokeObjectURL(compressedImage.src);
        
        // Scroll vers le haut
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
