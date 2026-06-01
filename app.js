/**
 * @fileoverview High-performance infinite pattern background engine.
 * Renders a single rotated icon cell, translates the pattern matrix to simulate global movement,
 * and composites a centered focal radial lighting spotlight.
 */

/**
 * Structural configurations for the infinite uniform grid layout.
 * @typedef {Object} GridConfig
 * @property {string} singleIconSrc - The single icon resource path to enforce consistency.
 * @property {number} cellGridSize - The bounding box size (width & height) of a single grid block.
 * @property {number} iconScaleSize - Output size constraint for the centered icon inside the cell.
 * @property {number} speedX - Horizontal directional pixel displacement per frame tick.
 * @property {number} speedY - Vertical directional pixel displacement per frame tick.
 * @property {number} globalOpacity - Alpha transparency mix layer configuration for the pattern.
 * @property {number} rotationDegrees - Explicit programmatic angle rotation applied to the asset.
 */
const CONFIG = {
    singleIconSrc: 'logo.svg',
    cellGridSize: 150,     // Determines the explicit distance spacing boundary between elements
    iconScaleSize: 109,    // Spatial size footprint of the asset inside its grid cell
    speedX: 0.15,           // Constant horizontal velocity vector
    speedY: 0.15,           // Constant vertical velocity vector
    globalOpacity: 0.4,    // Density alpha value for pattern layout visibility
    rotationDegrees: -45,  // Programmatic icon rotation parameter
    highlightColor: '#6887d6b4', // Customizable highlight color
    maxRadiusMultiplier: 0.45, // Multiplier for calculating the maximum radius of the radial gradient based on viewport dimensions
    gradientColorStops: [ // Optional array for defining custom gradient color stops, can be used to override default stops in drawCenterSpotlightOverlay
        { offset: 0.0, color: 'rgba(255, 255, 255, 0.12)' }, // Center ambient light accent
        { offset: 0.8, color: 'rgba(15, 23, 42, 0.2)' },     // Mid-tone falloff transition
        { offset: 1.0, color: 'rgba(11, 15, 25, 1.0)' }     // Edge boundary mask blending into background color
    ]

};

/**
 * Orchestrates the creation of the offscreen texture block, shifts the global pattern matrix,
 * and maps a static center radial lighting layer.
 */
class InfiniteGridEngine {
    /**
     * @param {string} canvasId - DOM query identifier token.
     */
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Trackers for the global translation offsets of the pattern
        this.offsetX = 0;
        this.offsetY = 0;

        /** @type {CanvasPattern|null} */
        this.gridPattern = null;
        /** @type {HTMLImageElement|null} */
        this.iconImage = null;

