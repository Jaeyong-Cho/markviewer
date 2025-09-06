/**
 * Tab Manager Component
 * Manages tab creation, switching, closing, and state persistence
 */

/**
 * Tab Manager Component
 * Manages tab creation, switching, closing, and state persistence
 */

class TabManager {
    constructor() {
        // Initialize EventEmitter using composition instead of inheritance
        this.eventEmitter = new Utils.EventEmitter();
        
        // Delegate event methods to the EventEmitter instance
        this.on = this.eventEmitter.on.bind(this.eventEmitter);
        this.emit = this.eventEmitter.emit.bind(this.eventEmitter);
        this.off = this.eventEmitter.off.bind(this.eventEmitter);
        
        // Tab state
        this.tabs = new Map(); // Map of tabId -> tab data
        this.activeTabId = null;
        this.recentlyUsed = []; // Most recently used tab order
        this.nextTabId = 1;
        
        // DOM elements
        this.container = null;
        this.tabBar = null;
        
        // Storage key for persistence
        this.storageKey = 'markviewer-tabs';
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        console.log('TabManager: Constructor completed');
    }
    
    /**
     * Initialize the tab manager
     * @param {HTMLElement} container - Container element for tabs
     */
    init(container) {
        this.container = container;
        this.createTabBar();
        this.loadState();
        this.setupEventListeners();
        console.log('TabManager: Initialized');
    }
    
