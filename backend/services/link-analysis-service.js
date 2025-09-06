const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');

/**
 * Link Analysis Service for MarkViewer
 * Analyzes markdown files to extract internal link relationships and build graph data
 */
class LinkAnalysisService {
    constructor() {
        this.linkGraph = {
            nodes: new Map(), // file path -> node data
            edges: new Map(), // source-target -> edge data
            orphans: new Set() // files with no incoming or outgoing links
        };
        this.excludedDirs = ['.git', 'node_modules', '.vscode', '.idea', '__pycache__'];
        this.markdownExtensions = ['.md', '.markdown', '.txt'];
    }

    /**
     * Analyze all markdown files in a directory to build link relationship graph
     * @param {string} rootPath - Root directory path to analyze
     * @returns {Promise<Object>} Graph data with nodes and edges
     */
    async analyzeDirectory(rootPath) {
        try {
            // Reset graph data
            this.linkGraph.nodes.clear();
            this.linkGraph.edges.clear();
            this.linkGraph.orphans.clear();

            // Get all markdown files
            const markdownFiles = await this.getAllMarkdownFiles(rootPath);
            
            // Process each file to extract links and tags
            for (const filePath of markdownFiles) {
                await this.analyzeFile(filePath, rootPath);
            }

            // Create tag-based connections after all files are processed
            this.createTagBasedConnections();

            // Identify orphaned files
            this.identifyOrphans();

            // Convert to serializable format
            return this.getGraphData();
        } catch (error) {
            console.error('Error analyzing directory:', error);
            throw error;
        }
    }

