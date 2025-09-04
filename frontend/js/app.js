/**
 * Main application class for MarkViewer
 * Manages application state and coordinates between components
 */

class MarkViewerApp extends Utils.EventEmitter {
    constructor() {
        super();
        
        // Application state
        this.state = {
            rootDirectory: null,
            currentFile: null,
            directoryTree: null,
            searchResults: null,
            isSearchMode: false,
            sidebarOpen: true,
            isLoading: false
        };

        // Component instances
        this.sidebar = null;
        this.renderer = null;
        this.search = null;

        // DOM elements
        this.elements = {};
        
        // Bind methods
        this.handleRootSelection = this.handleRootSelection.bind(this);
        this.handleFileSelect = this.handleFileSelect.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleSidebarToggle = this.handleSidebarToggle.bind(this);
        this.handleKeyboard = this.handleKeyboard.bind(this);
        this.handleResize = this.handleResize.bind(this);

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing MarkViewer...');

        try {
            // Wait for external libraries to load
            await this.waitForLibraries();

            // Cache DOM elements
            this.cacheElements();

            // Initialize components
            await this.initializeComponents();

            // Setup event listeners
            this.setupEventListeners();

            // Load saved state
            this.loadSavedState();

            // Check server connection
            await this.checkServerConnection();

            console.log('MarkViewer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize MarkViewer:', error);
            Utils.showNotification('Failed to initialize application: ' + error.message, 'error');
        }
    }

    /**
     * Wait for external libraries to load
     */
    async waitForLibraries() {
        const maxWaitTime = 15000; // 15 seconds
        const checkInterval = 200; // 200ms
        let elapsed = 0;

        return new Promise((resolve, reject) => {
            const checkLibraries = () => {
                const markedLoaded = typeof marked !== 'undefined';
                const hljsLoaded = typeof hljs !== 'undefined';
                const mermaidLoaded = typeof mermaid !== 'undefined';
                
                // Check if all critical libraries are loaded
                const criticalLibrariesLoaded = markedLoaded;
                const optionalLibrariesLoaded = hljsLoaded && mermaidLoaded;
                
                if (criticalLibrariesLoaded && optionalLibrariesLoaded) {
                    console.log('All external libraries loaded successfully');
                    console.log('- marked:', markedLoaded ? '✓' : '✗');
                    console.log('- highlight.js:', hljsLoaded ? '✓' : '✗');
                    console.log('- mermaid:', mermaidLoaded ? '✓' : '✗');
                    resolve();
                } else if (elapsed >= maxWaitTime) {
                    console.log('Library loading status after timeout:');
                    console.log('- marked:', markedLoaded ? '✓' : '✗');
                    console.log('- highlight.js:', hljsLoaded ? '✓' : '✗');
                    console.log('- mermaid:', mermaidLoaded ? '✓' : '✗');
                    
                    // For non-critical libraries, continue anyway
                    if (markedLoaded) {
                        console.log('Critical library (marked) loaded, continuing with available functionality');
                        resolve();
                    } else {
                        reject(new Error(`Critical library 'marked' failed to load. Cannot proceed.`));
                    }
                } else {
                    elapsed += checkInterval;
                    setTimeout(checkLibraries, checkInterval);
                }
            };

            checkLibraries();
        });
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            selectRootBtn: document.getElementById('select-root-btn'),
            currentRootPath: document.getElementById('current-root'),
            sidebarToggle: document.getElementById('sidebar-toggle'),
            sidebar: document.getElementById('sidebar'),
            searchInput: document.getElementById('search-input'),
            searchClear: document.getElementById('search-clear'),
            searchResults: document.getElementById('search-results'),
            mainContent: document.getElementById('main-content'),
            markdownContent: document.getElementById('markdown-content'),
            breadcrumb: document.getElementById('breadcrumb'),
            currentFileName: document.getElementById('current-file'),
            fileModified: document.getElementById('file-modified'),
            fileCount: document.getElementById('file-count')
        };