    /**
     * Create the tab bar structure
     */
    createTabBar() {
        // Create tab bar container
        this.tabBar = document.createElement('div');
        this.tabBar.className = 'tab-bar';
        this.tabBar.style.display = 'none'; // Hidden by default
        
        // Create tab container
        this.tabContainer = document.createElement('div');
        this.tabContainer.className = 'tab-container';
        
        this.tabBar.appendChild(this.tabContainer);
        this.container.insertBefore(this.tabBar, this.container.firstChild);
        
        console.log('TabManager: Tab bar created');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Tab container click delegation
        this.tabContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.tab');
            if (!tab) return;
            
            const tabId = tab.dataset.tabId;
            
            if (e.target.classList.contains('tab-close')) {
                this.closeTab(tabId);
            } else {
                this.activateTab(tabId);
            }
        });
        
        // Middle click to close tabs
        this.tabContainer.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                const tab = e.target.closest('.tab');
                if (tab) {
                    this.closeTab(tab.dataset.tabId);
                }
            }
        });
        
        console.log('TabManager: Event listeners setup');
    }
    
    /**
     * Open a file in a new tab or switch to existing tab
     * @param {string} filePath - Path of the file to open
     * @param {string} title - Display title for the tab
     * @returns {string} Tab ID
     */
    openFile(filePath, title = null) {
        // Check if file is already open in a tab
        const existingTab = this.findTabByPath(filePath);
        if (existingTab) {
            this.activateTab(existingTab.id);
            return existingTab.id;
        }
        
        // Create new tab
        const tabId = this.generateTabId();
        const displayTitle = title || this.getFileNameFromPath(filePath);
        
        const tabData = {
            id: tabId,
            filePath: filePath,
            title: displayTitle,
            isModified: false,
            lastAccessed: Date.now(),
            content: null // Will be loaded on demand
        };
        
        this.tabs.set(tabId, tabData);
        this.addToRecentlyUsed(tabId);
        this.createTabElement(tabData);
        this.activateTab(tabId);
        this.updateTabBarVisibility();
        this.saveState();
        
        // Emit event for app to handle content loading
        this.emit('tabOpened', tabData);
        
        console.log('TabManager: Opened file in tab', filePath, tabId);
        return tabId;
    }
    
    /**
     * Close a tab
     * @param {string} tabId - ID of tab to close
     */
    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        // Remove from DOM
        const tabElement = this.tabContainer.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.remove();
        }
        
        // Remove from state
        this.tabs.delete(tabId);
        this.removeFromRecentlyUsed(tabId);
        
        // If this was the active tab, switch to most recent
        if (this.activeTabId === tabId) {
            const nextTabId = this.recentlyUsed[0] || null;
            this.activeTabId = null;
            
            if (nextTabId) {
                this.activateTab(nextTabId);
            } else {
                // No tabs left, show welcome content
                this.emit('noTabsOpen');
            }
        }
        
        this.updateTabBarVisibility();
        this.saveState();
        
        this.emit('tabClosed', tab);
        console.log('TabManager: Closed tab', tabId);
    }
    
    /**
     * Activate a tab
     * @param {string} tabId - ID of tab to activate
     */
    activateTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        // Update active state
        const previousTabId = this.activeTabId;
        this.activeTabId = tabId;
        
        // Update tab access time and recently used order
        tab.lastAccessed = Date.now();
        this.addToRecentlyUsed(tabId);
        
        // Update visual state
        this.updateTabActiveStates();
        this.saveState();
        
        // Emit event for content loading
        this.emit('tabActivated', tab, previousTabId);
        
        console.log('TabManager: Activated tab', tabId);
    }
    
    /**
     * Get active tab data
     * @returns {Object|null} Active tab data
     */
    getActiveTab() {
        return this.activeTabId ? this.tabs.get(this.activeTabId) : null;
    }
    
    /**
     * Get all tabs
     * @returns {Array} Array of tab data
     */
    getAllTabs() {
        return Array.from(this.tabs.values());
    }
    
    /**
     * Mark a tab as modified
     * @param {string} tabId - ID of tab to mark
     * @param {boolean} isModified - Modified state
     */
    setTabModified(tabId, isModified) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        tab.isModified = isModified;
        this.updateTabModifiedState(tabId);
        this.saveState();
    }
    
    /**
     * Set tab content for caching
     * @param {string} tabId - Tab ID
     * @param {string} content - Content to cache
     */
    setTabContent(tabId, content) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.content = content;
        }
    }
    
    /**
     * Get tab content from cache
     * @param {string} tabId - Tab ID
     * @returns {string|null} Cached content
     */
    getTabContent(tabId) {
        const tab = this.tabs.get(tabId);
        return tab ? tab.content : null;
    }
    
    /**
     * Find tab by file path
     * @param {string} filePath - File path to search for
     * @returns {Object|null} Tab data if found
     */
    findTabByPath(filePath) {
        for (const tab of this.tabs.values()) {
            if (tab.filePath === filePath) {
                return tab;
            }
        }
        return null;
    }
    
    /**
     * Create DOM element for a tab
     * @param {Object} tabData - Tab data
     */
    createTabElement(tabData) {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabData.id;
        tabElement.draggable = true;
        
        tabElement.innerHTML = `
            <span class="tab-title">${Utils.escapeHtml(tabData.title)}</span>
            <span class="tab-modified" ${tabData.isModified ? '' : 'style="display: none;"'}>●</span>
            <button class="tab-close" aria-label="Close tab">×</button>
        `;
        
        this.tabContainer.appendChild(tabElement);
    }
    
    /**
     * Update visual active states for all tabs
     */
    updateTabActiveStates() {
        this.tabContainer.querySelectorAll('.tab').forEach(tabElement => {
            const isActive = tabElement.dataset.tabId === this.activeTabId;
            tabElement.classList.toggle('active', isActive);
        });
    }
    
    /**
     * Update modified state for a specific tab
     * @param {string} tabId - Tab ID
     */
    updateTabModifiedState(tabId) {
        const tabElement = this.tabContainer.querySelector(`[data-tab-id="${tabId}"]`);
        if (!tabElement) return;
        
        const tab = this.tabs.get(tabId);
        const modifiedIndicator = tabElement.querySelector('.tab-modified');
        
        if (tab && modifiedIndicator) {
            modifiedIndicator.style.display = tab.isModified ? 'inline' : 'none';
        }
    }
    
    /**
     * Update tab bar visibility based on number of tabs
     */
    updateTabBarVisibility() {
        const hasActiveTabs = this.tabs.size > 0;
        this.tabBar.style.display = hasActiveTabs ? 'flex' : 'none';
    }
    
    /**
     * Generate unique tab ID
     * @returns {string} New tab ID
     */
    generateTabId() {
        return `tab-${this.nextTabId++}`;
    }
    
    /**
     * Extract filename from file path
     * @param {string} filePath - Full file path
     * @returns {string} Filename
     */
    getFileNameFromPath(filePath) {
        return filePath.substring(filePath.lastIndexOf('/') + 1);
    }
    
    /**
     * Add tab to recently used list
     * @param {string} tabId - Tab ID
     */
    addToRecentlyUsed(tabId) {
        // Remove if already in list
        this.recentlyUsed = this.recentlyUsed.filter(id => id !== tabId);
        // Add to front
        this.recentlyUsed.unshift(tabId);
        // Keep only last 10
        this.recentlyUsed = this.recentlyUsed.slice(0, 10);
    }
    
    /**
     * Remove tab from recently used list
     * @param {string} tabId - Tab ID
     */
    removeFromRecentlyUsed(tabId) {
        this.recentlyUsed = this.recentlyUsed.filter(id => id !== tabId);
    }
    
    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            const state = {
                tabs: Array.from(this.tabs.entries()).map(([id, tab]) => ({
                    id: tab.id,
                    filePath: tab.filePath,
                    title: tab.title,
                    isModified: tab.isModified,
                    lastAccessed: tab.lastAccessed
                    // Don't save content to avoid localStorage size issues
                })),
                activeTabId: this.activeTabId,
                recentlyUsed: this.recentlyUsed,
                nextTabId: this.nextTabId
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (error) {
            console.warn('TabManager: Failed to save state to localStorage:', error);
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
            
            // Restore basic state
            this.nextTabId = state.nextTabId || 1;
            this.recentlyUsed = state.recentlyUsed || [];
            
            // Restore tabs (but don't automatically open them)
            // This will be handled by the app when it initializes
            this.restoredTabsState = state.tabs || [];
            this.restoredActiveTabId = state.activeTabId;
            
        } catch (error) {
            console.warn('TabManager: Failed to load state from localStorage:', error);
        }
    }
    
    /**
     * Get restored tabs state (for app initialization)
     * @returns {Array} Array of tab data to restore
     */
    getRestoredTabs() {
        return this.restoredTabsState || [];
    }
    
    /**
     * Get restored active tab ID
     * @returns {string|null} Active tab ID to restore
     */
    getRestoredActiveTabId() {
        return this.restoredActiveTabId || null;
    }
    
    /**
     * Clear all tabs
     */
    clearAllTabs() {
        const tabIds = Array.from(this.tabs.keys());
        tabIds.forEach(tabId => this.closeTab(tabId));
    }
    
    /**
     * Handle tab click events
     * @param {Event} e - Click event
     */
    handleTabClick(e) {
        e.preventDefault();
        const tabId = e.currentTarget.dataset.tabId;
        this.activateTab(tabId);
    }
    
    /**
     * Handle tab close button clicks
     * @param {Event} e - Click event
     */
    handleTabClose(e) {
        e.preventDefault();
        e.stopPropagation();
        const tabId = e.currentTarget.closest('.tab').dataset.tabId;
        this.closeTab(tabId);
    }
    
    /**
     * Handle tab middle click (for closing)
     * @param {Event} e - Mouse event
     */
    handleTabMiddleClick(e) {
        if (e.button === 1) { // Middle mouse button
            e.preventDefault();
            const tabId = e.currentTarget.dataset.tabId;
            this.closeTab(tabId);
        }
    }
    
    /**
     * Setup keyboard shortcuts for tab management
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+W: Close current tab
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                if (this.activeTabId) {
                    this.closeTab(this.activeTabId);
                }
            }
            
            // Ctrl+Tab: Switch to next tab
            if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                this.switchToNextTab();
            }
            
            // Ctrl+Shift+Tab: Switch to previous tab
            if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                this.switchToPreviousTab();
            }
            
            // Ctrl+1-9: Switch to tab by number
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const tabIndex = parseInt(e.key) - 1;
                const tabIds = Array.from(this.tabs.keys());
                if (tabIds[tabIndex]) {
                    this.activateTab(tabIds[tabIndex]);
                }
            }
        });
    }
    
    /**
     * Switch to next tab in order
     */
    switchToNextTab() {
        const tabIds = Array.from(this.tabs.keys());
        if (tabIds.length <= 1) return;
        
        const currentIndex = tabIds.indexOf(this.activeTabId);
        const nextIndex = (currentIndex + 1) % tabIds.length;
        this.activateTab(tabIds[nextIndex]);
    }
    
    /**
     * Switch to previous tab in order
     */
    switchToPreviousTab() {
        const tabIds = Array.from(this.tabs.keys());
        if (tabIds.length <= 1) return;
        
        const currentIndex = tabIds.indexOf(this.activeTabId);
        const prevIndex = currentIndex === 0 ? tabIds.length - 1 : currentIndex - 1;
        this.activateTab(tabIds[prevIndex]);
    }
}

// Export TabManager class globally
window.TabManager = TabManager;
