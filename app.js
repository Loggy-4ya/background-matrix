/**
 * @fileoverview Dual-canvas hardware-accelerated infinite background animation engine.
 * Synchronizes twin graphics layers to offload blur masking onto CSS GPU compositor threads.
 */

/**
 * Structural configuration schema for the engine instance.
 * @typedef {Object} EngineOptions
 * @property {string} singleIconSrc - The resolution path/URL for the target asset.
 * @property {number} cellGridSize - The absolute dimensions of a single grid block.
 * @property {number} iconScaleSize - Bounding constraint limit for the scaled icon asset.
 * @property {number} speedX - Horizontal pixel translation delta per frame step.
 * @property {number} speedY - Vertical pixel translation delta per frame step.
 * @property {number} globalOpacity - Rendering alpha value for the repeated pattern fill step.
 * @property {number} rotationDegrees - Explicit rotation angle applied to the asset.
 * @property {string} highlightColor - CSS color string used to colorize the icon mask.
 * @property {number} maxRadiusMultiplier - Radial gradient radius scale for the vignette backdrop.
 * @property {Array<{offset: number, color: string}>} vignetteColorStops - Color stops mapping the ambient light backdrop.
 */

class HardwareGridEngine {
    /**
     * @param {string} sharpCanvasId - DOM ID of the base sharp canvas layer.
     * @param {string} blurredCanvasId - DOM ID of the mirror blurred canvas layer.
     * @param {Partial<EngineOptions>} [customOptions={}] - Explicit configuration modifications.
     */
    constructor(sharpCanvasId, blurredCanvasId, customOptions = {}) {
        /** @private @type {HTMLCanvasElement} */
        this.canvasSharp = document.getElementById(sharpCanvasId);
        /** @private @type {CanvasRenderingContext2D} */
        this.ctxSharp = this.canvasSharp.getContext('2d');

        /** @private @type {HTMLCanvasElement} */
        this.canvasBlurred = document.getElementById(blurredCanvasId);
        /** @private @type {CanvasRenderingContext2D} */
        this.ctxBlurred = this.canvasBlurred.getContext('2d');
        
        /**
         * Fallback execution defaults merged seamlessly with user-defined mutations.
         * @private @type {EngineOptions}
         */
        this.options = {
            singleIconSrc: 'logo.svg',
            cellGridSize: 150,
            iconScaleSize: 109,
            speedX: 0.15,
            speedY: 0.15,
            globalOpacity: 0.4,
            rotationDegrees: -45,
            highlightColor: '#6887d6b4',
            maxRadiusMultiplier: 0.45,
            vignetteColorStops: [
                { offset: 0.0, color: 'rgba(11, 15, 25, 0.0)' },   // Ambient central lighting pocket
                { offset: 0.5, color: 'rgba(11, 15, 25, 0.4)' },   // Smooth mid-tone transition gradient
                { offset: 1.0, color: 'rgba(11, 15, 25, 1.0)' }    // Deep solid boundary background mask
            ],
            ...customOptions
        };

        /** @private @type {number} */
        this.offsetX = 0;
        /** @private @type {number} */
        this.offsetY = 0;
        /** @private @type {CanvasPattern|null} */
        this.gridPattern = null;
        /** @private @type {HTMLImageElement|null} */
        this.iconImage = null;
        /** @private @type {number|null} */
        this.animationFrameId = null;

        this.init();
    }

    /**
     * Bootstraps core subsystems, asset downloading pipelines, and binds viewport tracking events.
     * @private
     * @async
     */
    async init() {
        this.syncViewportResolution();
        
        this.resizeHandler = () => this.syncViewportResolution();
        window.addEventListener('resize', this.resizeHandler);

        try {
            this.iconImage = await this.fetchIconAsset(this.options.singleIconSrc);
            this.generateGridPatternTexture();
            this.animationPipelineLoop();
        } catch (error) {
            console.error("Critical architecture compilation fault within HardwareGridEngine:", error);
        }
    }

    /**
     * Resizes internal drawing dimensions for both targets simultaneously.
     * @private
     */
    syncViewportResolution() {
        this.canvasSharp.width = window.innerWidth;
        this.canvasSharp.height = window.innerHeight;
        this.canvasBlurred.width = window.innerWidth;
        this.canvasBlurred.height = window.innerHeight;
    }

