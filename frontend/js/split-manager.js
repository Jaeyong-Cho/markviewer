/**
 * Split Manager Component
 * Manages split screen functionality for side-by-side file viewing
 */

class SplitManager {
    constructor(app) {
        // Initialize event system using composition instead of inheritance
        this.events = {};
        
        // Add EventEmitter methods
        this.on = function(event, handler) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(handler);
        };
        
        this.emit = function(event, ...args) {
            if (this.events[event]) {
                this.events[event].forEach(handler => {
                    try {
                        handler(...args);
                    } catch (error) {
                        console.error(`Error in event handler for '${event}':`, error);
                    }
                });
            }
        };
        
        this.off = function(event, handler) {
            if (this.events[event]) {
                this.events[event] = this.events[event].filter(h => h !== handler);
            }
        };
        
        this.app = app; // Reference to main app
        this.isSplitMode = false;
        
        // Active pane tracking
        this.activePane = 'left'; // 'left' or 'right'
        
        // Split panes
        this.leftPane = null;
        this.rightPane = null;
        this.splitResizer = null;
        
        // Tab managers for each pane
        this.leftTabManager = null;
        this.rightTabManager = null;
        
        // Renderers for each pane
        this.leftRenderer = null;
        this.rightRenderer = null;
        
        // Pane sizing
        this.leftPaneWidth = 50; // Percentage
        
        // Storage key for persistence
        this.storageKey = 'markviewer-split';
        