        this.init();
    }

    /**
     * Initializes engine dependencies and assets asynchronously.
     * @async
     */
    async init() {
        this.syncViewportResolution();
        window.addEventListener('resize', () => this.syncViewportResolution());

        try {
            this.iconImage = await this.fetchIconAsset(CONFIG.singleIconSrc);
            this.generateGridPatternTexture();
            this.animationPipelineLoop();
        } catch (error) {
            console.error("Failed to build the uniform grid pipeline architecture:", error);
        }
    }

    /**
     * Updates main display resolution parameters without breaking structural states.
     */
    syncViewportResolution() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * Resolves raw image elements inside asynchronous structural promises.
     * @param {string} src - Path string to target asset.
     * @returns {Promise<HTMLImageElement>}
     */
    fetchIconAsset(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Could not stream layout asset context: ${src}`));
        });
    }

/**
     * Generates a virtual offscreen canvas texture block, scales the asset safely while 
     * maintaining its native aspect ratio, rotates it, colors it, and compiles the pattern.
     */
    generateGridPatternTexture() {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = CONFIG.cellGridSize;
        offscreenCanvas.height = CONFIG.cellGridSize;
        const oCtx = offscreenCanvas.getContext('2d');

        if (!oCtx || !this.iconImage) return;

        // 1. Calculate the natural aspect ratio of your image asset
        const nativeWidth = this.iconImage.naturalWidth || this.iconImage.width;
        const nativeHeight = this.iconImage.naturalHeight || this.iconImage.height;
        const aspectRatio = nativeWidth / nativeHeight;

        // 2. Determine proportional dimensions based on the max constraint size
        let targetWidth = CONFIG.iconScaleSize;
        let targetHeight = CONFIG.iconScaleSize;

        if (nativeWidth > nativeHeight) {
            // Image is wider than it is tall
            targetHeight = CONFIG.iconScaleSize / aspectRatio;
        } else {
            // Image is taller than it is wide, or perfectly square
            targetWidth = CONFIG.iconScaleSize * aspectRatio;
        }

        // 3. Create the temporary coloring canvas using the corrected dimensions
        const stencilCanvas = document.createElement('canvas');
        stencilCanvas.width = targetWidth;
        stencilCanvas.height = targetHeight;
        const sCtx = stencilCanvas.getContext('2d');

        if (sCtx) {
            sCtx.drawImage(this.iconImage, 0, 0, targetWidth, targetHeight);
            sCtx.globalCompositeOperation = 'source-in';
            sCtx.fillStyle = CONFIG.highlightColor; // Uses your clean blue-green highlight color fill
            sCtx.fillRect(0, 0, targetWidth, targetHeight);
        }

        // 4. Anchor matrices at the absolute center of the layout cell block
        const centerX = CONFIG.cellGridSize / 2;
        const centerY = CONFIG.cellGridSize / 2;

        oCtx.save();
        oCtx.translate(centerX, centerY);
        
        const radians = (CONFIG.rotationDegrees * Math.PI) / 180;
        oCtx.rotate(radians);

        // 5. Render the corrected stencil using its dedicated proportional offsets
        const renderOffsetX = -(targetWidth / 2);
        const renderOffsetY = -(targetHeight / 2);
        
        oCtx.drawImage(
            stencilCanvas, 
            renderOffsetX, 
            renderOffsetY, 
            targetWidth, 
            targetHeight
        );

        oCtx.restore();

        this.gridPattern = this.ctx.createPattern(offscreenCanvas, 'repeat');
    }

    /**
     * Appends a static radial lighting hotspot over the pattern array to accentuate the screen center.
     */
    drawCenterSpotlightOverlay() {
        const viewCenterX = this.canvas.width / 2;
        const viewCenterY = this.canvas.height / 2;
        
        // Dynamic boundary radius calculations tied to responsive dimensions
        const maxRadius = Math.max(this.canvas.width, this.canvas.height) * CONFIG.maxRadiusMultiplier;

        // Initialize standard canvas 2D radial gradient construct layout
        const lightingGradient = this.ctx.createRadialGradient(
            viewCenterX, viewCenterY, 0,           // Inner focal origin point
            viewCenterX, viewCenterY, maxRadius   // Outer perimeter fallback point
        );


        // Populate the gradient color stops using the defined configuration array for flexible control
        CONFIG.gradientColorStops.forEach(stop => {
            lightingGradient.addColorStop(stop.offset, stop.color);
        });


        this.ctx.save();
        // Destination-Over ensures the ambient overlay lives underneath the moving elements if transparency is needed,
        // but Source-Over creates a natural fog-like vignette over the running icons.
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.fillStyle = lightingGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }

    /**
     * Continuous frame graphics rendering execution loop.
     */
    animationPipelineLoop() {
        // 1. Clear frame buffer fully
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.gridPattern) {
            // 2. Increment translation metrics continuously to drive directional movement
            this.offsetX += CONFIG.speedX;
            this.offsetY += CONFIG.speedY;

            // 3. Keep coordinates bounded within the pattern texture size bounds to prevent integer overflows
            this.offsetX %= CONFIG.cellGridSize;
            this.offsetY %= CONFIG.cellGridSize;

            this.ctx.save();
            this.ctx.globalAlpha = CONFIG.globalOpacity;

            // 4. Create a 2D Transformation Matrix to shift the pattern coordinates globally
            const matrix = new DOMMatrix();
            matrix.translateSelf(this.offsetX, this.offsetY);
            this.gridPattern.setTransform(matrix);

            // 5. Fill the entire canvas viewport using only the shifted infinite pattern matrix
            this.ctx.fillStyle = this.gridPattern;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.restore();
            
            // 6. Draw the focal highlight directly onto the canvas view plane
            this.drawCenterSpotlightOverlay();
        }

        requestAnimationFrame(() => this.animationPipelineLoop());
    }
}

// Global invocation hook listener
window.addEventListener('DOMContentLoaded', () => {
    new InfiniteGridEngine('background-canvas');
});