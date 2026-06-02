/**
 * @fileoverview Interactive dual-canvas background animation engine.
 * Tracks user cursor inputs to drive CSS hardware mask translations in real time.
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

class InteractiveGridEngine {
    /**
     * @param {string} sharpCanvasId - DOM ID of the base sharp canvas layer.
     * @param {string} blurredCanvasId - DOM ID of the mirror blurred canvas layer.
     * @param {string} wrapperId - DOM ID of the outer container box updating styles.
     * @param {Partial<EngineOptions>} [customOptions={}] - Explicit configuration modifications.
     */
    constructor(sharpCanvasId, blurredCanvasId, wrapperId, customOptions = {}) {
        /** @private @type {HTMLCanvasElement} */
        this.canvasSharp = document.getElementById(sharpCanvasId);
        /** @private @type {CanvasRenderingContext2D} */
        this.ctxSharp = this.canvasSharp.getContext('2d');

        /** @private @type {HTMLCanvasElement} */
        this.canvasBlurred = document.getElementById(blurredCanvasId);
        /** @private @type {CanvasRenderingContext2D} */
        this.ctxBlurred = this.canvasBlurred.getContext('2d');

        /** @private @type {HTMLElement} */
        this.wrapper = document.getElementById(wrapperId);
        
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
            maxRadiusMultiplier: 0.4,
            vignetteColorStops: [
                { offset: 0.0, color: 'rgba(11, 15, 25, 0.0)' },   // Dynamic core gradient pocket
                { offset: 0.7, color: 'rgba(11, 15, 25, 0.4)' },   // Smooth falloff region
                { offset: 0.9, color: 'rgba(11, 15, 25, 0.75)' }    // Deep backdrop perimeter mask
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
     * Bootstraps core subsystems, asset downloading pipelines, and binds event loops.
     * @private
     * @async
     */
    async init() {
        this.syncViewportResolution();
        
        this.resizeHandler = () => this.syncViewportResolution();
        window.addEventListener('resize', this.resizeHandler);

        // Bind and activate mouse tracking listener
        this.mouseHandler = (event) => this.trackCursorMove(event);
        window.addEventListener('mousemove', this.mouseHandler, { passive: true });

        try {
            this.iconImage = await this.fetchIconAsset(this.options.singleIconSrc);
            this.generateGridPatternTexture();
            this.animationPipelineLoop();
        } catch (error) {
            console.error("Critical architecture compilation fault within InteractiveGridEngine:", error);
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
     * Intercepts cursor vector metrics and pushes updates directly into CSS Custom Properties.
     * @param {MouseEvent} event - Native mousemove browser vector payload.
     * @private
     */
    trackCursorMove(event) {
        // Calculate raw percentage values across the horizontal and vertical screen space
        const pctX = ((event.clientX / window.innerWidth) * 100).toFixed(2);
        const pctY = ((event.clientY / window.innerHeight) * 100).toFixed(2);

        // Directly modify CSS custom variables to trigger smooth hardware-accelerated transitions
        this.wrapper.style.setProperty('--mouse-x', `${pctX}%`);
        this.wrapper.style.setProperty('--mouse-y', `${pctY}%`);
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
     * Composites a static, centered ambient light backdrop to give deep contrast to the canvas plane.
     * @param {CanvasRenderingContext2D} ctx - Target canvas rendering layer context.
     * @private
     */
    drawAmbientVignette(ctx) {
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
     * Synchronized high-performance frame animation loop loop step.
     * @private
     */
    animationPipelineLoop() {
        this.ctxSharp.clearRect(0, 0, this.canvasSharp.width, this.canvasSharp.height);
        this.ctxBlurred.clearRect(0, 0, this.canvasBlurred.width, this.canvasBlurred.height);

        if (this.gridPattern) {
            this.offsetX += this.options.speedX;
            this.offsetY += this.options.speedY;
            this.offsetX %= this.options.cellGridSize;
            this.offsetY %= this.options.cellGridSize;

            const matrix = new DOMMatrix();
            matrix.translateSelf(this.offsetX, this.offsetY);
            this.gridPattern.setTransform(matrix);

            // 1. Render base sharp background canvas
            this.ctxSharp.save();
            this.ctxSharp.globalAlpha = this.options.globalOpacity;
            this.ctxSharp.fillStyle = this.gridPattern;
            this.ctxSharp.fillRect(0, 0, this.canvasSharp.width, this.canvasSharp.height);
            this.ctxSharp.restore();
            
            // 2. Render static ambient contrast vignette layer over the sharp elements
            this.drawAmbientVignette(this.ctxSharp);

            // 3. Render identical pattern coordinates to mirror blurred canvas layer
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
        window.removeEventListener('mousemove', this.mouseHandler);
    }
}

// Global invocation initialization trigger
window.addEventListener('DOMContentLoaded', () => {
    new InteractiveGridEngine('canvas-sharp', 'canvas-blurred', 'bg-box');
});