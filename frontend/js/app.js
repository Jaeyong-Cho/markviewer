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
            isLoading: false,
            splitMode: false
        };

        // Component instances
        this.sidebar = null;
        this.renderer = null;
        this.search = null;
        this.webSocket = null;
        this.workspaceRecommender = null;
        this.workspaceAutocomplete = null;
        this.tabManager = null;
        this.splitManager = null;

        // DOM elements
        this.elements = {};
        
        // Bind methods
        this.handleWorkspaceInput = this.handleWorkspaceInput.bind(this);
        this.handleFileSelect = this.handleFileSelect.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleSidebarToggle = this.handleSidebarToggle.bind(this);
        this.handleSidebarShow = this.handleSidebarShow.bind(this);
        this.handleSidebarHide = this.handleSidebarHide.bind(this);
        this.handleKeyboard = this.handleKeyboard.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleSplitToggle = this.handleSplitToggle.bind(this);

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

            // Setup component event listeners
            this.setupComponentEvents();

            // Setup DOM event listeners
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
            workspaceInput: document.getElementById('workspace-input'),
            currentWorkspacePath: document.getElementById('current-workspace'),
            sidebarToggle: document.getElementById('sidebar-toggle'),
            sidebar: document.getElementById('sidebar'),
            sidebarShowBtn: document.getElementById('sidebar-show-btn'),
            sidebarHideBtn: document.getElementById('sidebar-hide-btn'),
            searchInput: document.getElementById('search-input'),
            searchClear: document.getElementById('search-clear'),
            searchResults: document.getElementById('search-results'),
            mainContent: document.getElementById('main-content'),
            markdownContent: document.getElementById('markdown-content'),
            breadcrumb: document.getElementById('breadcrumb'),
            currentFileName: document.getElementById('current-file'),
            fileModified: document.getElementById('file-modified'),
            fileCount: document.getElementById('file-count'),
            tabArea: document.getElementById('tab-area'),
            splitToggle: document.getElementById('split-toggle'),
            contentArea: document.querySelector('.content-area')
        };

        // Verify all elements exist
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
        
        console.log('App: DOM elements cached successfully');
    }

    /**
     * Initialize component instances
     */
    async initializeComponents() {
        try {
            // Verify Utils is available before creating components
            if (typeof Utils === 'undefined' || !Utils.EventEmitter) {
                throw new Error('Utils.EventEmitter is required but not available');
            }
            
            // Initialize API service
            window.api = new window.API.ApiService();
            
            // Initialize TabManager
            this.tabManager = new TabManager();
            this.tabManager.init(this.elements.tabArea);
            console.log('App: TabManager initialized');
            
            // Initialize SplitManager (check if available)
            if (typeof SplitManager !== 'undefined') {
                this.splitManager = new SplitManager(this);
                this.splitManager.init(this.elements.contentArea);
                console.log('App: SplitManager initialized');
            } else {
                console.warn('SplitManager not available');
                this.splitManager = null;
            }
            
            // Initialize sidebar
            this.sidebar = new Sidebar(this.elements.sidebar);
            
            // Initialize search
            this.search = new SearchComponent();
            
            // Initialize markdown renderer
            this.renderer = new MarkdownRenderer(this.elements.markdownContent);
            
            // Initialize workspace recommender
            if (typeof WorkspaceRecommender !== 'undefined') {
                this.workspaceRecommender = new WorkspaceRecommender(this);
                this.workspaceRecommender.init();
                console.log('Workspace recommender initialized');
            } else {
                console.warn('WorkspaceRecommender not available');
            }
            
            // Initialize workspace autocomplete
            if (typeof WorkspaceAutocomplete !== 'undefined') {
                this.workspaceAutocomplete = new WorkspaceAutocomplete(this.elements.workspaceInput, this);
                console.log('Workspace autocomplete initialized');
            } else {
                console.warn('WorkspaceAutocomplete not available');
            }
            
            // Initialize WebSocket client (with error handling)
            try {
                this.webSocket = new WebSocketClient();
            } catch (error) {
                console.warn('WebSocket initialization failed, continuing without real-time updates:', error);
                this.webSocket = null;
            }
            
            console.log('All components initialized successfully');
        } catch (error) {
            console.error('Failed to initialize components:', error);
            throw error;
        }
    }

    /**
     * Setup event listeners for components
     */
    setupComponentEvents() {
        // TabManager events
        if (this.tabManager) {
            this.tabManager.on('tabOpened', (tabData) => {
                console.log('App: Tab opened', tabData.filePath);
                this.loadFileContent(tabData.filePath);
            });
            this.tabManager.on('tabActivated', (tabData, previousTabId) => {
                console.log('App: Tab activated', tabData.filePath);
                this.switchToTab(tabData);
            });
            this.tabManager.on('tabClosed', (tabData) => {
                console.log('App: Tab closed', tabData.filePath);
                // Clear content if no tabs are open
                const activeTab = this.tabManager.getActiveTab();
                if (!activeTab) {
                    this.showWelcomeContent();
                }
            });
            this.tabManager.on('noTabsOpen', () => {
                console.log('App: No tabs open, showing welcome');
                this.showWelcomeContent();
            });
        } else {
            console.error('App: TabManager not initialized, cannot setup events');
        }
        
        // TabManager events
        this.tabManager.on('tabOpened', (tab) => {
            console.log('App: Tab opened:', tab.filePath);
        });
        
        this.tabManager.on('tabActivated', (tab) => {
            this.handleTabActivated(tab);
        });
        
        this.tabManager.on('tabClosed', (tab) => {
            console.log('App: Tab closed:', tab.filePath);
        });
        
        this.tabManager.on('noTabsOpen', () => {
            this.showWelcomeContent();
        });
        
        // SplitManager events
        if (this.splitManager) {
            this.splitManager.on('splitModeEntered', () => {
                this.updateSplitToggleState();
            });
            
            this.splitManager.on('splitModeExited', () => {
                this.updateSplitToggleState();
            });
        } else {
            console.warn('App: SplitManager not initialized, split events disabled');
        }
        
        // Sidebar events
        if (this.sidebar) {
            this.sidebar.on('fileSelect', this.handleFileSelect.bind(this));
            this.sidebar.on('directoryLoad', (tree) => {
                this.updateState({ directoryTree: tree });
                this.updateFileCount();
            });
        } else {
            console.error('App: Sidebar not initialized, cannot setup events');
        }

        // Search events
        if (this.search) {
            this.search.on('searchResults', (results) => {
                this.updateState({ searchResults: results, isSearchMode: true });
                this.showSearchResults();
            });
            this.search.on('searchClear', () => {
                this.updateState({ searchResults: null, isSearchMode: false });
                this.hideSearchResults();
            });
            this.search.on('resultSelect', this.handleFileSelect.bind(this));
            this.search.on('openFile', this.handleFileSelect.bind(this));

            // Make search component globally accessible for inline event handlers
            window.searchComponent = this.search;
        } else {
            console.error('App: Search not initialized, cannot setup events');
        }

        // Renderer events
        if (this.renderer) {
            this.renderer.on('linkClick', this.handleInternalLink.bind(this));
        } else {
            console.error('App: Renderer not initialized, cannot setup events');
        }
        
        // WebSocket events for real-time file updates
        if (this.webSocket) {
            this.webSocket.on('fileChanged', this.handleFileChanged.bind(this));
            this.webSocket.on('fileAdded', this.handleFileAdded.bind(this));
            this.webSocket.on('fileRemoved', this.handleFileRemoved.bind(this));
            this.webSocket.on('directoryAdded', this.handleDirectoryAdded.bind(this));
            this.webSocket.on('directoryRemoved', this.handleDirectoryRemoved.bind(this));
        } else {
            console.warn('App: WebSocket not initialized, real-time updates disabled');
        }
    }

    /**
     * Setup DOM event listeners
     */
    setupEventListeners() {
        // Workspace directory input
        this.elements.workspaceInput.addEventListener('keydown', this.handleWorkspaceInput);

        // Sidebar toggle
        this.elements.sidebarToggle.addEventListener('click', this.handleSidebarToggle);
        
        // Split screen toggle
        this.elements.splitToggle.addEventListener('click', this.handleSplitToggle);
        
        // Sidebar edge toggle buttons
        if (this.elements.sidebarShowBtn) {
            this.elements.sidebarShowBtn.addEventListener('click', this.handleSidebarShow);
            this.elements.sidebarShowBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleSidebarShow();
                }
            });
        }
        
        if (this.elements.sidebarHideBtn) {
            this.elements.sidebarHideBtn.addEventListener('click', this.handleSidebarHide);
            this.elements.sidebarHideBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleSidebarHide();
                }
            });
        }

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
        
        // Set default directory if none is saved
        const defaultDirectory = savedState.rootDirectory || '/Users/jaeyong/workspace/markviewer/test-content';
        
        if (defaultDirectory) {
            this.updateState({ rootDirectory: defaultDirectory });
            this.elements.workspaceInput.value = defaultDirectory;
            this.elements.currentWorkspacePath.textContent = defaultDirectory;
            this.elements.currentWorkspacePath.classList.add('selected');
            
            // Load directory tree
            this.loadDirectoryTree(defaultDirectory);
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
            const currentPort = window.location.port || '80';
            Utils.showNotification(
                `Cannot connect to server. Please ensure the backend is running on port ${currentPort}.`,
                'error',
                0 // Persistent notification
            );
        }
    }

    /**
     * Handle workspace input (Enter key to set directory)
     */
    async handleWorkspaceInput(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const path = this.elements.workspaceInput.value.trim();
            
            if (!path) {
                Utils.showNotification('Please enter a directory path', 'warning');
                return;
            }

            try {
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
    }

    /**
     * Set the root directory
     * @param {string} path - Directory path
     */
    async setRootDirectory(path) {
        this.updateState({ rootDirectory: path });
        this.elements.workspaceInput.value = path;
        this.elements.currentWorkspacePath.textContent = path;
        this.elements.currentWorkspacePath.classList.add('selected');
        
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
     * Handle file selection (now opens in tabs)
     * @param {string} filePath - Selected file path
     */
    async handleFileSelect(filePath) {
        if (!filePath) return;

        try {
            // Check if in split mode
            if (this.splitManager.isSplit()) {
                // For now, always open in left pane
                // TODO: Add logic to determine which pane to use
                this.splitManager.openFileInPane('left', filePath);
            } else {
                // Open file in a tab (or switch to existing tab)
                const tabId = this.tabManager.openFile(filePath);
            }
            
            // Hide search results if in search mode
            if (this.state.isSearchMode) {
                this.hideSearchResults();
                this.updateState({ isSearchMode: false });
                this.search.clear();
            }
            
        } catch (error) {
            console.error('Failed to open file:', error);
            Utils.showNotification('Failed to open file: ' + error.message, 'error');
        }
    }
    
    /**
     * Handle tab activation (load content)
     * @param {Object} tab - Activated tab data
     */
    async handleTabActivated(tab) {
        if (!tab) return;
        
        try {
            // Check if content is cached
            const cachedContent = this.tabManager.getTabContent(tab.id);
            
            if (cachedContent) {
                // Use cached content
                await this.renderer.renderMarkdown(cachedContent);
                this.updateFileInfo(tab.filePath, { content: cachedContent });
            } else {
                // Load fresh content
                await this.loadFileContent(tab.filePath);
            }
            
            // Update sidebar selection
            this.sidebar.setActiveFile(tab.filePath);
            
        } catch (error) {
            console.error('Failed to load tab content:', error);
            Utils.showNotification('Failed to load content: ' + error.message, 'error');
        }
    }
    
    /**
     * Show welcome content when no tabs are open
     */
    showWelcomeContent() {
        this.elements.markdownContent.innerHTML = `
            <div class="welcome-content">
                <h1>Welcome to MarkViewer</h1>
                <p>A powerful markdown viewer with PlantUML, Mermaid, and search capabilities.</p>
                
                <h2>Features</h2>
                <ul>
                    <li>Render markdown with JavaScript</li>
                    <li>PlantUML diagrams using local plantuml.jar (SVG format)</li>
                    <li>Mermaid diagram rendering</li>
                    <li>Recursive directory sidebar navigation</li>
                    <li>Full-text search functionality</li>
                    <li>GitHub-style code highlighting</li>
                    <li><strong>Tabbed interface</strong> for multiple files</li>
                    <li><strong>Split screen</strong> for side-by-side viewing</li>
                </ul>
                
                <h2>Getting Started</h2>
                <ol>
                    <li>Enter a workspace directory path in the input field at the top of the sidebar</li>
                    <li>Press Enter to load the directory and browse files</li>
                    <li>Click on files to open them in tabs</li>
                    <li>Use the search box to find content across all files</li>
                    <li>View rendered markdown with diagrams and highlighted code</li>
                </ol>
                
                <h2>Tab Features</h2>
                <ul>
                    <li>Open multiple files in tabs</li>
                    <li>Click tabs to switch between files</li>
                    <li>Close tabs with the × button or middle-click</li>
                    <li>Keyboard shortcuts: Ctrl+W to close active tab</li>
                </ul>
                
                <h2>Split Screen</h2>
                <ul>
                    <li>Toggle split screen mode with Ctrl+Shift+\</li>
                    <li>Independent file browsing in each pane</li>
                    <li>Drag tabs between left and right panes (coming soon)</li>
                </ul>
                
                <div class="feature-demo">
                    <h3>Code Highlighting Example</h3>
                    <pre><code class="language-javascript">
// Example JavaScript code with syntax highlighting
function renderMarkdown(content) {
    const renderer = new marked.Renderer();
    return marked.parse(content, { renderer });
}
                    </code></pre>
                </div>
            </div>
        `;
        
        // Clear file info
        this.elements.currentFileName.textContent = 'Welcome';
        this.elements.fileModified.textContent = '';
        this.elements.breadcrumb.innerHTML = '';
        
        // Update state
        this.updateState({ currentFile: null });
    }
    
    /**
     * Load file content for a tab
     * @param {string} filePath - File path to load
     */
    async loadFileContent(filePath) {
        try {
            Utils.showLoading('Loading file...');
            
            const fileData = await window.api.getFileContent(filePath);
            
            // Update current file state
            this.updateState({ currentFile: filePath });
            
            // Cache content in tab
            const tab = this.tabManager.findTabByPath(filePath);
            if (tab) {
                this.tabManager.setTabContent(tab.id, fileData.content);
            }
            
            // Update UI
            this.updateFileInfo(filePath, fileData);
            
            // Render content
            await this.renderer.renderMarkdown(fileData.content);
            
            // Update sidebar selection
            this.sidebar.setActiveFile(filePath);
            
            Utils.hideLoading();
        } catch (error) {
            Utils.hideLoading();
            console.error('Failed to load file content:', error);
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
            Utils.showNotification('Please select a workspace directory first', 'error');
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
     * Handle sidebar show (from edge button)
     */
    handleSidebarShow() {
        this.updateState({ sidebarOpen: true });
        this.updateSidebarVisibility();
    }

    /**
     * Handle sidebar hide (from edge button)
     */
    handleSidebarHide() {
        this.updateState({ sidebarOpen: false });
        this.updateSidebarVisibility();
    }

    /**
     * Handle split screen toggle
     */
    handleSplitToggle() {
        if (this.splitManager) {
            this.splitManager.toggleSplitMode();
            this.updateSplitToggleState();
        } else {
            console.warn('Split functionality not available');
        }
    }

    /**
     * Toggle split screen mode (keyboard shortcut)
     */
    toggleSplitScreen() {
        this.handleSplitToggle();
    }

    /**
     * Update split toggle button state
     */
    updateSplitToggleState() {
        if (!this.splitManager) return;
        
        const isActive = this.splitManager.isSplit();
        this.elements.splitToggle.classList.toggle('active', isActive);
        this.updateState({ splitMode: isActive });
    }

    /**
     * Update sidebar visibility
     */
    updateSidebarVisibility() {
        if (this.state.sidebarOpen) {
            this.elements.sidebar.classList.add('open');
            this.elements.sidebar.classList.remove('collapsed');
        } else {
            this.elements.sidebar.classList.remove('open');
            this.elements.sidebar.classList.add('collapsed');
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
        
        // Ctrl/Cmd + W: Close active tab
        if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
            event.preventDefault();
            const activeTab = this.tabManager.getActiveTab();
            if (activeTab) {
                this.tabManager.closeTab(activeTab.id);
            }
        }
        
        // Ctrl/Cmd + Shift + \: Toggle split screen
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === '\\') {
            event.preventDefault();
            this.toggleSplitScreen();
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

    /**
     * Handle real-time file change events
     * @param {Object} fileData - Updated file data
     */
    async handleFileChanged(fileData) {
        // If the changed file is currently being viewed, reload it
        if (this.state.currentFile === fileData.path) {
            console.log('Current file changed, reloading content...');
            
            try {
                // Update UI with new content
                await this.renderer.renderMarkdown(fileData.content);
                
                // Update file info
                this.updateFileInfo(fileData.path, fileData);
                
                // Show subtle indication that file was updated
                Utils.showNotification('File updated automatically', 'success', 2000);
            } catch (error) {
                console.error('Failed to reload changed file:', error);
                Utils.showNotification('Failed to reload file changes', 'error');
            }
        }
        
        // Clear cache for this file to ensure fresh data on next load
        if (window.api && window.api.clearCache) {
            window.api.clearCache(fileData.path);
        }
    }

    /**
     * Handle file added events
     * @param {string} filePath - Path of added file
     */
    handleFileAdded(filePath) {
        console.log('File added:', filePath);
        
        // Refresh directory tree if we have a root directory
        if (this.state.rootDirectory) {
            this.refreshDirectoryTree();
        }
    }

    /**
     * Handle file removed events
     * @param {string} filePath - Path of removed file
     */
    handleFileRemoved(filePath) {
        console.log('File removed:', filePath);
        
        // If the removed file is currently being viewed, show error message
        if (this.state.currentFile === filePath) {
            this.elements.markdownContent.innerHTML = `
                <div class="error-message">
                    <h2>File Not Found</h2>
                    <p>The file "${filePath.split('/').pop()}" has been deleted.</p>
                    <p>Please select another file from the sidebar.</p>
                </div>
            `;
            
            Utils.showNotification('Current file was deleted', 'warning');
        }
        
        // Refresh directory tree
        if (this.state.rootDirectory) {
            this.refreshDirectoryTree();
        }
        
        // Clear cache for this file
        if (window.api && window.api.clearCache) {
            window.api.clearCache(filePath);
        }
    }

    /**
     * Handle directory added events
     * @param {string} dirPath - Path of added directory
     */
    handleDirectoryAdded(dirPath) {
        console.log('Directory added:', dirPath);
        
        // Refresh directory tree
        if (this.state.rootDirectory) {
            this.refreshDirectoryTree();
        }
    }

    /**
     * Handle directory removed events
     * @param {string} dirPath - Path of removed directory
     */
    handleDirectoryRemoved(dirPath) {
        console.log('Directory removed:', dirPath);
        
        // Check if current file was in the removed directory
        if (this.state.currentFile && this.state.currentFile.startsWith(dirPath)) {
            this.elements.markdownContent.innerHTML = `
                <div class="error-message">
                    <h2>Directory Not Found</h2>
                    <p>The directory containing the current file has been deleted.</p>
                    <p>Please select another file from the sidebar.</p>
                </div>
            `;
            
            Utils.showNotification('Current directory was deleted', 'warning');
        }
        
        // Refresh directory tree
        if (this.state.rootDirectory) {
            this.refreshDirectoryTree();
        }
    }

    /**
     * Refresh the directory tree
     */
    async refreshDirectoryTree() {
        try {
            const tree = await window.api.getDirectoryTree(this.state.rootDirectory);
            this.sidebar.loadTree(tree);
            this.updateState({ directoryTree: tree });
            this.updateFileCount();
        } catch (error) {
            console.error('Failed to refresh directory tree:', error);
        }
    }

    /**
     * Get WebSocket connection status
     * @returns {Object} Connection status information
     */
    getWebSocketStatus() {
        if (!this.webSocket) {
            return { connected: false, error: 'WebSocket not initialized' };
        }
        
        return this.webSocket.getConnectionInfo();
    }
}

// Export MarkViewerApp class globally
window.MarkViewerApp = MarkViewerApp;

// Initialize application when page loads
// Note: This will be called from index.html after all dependencies are loaded
// window.app = new MarkViewerApp();
