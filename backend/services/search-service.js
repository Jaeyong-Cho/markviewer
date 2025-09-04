const fs = require('fs').promises;
const path = require('path');
const fileHandler = require('./file-handler');

/**
 * Search service for full-text search across markdown files
 * Provides ranked search results with content snippets
 */
class SearchService {
    constructor() {
        this.indexCache = new Map();
        this.maxSnippetLength = 200;
        this.contextLength = 50;
    }

    /**
     * Search for files containing the query string
     * @param {string} query - Search query
     * @param {string} rootPath - Root directory to search in
     * @returns {Promise<Object>} Search results with rankings and snippets
     */
    async searchFiles(query, rootPath) {
        if (!query || query.trim().length === 0) {
            return { results: [], total: 0, query: query };
        }

        const trimmedQuery = query.trim();
        const isRegexQuery = this.isRegexPattern(trimmedQuery);
        
        try {
            // Get all markdown files in the directory
            const files = await fileHandler.getAllMarkdownFiles(rootPath);
            const results = [];

            // Search each file
            for (const filePath of files) {
                try {
                    const fileResults = await this.searchInFile(filePath, trimmedQuery, isRegexQuery);
                    if (fileResults.matches > 0) {
                        results.push(fileResults);
                    }
                } catch (error) {
                    console.warn(`Error searching file ${filePath}: ${error.message}`);
                }
            }

            // Sort results by relevance (matches count, then file name)
            results.sort((a, b) => {
                if (a.matches !== b.matches) {
                    return b.matches - a.matches; // More matches first
                }
                return a.file.localeCompare(b.file); // Alphabetical as tiebreaker
            });

            return {
                results: results,
                total: results.length,
                query: trimmedQuery
            };
        } catch (error) {
            console.error('Search error:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * Check if query appears to be a regex pattern
     * @param {string} query - Query string to check
     * @returns {boolean} True if query looks like regex
     */
    isRegexPattern(query) {
        // Simple heuristic to detect regex patterns
        const regexChars = /[.*+?^${}()|[\]\\]/;
        return regexChars.test(query);
    }

    /**
     * Search within a single file
     * @param {string} filePath - Path to file to search
     * @param {string} query - Search query
     * @param {boolean} isRegex - Whether to treat query as regex
     * @returns {Promise<Object>} Search result for this file
     */
    async searchInFile(filePath, query, isRegex = false) {
        const content = await fileHandler.getFileContent(filePath);
        const fileName = path.basename(filePath);
        const relativePath = this.getRelativePath(filePath);

        let matches = 0;
        let snippets = [];
        let filenameMatches = 0;
        
        try {
            // Search in file content
            if (isRegex) {
                matches = this.searchWithRegex(content, query, snippets);
            } else {
                matches = this.searchWithString(content, query, snippets);
            }

            // Search in filename and add filename match if found
            filenameMatches = this.searchInFilename(fileName, query, isRegex);
            if (filenameMatches > 0) {
                matches += filenameMatches;
                // Add filename match snippet
                snippets.unshift({
                    content: fileName,
                    lineNumber: 0,
                    context: 'Filename match',
                    isFilename: true
                });
            }

            // Extract title from markdown (first heading)
            const title = this.extractTitle(content) || fileName;

            return {
                file: filePath,
                relativePath: relativePath,
                title: title,
                matches: matches,
                filenameMatches: filenameMatches,
                contentMatches: matches - filenameMatches,
                snippets: snippets.slice(0, 4), // Limit to 4 snippets per file (including filename)
                preview: this.generatePreview(content, 300) // Add preview text
            };
        } catch (error) {
            console.warn(`Search error in file ${filePath}: ${error.message}`);
            return {
                file: filePath,
                relativePath: relativePath,
                title: fileName,
                matches: 0,
                filenameMatches: 0,
                contentMatches: 0,
                snippets: [],
                preview: ''
            };
        }
    }

    /**
     * Search content using string matching
     * @param {string} content - File content to search
     * @param {string} query - Search query
     * @param {Array} snippets - Array to collect snippets
     * @returns {number} Number of matches found
     */
    searchWithString(content, query, snippets) {
        const lines = content.split('\n');
        let matches = 0;
        const queryLower = query.toLowerCase();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();
            
            if (lineLower.includes(queryLower)) {
                matches++;
                
                // Create snippet with context
                const snippet = this.createSnippet(lines, i, query);
                if (snippet && !this.isDuplicateSnippet(snippets, snippet)) {
                    snippets.push(snippet);
                }
            }
        }

        return matches;
    }

    /**
     * Search content using regex pattern
     * @param {string} content - File content to search
     * @param {string} pattern - Regex pattern
     * @param {Array} snippets - Array to collect snippets
     * @returns {number} Number of matches found
     */
    searchWithRegex(content, pattern, snippets) {
        try {
            const regex = new RegExp(pattern, 'gi'); // Global, case-insensitive
            const lines = content.split('\n');
            let matches = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineMatches = line.match(regex);
                
                if (lineMatches) {
                    matches += lineMatches.length;
                    
                    // Create snippet with context
                    const snippet = this.createSnippet(lines, i, pattern, true);
                    if (snippet && !this.isDuplicateSnippet(snippets, snippet)) {
                        snippets.push(snippet);
                    }
                }
            }

            return matches;
        } catch (error) {
            // If regex is invalid, fall back to string search
            console.warn(`Invalid regex pattern: ${pattern}, falling back to string search`);
            return this.searchWithString(content, pattern, snippets);
        }
    }

    /**
     * Create a text snippet with context around the match
     * @param {Array} lines - All lines in the file
     * @param {number} lineIndex - Index of the matching line
     * @param {string} query - Search query for highlighting
     * @param {boolean} isRegex - Whether query is regex
     * @returns {Object} Snippet object with content and line number
     */
    createSnippet(lines, lineIndex, query, isRegex = false) {
        const startLine = Math.max(0, lineIndex - 1);
        const endLine = Math.min(lines.length - 1, lineIndex + 1);
        
        let snippetLines = [];
        for (let i = startLine; i <= endLine; i++) {
            snippetLines.push(lines[i]);
        }

        let snippet = snippetLines.join(' ').trim();
        
        // Truncate if too long
        if (snippet.length > this.maxSnippetLength) {
            snippet = snippet.substring(0, this.maxSnippetLength) + '...';
        }

        // Highlight the search term (simple highlighting)
        const highlightedSnippet = this.highlightQuery(snippet, query, isRegex);

        return {
            content: highlightedSnippet,
            lineNumber: lineIndex + 1,
            context: `Line ${lineIndex + 1}`
        };
    }

    /**
     * Highlight query matches in snippet
     * @param {string} snippet - Text snippet
     * @param {string} query - Search query
     * @param {boolean} isRegex - Whether query is regex
     * @returns {string} Snippet with highlighted matches
     */
    highlightQuery(snippet, query, isRegex = false) {
        try {
            if (isRegex) {
                const regex = new RegExp(`(${query})`, 'gi');
                return snippet.replace(regex, '<mark>$1</mark>');
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQuery})`, 'gi');
                return snippet.replace(regex, '<mark>$1</mark>');
            }
        } catch (error) {
            // If highlighting fails, return original snippet
            return snippet;
        }
    }

    /**
     * Check if snippet is duplicate (similar content)
     * @param {Array} snippets - Existing snippets
     * @param {Object} newSnippet - New snippet to check
     * @returns {boolean} True if snippet is duplicate
     */
    isDuplicateSnippet(snippets, newSnippet) {
        return snippets.some(existing => {
            // Remove HTML tags for comparison
            const existingClean = existing.content.replace(/<[^>]*>/g, '');
            const newClean = newSnippet.content.replace(/<[^>]*>/g, '');
            
            // Check if content is very similar (simple similarity check)
            return existingClean.includes(newClean) || newClean.includes(existingClean);
        });
    }

    /**
     * Extract title from markdown content (first heading)
     * @param {string} content - Markdown content
     * @returns {string|null} Extracted title or null
     */
    extractTitle(content) {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                // Extract heading text (remove # and trim)
                return trimmed.replace(/^#+\s*/, '').trim();
            }
        }
        
        return null;
    }

    /**
     * Search for query in filename
     * @param {string} filename - Filename to search
     * @param {string} query - Search query
     * @param {boolean} isRegex - Whether to treat query as regex
     * @returns {number} Number of matches in filename
     */
    searchInFilename(filename, query, isRegex = false) {
        try {
            if (isRegex) {
                const regex = new RegExp(query, 'gi');
                const matches = filename.match(regex);
                return matches ? matches.length : 0;
            } else {
                const queryLower = query.toLowerCase();
                const filenameLower = filename.toLowerCase();
                return filenameLower.includes(queryLower) ? 1 : 0;
            }
        } catch (error) {
            console.warn(`Error searching filename ${filename}: ${error.message}`);
            return 0;
        }
    }

    /**
     * Generate a preview of the file content
     * @param {string} content - Full file content
     * @param {number} maxLength - Maximum length of preview
     * @returns {string} Preview text
     */
    generatePreview(content, maxLength = 300) {
        if (!content || content.trim().length === 0) {
            return '';
        }

        // Remove markdown syntax for cleaner preview
        let preview = content
            .replace(/^#{1,6}\s+/gm, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`{1,3}[^`]*`{1,3}/g, '') // Remove code blocks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
            .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove images
            .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
            .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
            .replace(/^\s*>\s*/gm, '') // Remove blockquotes
            .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
            .trim();

        // Truncate to max length
        if (preview.length > maxLength) {
            preview = preview.substring(0, maxLength);
            // Try to end at a word boundary
            const lastSpace = preview.lastIndexOf(' ');
            if (lastSpace > maxLength * 0.8) {
                preview = preview.substring(0, lastSpace);
            }
            preview += '...';
        }

        return preview;
    }

    /**
     * Get relative path for display
     * @param {string} fullPath - Full file path
     * @returns {string} Relative path
     */
    getRelativePath(fullPath) {
        // For now, just return the basename
        // In the future, could compute relative to root
        return path.basename(fullPath);
    }

    /**
     * Clear search cache
     */
    clearCache() {
        this.indexCache.clear();
        console.log('Search cache cleared');
    }

    /**
     * Get search statistics
     * @returns {Object} Search statistics
     */
    getStats() {
        return {
            cacheSize: this.indexCache.size,
            maxSnippetLength: this.maxSnippetLength,
            contextLength: this.contextLength
        };
    }
}

module.exports = new SearchService();
