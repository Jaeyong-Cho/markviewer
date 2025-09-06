/**
 * Workspace scanner service for intelligent directory discovery
 * Analyzes directories to find and recommend markdown workspaces
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class WorkspaceScanner {
    constructor() {
        this.scanCache = new Map();
        this.currentScans = new Map();
        this.defaultConfig = {
            maxDepth: 4,
            maxConcurrent: 5,
            minMarkdownFiles: 3,
            excludePatterns: [
                '.git', '.svn', '.hg',
                'node_modules', '.npm',
                '.vscode', '.idea',
                'target', 'build', 'dist',
                '.cache', 'tmp', 'temp',
                'Trash', '.Trash-*'
            ],
            scanTimeout: 30000 // 30 seconds
        };
    }

    /**
     * Start a new workspace scan
     * @param {Object} options - Scan configuration
     * @returns {Promise<string>} Scan ID for tracking progress
     */
    async startScan(options = {}) {
        const scanId = this.generateScanId();
        const config = { ...this.defaultConfig, ...options };
        
        // Determine scan paths
        const scanPaths = config.scanPaths || this.getDefaultScanPaths();
        
        console.log(`Starting workspace scan ${scanId} for paths:`, scanPaths);
        
        // Initialize scan state
        const scanState = {
            id: scanId,
            status: 'scanning',
            startTime: Date.now(),
            config,
            progress: {
                scannedDirectories: 0,
                totalDirectories: 0,
                currentDirectory: '',
                foundWorkspaces: 0
            },
            recommendations: [],
            error: null
        };
        
        this.currentScans.set(scanId, scanState);
        
        // Start scanning asynchronously
        this.performScan(scanState, scanPaths).catch(error => {
            console.error(`Scan ${scanId} failed:`, error);
            scanState.status = 'error';
            scanState.error = error.message;
        });
        
        return scanId;
    }

    /**
     * Get scan progress and results
     * @param {string} scanId - Scan identifier
     * @returns {Object} Scan status and progress
     */
    getScanProgress(scanId) {
        const scanState = this.currentScans.get(scanId);
        if (!scanState) {
            return { error: 'Scan not found' };
        }
        
        return {
            id: scanId,
            status: scanState.status,
            progress: scanState.progress,
            recommendations: scanState.recommendations,
            error: scanState.error,
            duration: Date.now() - scanState.startTime
        };
    }

    /**
     * Get cached recommendations without scanning
     * @returns {Array} Previously found workspace recommendations
     */
    getCachedRecommendations() {
        const cached = [];
        const now = Date.now();
        const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [path, result] of this.scanCache) {
            if (now - result.timestamp < cacheExpiry && result.recommendations) {
                cached.push(...result.recommendations);
            }
        }
        
        // Sort by score and return top 10
        return cached
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    /**
     * Perform the actual directory scanning
     * @param {Object} scanState - Current scan state
     * @param {Array} scanPaths - Paths to scan
     */
    async performScan(scanState, scanPaths) {
        const { config } = scanState;
        const allDirectories = [];
        
        try {
            // First pass: discover all directories
            for (const basePath of scanPaths) {
                if (scanState.status === 'cancelled') return;
                
                await this.discoverDirectories(basePath, allDirectories, config, scanState);
            }
            
            scanState.progress.totalDirectories = allDirectories.length;
            console.log(`Found ${allDirectories.length} directories to analyze`);
            
            // Second pass: analyze directories for markdown content
            const workspaces = [];
            const semaphore = new Semaphore(config.maxConcurrent);
            
            const analysisPromises = allDirectories.map(async (dirPath) => {
                return semaphore.acquire(async () => {
                    if (scanState.status === 'cancelled') return null;
                    
                    scanState.progress.currentDirectory = dirPath;
                    scanState.progress.scannedDirectories++;
                    
                    const analysis = await this.analyzeWorkspaceDirectory(dirPath, config);
                    if (analysis && analysis.score > 0.1) {
                        workspaces.push(analysis);
                        scanState.progress.foundWorkspaces++;
                    }
                    
                    return analysis;
                });
            });
            
            await Promise.all(analysisPromises);
            
            // Sort and prepare recommendations
            const recommendations = workspaces
                .filter(w => w.markdownCount >= config.minMarkdownFiles)
                .sort((a, b) => b.score - a.score)
                .slice(0, 20); // Top 20 recommendations
            
            scanState.recommendations = recommendations;
            scanState.status = 'completed';
            scanState.progress.currentDirectory = '';
            
            // Cache results
            this.cacheResults(scanPaths, recommendations);
            
            console.log(`Scan ${scanState.id} completed: ${recommendations.length} recommendations found`);
            
        } catch (error) {
            console.error(`Scan ${scanState.id} error:`, error);
            scanState.status = 'error';
            scanState.error = error.message;
        }
    }

    /**
     * Recursively discover directories to analyze
     * @param {string} dirPath - Directory path to explore
     * @param {Array} allDirectories - Accumulator for found directories
     * @param {Object} config - Scan configuration
     * @param {Object} scanState - Current scan state
     * @param {number} depth - Current recursion depth
     */
    async discoverDirectories(dirPath, allDirectories, config, scanState, depth = 0) {
        if (depth >= config.maxDepth || scanState.status === 'cancelled') {
            return;
        }
        
        try {
            // Check if directory should be excluded
            const dirName = path.basename(dirPath);
            if (this.shouldExcludeDirectory(dirName, config.excludePatterns)) {
                return;
            }
            
            const stats = await fs.stat(dirPath);
            if (!stats.isDirectory()) return;
            
            // Add this directory to analysis list
            allDirectories.push(dirPath);
            
            // Explore subdirectories
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const subDirPath = path.join(dirPath, entry.name);
                    await this.discoverDirectories(subDirPath, allDirectories, config, scanState, depth + 1);
                }
            }
            
        } catch (error) {
            // Silently skip directories we can't access
            if (error.code !== 'EACCES' && error.code !== 'EPERM') {
                console.warn(`Error accessing directory ${dirPath}:`, error.message);
            }
        }
    }

    /**
     * Analyze a directory to determine if it's a good workspace
     * @param {string} dirPath - Directory to analyze
     * @param {Object} config - Scan configuration
     * @returns {Object|null} Workspace analysis or null if not suitable
     */
    async analyzeWorkspaceDirectory(dirPath) {
        try {
            const analysis = {
                path: dirPath,
                name: path.basename(dirPath),
                markdownCount: 0,
                totalFiles: 0,
                subdirectories: [],
                hasReadme: false,
                hasDocs: false,
                hasGuides: false,
                lastModified: new Date(0),
                score: 0,
                preview: {
                    structure: [],
                    sampleFiles: []
                }
            };
            
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);
                
                if (entry.isFile()) {
                    analysis.totalFiles++;
                    
                    if (this.isMarkdownFile(entry.name)) {
                        analysis.markdownCount++;
                        analysis.preview.sampleFiles.push(entry.name);
                        
                        // Check for special files
                        const lowerName = entry.name.toLowerCase();
                        if (lowerName.includes('readme')) {
                            analysis.hasReadme = true;
                        }
                        
                        // Get file modification time
                        try {
                            const stats = await fs.stat(entryPath);
                            if (stats.mtime > analysis.lastModified) {
                                analysis.lastModified = stats.mtime;
                            }
                        } catch (error) {
                            // Ignore stat errors
                        }
                    }
                } else if (entry.isDirectory()) {
                    if (!this.shouldExcludeDirectory(entry.name, [])) {
                        analysis.subdirectories.push(entry.name);
                        analysis.preview.structure.push(entry.name + '/');
                        
                        // Check for documentation directories
                        const lowerName = entry.name.toLowerCase();
                        if (lowerName.includes('doc')) {
                            analysis.hasDocs = true;
                        }
                        if (lowerName.includes('guide') || lowerName.includes('tutorial')) {
                            analysis.hasGuides = true;
                        }
                    }
                }
            }
            
            // Limit preview arrays
            analysis.preview.sampleFiles = analysis.preview.sampleFiles.slice(0, 5);
            analysis.preview.structure = analysis.preview.structure.slice(0, 8);
            
            // Calculate recommendation score
            analysis.score = this.calculateRecommendationScore(analysis);
            
            return analysis.markdownCount > 0 ? analysis : null;
            
        } catch (error) {
            // Silently skip directories we can't analyze
            return null;
        }
    }

    /**
     * Calculate recommendation score for a workspace
     * @param {Object} analysis - Directory analysis results
     * @returns {number} Score between 0 and 1
     */
    calculateRecommendationScore(analysis) {
        let score = 0;
        
        // File count factor (40% weight)
        const fileCountScore = Math.min(analysis.markdownCount / 20, 1);
        score += fileCountScore * 0.4;
        
        // Structure quality factor (25% weight)
        const hasGoodStructure = analysis.subdirectories.length > 0 && analysis.subdirectories.length < 20;
        score += hasGoodStructure ? 0.25 : 0;
        
        // Documentation patterns factor (20% weight)
        const docScore = (
            (analysis.hasReadme ? 1 : 0) +
            (analysis.hasDocs ? 1 : 0) +
            (analysis.hasGuides ? 1 : 0)
        ) / 3;
        score += docScore * 0.2;
        
        // Recent activity factor (15% weight)
        const daysSinceModified = (Date.now() - analysis.lastModified.getTime()) / (1000 * 60 * 60 * 24);
        const recentScore = daysSinceModified < 30 ? (30 - daysSinceModified) / 30 : 0;
        score += recentScore * 0.15;
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Check if a file is a markdown file
     * @param {string} filename - File name to check
     * @returns {boolean} True if it's a markdown file
     */
    isMarkdownFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn', '.mdtxt', '.mdtext'].includes(ext);
    }

    /**
     * Check if a directory should be excluded from scanning
     * @param {string} dirName - Directory name
     * @param {Array} excludePatterns - Patterns to exclude
     * @returns {boolean} True if directory should be excluded
     */
    shouldExcludeDirectory(dirName, excludePatterns = []) {
        const lowerName = dirName.toLowerCase();
        
        // System directories
        if (lowerName.startsWith('.') && lowerName !== '.github') {
            return true;
        }
        
        // Common exclude patterns
        const allPatterns = [...this.defaultConfig.excludePatterns, ...excludePatterns];
        return allPatterns.some(pattern => 
            lowerName.includes(pattern.toLowerCase())
        );
    }

    /**
     * Get default paths to scan for workspaces
     * @returns {Array} Array of paths to scan
     */
    getDefaultScanPaths() {
        const homedir = os.homedir();
        const paths = [homedir];
        
        // Add common document directories
        const commonDirs = [
            'Documents', 'Desktop', 'Downloads', 'Projects', 'Workspace', 'Development', 'dev'
        ];
        
        for (const dir of commonDirs) {
            const fullPath = path.join(homedir, dir);
            paths.push(fullPath);
        }
        
        return paths.filter(async (p) => {
            try {
                const stats = await fs.stat(p);
                return stats.isDirectory();
            } catch {
                return false;
            }
        });
    }

    /**
     * Generate unique scan ID
     * @returns {string} Unique identifier
     */
    generateScanId() {
        return 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Cache scan results
     * @param {Array} scanPaths - Paths that were scanned
     * @param {Array} recommendations - Found recommendations
     */
    cacheResults(scanPaths, recommendations) {
        const cacheKey = scanPaths.join(':');
        this.scanCache.set(cacheKey, {
            timestamp: Date.now(),
            recommendations: recommendations.map(r => ({ ...r })) // Deep copy
        });
        
        // Limit cache size
        if (this.scanCache.size > 10) {
            const oldestKey = this.scanCache.keys().next().value;
            this.scanCache.delete(oldestKey);
        }
    }

    /**
     * Cancel an ongoing scan
     * @param {string} scanId - Scan to cancel
     */
    cancelScan(scanId) {
        const scanState = this.currentScans.get(scanId);
        if (scanState) {
            scanState.status = 'cancelled';
            console.log(`Scan ${scanId} cancelled`);
        }
    }

    /**
     * Clean up completed scans
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        for (const [scanId, scanState] of this.currentScans) {
            if (now - scanState.startTime > maxAge) {
                this.currentScans.delete(scanId);
            }
        }
    }
}

/**
 * Simple semaphore for limiting concurrent operations
 */
class Semaphore {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.currentCount = 0;
        this.queue = [];
    }

    async acquire(callback) {
        return new Promise((resolve, reject) => {
            this.queue.push({ callback, resolve, reject });
            this.process();
        });
    }

    process() {
        if (this.currentCount < this.maxConcurrent && this.queue.length > 0) {
            this.currentCount++;
            const { callback, resolve, reject } = this.queue.shift();
            
            Promise.resolve(callback())
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this.currentCount--;
                    this.process();
                });
        }
    }
}

module.exports = WorkspaceScanner;
