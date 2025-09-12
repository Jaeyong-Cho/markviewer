/**
 * Utility functions for the MarkViewer application
 */

/**
 * Debounce function to limit the rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Whether to execute immediately on leading edge
 * @returns {Function} Debounced function
 */
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * Throttle function to limit function execution to at most once per interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Escape HTML characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitize HTML by removing potentially dangerous elements and attributes
 * @param {string} html - HTML to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html) {
    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove dangerous script tags but preserve safe ones for PlantUML and Mermaid
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(script => {
        const type = script.getAttribute('type');
        // Keep scripts with safe types that are used for diagram source storage
        if (type !== 'application/plantuml' && type !== 'application/mermaid') {
            script.remove();
        }
    });

    // Remove dangerous attributes
    const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'];
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(element => {
        dangerousAttrs.forEach(attr => {
            if (element.hasAttribute(attr)) {
                element.removeAttribute(attr);
            }
        });
    });

    return temp.innerHTML;
}

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format date in relative time (e.g., "2 hours ago")
 * @param {Date|string} date - Date to format
 * @returns {string} Relative time string
 */
function formatRelativeTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now - target;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return target.toLocaleDateString();
    }
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename to extract extension from
 * @returns {string} File extension including the dot
 */
function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
}

/**
 * Check if a file is a markdown file based on extension
 * @param {string} filename - Filename to check
 * @returns {boolean} True if file is markdown
 */
function isMarkdownFile(filename) {
    const ext = getFileExtension(filename).toLowerCase();
    return ['.md', '.markdown', '.txt'].includes(ext);
}

/**
 * Normalize file path to use forward slashes and handle Windows paths
 */
function normalizePath(filePath) {
    if (!filePath) return filePath;
    
    // Convert backslashes to forward slashes
    let normalized = filePath.replace(/\\/g, '/');
    
    // Handle Windows drive letters (C:/ -> /C:/)
    if (/^[A-Za-z]:\//.test(normalized)) {
        normalized = '/' + normalized;
    }
    
    // Remove duplicate slashes except for the first one
    normalized = normalized.replace(/\/+/g, '/');
    
    return normalized;
}

/**
 * Resolve a link path relative to a current file
 * @param {string} linkPath - The link path to resolve
 * @param {string} currentFilePath - Path of the current file
 * @param {string} rootDirectory - Root directory path
 * @returns {string} Resolved absolute file path
 */
function resolveLinkPath(linkPath, currentFilePath, rootDirectory) {
    console.log('resolveLinkPath called with:', { linkPath, currentFilePath, rootDirectory });
    
    // Normalize all paths
    const normalizedLinkPath = normalizePath(linkPath);
    const normalizedCurrentPath = normalizePath(currentFilePath);
    const normalizedRootPath = normalizePath(rootDirectory);
    
    console.log('Normalized paths:', { 
        normalizedLinkPath, 
        normalizedCurrentPath, 
        normalizedRootPath 
    });
    
    // If link path is already absolute and starts with root, return as is
    if (normalizedLinkPath.startsWith(normalizedRootPath)) {
        console.log('Link path already absolute within root');
        return normalizedLinkPath;
    }
    
    // If link path is absolute but not within root, try to resolve within root
    if (normalizedLinkPath.startsWith('/')) {
        const resolvedPath = joinPaths(normalizedRootPath, normalizedLinkPath.substring(1));
        console.log('Resolved absolute path within root:', resolvedPath);
        return resolvedPath;
    }
    
    // Get current file's directory
    const currentDir = normalizedCurrentPath.substring(0, normalizedCurrentPath.lastIndexOf('/'));
    console.log('Current directory:', currentDir);
    
    // Resolve relative path
    const resolvedPath = joinPaths(currentDir, normalizedLinkPath);
    console.log('Resolved relative path:', resolvedPath);
    
    return normalizePath(resolvedPath);
}

/**
 * Join path components with proper separators
 * @param {...string} paths - Path components to join
 * @returns {string} Joined path
 */
function joinPaths(...paths) {
    const joined = paths
        .map(p => normalizePath(p))
        .filter(p => p)
        .join('/')
        .replace(/\/+/g, '/'); // Remove duplicate slashes
    
    console.log('joinPaths result:', joined);
    return joined;
}

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Show loading state
 * @param {string} message - Loading message
 */
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay.querySelector('.loading-text');
    text.textContent = message;
    overlay.classList.remove('hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
}

/**
 * Show notification to user
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, info)
 * @param {number} duration - Duration in milliseconds (0 for persistent)
 */
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.getElementById('notification');
    const messageElement = notification.querySelector('.notification-message');
    const closeButton = notification.querySelector('.notification-close');

    // Set message and type
    messageElement.textContent = message;
    notification.className = `notification ${type}`;

    // Show notification
    notification.classList.remove('hidden');

    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            hideNotification();
        }, duration);
    }

    // Handle close button
    closeButton.onclick = hideNotification;
}

/**
 * Hide notification
 */
function hideNotification() {
    const notification = document.getElementById('notification');
    notification.classList.add('hidden');
}

/**
 * Extract text content from HTML
 * @param {string} html - HTML string
 * @returns {string} Plain text content
 */
function extractTextFromHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if element is in viewport
 * @param {Element} element - Element to check
 * @returns {boolean} True if element is visible
 */
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Scroll element into view smoothly
 * @param {Element} element - Element to scroll to
 * @param {string} behavior - Scroll behavior (smooth, auto)
 * @param {string} block - Vertical alignment (start, center, end, nearest)
 */
function scrollToElement(element, behavior = 'smooth', block = 'nearest') {
    element.scrollIntoView({
        behavior: behavior,
        block: block,
        inline: 'nearest'
    });
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}

/**
 * Local storage wrapper with error handling
 */
const storage = {
    /**
     * Get item from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Stored value or default
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Failed to get from localStorage:', error);
            return defaultValue;
        }
    },

    /**
     * Set item in localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} Success status
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Failed to set localStorage:', error);
            return false;
        }
    },

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} Success status
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
            return false;
        }
    }
};

/**
 * Event emitter for decoupled communication
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     */
    on(event, callback) {
        console.log(`EventEmitter: Registering handler for event '${event}'`);
        
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        
        console.log(`EventEmitter: Total handlers for '${event}':`, this.events[event].length);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler to remove
     */
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...*} args - Arguments to pass to handlers
     */
    emit(event, ...args) {
        console.log(`EventEmitter: Emitting event '${event}' with args:`, args);
        console.log(`EventEmitter: Registered handlers for '${event}':`, this.events[event] ? this.events[event].length : 0);
        
        if (!this.events[event]) {
            console.warn(`EventEmitter: No handlers registered for event '${event}'`);
            return;
        }
        
        this.events[event].forEach((callback, index) => {
            try {
                console.log(`EventEmitter: Calling handler ${index} for '${event}'`);
                callback(...args);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }
}

// Export utilities
window.Utils = {
    debounce,
    throttle,
    escapeHtml,
    sanitizeHtml,
    formatFileSize,
    formatRelativeTime,
    getFileExtension,
    isMarkdownFile,
    normalizePath,
    resolveLinkPath,
    joinPaths,
    generateId,
    deepClone,
    showLoading,
    hideLoading,
    showNotification,
    hideNotification,
    extractTextFromHtml,
    truncateText,
    isElementInViewport,
    scrollToElement,
    copyToClipboard,
    storage,
    EventEmitter
};
