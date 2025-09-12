const path = require('path');

/**
 * Backend utility functions for path handling and normalization
 */

/**
 * Normalize file path to handle cross-platform compatibility
 * @param {string} filePath - Path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(filePath) {
    if (!filePath) return filePath;
    
    // Use Node.js path.normalize for proper platform handling
    let normalized = path.normalize(filePath);
    
    // Convert backslashes to forward slashes for consistency
    normalized = normalized.replace(/\\/g, '/');
    
    // Handle Windows drive letters - remove leading slash
    // /C:/ -> C:/
    if (/^\/[A-Za-z]:\//.test(normalized)) {
        normalized = normalized.substring(1);
    }
    
    // Remove duplicate slashes (but preserve UNC paths)
    if (normalized.startsWith('//') && !normalized.startsWith('///')) {
        // UNC path, keep double slash
    } else {
        normalized = normalized.replace(/\/+/g, '/');
    }
    
    return normalized;
}

/**
 * Resolve a relative path against a base path with proper normalization
 * @param {string} basePath - Base path
 * @param {string} relativePath - Relative path to resolve
 * @returns {string} Resolved absolute path
 */
function resolvePath(basePath, relativePath) {
    if (!basePath || !relativePath) return relativePath;
    
    const resolved = path.resolve(basePath, relativePath);
    return normalizePath(resolved);
}

/**
 * Check if a path is within a given directory (prevent path traversal)
 * @param {string} parentDir - Parent directory
 * @param {string} targetPath - Target path to check
 * @returns {boolean} True if path is within parent directory
 */
function isPathWithinDirectory(parentDir, targetPath) {
    if (!parentDir || !targetPath) return false;
    
    const normalizedParent = normalizePath(path.resolve(parentDir));
    const normalizedTarget = normalizePath(path.resolve(targetPath));
    
    console.log('isPathWithinDirectory check:', {
        parent: normalizedParent,
        target: normalizedTarget,
        result: normalizedTarget.startsWith(normalizedParent)
    });
    
    return normalizedTarget.startsWith(normalizedParent);
}

/**
 * Join multiple path segments with proper normalization
 * @param {...string} segments - Path segments to join
 * @returns {string} Joined path
 */
function joinPaths(...segments) {
    const joined = path.join(...segments);
    return normalizePath(joined);
}

/**
 * Get relative path from one path to another
 * @param {string} from - Source path
 * @param {string} to - Target path
 * @returns {string} Relative path
 */
function getRelativePath(from, to) {
    const relative = path.relative(from, to);
    return normalizePath(relative);
}

/**
 * Check if path is absolute
 * @param {string} filePath - Path to check
 * @returns {boolean} True if path is absolute
 */
function isAbsolutePath(filePath) {
    return path.isAbsolute(filePath);
}

/**
 * Get directory name from path
 * @param {string} filePath - File path
 * @returns {string} Directory name
 */
function getDirname(filePath) {
    return normalizePath(path.dirname(filePath));
}

/**
 * Get base name from path
 * @param {string} filePath - File path
 * @param {string} ext - Optional extension to remove
 * @returns {string} Base name
 */
function getBasename(filePath, ext) {
    return path.basename(filePath, ext);
}

/**
 * Get file extension
 * @param {string} filePath - File path
 * @returns {string} File extension
 */
function getExtension(filePath) {
    return path.extname(filePath);
}

module.exports = {
    normalizePath,
    resolvePath,
    isPathWithinDirectory,
    joinPaths,
    getRelativePath,
    isAbsolutePath,
    getDirname,
    getBasename,
    getExtension
};