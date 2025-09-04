/**
 * Sidebar component for directory tree navigation
 * Handles file/folder display and selection
 */

class Sidebar extends Utils.EventEmitter {
    constructor(container, app) {
        super();
        this.container = container;
        this.app = app;
        this.treeContainer = container.querySelector('#directory-tree');
        this.expandedDirectories = new Set();
        this.activeFile = null;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for the sidebar
     */
    setupEventListeners() {
        // Handle clicks on tree items
        this.treeContainer.addEventListener('click', (event) => {
            this.handleTreeClick(event);
        });

        // Handle keyboard navigation
        this.treeContainer.addEventListener('keydown', (event) => {
            this.handleKeyNavigation(event);
        });
    }

    /**
     * Load and display directory tree
     * @param {Object} tree - Directory tree data
     */
    loadTree(tree) {
        this.treeContainer.innerHTML = '';
        
        if (!tree || !tree.children || tree.children.length === 0) {
            this.showEmptyState();
            return;
        }

        const treeElement = this.createTreeElement(tree);
        this.treeContainer.appendChild(treeElement);
        
        this.emit('directoryLoad', tree);
    }

    /**
     * Show empty state when no files are found
     */
    showEmptyState() {
        this.treeContainer.innerHTML = `
            <div class="tree-placeholder">
                <p>No markdown files found in this directory</p>
            </div>
        `;
    }

    /**
     * Create tree element from tree data
     * @param {Object} node - Tree node data
     * @param {number} level - Nesting level
     * @returns {HTMLElement} Tree element
     */
    createTreeElement(node, level = 0) {
        const ul = document.createElement('ul');
        ul.className = 'tree-node';
        ul.setAttribute('role', 'tree');

        if (node.children && node.children.length > 0) {
            // Sort children: directories first, then files
            const sortedChildren = [...node.children].sort((a, b) => {
                if (a.type === 'directory' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
            });

            for (const child of sortedChildren) {
                const li = this.createTreeItem(child, level);
                ul.appendChild(li);
            }
        }

        return ul;
    }

    /**
     * Create a single tree item
     * @param {Object} node - Tree node data
     * @param {number} level - Nesting level
     * @returns {HTMLElement} Tree item element
     */
    createTreeItem(node, level) {
        const li = document.createElement('li');
        li.className = 'tree-item';
        li.setAttribute('data-path', node.path);
        li.setAttribute('data-type', node.type);
        
        if (node.type === 'file') {
            const extension = Utils.getFileExtension(node.name);
            li.setAttribute('data-extension', extension);
        }

        // Create item content container
        const itemContent = document.createElement('div');
        itemContent.className = 'tree-item-content';
        itemContent.setAttribute('tabindex', '0');
        itemContent.setAttribute('role', 'treeitem');
        itemContent.style.paddingLeft = `${level * 12 + 8}px`;

        // Add expand/collapse button for directories
        if (node.type === 'directory' && node.children && node.children.length > 0) {
            const expandBtn = document.createElement('button');
            expandBtn.className = 'tree-expand-btn';
            expandBtn.innerHTML = '▶';
            expandBtn.setAttribute('aria-label', `Expand ${node.name}`);
            itemContent.appendChild(expandBtn);
        } else {
            // Add spacer for files to align with expandable items
            const spacer = document.createElement('span');
            spacer.className = 'tree-expand-btn';
            itemContent.appendChild(spacer);
        }

        // Add icon
        const icon = document.createElement('span');
        icon.className = `tree-item-icon ${node.type}`;
        itemContent.appendChild(icon);

        // Add text
        const text = document.createElement('span');
        text.className = 'tree-item-text';
        text.textContent = node.name;
        text.title = node.path; // Tooltip with full path
        itemContent.appendChild(text);

        li.appendChild(itemContent);

        // Add children for directories
        if (node.type === 'directory' && node.children && node.children.length > 0) {
            const childrenContainer = this.createTreeElement(node, level + 1);
            childrenContainer.className += ' tree-children collapsed';
            li.appendChild(childrenContainer);
        }

        return li;
    }

    /**
     * Handle clicks on tree items
     * @param {Event} event - Click event
     */
    handleTreeClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        const itemContent = target.closest('.tree-item-content');
        const treeItem = target.closest('.tree-item');
        
        if (!itemContent || !treeItem) return;

        const path = treeItem.dataset.path;
        const type = treeItem.dataset.type;

        // Handle expand/collapse button clicks
        if (target.classList.contains('tree-expand-btn')) {
            this.toggleDirectory(treeItem);
            return;
        }

        // Handle item selection
        if (type === 'file') {
            this.selectFile(path, itemContent);
        } else if (type === 'directory') {
            this.toggleDirectory(treeItem);
        }
    }

    /**
     * Handle keyboard navigation in tree
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyNavigation(event) {
        const focused = document.activeElement;
        const treeItem = focused.closest('.tree-item');
        
        if (!treeItem) return;

        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.handleTreeClick({ target: focused, preventDefault: () => {}, stopPropagation: () => {} });
                break;
                
            case 'ArrowRight':
                event.preventDefault();
                this.expandDirectory(treeItem);
                break;
                
            case 'ArrowLeft':
                event.preventDefault();
                this.collapseDirectory(treeItem);
                break;
                
            case 'ArrowDown':
                event.preventDefault();
                this.focusNext(treeItem);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.focusPrevious(treeItem);
                break;
        }
    }

    /**
     * Toggle directory expanded/collapsed state
     * @param {HTMLElement} treeItem - Tree item element
     */
    toggleDirectory(treeItem) {
        const path = treeItem.dataset.path;
        const childrenContainer = treeItem.querySelector('.tree-children');
        const expandBtn = treeItem.querySelector('.tree-expand-btn');
        const icon = treeItem.querySelector('.tree-item-icon');
        
        if (!childrenContainer || !expandBtn) return;

        const isExpanded = !childrenContainer.classList.contains('collapsed');
        
        if (isExpanded) {
            this.collapseDirectory(treeItem);
        } else {
            this.expandDirectory(treeItem);
        }
    }

    /**
     * Expand a directory
     * @param {HTMLElement} treeItem - Tree item element
     */
    expandDirectory(treeItem) {
        const path = treeItem.dataset.path;
        const childrenContainer = treeItem.querySelector('.tree-children');
        const expandBtn = treeItem.querySelector('.tree-expand-btn');
        const icon = treeItem.querySelector('.tree-item-icon');
        
        if (!childrenContainer || !expandBtn) return;

        childrenContainer.classList.remove('collapsed');
        expandBtn.classList.add('expanded');
        expandBtn.innerHTML = '▼';
        expandBtn.setAttribute('aria-label', `Collapse ${treeItem.querySelector('.tree-item-text').textContent}`);
        
        if (icon) {
            icon.classList.add('open');
        }
        
        this.expandedDirectories.add(path);
    }

    /**
     * Collapse a directory
     * @param {HTMLElement} treeItem - Tree item element
     */
    collapseDirectory(treeItem) {
        const path = treeItem.dataset.path;
        const childrenContainer = treeItem.querySelector('.tree-children');
        const expandBtn = treeItem.querySelector('.tree-expand-btn');
        const icon = treeItem.querySelector('.tree-item-icon');
        
        if (!childrenContainer || !expandBtn) return;

        childrenContainer.classList.add('collapsed');
        expandBtn.classList.remove('expanded');
        expandBtn.innerHTML = '▶';
        expandBtn.setAttribute('aria-label', `Expand ${treeItem.querySelector('.tree-item-text').textContent}`);
        
        if (icon) {
            icon.classList.remove('open');
        }
        
        this.expandedDirectories.delete(path);
    }

    /**
     * Select a file and emit event
     * @param {string} filePath - File path
     * @param {HTMLElement} itemContent - Item content element
     */
    selectFile(filePath, itemContent) {
        // Remove previous selection
        const previousSelection = this.treeContainer.querySelector('.tree-item-content.active');
        if (previousSelection) {
            previousSelection.classList.remove('active');
        }

        // Add selection to new item
        itemContent.classList.add('active');
        this.activeFile = filePath;

        // Ensure item is visible
        Utils.scrollToElement(itemContent);

        // Emit file selection event
        this.emit('fileSelect', filePath);
    }

    /**
     * Set active file (used when file is selected from other components)
     * @param {string} filePath - File path
     */
    setActiveFile(filePath) {
        // Remove previous selection
        const previousSelection = this.treeContainer.querySelector('.tree-item-content.active');
        if (previousSelection) {
            previousSelection.classList.remove('active');
        }

        // Find and select new file
        const fileItem = this.treeContainer.querySelector(`[data-path="${filePath}"]`);
        if (fileItem) {
            const itemContent = fileItem.querySelector('.tree-item-content');
            if (itemContent) {
                itemContent.classList.add('active');
                this.activeFile = filePath;
                
                // Expand parent directories if needed
                this.expandParentDirectories(fileItem);
                
                // Scroll to item
                Utils.scrollToElement(itemContent);
            }
        }
    }

    /**
     * Expand parent directories to make file visible
     * @param {HTMLElement} fileItem - File item element
     */
    expandParentDirectories(fileItem) {
        let parent = fileItem.parentElement;
        
        while (parent && parent !== this.treeContainer) {
            if (parent.classList.contains('tree-children')) {
                parent.classList.remove('collapsed');
                
                // Find the corresponding tree item and update its expand button
                const parentTreeItem = parent.previousElementSibling;
                if (parentTreeItem && parentTreeItem.classList.contains('tree-item-content')) {
                    const expandBtn = parentTreeItem.querySelector('.tree-expand-btn');
                    const icon = parentTreeItem.querySelector('.tree-item-icon');
                    
                    if (expandBtn) {
                        expandBtn.classList.add('expanded');
                        expandBtn.innerHTML = '▼';
                    }
                    
                    if (icon) {
                        icon.classList.add('open');
                    }
                }
            }
            parent = parent.parentElement;
        }
    }

    /**
     * Focus next tree item
     * @param {HTMLElement} currentItem - Current tree item
     */
    focusNext(currentItem) {
        const allItems = Array.from(this.treeContainer.querySelectorAll('.tree-item-content'));
        const currentIndex = allItems.indexOf(currentItem.querySelector('.tree-item-content'));
        
        if (currentIndex < allItems.length - 1) {
            allItems[currentIndex + 1].focus();
        }
    }

    /**
     * Focus previous tree item
     * @param {HTMLElement} currentItem - Current tree item
     */
    focusPrevious(currentItem) {
        const allItems = Array.from(this.treeContainer.querySelectorAll('.tree-item-content'));
        const currentIndex = allItems.indexOf(currentItem.querySelector('.tree-item-content'));
        
        if (currentIndex > 0) {
            allItems[currentIndex - 1].focus();
        }
    }

    /**
     * Filter tree based on search query
     * @param {string} query - Search query
     */
    filterTree(query) {
        if (!query.trim()) {
            this.clearFilter();
            return;
        }

        const queryLower = query.toLowerCase();
        const allItems = this.treeContainer.querySelectorAll('.tree-item');
        
        allItems.forEach(item => {
            const text = item.querySelector('.tree-item-text').textContent.toLowerCase();
            const matches = text.includes(queryLower);
            
            if (matches) {
                item.style.display = '';
                this.highlightText(item.querySelector('.tree-item-text'), query);
                
                // Expand parent directories
                this.expandParentDirectories(item);
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * Clear tree filter
     */
    clearFilter() {
        const allItems = this.treeContainer.querySelectorAll('.tree-item');
        
        allItems.forEach(item => {
            item.style.display = '';
            this.clearHighlight(item.querySelector('.tree-item-text'));
        });
    }

    /**
     * Highlight text in element
     * @param {HTMLElement} element - Element to highlight
     * @param {string} query - Query to highlight
     */
    highlightText(element, query) {
        const originalText = element.dataset.originalText || element.textContent;
        element.dataset.originalText = originalText;
        
        const regex = new RegExp(`(${Utils.escapeHtml(query)})`, 'gi');
        const highlightedText = originalText.replace(regex, '<mark>$1</mark>');
        element.innerHTML = highlightedText;
    }

    /**
     * Clear text highlighting
     * @param {HTMLElement} element - Element to clear highlighting from
     */
    clearHighlight(element) {
        if (element.dataset.originalText) {
            element.textContent = element.dataset.originalText;
            delete element.dataset.originalText;
        }
    }

    /**
     * Get currently expanded directories
     * @returns {Set} Set of expanded directory paths
     */
    getExpandedDirectories() {
        return new Set(this.expandedDirectories);
    }

    /**
     * Restore expanded state for directories
     * @param {Set} expandedPaths - Set of paths to expand
     */
    restoreExpandedState(expandedPaths) {
        expandedPaths.forEach(path => {
            const item = this.treeContainer.querySelector(`[data-path="${path}"]`);
            if (item && item.dataset.type === 'directory') {
                this.expandDirectory(item);
            }
        });
    }
}

// Make Sidebar available globally
window.Sidebar = Sidebar;