    /**
     * Analyze a single markdown file to extract internal links and tags
     * @param {string} filePath - Path to the markdown file
     * @param {string} rootPath - Root directory path for resolving relative links
     */
    async analyzeFile(filePath, rootPath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const fileKey = this.getFileKey(filePath, rootPath);
            
            // Extract frontmatter and content
            const { frontmatter, content: markdownContent } = this.extractFrontmatter(content);
            
            // Add node for this file with tag information
            this.addNode(fileKey, filePath, rootPath, frontmatter);

            // Extract links from markdown content
            const links = this.extractLinksFromMarkdown(markdownContent, filePath, rootPath);
            
            // Add edges for each valid link (only if target file exists and is already a node)
            for (const targetPath of links) {
                const targetKey = this.getFileKey(targetPath, rootPath);
                
                // Only add edge if target node exists (target file was found in markdown files)
                if (this.linkGraph.nodes.has(targetKey)) {
                    this.addEdge(fileKey, targetKey, filePath, targetPath, 'link');
                } else {
                    console.warn(`Target file not found in markdown collection: ${targetKey}`);
                }
            }

        } catch (error) {
            console.error(`Error analyzing file ${filePath}:`, error);
            // Continue processing other files even if one fails
        }
    }

    /**
     * Extract internal markdown links from content
     * @param {string} content - Markdown content
     * @param {string} currentFilePath - Path of the current file
     * @param {string} rootPath - Root directory path
     * @returns {Array<string>} Array of resolved target file paths
     */
    extractLinksFromMarkdown(content, currentFilePath, rootPath) {
        const links = [];
        const currentDir = path.dirname(currentFilePath);

        // Regular expressions for different link formats
        const linkPatterns = [
            // Standard markdown links: [text](path)
            /\[([^\]]+)\]\(([^)]+)\)/g,
            // Obsidian-style wiki links: [[path]] or [[path|text]]
            /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
        ];

        for (const pattern of linkPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                let linkPath = match[2] || match[1]; // For wiki links, capture group 1

                // Skip external links
                if (this.isExternalLink(linkPath)) {
                    continue;
                }

                // Skip anchor links
                if (linkPath.startsWith('#')) {
                    continue;
                }

                // Remove anchor from path if present
                linkPath = linkPath.split('#')[0];

                // Skip empty paths
                if (!linkPath.trim()) {
                    continue;
                }

                // Resolve relative path
                const resolvedPath = this.resolveLinkPath(linkPath, currentDir, rootPath);
                
                if (resolvedPath && this.isMarkdownFile(resolvedPath)) {
                    links.push(resolvedPath);
                }
            }
        }

        return [...new Set(links)]; // Remove duplicates
    }

    /**
     * Extract YAML frontmatter from markdown content
     * @param {string} content - Full markdown content
     * @returns {Object} Object with frontmatter and content properties
     */
    extractFrontmatter(content) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            return {
                frontmatter: {},
                content: content
            };
        }

        try {
            const frontmatter = yaml.load(match[1]) || {};
            const contentWithoutFrontmatter = content.slice(match[0].length);
            
            return {
                frontmatter: frontmatter,
                content: contentWithoutFrontmatter
            };
        } catch (error) {
            console.warn('Error parsing YAML frontmatter:', error);
            return {
                frontmatter: {},
                content: content
            };
        }
    }

    /**
     * Check if a link is external (http, https, mailto, etc.)
     * @param {string} linkPath - Link path to check
     * @returns {boolean} True if external link
     */
    isExternalLink(linkPath) {
        return /^(https?|mailto|ftp|file):\/\//.test(linkPath);
    }

    /**
     * Resolve a link path relative to current file and root directory
     * @param {string} linkPath - Original link path
     * @param {string} currentDir - Directory of current file
     * @param {string} rootPath - Root directory path
     * @returns {string|null} Resolved absolute path or null if invalid
     */
    resolveLinkPath(linkPath, currentDir, rootPath) {
        try {
            let resolvedPath;

            if (path.isAbsolute(linkPath)) {
                // Absolute path from root
                resolvedPath = path.join(rootPath, linkPath.substring(1));
            } else {
                // Relative path from current file
                resolvedPath = path.resolve(currentDir, linkPath);
            }

            // Ensure the resolved path is within the root directory
            const relativePath = path.relative(rootPath, resolvedPath);
            if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
                return null; // Path escapes root directory
            }

            // Check if the file actually exists
            try {
                const stats = require('fs').statSync(resolvedPath);
                if (!stats.isFile()) {
                    return null; // Not a file
                }
            } catch (error) {
                console.warn(`Linked file does not exist: ${resolvedPath}`);
                return null; // File doesn't exist
            }

            return resolvedPath;
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if a file is a markdown file
     * @param {string} filePath - File path to check
     * @returns {boolean} True if markdown file
     */
    isMarkdownFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.markdownExtensions.includes(ext);
    }

    /**
     * Get all markdown files in directory recursively
     * @param {string} rootPath - Root directory path
     * @returns {Promise<Array<string>>} Array of markdown file paths
     */
    async getAllMarkdownFiles(rootPath) {
        const files = [];
        await this.collectMarkdownFiles(rootPath, files);
        return files;
    }

    /**
     * Recursively collect markdown files
     * @param {string} dirPath - Directory path to scan
     * @param {Array<string>} files - Array to collect file paths
     */
    async collectMarkdownFiles(dirPath, files) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Skip excluded directories
                    if (this.excludedDirs.includes(entry.name)) {
                        continue;
                    }
                    await this.collectMarkdownFiles(entryPath, files);
                } else if (entry.isFile() && this.isMarkdownFile(entry.name)) {
                    files.push(entryPath);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
    }

    /**
     * Add a node to the graph
     * @param {string} key - File key (relative path)
     * @param {string} filePath - Absolute file path
     * @param {string} rootPath - Root directory path
     * @param {Object} frontmatter - Parsed frontmatter object
     */
    addNode(key, filePath, rootPath, frontmatter = {}) {
        if (!this.linkGraph.nodes.has(key)) {
            const stats = this.getFileStats(filePath);
            
            // Extract and normalize tags from frontmatter
            let tags = [];
            if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
                tags = frontmatter.tags
                    .filter(tag => typeof tag === 'string')
                    .map(tag => tag.toLowerCase().trim())
                    .filter(tag => tag.length > 0);
            }
            
            this.linkGraph.nodes.set(key, {
                id: key,
                path: filePath,
                name: path.basename(filePath),
                relativePath: path.relative(rootPath, filePath),
                size: stats.size,
                modified: stats.modified,
                incomingLinks: 0,
                outgoingLinks: 0,
                tags: tags,
                tagConnections: 0
            });
        }
    }

    /**
     * Add an edge to the graph
     * @param {string} sourceKey - Source file key
     * @param {string} targetKey - Target file key
     * @param {string} sourcePath - Source file path
     * @param {string} targetPath - Target file path
     * @param {string} type - Edge type ('link' or 'tag')
     * @param {Array<string>} sharedTags - For tag edges, array of shared tags
     */
    addEdge(sourceKey, targetKey, sourcePath, targetPath, type = 'link', sharedTags = []) {
        // Only add edge if both source and target nodes exist
        if (!this.linkGraph.nodes.has(sourceKey) || !this.linkGraph.nodes.has(targetKey)) {
            console.warn(`Skipping edge ${sourceKey} -> ${targetKey}: missing node(s)`, {
                sourceExists: this.linkGraph.nodes.has(sourceKey),
                targetExists: this.linkGraph.nodes.has(targetKey)
            });
            return;
        }

        const edgeKey = `${sourceKey}->${targetKey}`;
        
        if (!this.linkGraph.edges.has(edgeKey)) {
            this.linkGraph.edges.set(edgeKey, {
                source: sourceKey,
                target: targetKey,
                sourcePath: sourcePath,
                targetPath: targetPath,
                type: type,
                sharedTags: sharedTags
            });

            // Update link counts
            const sourceNode = this.linkGraph.nodes.get(sourceKey);
            const targetNode = this.linkGraph.nodes.get(targetKey);
            
            if (type === 'link') {
                if (sourceNode) sourceNode.outgoingLinks++;
                if (targetNode) targetNode.incomingLinks++;
            } else if (type === 'tag') {
                if (sourceNode) sourceNode.tagConnections++;
                if (targetNode) targetNode.tagConnections++;
            }
        }
    }

    /**
     * Create tag-based connections between files with shared tags
     */
    createTagBasedConnections() {
        // Create a map of tags to files
        const tagToFiles = new Map();
        
        for (const [key, node] of this.linkGraph.nodes) {
            if (node.tags && node.tags.length > 0) {
                for (const tag of node.tags) {
                    if (!tagToFiles.has(tag)) {
                        tagToFiles.set(tag, []);
                    }
                    tagToFiles.get(tag).push(key);
                }
            }
        }

        // Create edges between files that share tags
        for (const [tag, files] of tagToFiles) {
            if (files.length > 1) {
                // Create connections between all pairs of files with this tag
                for (let i = 0; i < files.length; i++) {
                    for (let j = i + 1; j < files.length; j++) {
                        const sourceKey = files[i];
                        const targetKey = files[j];
                        
                        // Get the nodes to access their paths
                        const sourceNode = this.linkGraph.nodes.get(sourceKey);
                        const targetNode = this.linkGraph.nodes.get(targetKey);
                        
                        if (sourceNode && targetNode) {
                            // Find all shared tags between these two files
                            const sharedTags = sourceNode.tags.filter(t => targetNode.tags.includes(t));
                            
                            // Create bidirectional edges for tag connections
                            this.addEdge(sourceKey, targetKey, sourceNode.path, targetNode.path, 'tag', sharedTags);
                            this.addEdge(targetKey, sourceKey, targetNode.path, sourceNode.path, 'tag', sharedTags);
                        }
                    }
                }
            }
        }
    }

    /**
     * Get file key (relative path from root)
     * @param {string} filePath - Absolute file path
     * @param {string} rootPath - Root directory path
     * @returns {string} File key
     */
    getFileKey(filePath, rootPath) {
        return path.relative(rootPath, filePath);
    }

    /**
     * Get basic file statistics
     * @param {string} filePath - File path
     * @returns {Object} File statistics
     */
    getFileStats(filePath) {
        try {
            const stats = require('fs').statSync(filePath);
            return {
                size: stats.size,
                modified: stats.mtime.toISOString()
            };
        } catch (error) {
            return {
                size: 0,
                modified: new Date().toISOString()
            };
        }
    }

    /**
     * Identify orphaned files (no incoming links, outgoing links, or tag connections)
     */
    identifyOrphans() {
        for (const [key, node] of this.linkGraph.nodes) {
            if (node.incomingLinks === 0 && node.outgoingLinks === 0 && node.tagConnections === 0) {
                this.linkGraph.orphans.add(key);
            }
        }
    }

    /**
     * Get graph data in serializable format
     * @returns {Object} Graph data with nodes and edges arrays
     */
    getGraphData() {
        return {
            nodes: Array.from(this.linkGraph.nodes.values()),
            edges: Array.from(this.linkGraph.edges.values()),
            orphans: Array.from(this.linkGraph.orphans),
            stats: this.getStats()
        };
    }

    /**
     * Get graph statistics
     * @returns {Object} Graph statistics
     */
    getStats() {
        const nodes = Array.from(this.linkGraph.nodes.values());
        const edges = Array.from(this.linkGraph.edges.values());
        
        const incomingCounts = nodes.map(n => n.incomingLinks);
        const outgoingCounts = nodes.map(n => n.outgoingLinks);
        const tagConnectionCounts = nodes.map(n => n.tagConnections);
        
        const linkEdges = edges.filter(e => e.type === 'link');
        const tagEdges = edges.filter(e => e.type === 'tag');
        
        // Get unique tags
        const allTags = new Set();
        nodes.forEach(node => {
            if (node.tags) {
                node.tags.forEach(tag => allTags.add(tag));
            }
        });

        return {
            totalFiles: this.linkGraph.nodes.size,
            totalLinks: linkEdges.length,
            totalTagConnections: tagEdges.length,
            totalTags: allTags.size,
            orphanedFiles: this.linkGraph.orphans.size,
            averageIncomingLinks: incomingCounts.length > 0 ? 
                incomingCounts.reduce((a, b) => a + b, 0) / incomingCounts.length : 0,
            averageOutgoingLinks: outgoingCounts.length > 0 ? 
                outgoingCounts.reduce((a, b) => a + b, 0) / outgoingCounts.length : 0,
            averageTagConnections: tagConnectionCounts.length > 0 ? 
                tagConnectionCounts.reduce((a, b) => a + b, 0) / tagConnectionCounts.length : 0,
            maxIncomingLinks: Math.max(...incomingCounts, 0),
            maxOutgoingLinks: Math.max(...outgoingCounts, 0),
            maxTagConnections: Math.max(...tagConnectionCounts, 0)
        };
    }
}

module.exports = LinkAnalysisService;