        // DOM elements
        this.contentArea = null;
        this.originalMainContent = null;
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.handleResizerDrag = this.handleResizerDrag.bind(this);
    }
    
    /**
     * Initialize the split manager
     * @param {HTMLElement} contentArea - Content area element
     */
    init(contentArea) {
        this.contentArea = contentArea;
        this.originalMainContent = contentArea.querySelector('#main-content');
        
        // Load saved state
        this.loadState();
        
        console.log('SplitManager: Initialized');
    }
    
    /**
     * Toggle split screen mode
     */
    toggleSplitMode() {
        if (this.isSplitMode) {
            this.exitSplitMode();
        } else {
            this.enterSplitMode();
        }
    }
    
    /**
     * Enter split screen mode
     */
    enterSplitMode() {
        if (this.isSplitMode) return;
        
        console.log('SplitManager: Entering split mode');
        
        // Create split layout
        this.createSplitLayout();
        
        // Set split mode state
        this.isSplitMode = true;
        this.contentArea.classList.add('split-mode');
        
        // Initialize tab managers for each pane
        this.initializePaneTabManagers();
        
        // Initialize renderers for each pane
        this.initializePaneRenderers();
        
        // Hide main ToC when in split mode
        this.hideMainToC();
        
        // Move current tab to left pane if exists
        const activeTab = this.app.tabManager.getActiveTab();
        if (activeTab) {
            this.leftTabManager.openFile(activeTab.filePath, activeTab.title);
            this.leftTabManager.activateTab(this.leftTabManager.getAllTabs()[0].id);
        }
        
        // Save state
        this.saveState();
        
        // Emit event
        this.emit('splitModeEntered');
        
        // Show notification
        Utils.showNotification('Split screen mode enabled', 'success', 2000);
    }
    
    /**
     * Exit split screen mode
     */
    exitSplitMode() {
        if (!this.isSplitMode) return;
        
        console.log('SplitManager: Exiting split mode');
        
        // Get active tab from left pane to preserve
        const leftActiveTab = this.leftTabManager ? this.leftTabManager.getActiveTab() : null;
        
        // Remove split layout
        this.removeSplitLayout();
        
        // Set split mode state
        this.isSplitMode = false;
        this.contentArea.classList.remove('split-mode');
        
        // Restore original tab manager
        if (leftActiveTab) {
            this.app.tabManager.openFile(leftActiveTab.filePath, leftActiveTab.title);
        }
        
        // Clean up pane tab managers
        this.cleanupPaneTabManagers();
        
        // Restore main ToC when exiting split mode
        this.showMainToC();
        
        // Save state
        this.saveState();
        
        // Emit event
        this.emit('splitModeExited');
        
        // Show notification
        Utils.showNotification('Split screen mode disabled', 'success', 2000);
    }
    
    /**
     * Create split layout DOM structure
     */
    createSplitLayout() {
        // Hide original main content and search results
        const searchResults = this.contentArea.querySelector('#search-results');
        const tabArea = this.contentArea.querySelector('#tab-area');
        
        if (this.originalMainContent) this.originalMainContent.style.display = 'none';
        if (searchResults) searchResults.style.display = 'none';
        if (tabArea) tabArea.style.display = 'none';
        
        // Create split container
        const splitContainer = document.createElement('div');
        splitContainer.className = 'split-container';
        splitContainer.innerHTML = `
            <div class="split-pane left-pane">
                <div class="pane-tab-area" id="left-tab-area">
                    <!-- Left pane tab bar will be created here -->
                </div>
                <div class="pane-content">
                    <div class="pane-main-content" id="left-main-content">
                        <div class="content-header">
                            <nav class="breadcrumb" id="left-breadcrumb">
                                <!-- Left breadcrumb will be populated here -->
                            </nav>
                            <div class="file-info">
                                <span id="left-current-file" class="current-file-name">No file selected</span>
                                <span id="left-file-modified" class="file-modified"></span>
                            </div>
                        </div>
                        <div class="content-body">
                            <article id="left-markdown-content" class="markdown-content">
                                <div class="welcome-content">
                                    <h2>Left Pane</h2>
                                    <p>Click here to activate this pane</p>
                                    <p>Then select a file from the sidebar to view it here</p>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="split-resizer" id="split-resizer">
                <div class="split-resizer-handle"></div>
            </div>
            
            <div class="split-pane right-pane">
                <div class="pane-tab-area" id="right-tab-area">
                    <!-- Right pane tab bar will be created here -->
                </div>
                <div class="pane-content">
                    <div class="pane-main-content" id="right-main-content">
                        <div class="content-header">
                            <nav class="breadcrumb" id="right-breadcrumb">
                                <!-- Right breadcrumb will be populated here -->
                            </nav>
                            <div class="file-info">
                                <span id="right-current-file" class="current-file-name">No file selected</span>
                                <span id="right-file-modified" class="file-modified"></span>
                            </div>
                        </div>
                        <div class="content-body">
                            <article id="right-markdown-content" class="markdown-content">
                                <div class="welcome-content">
                                    <h2>Right Pane</h2>
                                    <p>Click here to activate this pane</p>
                                    <p>Then select a file from the sidebar to view it here</p>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.contentArea.appendChild(splitContainer);
        
        // Store references to panes
        this.leftPane = splitContainer.querySelector('.left-pane');
        this.rightPane = splitContainer.querySelector('.right-pane');
        this.splitResizer = splitContainer.querySelector('.split-resizer');
        
        // Apply saved sizing
        this.applySizing();
        
        // Setup resizer
        this.setupResizer();
        
        // Setup pane click handlers for activation
        this.setupPaneActivation();
    }
    
    /**
     * Remove split layout and restore original
     */
    removeSplitLayout() {
        // Remove split container
        const splitContainer = this.contentArea.querySelector('.split-container');
        if (splitContainer) {
            splitContainer.remove();
        }
        
        // Restore original elements
        const searchResults = this.contentArea.querySelector('#search-results');
        const tabArea = this.contentArea.querySelector('#tab-area');
        
        if (this.originalMainContent) this.originalMainContent.style.display = '';
        if (searchResults) searchResults.style.display = '';
        if (tabArea) tabArea.style.display = '';
        
        // Clear pane references
        this.leftPane = null;
        this.rightPane = null;
        this.splitResizer = null;
    }
    
    /**
     * Initialize tab managers for split panes
     */
    initializePaneTabManagers() {
        // Create left pane tab manager
        const leftTabArea = this.leftPane.querySelector('#left-tab-area');
        this.leftTabManager = new TabManager();
        this.leftTabManager.init(leftTabArea);
        
        // Create right pane tab manager
        const rightTabArea = this.rightPane.querySelector('#right-tab-area');
        this.rightTabManager = new TabManager();
        this.rightTabManager.init(rightTabArea);
        
        // Setup event listeners for pane tab managers
        this.setupPaneTabEvents();
    }
    
    /**
     * Initialize renderers for split panes
     */
    initializePaneRenderers() {
        // Create left pane renderer with ToC disabled
        const leftMarkdownContent = this.leftPane.querySelector('#left-markdown-content');
        this.leftRenderer = new MarkdownRenderer(leftMarkdownContent, { disableToC: true });
        
        // Create right pane renderer with ToC disabled
        const rightMarkdownContent = this.rightPane.querySelector('#right-markdown-content');
        this.rightRenderer = new MarkdownRenderer(rightMarkdownContent, { disableToC: true });
        
        console.log('SplitManager: Pane renderers initialized with ToC disabled');
    }
    
    /**
     * Setup event listeners for pane tab managers
     */
    setupPaneTabEvents() {
        // Left pane events
        this.leftTabManager.on('tabOpened', (tab) => {
            this.handlePaneTabOpened('left', tab);
        });
        
        this.leftTabManager.on('tabActivated', (tab) => {
            this.handlePaneTabActivated('left', tab);
        });
        
        this.leftTabManager.on('tabClosed', (tab) => {
            this.handlePaneTabClosed('left', tab);
        });
        
        this.leftTabManager.on('noTabsOpen', () => {
            this.showPaneWelcome('left');
        });
        
        // Right pane events
        this.rightTabManager.on('tabOpened', (tab) => {
            this.handlePaneTabOpened('right', tab);
        });
        
        this.rightTabManager.on('tabActivated', (tab) => {
            this.handlePaneTabActivated('right', tab);
        });
        
        this.rightTabManager.on('tabClosed', (tab) => {
            this.handlePaneTabClosed('right', tab);
        });
        
        this.rightTabManager.on('noTabsOpen', () => {
            this.showPaneWelcome('right');
        });
    }
    
    /**
     * Handle tab opened in a pane
     * @param {string} pane - 'left' or 'right'
     * @param {Object} tab - Tab data
     */
    async handlePaneTabOpened(pane, tab) {
        console.log(`SplitManager: Tab opened in ${pane} pane:`, tab.filePath);
        
        // Load file content and render
        try {
            const fileData = await window.api.getFileContent(tab.filePath);
            
            // Use the pane's dedicated renderer
            const renderer = pane === 'left' ? this.leftRenderer : this.rightRenderer;
            
            // Render content
            await renderer.renderMarkdown(fileData.content);
            
            // Update file info
            this.updatePaneFileInfo(pane, tab.filePath, fileData);
            
            // Cache content in tab
            const tabManager = pane === 'left' ? this.leftTabManager : this.rightTabManager;
            tabManager.setTabContent(tab.id, fileData.content);
            
        } catch (error) {
            console.error(`Failed to load file in ${pane} pane:`, error);
            Utils.showNotification(`Failed to load file in ${pane} pane: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handle tab activated in a pane
     * @param {string} pane - 'left' or 'right'
     * @param {Object} tab - Tab data
     */
    async handlePaneTabActivated(pane, tab) {
        console.log(`SplitManager: Tab activated in ${pane} pane:`, tab.filePath);
        
        // Check if content is cached
        const tabManager = pane === 'left' ? this.leftTabManager : this.rightTabManager;
        const renderer = pane === 'left' ? this.leftRenderer : this.rightRenderer;
        const cachedContent = tabManager.getTabContent(tab.id);
        
        if (cachedContent) {
            // Use cached content with the pane's dedicated renderer
            await renderer.renderMarkdown(cachedContent);
            
            // Update file info
            this.updatePaneFileInfo(pane, tab.filePath, { content: cachedContent });
        } else {
            // Load fresh content
            await this.handlePaneTabOpened(pane, tab);
        }
    }
    
    /**
     * Handle tab closed in a pane
     * @param {string} pane - 'left' or 'right'
     * @param {Object} tab - Tab data
     */
    handlePaneTabClosed(pane, tab) {
        console.log(`SplitManager: Tab closed in ${pane} pane:`, tab.filePath);
    }
    
    /**
     * Show welcome content in a pane
     * @param {string} pane - 'left' or 'right'
     */
    showPaneWelcome(pane) {
        const contentElement = document.getElementById(`${pane}-markdown-content`);
        contentElement.innerHTML = `
            <div class="welcome-content">
                <h2>${pane.charAt(0).toUpperCase() + pane.slice(1)} Pane</h2>
                <p>Select a file to view in the ${pane} pane</p>
            </div>
        `;
        
        // Clear file info
        const fileNameElement = document.getElementById(`${pane}-current-file`);
        const fileModifiedElement = document.getElementById(`${pane}-file-modified`);
        
        if (fileNameElement) fileNameElement.textContent = 'No file selected';
        if (fileModifiedElement) fileModifiedElement.textContent = '';
    }
    
    /**
     * Update file info for a pane
     * @param {string} pane - 'left' or 'right'
     * @param {string} filePath - File path
     * @param {Object} fileData - File data
     */
    updatePaneFileInfo(pane, filePath, fileData) {
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        const fileNameElement = document.getElementById(`${pane}-current-file`);
        const fileModifiedElement = document.getElementById(`${pane}-file-modified`);
        
        if (fileNameElement) {
            fileNameElement.textContent = fileName;
        }
        
        if (fileModifiedElement && fileData.modified) {
            const modifiedDate = new Date(fileData.modified);
            fileModifiedElement.textContent = `Modified: ${modifiedDate.toLocaleDateString()}`;
        }
        
        // Update breadcrumb
        this.updatePaneBreadcrumb(pane, filePath);
    }
    
    /**
     * Update breadcrumb for a pane
     * @param {string} pane - 'left' or 'right'
     * @param {string} filePath - File path
     */
    updatePaneBreadcrumb(pane, filePath) {
        const breadcrumbElement = document.getElementById(`${pane}-breadcrumb`);
        if (!breadcrumbElement || !this.app.state.rootDirectory) return;
        
        const relativePath = filePath.replace(this.app.state.rootDirectory, '');
        const pathParts = relativePath.split('/').filter(part => part);
        
        breadcrumbElement.innerHTML = pathParts.map((part, index) => {
            return `<span class="breadcrumb-item">${Utils.escapeHtml(part)}</span>`;
        }).join('<span class="breadcrumb-separator">/</span>');
    }
    
    /**
     * Open file in specific pane
     * @param {string} pane - 'left' or 'right'
     * @param {string} filePath - File path
     * @param {string} title - Display title
     */
    openFileInPane(pane, filePath, title) {
        if (!this.isSplitMode) return;
        
        const tabManager = pane === 'left' ? this.leftTabManager : this.rightTabManager;
        if (tabManager) {
            tabManager.openFile(filePath, title);
        }
    }
    
    /**
     * Setup split resizer functionality
     */
    setupResizer() {
        if (!this.splitResizer) return;
        
        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;
        
        const handleMouseDown = (e) => {
            isResizing = true;
            startX = e.clientX;
            startLeftWidth = this.leftPaneWidth;
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        };
        
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const containerWidth = this.contentArea.clientWidth;
            const deltaX = e.clientX - startX;
            const deltaPercent = (deltaX / containerWidth) * 100;
            
            let newLeftWidth = startLeftWidth + deltaPercent;
            
            // Constrain between 20% and 80%
            newLeftWidth = Math.max(20, Math.min(80, newLeftWidth));
            
            this.leftPaneWidth = newLeftWidth;
            this.applySizing();
        };
        
        const handleMouseUp = () => {
            isResizing = false;
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            
            this.saveState();
        };
        
        this.splitResizer.addEventListener('mousedown', handleMouseDown);
    }
    
    /**
     * Apply sizing to split panes
     */
    applySizing() {
        if (!this.leftPane || !this.rightPane) return;
        
        const rightPaneWidth = 100 - this.leftPaneWidth;
        
        this.leftPane.style.width = `${this.leftPaneWidth}%`;
        this.rightPane.style.width = `${rightPaneWidth}%`;
    }
    
    /**
     * Clean up pane tab managers
     */
    cleanupPaneTabManagers() {
        if (this.leftTabManager) {
            this.leftTabManager.clearAllTabs();
            this.leftTabManager = null;
        }
        
        if (this.rightTabManager) {
            this.rightTabManager.clearAllTabs();
            this.rightTabManager = null;
        }
        
        // Clean up renderers
        if (this.leftRenderer) {
            this.leftRenderer = null;
        }
        
        if (this.rightRenderer) {
            this.rightRenderer = null;
        }
    }
    
    /**
     * Check if currently in split mode
     * @returns {boolean} Split mode status
     */
    isSplit() {
        return this.isSplitMode;
    }
    
    /**
     * Get active pane tab managers
     * @returns {Object} Object with left and right tab managers
     */
    getPaneTabManagers() {
        return {
            left: this.leftTabManager,
            right: this.rightTabManager
        };
    }
    
    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            const state = {
                isSplitMode: this.isSplitMode,
                leftPaneWidth: this.leftPaneWidth
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (error) {
            console.warn('SplitManager: Failed to save state to localStorage:', error);
        }
    }
    
    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return;
            
            const state = JSON.parse(stored);
            
            this.leftPaneWidth = state.leftPaneWidth || 50;
            // Don't automatically restore split mode - let user manually toggle
            
        } catch (error) {
            console.warn('SplitManager: Failed to load state from localStorage:', error);
        }
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        if (this.isSplitMode) {
            this.applySizing();
        }
    }
    
    /**
     * Handle resizer drag for split panes
     * @param {Event} e - Mouse event
     */
    handleResizerDrag(e) {
        if (!this.isSplitMode || !this.splitResizer) return;
        
        e.preventDefault();
        
        const containerRect = this.contentArea.getBoundingClientRect();
        const relativeX = e.clientX - containerRect.left;
        const percentage = (relativeX / containerRect.width) * 100;
        
        // Constrain between 20% and 80%
        this.leftPaneWidth = Math.max(20, Math.min(80, percentage));
        this.applySizing();
    }
    
    /**
     * Setup pane activation click handlers
     */
    setupPaneActivation() {
        if (!this.leftPane || !this.rightPane) return;
        
        // Add click handlers to activate panes
        this.leftPane.addEventListener('click', () => {
            this.setActivePane('left');
        });
        
        this.rightPane.addEventListener('click', () => {
            this.setActivePane('right');
        });
        
        // Set initial active pane
        this.setActivePane(this.activePane);
    }
    
    /**
     * Set the active pane
     * @param {string} pane - 'left' or 'right'
     */
    setActivePane(pane) {
        if (pane !== 'left' && pane !== 'right') return;
        
        this.activePane = pane;
        
        // Update visual indicators
        this.leftPane.classList.toggle('active', pane === 'left');
        this.rightPane.classList.toggle('active', pane === 'right');
        
        console.log(`SplitManager: Active pane set to ${pane}`);
    }
    
    /**
     * Get the active pane
     * @returns {string} 'left' or 'right'
     */
    getActivePane() {
        return this.activePane;
    }
    
    /**
     * Hide main ToC when in split mode
     */
    hideMainToC() {
        const tocSidebar = document.getElementById('toc-sidebar');
        const tocShowBtn = document.getElementById('toc-show-btn');
        const tocHideBtn = document.getElementById('toc-hide-btn');
        const tocHoverTrigger = document.querySelector('.toc-hover-trigger');
        
        if (tocSidebar) tocSidebar.style.display = 'none';
        if (tocShowBtn) tocShowBtn.style.display = 'none';
        if (tocHideBtn) tocHideBtn.style.display = 'none';
        if (tocHoverTrigger) tocHoverTrigger.style.display = 'none';
    }
    
    /**
     * Show main ToC when exiting split mode
     */
    showMainToC() {
        const tocSidebar = document.getElementById('toc-sidebar');
        const tocShowBtn = document.getElementById('toc-show-btn');
        const tocHideBtn = document.getElementById('toc-hide-btn');
        const tocHoverTrigger = document.querySelector('.toc-hover-trigger');
        
        if (tocSidebar) tocSidebar.style.display = '';
        if (tocShowBtn) tocShowBtn.style.display = '';
        if (tocHideBtn) tocHideBtn.style.display = '';
        if (tocHoverTrigger) tocHoverTrigger.style.display = '';
    }
}

// Export SplitManager class globally
window.SplitManager = SplitManager;