    /**
     * Packages resource caching routines into asynchronous promises.
     * @param {string} src - Asset path string.
     * @returns {Promise<HTMLImageElement>}
     * @private
     */
    fetchIconAsset(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to safely stream layout asset buffer: ${src}`));
        });
    }

    /**
     * Compiles the custom color mask and vector rotations into a clean pattern cache.
     * @private
     */
    generateGridPatternTexture() {
        if (!this.iconImage) return;

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = this.options.cellGridSize;
        offscreenCanvas.height = this.options.cellGridSize;
        const oCtx = offscreenCanvas.getContext('2d');

        if (!oCtx) return;

        const nativeWidth = this.iconImage.naturalWidth || this.iconImage.width;
        const nativeHeight = this.iconImage.naturalHeight || this.iconImage.height;
        const aspectRatio = nativeWidth / nativeHeight;

        let targetWidth = this.options.iconScaleSize;
        let targetHeight = this.options.iconScaleSize;

        if (nativeWidth > nativeHeight) {
            targetHeight = this.options.iconScaleSize / aspectRatio;
        } else {
            targetWidth = this.options.iconScaleSize * aspectRatio;
        }

        const stencilCanvas = document.createElement('canvas');
        stencilCanvas.width = targetWidth;
        stencilCanvas.height = targetHeight;
        const sCtx = stencilCanvas.getContext('2d');

        if (sCtx) {
            sCtx.drawImage(this.iconImage, 0, 0, targetWidth, targetHeight);
            sCtx.globalCompositeOperation = 'source-in';
            sCtx.fillStyle = this.options.highlightColor;
            sCtx.fillRect(0, 0, targetWidth, targetHeight);
        }

        const centerX = this.options.cellGridSize / 2;
        const centerY = this.options.cellGridSize / 2;

        oCtx.save();
        oCtx.translate(centerX, centerY);
        
        const radians = (this.options.rotationDegrees * Math.PI) / 180;
        oCtx.rotate(radians);

        const renderOffsetX = -(targetWidth / 2);
        const renderOffsetY = -(targetHeight / 2);
        
        oCtx.drawImage(stencilCanvas, renderOffsetX, renderOffsetY, targetWidth, targetHeight);
        oCtx.restore();

        this.gridPattern = this.ctxSharp.createPattern(offscreenCanvas, 'repeat');
    }

    /**
     * Composites the ambient background vignette layer directly over the base sharp canvas layer.
     * @param {CanvasRenderingContext2D} ctx - Target canvas rendering layer context.
     * @private
     */
    drawBackgroundVignette(ctx) {
        const viewCenterX = this.canvasSharp.width / 2;
        const viewCenterY = this.canvasSharp.height / 2;
        const maxRadius = Math.max(this.canvasSharp.width, this.canvasSharp.height) * this.options.maxRadiusMultiplier;

        const lightingGradient = ctx.createRadialGradient(
            viewCenterX, viewCenterY, 0,
            viewCenterX, viewCenterY, maxRadius
        );

        this.options.vignetteColorStops.forEach(stop => {
            lightingGradient.addColorStop(stop.offset, stop.color);
        });

        ctx.save();
        ctx.fillStyle = lightingGradient;
        ctx.fillRect(0, 0, this.canvasSharp.width, this.canvasSharp.height);
        ctx.restore();
    }

    /**
     * High-performance synchronized render pipeline execution loop.
     * @private
     */
    animationPipelineLoop() {
        // Clear frame buffers for both graphics layers
        this.ctxSharp.clearRect(0, 0, this.canvasSharp.width, this.canvasSharp.height);
        this.ctxBlurred.clearRect(0, 0, this.canvasBlurred.width, this.canvasBlurred.height);

        if (this.gridPattern) {
            // Step continuous arithmetic displacements
            this.offsetX += this.options.speedX;
            this.offsetY += this.options.speedY;
            this.offsetX %= this.options.cellGridSize;
            this.offsetY %= this.options.cellGridSize;

            const matrix = new DOMMatrix();
            matrix.translateSelf(this.offsetX, this.offsetY);
            this.gridPattern.setTransform(matrix);

            // 1. Paint the sharp base background canvas layer
            this.ctxSharp.save();
            this.ctxSharp.globalAlpha = this.options.globalOpacity;
            this.ctxSharp.fillStyle = this.gridPattern;
            this.ctxSharp.fillRect(0, 0, this.canvasSharp.width, this.canvasSharp.height);
            this.ctxSharp.restore();
            
            // 2. Overlay ambient gradient directly onto the base sharp layer
            this.drawBackgroundVignette(this.ctxSharp);

            // 3. Paint the identical pattern vector matrix onto the blurred mirror layer
            // CSS handles the sub-pixel interpolation blur transitions seamlessly on its own layer thread
            this.ctxBlurred.save();
            this.ctxBlurred.globalAlpha = this.options.globalOpacity;
            this.ctxBlurred.fillStyle = this.gridPattern;
            this.ctxBlurred.fillRect(0, 0, this.canvasBlurred.width, this.canvasBlurred.height);
            this.ctxBlurred.restore();
        }

        this.animationFrameId = requestAnimationFrame(() => this.animationPipelineLoop());
    }

    /**
     * Clean down cycle hook dismantling active event listeners and animation frames.
     * @public
     */
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('resize', this.resizeHandler);
    }
}

// Global invocation hook constructor trigger
window.addEventListener('DOMContentLoaded', () => {
    new HardwareGridEngine('canvas-sharp', 'canvas-blurred');
});