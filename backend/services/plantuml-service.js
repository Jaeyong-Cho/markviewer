const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

/**
 * PlantUML service for rendering diagrams to SVG
 * Uses local plantuml.jar for offline operation
 */
class PlantUMLService {
    constructor() {
        this.plantUMLPath = path.join(__dirname, '..', '..', 'tools', 'plantuml.jar');
        this.cacheDir = path.join(os.tmpdir(), 'markviewer-plantuml-cache');
        this.ensureCacheDir();
    }

    /**
     * Ensure cache directory exists
     */
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * Check if PlantUML jar file exists
     * @returns {boolean} True if PlantUML is available
     */
    isPlantUMLAvailable() {
        return fs.existsSync(this.plantUMLPath);
    }

    /**
     * Generate cache key for PlantUML source
     * @param {string} source - PlantUML source code
     * @returns {string} MD5 hash of the source
     */
    generateCacheKey(source) {
        return crypto.createHash('md5').update(source.trim()).digest('hex');
    }

    /**
     * Get cached SVG if available
     * @param {string} cacheKey - Cache key for the diagram
     * @returns {string|null} Cached SVG content or null
     */
    getCachedSVG(cacheKey) {
        const cacheFile = path.join(this.cacheDir, `${cacheKey}.svg`);
        if (fs.existsSync(cacheFile)) {
            try {
                return fs.readFileSync(cacheFile, 'utf-8');
            } catch (error) {
                console.warn(`Failed to read cache file ${cacheFile}: ${error.message}`);
            }
        }
        return null;
    }

    /**
     * Save SVG to cache
     * @param {string} cacheKey - Cache key for the diagram
     * @param {string} svg - SVG content to cache
     */
    saveCachedSVG(cacheKey, svg) {
        const cacheFile = path.join(this.cacheDir, `${cacheKey}.svg`);
        try {
            fs.writeFileSync(cacheFile, svg, 'utf-8');
        } catch (error) {
            console.warn(`Failed to save cache file ${cacheFile}: ${error.message}`);
        }
    }

    /**
     * Validate PlantUML source code
     * @param {string} source - PlantUML source to validate
     * @throws {Error} If source is invalid
     */
    validateSource(source) {
        if (!source || typeof source !== 'string') {
            throw new Error('PlantUML source must be a non-empty string');
        }

        const trimmedSource = source.trim();
        if (trimmedSource.length === 0) {
            throw new Error('PlantUML source cannot be empty');
        }

        // Check for basic PlantUML structure
        if (!trimmedSource.includes('@start') && !trimmedSource.includes('@end')) {
            // Auto-wrap if not already wrapped
            return `@startuml
${trimmedSource}
@enduml`;
        }

        return trimmedSource;
    }

    /**
     * Execute PlantUML jar to generate SVG
     * @param {string} source - PlantUML source code
     * @returns {Promise<string>} Generated SVG content
     */
    async executePlantUML(source) {
        return new Promise((resolve, reject) => {
            if (!this.isPlantUMLAvailable()) {
                return reject(new Error('PlantUML jar not found. Please run setup script.'));
            }

            // Use -tsvg for SVG output, -pipe for stdin/stdout
            const args = ['-jar', this.plantUMLPath, '-tsvg', '-pipe'];
            const plantuml = spawn('java', args);

            let svgOutput = '';
            let errorOutput = '';

            plantuml.stdout.on('data', (data) => {
                svgOutput += data.toString();
            });

            plantuml.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            plantuml.on('close', (code) => {
                if (code !== 0) {
                    const error = errorOutput || `PlantUML process exited with code ${code}`;
                    return reject(new Error(`PlantUML rendering failed: ${error}`));
                }

                if (!svgOutput.trim()) {
                    return reject(new Error('PlantUML generated empty output'));
                }

                // Validate that output is SVG
                if (!svgOutput.includes('<svg') || !svgOutput.includes('</svg>')) {
                    return reject(new Error('PlantUML did not generate valid SVG'));
                }

                resolve(svgOutput);
            });

            plantuml.on('error', (error) => {
                reject(new Error(`Failed to start PlantUML process: ${error.message}`));
            });

            // Send source to PlantUML via stdin
            plantuml.stdin.write(source);
            plantuml.stdin.end();

            // Set timeout to prevent hanging
            setTimeout(() => {
                plantuml.kill();
                reject(new Error('PlantUML rendering timeout'));
            }, 30000); // 30 second timeout
        });
    }

    /**
     * Render PlantUML source to SVG
     * @param {string} source - PlantUML source code
     * @returns {Promise<string>} SVG content
     */
    async renderToSVG(source) {
        try {
            // Validate and normalize source
            const validatedSource = this.validateSource(source);
            
            // Check cache first
            const cacheKey = this.generateCacheKey(validatedSource);
            const cachedSVG = this.getCachedSVG(cacheKey);
            
            if (cachedSVG) {
                console.log(`PlantUML cache hit for key: ${cacheKey}`);
                return cachedSVG;
            }

            // Generate SVG using PlantUML
            console.log(`Rendering PlantUML diagram (cache miss): ${cacheKey}`);
            const svg = await this.executePlantUML(validatedSource);
            
            // Cache the result
            this.saveCachedSVG(cacheKey, svg);
            
            return svg;
        } catch (error) {
            console.error('PlantUML rendering error:', error.message);
            throw error;
        }
    }

    /**
     * Clear the PlantUML cache
     * @returns {Promise<void>}
     */
    async clearCache() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.svg')) {
                    fs.unlinkSync(path.join(this.cacheDir, file));
                }
            }
            console.log('PlantUML cache cleared');
        } catch (error) {
            console.error('Failed to clear PlantUML cache:', error.message);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            const svgFiles = files.filter(file => file.endsWith('.svg'));
            
            let totalSize = 0;
            for (const file of svgFiles) {
                const stats = fs.statSync(path.join(this.cacheDir, file));
                totalSize += stats.size;
            }

            return {
                fileCount: svgFiles.length,
                totalSize: totalSize,
                cacheDir: this.cacheDir
            };
        } catch (error) {
            return {
                fileCount: 0,
                totalSize: 0,
                cacheDir: this.cacheDir,
                error: error.message
            };
        }
    }
}

module.exports = new PlantUMLService();
