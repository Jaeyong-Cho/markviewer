/**
 * Sidebar Resizer Component
 * Handles sidebar width resizing functionality
 */

class SidebarResizer {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.resizer = document.getElementById('sidebar-resizer');
        this.isResizing = false;
        this.startX = 0;
        this.startWidth = 0;
        this.minWidth = 200;
        this.maxWidth = window.innerWidth * 0.5; // 50% of viewport width
        
        this.init();
    }

    /**
     * Initialize the resizer functionality
     */
    init() {
        if (!this.sidebar || !this.resizer) {
            console.warn('Sidebar or resizer element not found');
            return;
        }

        this.setupEventListeners();
        this.updateMaxWidth();
    }

    /**
     * Setup event listeners for resizing
     */
    setupEventListeners() {
        // Mouse events for resizing
        this.resizer.addEventListener('mousedown', this.startResize.bind(this));
        document.addEventListener('mousemove', this.doResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));

        // Touch events for mobile support
        this.resizer.addEventListener('touchstart', this.startResize.bind(this));
        document.addEventListener('touchmove', this.doResize.bind(this));
        document.addEventListener('touchend', this.stopResize.bind(this));

        // Update max width on window resize
        window.addEventListener('resize', () => {
            this.updateMaxWidth();
        });

        // Prevent text selection during resize
        this.resizer.addEventListener('selectstart', (e) => e.preventDefault());
    }

    /**
     * Start resizing operation
     * @param {MouseEvent|TouchEvent} e - The event object
     */
    startResize(e) {
        this.isResizing = true;
        this.startX = this.getClientX(e);
        this.startWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10);
        
        // Add visual feedback
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        this.resizer.classList.add('resizing');
        
        e.preventDefault();
    }

    /**
     * Perform resize operation
     * @param {MouseEvent|TouchEvent} e - The event object
     */
    doResize(e) {
        if (!this.isResizing) return;

        const currentX = this.getClientX(e);
        const diff = currentX - this.startX;
        let newWidth = this.startWidth + diff;

        // Enforce min/max constraints
        newWidth = Math.max(this.minWidth, Math.min(newWidth, this.maxWidth));

        // Apply new width
        this.setSidebarWidth(newWidth);
        
        e.preventDefault();
    }

    /**
     * Stop resizing operation
     * @param {MouseEvent|TouchEvent} e - The event object
     */
    stopResize(e) {
        if (!this.isResizing) return;

        this.isResizing = false;
        
        // Remove visual feedback
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        this.resizer.classList.remove('resizing');
        
        // Store the new width in localStorage for persistence
        const currentWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10);
        localStorage.setItem('sidebarWidth', currentWidth);
        
        e.preventDefault();
    }

    /**
     * Get client X coordinate from mouse or touch event
     * @param {MouseEvent|TouchEvent} e - The event object
     * @returns {number} - The X coordinate
     */
    getClientX(e) {
        return e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    }

    /**
     * Set sidebar width
     * @param {number} width - The new width in pixels
     */
    setSidebarWidth(width) {
        this.sidebar.style.width = `${width}px`;
        
        // Update CSS custom property for other components that might need it
        document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
        
        // If graph view is active, update its position and resize accordingly
        this.updateGraphViewLayout();
        
        // Update ToC positioning if it exists
        this.updateToCPosition();
    }

    /**
     * Update graph view layout when sidebar is resized
     */
    updateGraphViewLayout() {
        const graphView = window.graphView;
        if (graphView && graphView.isVisible) {
            // Get current sidebar width
            const sidebarWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10);
            
            // Update graph panel position to account for new sidebar width
            const graphPanel = document.querySelector('.graph-panel');
            if (graphPanel) {
                graphPanel.style.left = `${sidebarWidth}px`;
                
                // Trigger graph resize
                if (graphView.cy) {
                    setTimeout(() => {
                        graphView.resizeAndAdjustGraph();
                    }, 100);
                }
            }
        }
    }

    /**
     * Update ToC positioning when sidebar is resized
     */
    updateToCPosition() {
        const toc = document.querySelector('.toc');
        const content = document.querySelector('.content');
        
        if (toc && content) {
            // Get current sidebar width
            const sidebarWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10);
            
            // Check if graph view is active
            const isGraphActive = document.querySelector('.app-main.graph-view-active');
            
            if (isGraphActive) {
                // When graph view is active, adjust ToC position based on both sidebar and graph widths
                const graphPanel = document.querySelector('.graph-panel');
                if (graphPanel) {
                    const graphWidth = parseInt(document.defaultView.getComputedStyle(graphPanel).width, 10);
                    const totalOffset = sidebarWidth + graphWidth;
                    
                    // Update content area to accommodate both sidebar and graph
                    content.style.marginLeft = `${totalOffset}px`;
                    
                    // Update ToC positioning
                    toc.style.left = `${totalOffset + 20}px`; // 20px margin from content
                }
            } else {
                // Normal mode, just account for sidebar
                content.style.marginLeft = `${sidebarWidth}px`;
                toc.style.left = `${sidebarWidth + 20}px`;
            }
        }
    }

    /**
     * Update maximum width based on current viewport
     */
    updateMaxWidth() {
        this.maxWidth = window.innerWidth * 0.5;
        
        // If current sidebar width exceeds new max, adjust it
        const currentWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10);
        if (currentWidth > this.maxWidth) {
            this.setSidebarWidth(this.maxWidth);
        }
    }

    /**
     * Restore sidebar width from localStorage
     */
    restoreWidth() {
        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
            const width = parseInt(savedWidth, 10);
            if (width >= this.minWidth && width <= this.maxWidth) {
                this.setSidebarWidth(width);
            }
        }
    }

    /**
     * Reset sidebar to default width
     */
    resetToDefault() {
        const defaultWidth = 280; // Default sidebar width
        this.setSidebarWidth(defaultWidth);
        localStorage.removeItem('sidebarWidth');
    }
}
