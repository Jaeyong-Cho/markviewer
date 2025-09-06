/**
 * API client for MarkViewer backend
 * Handles all communication with the Express server
 */

/**
 * Low-level API client for direct HTTP requests
 */
class ApiClient {
    constructor() {
        // Auto-detect API base URL
        // If running from same host, use same host for API
        // Otherwise, default to localhost for development
        const currentHost = window.location.hostname;
        const currentPort = window.location.port;
        
        // Determine API port based on current location
        let apiPort = '3001';
        if (currentPort && currentPort !== '80' && currentPort !== '443') {
            // If we're on a non-standard port, assume backend is on 3001
            apiPort = '3001';
        }
        
        // Use current protocol and hostname for external access
        const protocol = window.location.protocol;
        this.baseUrl = `${protocol}//${currentHost}:${apiPort}/api`;
        this.timeout = 30000; // 30 seconds
    }

    /**
     * Make a HTTP request with error handling and timeout
     * @param {string} url - Request URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     */
    async request(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - please try again');
            }
            
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server - please ensure the backend is running');
            }
            
            throw error;
        }
    }

    /**
     * Get directory tree structure
     * @param {string} rootPath - Root directory path
     * @returns {Promise<Object>} Directory tree data
     */
    async getDirectoryTree(rootPath) {
        const url = `${this.baseUrl}/directory?${new URLSearchParams({ path: rootPath })}`;
        return await this.request(url);
    }

    /**
     * Get file content
     * @param {string} filePath - File path
     * @returns {Promise<Object>} File content data
     */
    async getFileContent(filePath) {
        const url = `${this.baseUrl}/file?${new URLSearchParams({ path: filePath })}`;
        return await this.request(url);
    }

    /**
     * Render PlantUML diagram to SVG
     * @param {string} source - PlantUML source code
     * @returns {Promise<Object>} SVG rendering result
     */
    async renderPlantUML(source) {
        const url = `${this.baseUrl}/plantuml`;
        return await this.request(url, {
            method: 'POST',
            body: JSON.stringify({ source })
        });
    }

    /**
     * Search files for content
     * @param {string} query - Search query
     * @param {string} rootPath - Root directory path
     * @returns {Promise<Object>} Search results
     */
    async searchFiles(query, rootPath) {
        const url = `${this.baseUrl}/search?${new URLSearchParams({ query: query, path: rootPath })}`;
        return await this.request(url);
    }

    /**
     * Check server health
     * @returns {Promise<Object>} Health status
     */
    async checkHealth() {
        const url = `${this.baseUrl}/health`;
        return await this.request(url);
    }
}

/**
 * API service with caching and error handling
 */
class ApiService {
    constructor() {
        this.client = new ApiClient();
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get cache key for request
     * @param {string} method - API method
     * @param {...*} args - Method arguments
     * @returns {string} Cache key
     */
    getCacheKey(method, ...args) {
        return `${method}:${JSON.stringify(args)}`;
    }

    /**
     * Check if cached data is still valid
     * @param {Object} cacheEntry - Cache entry with timestamp
     * @returns {boolean} True if cache is valid
     */
    isCacheValid(cacheEntry) {
        return Date.now() - cacheEntry.timestamp < this.cacheTimeout;
    }

    /**
     * Get from cache or fetch from API
     * @param {string} method - API method name
     * @param {Function} apiCall - API call function
     * @param {...*} args - Arguments for API call
     * @returns {Promise<*>} API response
     */
    async cachedRequest(method, apiCall, ...args) {
        const cacheKey = this.getCacheKey(method, ...args);
        const cached = this.cache.get(cacheKey);

        // Return cached data if valid
        if (cached && this.isCacheValid(cached)) {
            console.log(`Cache hit for ${method}`);
            return cached.data;
        }

        try {
            console.log(`API call for ${method}`);
            const data = await apiCall.apply(this.client, args);
            
            // Cache the result
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`API error for ${method}:`, error);
            throw error;
        }
    }

    /**
     * Get directory tree with caching
     * @param {string} rootPath - Root directory path
     * @returns {Promise<Object>} Directory tree
     */
    async getDirectoryTree(rootPath) {
        return await this.cachedRequest('getDirectoryTree', this.client.getDirectoryTree, rootPath);
    }

    /**
     * Get file content with caching
     * @param {string} filePath - File path
     * @returns {Promise<Object>} File content
     */
    async getFileContent(filePath) {
        return await this.cachedRequest('getFileContent', this.client.getFileContent, filePath);
    }

    /**
     * Render PlantUML (with caching)
     * @param {string} source - PlantUML source
     * @returns {Promise<Object>} SVG result
     */
    async renderPlantUML(source) {
        return await this.cachedRequest('renderPlantUML', this.client.renderPlantUML, source);
    }

    /**
     * Search files (no caching for real-time results)
     * @param {string} query - Search query
     * @param {string} rootPath - Root directory path
     * @returns {Promise<Object>} Search results
     */
    async searchFiles(query, rootPath) {
        try {
            return await this.client.searchFiles(query, rootPath);
        } catch (error) {
            console.error('Search API error:', error);
            throw error;
        }
    }

    /**
     * Check server health
     * @returns {Promise<Object>} Health status
     */
    async checkHealth() {
        try {
            return await this.client.checkHealth();
        } catch (error) {
            console.error('Health check failed:', error);
            throw error;
        }
    }

    /**
     * Clear all cached data
     */
    clearCache(filePath = null) {
        if (filePath) {
            // Clear cache for specific file
            const keysToDelete = [];
            for (const key of this.cache.keys()) {
                if (key.includes(filePath)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.cache.delete(key));
            console.log(`Cache cleared for file: ${filePath}`);
        } else {
            // Clear all cache
            this.cache.clear();
            console.log('API cache cleared');
        }
    }

    /**
     * Clear cache for specific method
     * @param {string} method - Method name to clear cache for
     */
    clearMethodCache(method) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${method}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        console.log(`Cache cleared for method: ${method}`);
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const entry of this.cache.values()) {
            if (now - entry.timestamp < this.cacheTimeout) {
                validEntries++;
            } else {
                expiredEntries++;
            }
        }

        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            cacheTimeout: this.cacheTimeout
        };
    }

    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp >= this.cacheTimeout) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
        
        if (keysToDelete.length > 0) {
            console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
        }
    }
}

// Create global API service instance
window.API = {
    ApiService: ApiService
};
window.api = new ApiService(); // Export instance

// Periodic cache cleanup
setInterval(() => {
    window.api.cleanupCache();
}, 60000); // Clean up every minute