        // Verify all elements exist
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
    }

    /**
     * Initialize component instances
     */
    async initializeComponents() {
        // Import and initialize components
        this.sidebar = new Sidebar(this.elements.sidebar, this);
        this.renderer = new MarkdownRenderer(this.elements.markdownContent, this);
        this.search = new SearchComponent(this.elements.searchInput, this);

        // Set up inter-component communication
        this.setupComponentEvents();
    }

    /**
     * Setup event listeners for components
     */
    setupComponentEvents() {
        // Sidebar events
        this.sidebar.on('fileSelect', this.handleFileSelect);
        this.sidebar.on('directoryLoad', (tree) => {
            this.updateState({ directoryTree: tree });
            this.updateFileCount();
        });

        // Search events
        this.search.on('searchResults', (results) => {
            this.updateState({ searchResults: results, isSearchMode: true });
            this.showSearchResults();
        });
        this.search.on('searchClear', () => {
            this.updateState({ searchResults: null, isSearchMode: false });
            this.hideSearchResults();
        });
        this.search.on('resultSelect', this.handleFileSelect);

        // Renderer events
        this.renderer.on('linkClick', this.handleInternalLink.bind(this));
    }

    /**
     * Setup DOM event listeners
     */
    setupEventListeners() {
        // Root directory selection
        this.elements.selectRootBtn.addEventListener('click', this.handleRootSelection);

        // Sidebar toggle
        this.elements.sidebarToggle.addEventListener('click', this.handleSidebarToggle);

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard);

        // Window events
        window.addEventListener('resize', Utils.throttle(this.handleResize, 250));

        // Prevent default file drop behavior
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }

    /**
     * Load saved state from localStorage
     */
    loadSavedState() {
        const savedState = Utils.storage.get('markviewer-state', {});
        
        if (savedState.rootDirectory) {
            this.updateState({ rootDirectory: savedState.rootDirectory });
            this.elements.currentRootPath.textContent = savedState.rootDirectory;
            
            // Load directory tree
            this.loadDirectoryTree(savedState.rootDirectory);
        }

        if (savedState.sidebarOpen !== undefined) {
            this.updateState({ sidebarOpen: savedState.sidebarOpen });
            this.updateSidebarVisibility();
        }
    }

    /**
     * Save current state to localStorage
     */
    saveState() {
        const stateToSave = {
            rootDirectory: this.state.rootDirectory,
            sidebarOpen: this.state.sidebarOpen
        };
        Utils.storage.set('markviewer-state', stateToSave);
    }

    /**
     * Update application state
     * @param {Object} newState - State updates
     */
    updateState(newState) {
        const oldState = { ...this.state };
        Object.assign(this.state, newState);
        
        // Emit state change event
        this.emit('stateChange', this.state, oldState);
        
        // Save to localStorage
        this.saveState();
    }

    /**
     * Check server connection
     */
    async checkServerConnection() {
        try {
            await window.api.checkHealth();
            console.log('Server connection established');
        } catch (error) {
            console.warn('Server connection failed:', error);
            Utils.showNotification(
                'Cannot connect to server. Please ensure the backend is running on port 3000.',
                'error',
                0 // Persistent notification
            );
        }
    }

    /**
     * Handle root directory selection
     */
    async handleRootSelection() {
        try {
            // In a real application, this would open a directory picker dialog
            // For now, we'll prompt the user for a directory path
            const path = prompt('Enter the path to your markdown directory:');
            
            if (!path) return;

            Utils.showLoading('Loading directory...');
            
            await this.setRootDirectory(path);
            
            Utils.hideLoading();
            Utils.showNotification('Directory loaded successfully', 'success');
        } catch (error) {
            Utils.hideLoading();
            console.error('Failed to set root directory:', error);
            Utils.showNotification('Failed to load directory: ' + error.message, 'error');
        }
    }

    /**
     * Set the root directory
     * @param {string} path - Directory path
     */
    async setRootDirectory(path) {
        this.updateState({ rootDirectory: path });
        this.elements.currentRootPath.textContent = path;
        
        // Clear previous state
        this.updateState({ 
            currentFile: null, 
            directoryTree: null,
            searchResults: null,
            isSearchMode: false 
        });

        // Load directory tree
        await this.loadDirectoryTree(path);
        
        // Clear search and show main content
        this.search.clear();
        this.hideSearchResults();
    }

    /**
     * Load directory tree
     * @param {string} rootPath - Root directory path
     */
    async loadDirectoryTree(rootPath) {
        try {
            const tree = await window.api.getDirectoryTree(rootPath);
            this.sidebar.loadTree(tree);
            this.updateState({ directoryTree: tree });
            this.updateFileCount();
        } catch (error) {
            console.error('Failed to load directory tree:', error);
            throw error;
        }
    }

    /**
     * Handle file selection
     * @param {string} filePath - Selected file path
     */
    async handleFileSelect(filePath) {
        if (!filePath || this.state.currentFile === filePath) return;

        try {
            Utils.showLoading('Loading file...');
            
            const fileData = await window.api.getFileContent(filePath);
            
            this.updateState({ currentFile: filePath });
            
            // Update UI
            this.updateFileInfo(filePath, fileData);
            
            // Render content
            await this.renderer.renderMarkdown(fileData.content);
            
            // Update sidebar selection
            this.sidebar.setActiveFile(filePath);
            
            // Hide search results if in search mode
            if (this.state.isSearchMode) {
                this.hideSearchResults();
                this.updateState({ isSearchMode: false });
                this.search.clear();
            }
            
            Utils.hideLoading();
        } catch (error) {
            Utils.hideLoading();
            console.error('Failed to load file:', error);
            Utils.showNotification('Failed to load file: ' + error.message, 'error');
        }
    }

    /**
     * Handle internal link clicks
     * @param {string} href - Link href
     */
    async handleInternalLink(href) {
        // If it's a relative path, resolve it relative to current file
        if (this.state.currentFile && !href.startsWith('/') && !href.includes('://')) {
            const currentDir = this.state.currentFile.substring(0, this.state.currentFile.lastIndexOf('/'));
            const resolvedPath = `${currentDir}/${href}`;
            
            if (Utils.isMarkdownFile(resolvedPath)) {
                await this.handleFileSelect(resolvedPath);
                return;
            }
        }
        
        // For external links, open in new tab
        if (href.includes('://')) {
            window.open(href, '_blank');
        }
    }

    /**
     * Handle search
     * @param {string} query - Search query
     */
    async handleSearch(query) {
        if (!this.state.rootDirectory) {
            Utils.showNotification('Please select a root directory first', 'error');
            return;
        }

        try {
            const results = await window.api.searchFiles(query, this.state.rootDirectory);
            this.updateState({ searchResults: results, isSearchMode: true });
            this.showSearchResults();
        } catch (error) {
            console.error('Search failed:', error);
            Utils.showNotification('Search failed: ' + error.message, 'error');
        }
    }

    /**
     * Show search results
     */
    showSearchResults() {
        this.elements.searchResults.classList.remove('hidden');
        this.elements.mainContent.classList.add('hidden');
        this.search.displayResults(this.state.searchResults);
    }

    /**
     * Hide search results
     */
    hideSearchResults() {
        this.elements.searchResults.classList.add('hidden');
        this.elements.mainContent.classList.remove('hidden');
    }

    /**
     * Handle sidebar toggle
     */
    handleSidebarToggle() {
        this.updateState({ sidebarOpen: !this.state.sidebarOpen });
        this.updateSidebarVisibility();
    }

    /**
     * Update sidebar visibility
     */
    updateSidebarVisibility() {
        if (this.state.sidebarOpen) {
            this.elements.sidebar.classList.add('open');
        } else {
            this.elements.sidebar.classList.remove('open');
        }
    }

    /**
     * Update file info display
     * @param {string} filePath - File path
     * @param {Object} fileData - File data
     */
    updateFileInfo(filePath, fileData) {
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        this.elements.currentFileName.textContent = fileName;
        
        // Update breadcrumb
        this.updateBreadcrumb(filePath);
    }

    /**
     * Update breadcrumb navigation
     * @param {string} filePath - Current file path
     */
    updateBreadcrumb(filePath) {
        if (!this.state.rootDirectory) return;

        const relativePath = filePath.replace(this.state.rootDirectory, '');
        const parts = relativePath.split('/').filter(part => part);
        
        let breadcrumbHtml = `<a href="#" data-path="${this.state.rootDirectory}">Root</a>`;
        
        let currentPath = this.state.rootDirectory;
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath += '/' + parts[i];
            breadcrumbHtml += ` / <a href="#" data-path="${currentPath}">${parts[i]}</a>`;
        }
        
        if (parts.length > 0) {
            breadcrumbHtml += ` / <span>${parts[parts.length - 1]}</span>`;
        }
        
        this.elements.breadcrumb.innerHTML = breadcrumbHtml;
        
        // Add click handlers to breadcrumb links
        this.elements.breadcrumb.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.dataset.path;
                // Could implement navigation to directory
            });
        });
    }

    /**
     * Update file count display
     */
    updateFileCount() {
        if (!this.state.directoryTree) {
            this.elements.fileCount.textContent = '0 files';
            return;
        }

        const fileCount = this.countFiles(this.state.directoryTree);
        this.elements.fileCount.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    }

    /**
     * Count files in directory tree
     * @param {Object} node - Directory tree node
     * @returns {number} File count
     */
    countFiles(node) {
        let count = 0;
        
        if (node.children) {
            for (const child of node.children) {
                if (child.type === 'file') {
                    count++;
                } else if (child.type === 'directory') {
                    count += this.countFiles(child);
                }
            }
        }
        
        return count;
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboard(event) {
        // Ctrl/Cmd + K: Focus search
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            this.elements.searchInput.focus();
        }
        
        // Ctrl/Cmd + B: Toggle sidebar
        if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
            event.preventDefault();
            this.handleSidebarToggle();
        }
        
        // Escape: Clear search or close sidebar on mobile
        if (event.key === 'Escape') {
            if (this.state.isSearchMode) {
                this.search.clear();
            } else if (window.innerWidth <= 768 && this.state.sidebarOpen) {
                this.handleSidebarToggle();
            }
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Close sidebar on mobile when switching to desktop
        if (window.innerWidth > 768 && !this.state.sidebarOpen) {
            this.updateState({ sidebarOpen: true });
            this.updateSidebarVisibility();
        }
    }
}

// Export MarkViewerApp class globally
window.MarkViewerApp = MarkViewerApp;

// Initialize application when page loads
// Note: This will be called from index.html after all dependencies are loaded
// window.app = new MarkViewerApp();
