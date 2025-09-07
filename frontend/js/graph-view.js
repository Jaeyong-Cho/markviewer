/**
 * Graph View Component for MarkViewer
 * Interactive visualization of markdown file relationships using Cytoscape.js
 */

class GraphView extends Utils.EventEmitter {
    constructor(containerSelector) {
        super();
        
        console.log('GraphView constructor called with selector:', containerSelector);
        
        this.container = document.querySelector(containerSelector);
        console.log('Container element found:', this.container);
        
        if (!this.container) {
            console.error('Graph view container not found:', containerSelector);
            // Set a flag to indicate failed initialization
            this.initialized = false;
            return null;
        }
        
        this.initialized = true;
        
        this.graphData = null;
        this.isVisible = false;
        this.selectedNode = null;
        
        // Focus and depth settings
        this.autoFocus = true;
        this.focusDepth = 2;
        this.currentFocusNode = null;
        
        // Cytoscape instance
        this.cy = null;
        
        // Debounce timer for resize operations
        this.resizeTimer = null;
        
        // Graph settings
        this.settings = {
            layout: {
                name: 'cose',
                idealEdgeLength: 150,
                nodeOverlap: 30,
                refresh: 10,
                fit: true,
                padding: 50,
                randomize: false,
                componentSpacing: 120,
                nodeRepulsion: 800000,
                edgeElasticity: 200,
                nestingFactor: 10,
                gravity: 300, // Increased gravity for stronger pull
                gravityCompound: 1.5,
                gravityRangeCompound: 2.0,
                gravityRange: 4.0,
                numIter: 2000,
                initialTemp: 500, // Higher initial temp for more movement
                coolingFactor: 0.90, // Faster cooling but still allowing movement
                minTemp: 1.0,
                animate: true,
                animationDuration: 1500,
                animationEasing: 'ease-out'
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#a50034',
                        'label': 'data(name)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#ffffff',
                        'text-outline-width': 2,
                        'text-outline-color': '#a50034',
                        'width': 'mapData(degree, 0, 100, 25, 70)',
                        'height': 'mapData(degree, 0, 100, 25, 70)',
                        'font-size': '11px',
                        'font-weight': '600',
                        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        'border-width': 2,
                        'border-color': '#a50034',
                        'border-opacity': 0.8,
                        'transition-property': 'opacity, background-color, border-color, border-width',
                        'transition-duration': '0.3s',
                        'transition-timing-function': 'ease-out'
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'background-color': '#a50034',
                        'text-outline-color': '#a50034',
                        'border-width': 3,
                        'border-color': '#a50034',
                        'border-opacity': 1
                    }
                },
                {
                    selector: 'node.orphan',
                    style: {
                        'background-color': '#6a737d',
                        'text-outline-color': '#6a737d',
                        'border-color': '#6a737d'
                    }
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'background-color': '#a50034',
                        'text-outline-color': '#a50034',
                        'border-color': '#a50034',
                        'border-width': 3
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#586069',
                        'target-arrow-color': '#586069',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.2,
                        'opacity': 0.7,
                        'transition-property': 'opacity, line-color, target-arrow-color, width',
                        'transition-duration': '0.3s',
                        'transition-timing-function': 'ease-out'
                    }
                },
                {
                    selector: 'edge.tag',
                    style: {
                        'width': 2,
                        'line-color': 'data(edgeColor)',
                        'target-arrow-color': 'data(edgeColor)',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.2,
                        'opacity': 0.7,
                        'line-style': 'dashed',
                        'line-dash-pattern': [6, 3],
                        'label': 'data(edgeLabel)',
                        'font-size': '10px',
                        'text-rotation': 'autorotate',
                        'text-margin-y': -8,
                        'color': 'data(edgeColor)',
                        'text-outline-width': 1,
                        'text-outline-color': '#ffffff'
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'line-color': '#a50034',
                        'target-arrow-color': '#a50034',
                        'width': 3,
                        'opacity': 1
                    }
                },
                {
                    selector: 'edge.tag.highlighted',
                    style: {
                        'line-color': 'data(edgeColor)',
                        'target-arrow-color': 'data(edgeColor)',
                        'width': 3,
                        'opacity': 1,
                        'line-style': 'dashed',
                        'line-dash-pattern': [6, 3],
                        'color': 'data(edgeColor)'
                    }
                }
            ]
        };
        
        // Search state
        this.searchQuery = '';
        this.highlightedElements = null;
        
        this.init();
        console.log('GraphView initialized successfully');
    }

    /**
     * Initialize the graph view component
     */
    init() {
        this.createGraphContainer();
        this.createControls();
        this.setupEventListeners();
    }

    /**
     * Get consistent color for a tag name (same logic as renderer)
     * @param {string} tag - Tag name
     * @returns {string} Hex color
     */
    getTagColor(tag) {
        // Color palette for tags (same as in renderer)
        const palette = [
            '#d97706', // amber
            '#2563eb', // blue
            '#059669', // green
            '#a21caf', // purple
            '#be185d', // pink
            '#e11d48', // red
            '#f59e42', // orange
            '#10b981', // teal
            '#6366f1', // indigo
            '#f43f5e', // rose
            '#64748b', // slate
            '#fbbf24', // yellow
        ];

        // Simple hash function for tag color
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        const idx = Math.abs(hash) % palette.length;
        return palette[idx];
    }

    /**
     * Create the graph container and controls
     */
    createGraphContainer() {
        this.container.innerHTML = `
            <div class="graph-panel" style="display: none;">
                <div class="graph-resizer" id="graph-resizer"></div>
                <div class="graph-header">
                    <h3>Graph View</h3>
                    <div class="graph-header-controls">
                        <button class="graph-btn graph-btn-small" id="graph-settings" title="Graph Settings">
                            Settings
                        </button>
                        <button class="graph-btn graph-btn-small graph-close" id="graph-close" title="Close Graph">
                            Close
                        </button>
                    </div>
                </div>
                <div class="graph-settings-panel" id="graph-settings-panel" style="display: none;">
                    <div class="settings-header">
                        <h4>Graph Settings</h4>
                        <button class="graph-btn graph-btn-small" id="close-settings" title="Close Settings">×</button>
                    </div>
                    <div class="settings-content">
                        <div class="setting-group">
                            <label class="setting-label">
                                <input type="checkbox" id="auto-focus-setting"> 
                                Auto Focus on File Selection
                            </label>
                        </div>
                        <div class="setting-group">
                            <label class="setting-label">Focus Depth:</label>
                            <select id="depth-setting" class="setting-select">
                                <option value="1">1 Level</option>
                                <option value="2" selected>2 Levels</option>
                                <option value="3">3 Levels</option>
                                <option value="4">4 Levels</option>
                                <option value="all">All Connections</option>
                            </select>
                        </div>
                        <div class="setting-group">
                            <label class="setting-label">Graph Layout:</label>
                            <select id="layout-setting" class="setting-select">
                                <option value="cose">Force Directed</option>
                                <option value="circle">Circle</option>
                                <option value="grid">Grid</option>
                                <option value="breadthfirst">Tree</option>
                                <option value="concentric">Concentric</option>
                            </select>
                        </div>
                        <div class="setting-group setting-actions">
                            <button class="graph-btn" id="refresh-graph-btn" title="Refresh Graph Data">
                                Refresh Graph
                            </button>
                            <button class="graph-btn" id="fit-view-btn" title="Fit Graph to View">
                                Fit to View
                            </button>
                        </div>
                        <div class="setting-group">
                            <button class="graph-btn" id="clear-focus-btn" title="Clear Current Focus">
                                Clear Focus
                            </button>
                        </div>
                    </div>
                </div>
                <div class="graph-search-bar">
                    <input type="text" id="graph-search-input" placeholder="Search files..." class="graph-search-input">
                    <button class="graph-btn graph-btn-small" id="graph-clear-search" title="Clear Search">Clear</button>
                </div>
                <div class="graph-canvas" id="graph-canvas"></div>
                <div class="graph-stats">
                    <span id="graph-stats-files">0 files</span>
                    <span class="graph-stats-separator">•</span>
                    <span id="graph-stats-links">0 links</span>
                    <span class="graph-stats-separator">•</span>
                    <span id="graph-stats-tags">0 tag connections</span>
                    <span class="graph-stats-separator">•</span>
                    <span id="graph-stats-orphans">0 orphans</span>
                </div>
                <div class="graph-node-info" id="graph-node-info" style="display: none;">
                    <h4>File Information</h4>
                    <div class="node-info-content">
                        <p><strong>Name:</strong> <span id="node-info-name">-</span></p>
                        <p><strong>Path:</strong> <span id="node-info-path">-</span></p>
                        <p><strong>Incoming:</strong> <span id="node-info-incoming">0</span></p>
                        <p><strong>Outgoing:</strong> <span id="node-info-outgoing">0</span></p>
                        <p><strong>Tag Connections:</strong> <span id="node-info-tag-connections">0</span></p>
                        <p><strong>Tags:</strong> <span id="node-info-tags">None</span></p>
                        <p><strong>Modified:</strong> <span id="node-info-modified">-</span></p>
                    </div>
                    <div class="node-connections">
                        <h5>Connected Files</h5>
                        <div id="node-connections-list" class="connections-list"></div>
                    </div>
                    <div class="node-actions">
                        <button class="graph-btn graph-btn-small" id="node-open-file">Open</button>
                        <button class="graph-btn graph-btn-small" id="node-focus">Focus</button>
                    </div>
                </div>
            </div>
        `;
        
        this.graphPanel = this.container.querySelector('.graph-panel');
        this.graphCanvas = this.container.querySelector('#graph-canvas');
        this.nodeInfoPanel = this.container.querySelector('#graph-node-info');
    }

    /**
     * Create graph controls and toolbar
     */
    createControls() {
        this.controls = {
            searchInput: this.container.querySelector('#graph-search-input'),
            clearSearch: this.container.querySelector('#graph-clear-search'),
            closeGraph: this.container.querySelector('#graph-close'),
            statsFiles: this.container.querySelector('#graph-stats-files'),
            statsLinks: this.container.querySelector('#graph-stats-links'),
            statsTags: this.container.querySelector('#graph-stats-tags'),
            statsOrphans: this.container.querySelector('#graph-stats-orphans'),
            
            // Settings panel elements
            settingsBtn: this.container.querySelector('#graph-settings'),
            settingsPanel: this.container.querySelector('#graph-settings-panel'),
            closeSettings: this.container.querySelector('#close-settings'),
            autoFocusSetting: this.container.querySelector('#auto-focus-setting'),
            depthSetting: this.container.querySelector('#depth-setting'),
            layoutSetting: this.container.querySelector('#layout-setting'),
            clearFocusBtn: this.container.querySelector('#clear-focus-btn'),
            refreshBtn: this.container.querySelector('#refresh-graph-btn'),
            fitViewBtn: this.container.querySelector('#fit-view-btn')
        };
    }

    /**
     * Setup event listeners for controls
     */
    setupEventListeners() {
        // Settings button
        if (this.controls.settingsBtn) {
            this.controls.settingsBtn.addEventListener('click', () => this.toggleSettings());
        }
        
        // Close settings
        if (this.controls.closeSettings) {
            this.controls.closeSettings.addEventListener('click', () => this.toggleSettings());
        }
        
        // Control buttons in settings panel
        if (this.controls.refreshBtn) {
            this.controls.refreshBtn.addEventListener('click', () => this.refreshGraph());
        }
        
        if (this.controls.fitViewBtn) {
            this.controls.fitViewBtn.addEventListener('click', () => this.fitToView());
        }
        
        if (this.controls.closeGraph) {
            this.controls.closeGraph.addEventListener('click', () => this.hide());
        }
        
        if (this.controls.clearSearch) {
            this.controls.clearSearch.addEventListener('click', () => this.clearSearch());
        }
        
        // Settings panel event listeners
        if (this.controls.autoFocusSetting) {
            this.controls.autoFocusSetting.addEventListener('change', (e) => {
                this.autoFocus = e.target.checked;
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification(`Auto focus ${this.autoFocus ? 'enabled' : 'disabled'}`, 'info');
                }
            });
        }
        
        if (this.controls.depthSetting) {
            this.controls.depthSetting.addEventListener('change', (e) => {
                this.setFocusDepth(e.target.value);
            });
        }
        
        if (this.controls.layoutSetting) {
            this.controls.layoutSetting.addEventListener('change', (e) => {
                this.changeLayout(e.target.value);
            });
        }
        
        if (this.controls.clearFocusBtn) {
            this.controls.clearFocusBtn.addEventListener('click', () => this.clearFocus());
        }
        
        // Search functionality
        if (this.controls.searchInput) {
            this.controls.searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
        
        // Node info panel actions
        const openFileBtn = this.container.querySelector('#node-open-file');
        const focusBtn = this.container.querySelector('#node-focus');
        
        if (openFileBtn) {
            openFileBtn.addEventListener('click', () => {
                if (this.selectedNode) {
                    const filePath = this.selectedNode.data('path') || this.selectedNode.data().path;
                    this.emit('fileSelect', filePath);
                }
            });
        }
        
        if (focusBtn) {
            focusBtn.addEventListener('click', () => {
                if (this.selectedNode) {
                    this.focusOnNode(this.selectedNode.id());
                }
            });
        }

        // Panel resizer
        this.setupResizer();

        // Resize handling
        window.addEventListener('resize', () => {
            if (this.isVisible && this.cy) {
                this.resizeAndAdjustGraph();
            }
        });
    }

    /**
     * Check if Cytoscape.js is available
     */
    isCytoscapeAvailable() {
        return typeof cytoscape !== 'undefined';
    }

    /**
     * Show the graph view and focus on current file if available
     * @param {string} currentFilePath - Optional current file path to focus on
     */
    async show(currentFilePath = null) {
        console.log('GraphView.show() called');
        console.log('isVisible:', this.isVisible);
        
        if (this.isVisible) return;

        if (!this.isCytoscapeAvailable()) {
            console.error('Cytoscape.js library not loaded');
            Utils.showNotification('Cytoscape.js library not loaded', 'error');
            return;
        }

        console.log('Showing graph panel');
        this.graphPanel.style.display = 'flex';
        
        // Re-query canvas element after showing panel
        this.graphCanvas = this.container.querySelector('#graph-canvas');
        console.log('Graph canvas after show:', this.graphCanvas);
        
        // Add class to app-main for content area adjustment
        const appMain = document.querySelector('.app-main');
        if (appMain) {
            appMain.classList.add('graph-view-active');
        }
        
        // Update sidebar resizer to account for graph view
        if (window.sidebarResizer) {
            window.sidebarResizer.updateGraphViewLayout();
        }
        
        // Adjust graph size to fit the panel
        if (this.cy) {
            setTimeout(() => {
                this.resizeAndAdjustGraph();
            }, 100);
        }
        
        // Update ToC position for graph view
        setTimeout(() => {
            this.updateToCPosition();
        }, 150);
        
        this.isVisible = true;
        this.emit('show');
        
        // Focus on current file if provided and graph is loaded
        if (currentFilePath && this.cy) {
            setTimeout(() => {
                this.focusOnCurrentFile(currentFilePath);
            }, 200);
        }
        
        console.log('Graph view shown successfully');
    }

    /**
     * Hide the graph view
     */
    hide() {
        if (!this.isVisible) return;

        this.graphPanel.style.display = 'none';
        
        // Remove class from app-main
        const appMain = document.querySelector('.app-main');
        if (appMain) {
            appMain.classList.remove('graph-view-active');
        }
        
        // Reset ToC position when hiding graph view
        this.resetToCPosition();
        
        this.isVisible = false;
        this.clearSelection();
        this.emit('hide');
    }

    /**
     * Toggle graph view visibility
     * @param {string} currentFilePath - Optional current file path to focus on when showing
     */
    toggle(currentFilePath = null) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(currentFilePath);
        }
    }

    /**
     * Load and display graph data
     * @param {Object} data - Graph data with nodes and edges
     */
    async loadGraphData(data) {
        console.log('GraphView.loadGraphData() called with data:', data);
        this.graphData = data;
        
        // Show the graph view if not already visible
        if (!this.isVisible) {
            await this.show();
        }
        
        this.renderGraph();
        this.updateStats();
        console.log('Graph data loaded and rendered');
    }

    /**
     * Render the graph visualization using Cytoscape.js
     */
    renderGraph() {
        console.log('GraphView.renderGraph() called');
        console.log('graphData:', this.graphData);
        console.log('isCytoscapeAvailable:', this.isCytoscapeAvailable());
        
        if (!this.graphData || !this.isCytoscapeAvailable()) {
            console.error('Cannot render graph: missing data or Cytoscape.js');
            return;
        }

        console.log('Preparing graph elements...');
        
        // Clear existing graph
        if (this.cy) {
            console.log('Destroying existing Cytoscape instance');
            this.cy.destroy();
        }

        // Prepare nodes data
        const elements = [];
        
        // Create a set of valid node IDs for edge validation
        const validNodeIds = new Set();
        
        // Add nodes
        this.graphData.nodes.forEach(node => {
            // Updated orphan detection to include tag connections
            const isOrphan = node.incomingLinks === 0 && node.outgoingLinks === 0 && 
                           (!node.tagConnections || node.tagConnections === 0);
            validNodeIds.add(node.id);
            elements.push({
                data: {
                    id: node.id,
                    name: this.truncateLabel(node.name),
                    fullName: node.name,
                    path: node.path,
                    relativePath: node.relativePath,
                    incomingLinks: node.incomingLinks,
                    outgoingLinks: node.outgoingLinks,
                    tagConnections: node.tagConnections || 0,
                    tags: node.tags || [],
                    degree: node.incomingLinks + node.outgoingLinks + (node.tagConnections || 0),
                    modified: node.modified,
                    size: node.size
                },
                classes: isOrphan ? 'orphan' : ''
            });
        });

        // Add edges (only if both source and target nodes exist)
        this.graphData.edges.forEach(edge => {
            if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
                const edgeClasses = edge.type === 'tag' ? 'tag' : '';
                const edgeLabel = edge.type === 'tag' && edge.sharedTags && edge.sharedTags.length > 0 
                    ? edge.sharedTags.join(', ') 
                    : '';
                
                // For tag edges, get color from the first shared tag
                let edgeColor = '#d97706'; // fallback color
                if (edge.type === 'tag' && edge.sharedTags && edge.sharedTags.length > 0) {
                    edgeColor = this.getTagColor(edge.sharedTags[0]);
                }
                
                elements.push({
                    data: {
                        id: `${edge.source}-${edge.target}`,
                        source: edge.source,
                        target: edge.target,
                        sourcePath: edge.sourcePath,
                        targetPath: edge.targetPath,
                        type: edge.type || 'link',
                        sharedTags: edge.sharedTags || [],
                        edgeLabel: edgeLabel,
                        edgeColor: edgeColor
                    },
                    classes: edgeClasses
                });
            } else {
                console.warn(`Skipping edge ${edge.source} -> ${edge.target}: missing node(s)`, {
                    sourceExists: validNodeIds.has(edge.source),
                    targetExists: validNodeIds.has(edge.target),
                    availableNodes: Array.from(validNodeIds)
                });
            }
        });

        console.log('Creating Cytoscape instance with', elements.length, 'elements');
        console.log('Graph canvas element:', this.graphCanvas);

        if (!this.graphCanvas) {
            console.error('Graph canvas element not found!');
            Utils.showNotification('Graph canvas not available', 'error');
            return;
        }

        // Initialize Cytoscape
        this.cy = cytoscape({
            container: this.graphCanvas,
            elements: elements,
            style: this.settings.style,
            layout: this.settings.layout,
            minZoom: 0.1,
            maxZoom: 3.0
        });

        console.log('Cytoscape instance created:', this.cy);

        // Add event listeners
        this.setupCytoscapeEvents();
        
        // Highlight current file if available
        this.highlightCurrentFile();
        
        // Adjust graph size for current panel dimensions
        setTimeout(() => {
            if (this.isVisible) {
                this.resizeAndAdjustGraph();
            }
        }, 100);
        
        console.log('Graph rendering completed');
    }

    /**
     * Setup Cytoscape event listeners
     */
    setupCytoscapeEvents() {
        if (!this.cy) return;

        // Node click
        this.cy.on('tap', 'node', (event) => {
            const node = event.target;
            this.selectNode(node);
        });

        // Node hover for dimming effect
        this.cy.on('mouseover', 'node', (event) => {
            const node = event.target;
            this.highlightConnectedNodesOnHover(node);
        });

        this.cy.on('mouseout', 'node', (event) => {
            this.clearHoverHighlight();
        });

        // Edge hover for tooltip
        this.cy.on('mouseover', 'edge', (event) => {
            const edge = event.target;
            this.showEdgeTooltip(edge, event);
        });

        this.cy.on('mouseout', 'edge', (event) => {
            this.hideEdgeTooltip();
        });

        // Background click (deselect)
        this.cy.on('tap', (event) => {
            if (event.target === this.cy) {
                this.clearSelection();
            }
        });

        // Double click to open file
        this.cy.on('dbltap', 'node', (event) => {
            const node = event.target;
            const filePath = node.data('path') || node.data().path;
            
            // Select the node
            this.selectNode(node);
            
            // Open the file when double-clicked
            if (filePath) {
                this.emit('fileSelect', filePath);
            }
        });
        
        // Double click background to clear focus
        this.cy.on('dbltap', (event) => {
            if (event.target === this.cy) {
                this.clearFocus();
            }
        });
    }

    /**
     * Truncate label for display
     * @param {string} label - Original label
     * @returns {string} Truncated label
     */
    truncateLabel(label) {
        return label.length > 15 ? label.substring(0, 12) + '...' : label;
    }

    /**
     * Select a node and show its information
     * @param {Object} node - Cytoscape node object
     */
    selectNode(node) {
        this.selectedNode = node;
        this.showNodeInfo(node);
        this.highlightNode(node);
    }

    /**
     * Clear node selection
     */
    clearSelection() {
        this.selectedNode = null;
        this.hideNodeInfo();
        this.clearHighlight();
    }

    /**
     * Highlight a node
     * @param {Object} node - Cytoscape node object
     */
    highlightNode(node) {
        if (!this.cy) return;

        // Clear previous selections
        this.cy.nodes().removeClass('highlighted');
        
        // Highlight selected node
        node.addClass('highlighted');
        
        // Highlight connected nodes and edges
        this.highlightConnections(node, true);
    }

    /**
     * Clear all highlights
     */
    clearHighlight() {
        if (!this.cy) return;

        this.cy.elements().removeClass('highlighted');
        this.cy.edges().removeClass('highlighted');
    }

    /**
     * Highlight connections for a node
     * @param {Object} node - Cytoscape node object
     * @param {boolean} highlight - Whether to highlight or unhighlight
     */
    highlightConnections(node, highlight) {
        if (!this.cy) return;

        if (highlight) {
            // Get connected edges and nodes
            const connectedEdges = node.connectedEdges();
            const connectedNodes = connectedEdges.connectedNodes();
            
            // Highlight connected elements
            connectedEdges.addClass('highlighted');
            connectedNodes.addClass('highlighted');
        } else {
            // Remove highlights if no node is selected
            if (!this.selectedNode) {
                this.clearHighlight();
            }
        }
    }

    /**
     * Highlight connected nodes on hover and dim others
     * @param {Object} node - Cytoscape node object
     */
    highlightConnectedNodesOnHover(node) {
        if (!this.cy) return;

        // Get the hovered node and its connected elements
        const connectedEdges = node.connectedEdges();
        const connectedNodes = connectedEdges.connectedNodes().union(node);
        
        // Get all nodes and edges
        const allNodes = this.cy.nodes();
        const allEdges = this.cy.edges();
        
        // Dim all nodes and edges first
        allNodes.style({
            'opacity': 0.3,
            'transition-property': 'opacity',
            'transition-duration': '0.2s'
        });
        
        allEdges.style({
            'opacity': 0.1,
            'transition-property': 'opacity',
            'transition-duration': '0.2s'
        });
        
        // Highlight the hovered node and connected nodes
        connectedNodes.style({
            'opacity': 1,
            'transition-property': 'opacity',
            'transition-duration': '0.2s'
        });
        
        // Highlight connected edges
        connectedEdges.style({
            'opacity': 0.8,
            'transition-property': 'opacity',
            'transition-duration': '0.2s'
        });
    }

    /**
     * Clear hover highlight effect
     */
    clearHoverHighlight() {
        if (!this.cy) return;
        
        // Reset all nodes and edges to normal opacity
        this.cy.nodes().style({
            'opacity': 1,
            'transition-property': 'opacity',
            'transition-duration': '0.2s'
        });
        
        this.cy.edges().style({
            'opacity': 0.7,
            'transition-property': 'opacity',
            'transition-duration': '0.2s'
        });
    }

    /**
     * Show edge tooltip with connection information
     * @param {Object} edge - Cytoscape edge object
     * @param {Object} event - Mouse event
     */
    showEdgeTooltip(edge, event) {
        const edgeData = edge.data();
        let tooltipContent = '';
        
        if (edgeData.type === 'tag' && edgeData.sharedTags && edgeData.sharedTags.length > 0) {
            const source = edge.source().data('fullName');
            const target = edge.target().data('fullName');
            tooltipContent = `<div class="edge-tooltip tag-edge">
                <div class="tooltip-title">Tag Connection</div>
                <div class="tooltip-files">${source} ↔ ${target}</div>
                <div class="tooltip-tags">Shared tags: ${edgeData.sharedTags.map(tag => 
                    `<span class="tag-badge mini" style="background:${this.getTagColor(tag)};">${tag}</span>`
                ).join(' ')}</div>
            </div>`;
        } else {
            const source = edge.source().data('fullName');
            const target = edge.target().data('fullName');
            tooltipContent = `<div class="edge-tooltip link-edge">
                <div class="tooltip-title">Link Connection</div>
                <div class="tooltip-files">${source} → ${target}</div>
            </div>`;
        }
        
        this.createTooltip(tooltipContent, event.renderedPosition || event.position);
    }

    /**
     * Create and show tooltip
     * @param {string} content - HTML content for tooltip
     * @param {Object} position - Position object with x, y coordinates
     */
    createTooltip(content, position) {
        this.hideEdgeTooltip(); // Remove any existing tooltip
        
        const tooltip = document.createElement('div');
        tooltip.id = 'graph-edge-tooltip';
        tooltip.innerHTML = content;
        
        // Get the graph container position to calculate relative position
        const graphContainer = this.container.querySelector('.graph-content');
        const containerRect = graphContainer ? graphContainer.getBoundingClientRect() : this.container.getBoundingClientRect();
        
        // Calculate position relative to the viewport
        const x = containerRect.left + position.x;
        const y = containerRect.top + position.y;
        
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            pointer-events: none;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            left: ${x + 10}px;
            top: ${y - 40}px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        // Ensure tooltip stays within viewport
        document.body.appendChild(tooltip);
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Adjust horizontal position if tooltip goes off-screen
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = `${x - tooltipRect.width - 10}px`;
        }
        
        // Adjust vertical position if tooltip goes off-screen
        if (tooltipRect.top < 0) {
            tooltip.style.top = `${y + 20}px`;
        }
    }

    /**
     * Hide edge tooltip
     */
    hideEdgeTooltip() {
        const existingTooltip = document.getElementById('graph-edge-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }

    /**
     * Show node information panel
     * @param {Object} node - Cytoscape node object
     */
    showNodeInfo(node) {
        this.nodeInfoPanel.style.display = 'block';
        
        const data = node.data();
        
        // Update node information
        document.getElementById('node-info-name').textContent = data.fullName;
        document.getElementById('node-info-path').textContent = data.relativePath;
        document.getElementById('node-info-incoming').textContent = data.incomingLinks;
        document.getElementById('node-info-outgoing').textContent = data.outgoingLinks;
        document.getElementById('node-info-tag-connections').textContent = data.tagConnections || 0;
        
        // Display tags
        const tagsElement = document.getElementById('node-info-tags');
        if (data.tags && data.tags.length > 0) {
            tagsElement.innerHTML = data.tags.map(tag => 
                `<span class="tag-badge" style="background:${this.getTagColor(tag)};">${tag}</span>`
            ).join(' ');
        } else {
            tagsElement.textContent = 'None';
        }
        
        document.getElementById('node-info-modified').textContent = 
            new Date(data.modified).toLocaleDateString();

        // Show connected files
        this.showConnectedFiles(node);
    }

    /**
     * Hide node information panel
     */
    hideNodeInfo() {
        this.nodeInfoPanel.style.display = 'none';
    }

    /**
     * Show connected files for a node
     * @param {Object} node - Cytoscape node object
     */
    showConnectedFiles(node) {
        const connectionsList = document.getElementById('node-connections-list');
        connectionsList.innerHTML = '';

        const connectedEdges = node.connectedEdges();
        const connections = [];

        connectedEdges.forEach(edge => {
            const source = edge.source();
            const target = edge.target();
            const other = source.id() === node.id() ? target : source;
            const direction = source.id() === node.id() ? 'outgoing' : 'incoming';
            const edgeData = edge.data();
            
            connections.push({
                id: other.id(),
                name: other.data('fullName'),
                direction: direction,
                type: edgeData.type || 'link',
                sharedTags: edgeData.sharedTags || []
            });
        });

        if (connections.length === 0) {
            connectionsList.innerHTML = '<p class="no-connections">No connections</p>';
            return;
        }

        // Create connection list
        connections.forEach(connection => {
            const item = document.createElement('div');
            item.className = 'connection-item';
            
            const typeLabel = connection.type === 'tag' ? 'tag' : 'link';
            const directionLabel = connection.direction;
            
            let connectionInfo = `<span class="connection-type ${connection.direction} ${connection.type}">${typeLabel} (${directionLabel})</span>`;
            connectionInfo += `<span class="connection-name">${connection.name}</span>`;
            
            if (connection.type === 'tag' && connection.sharedTags.length > 0) {
                connectionInfo += `<div class="shared-tags">Shared tags: ${connection.sharedTags.map(tag => 
                    `<span class="tag-badge small" style="background:${this.getTagColor(tag)};">${tag}</span>`
                ).join(' ')}</div>`;
            }
            
            item.innerHTML = connectionInfo;
            item.addEventListener('click', () => {
                const targetNode = this.cy.getElementById(connection.id);
                if (targetNode.length > 0) {
                    this.selectNode(targetNode);
                    this.focusOnNode(connection.id);
                }
            });
            connectionsList.appendChild(item);
        });
    }

    /**
     * Handle search functionality
     * @param {string} query - Search query
     */
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();

        if (!this.cy) return;

        // Clear previous highlights
        this.clearHighlight();

        if (this.searchQuery.trim() === '') {
            return;
        }

        // Find matching nodes
        const matchingNodes = this.cy.nodes().filter(node => {
            const data = node.data();
            return data.fullName.toLowerCase().includes(this.searchQuery) ||
                   data.relativePath.toLowerCase().includes(this.searchQuery);
        });

        // Highlight matching nodes
        matchingNodes.addClass('highlighted');
        
        // If only one match, focus on it
        if (matchingNodes.length === 1) {
            this.focusOnNode(matchingNodes[0].id());
        }
    }

    /**
     * Clear search
     */
    clearSearch() {
        this.controls.searchInput.value = '';
        this.handleSearch('');
    }

    /**
     * Focus on a specific node with smooth animation
     * @param {string} nodeId - Node ID to focus on
     */
    focusOnNode(nodeId) {
        if (!this.cy) return;

        const node = this.cy.getElementById(nodeId);
        if (node.length === 0) return;

        this.cy.animate({
            center: { eles: node },
            zoom: 1.5
        }, {
            duration: 600,
            easing: 'ease-in-out'
        });
    }

    /**
     * Reset zoom to fit all nodes
     */
    resetZoom() {
        if (!this.cy) return;
        
        this.cy.animate({
            zoom: 1,
            center: { eles: this.cy.elements() }
        }, {
            duration: 500
        });
    }

    /**
     * Center the view
     */
    centerView() {
        if (!this.cy) return;

        this.cy.animate({
            center: { eles: this.cy.elements() }
        }, {
            duration: 500
        });
    }

    /**
     * Fit view to show all nodes
     */
    fitToView() {
        if (!this.cy) return;

        this.cy.fit(this.cy.elements(), 50);
    }

    /**
     * Refresh the graph with latest data
     */
    async refreshGraph() {
        if (!window.app || !window.app.state.rootDirectory) {
            Utils.showNotification('No workspace directory available', 'warning');
            return;
        }

        try {
            Utils.showNotification('Refreshing graph...', 'info');
            
            // Fetch fresh graph data
            const response = await API.getGraphData(window.app.state.rootDirectory);
            
            if (response.success) {
                this.graphData = response.data;
                this.renderGraph();
                this.updateStats();
                Utils.showNotification('Graph refreshed successfully', 'success');
            } else {
                throw new Error(response.message || 'Failed to refresh graph data');
            }
        } catch (error) {
            console.error('Error refreshing graph:', error);
            Utils.showNotification('Failed to refresh graph: ' + error.message, 'error');
        }
    }

    /**
     * Change graph layout
     * @param {string} layoutName - Layout name
     */
    changeLayout(layoutName) {
        if (!this.cy) return;

        const layoutOptions = {
            name: layoutName,
            animate: true,
            animationDuration: 1000,
            fit: true,
            padding: 30
        };

        // Add specific options for certain layouts
        if (layoutName === 'cose') {
            Object.assign(layoutOptions, {
                idealEdgeLength: 150,
                nodeOverlap: 30,
                refresh: 10,
                randomize: false,
                componentSpacing: 120,
                nodeRepulsion: 800000,
                edgeElasticity: 200,
                nestingFactor: 10,
                gravity: 300,
                gravityCompound: 1.5,
                gravityRangeCompound: 2.0,
                gravityRange: 4.0,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0,
                animate: false // Disable animation for better performance
            });
        } else if (layoutName === 'breadthfirst') {
            Object.assign(layoutOptions, {
                directed: true,
                spacingFactor: 1.5
            });
        }

        const layout = this.cy.layout(layoutOptions);
        layout.run();
        
        // Fit view after layout without animation
        layout.on('layoutstop', () => {
            this.cy.fit(this.cy.elements(), 50);
        });
    }

    /**
     * Update graph statistics display
     */
    updateStats() {
        if (!this.graphData) return;

        this.controls.statsFiles.textContent = `${this.graphData.stats.totalFiles} files`;
        this.controls.statsLinks.textContent = `${this.graphData.stats.totalLinks} links`;
        this.controls.statsTags.textContent = `${this.graphData.stats.totalTagConnections || 0} tag connections`;
        this.controls.statsOrphans.textContent = `${this.graphData.stats.orphanedFiles} orphans`;
    }

    /**
     * Setup panel resizer functionality
     */
    setupResizer() {
        const resizer = this.container.querySelector('#graph-resizer');
        if (!resizer) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = this.graphPanel.offsetWidth;
            
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = startX - e.clientX;
            const newWidth = Math.max(300, Math.min(window.innerWidth * 0.6, startWidth + deltaX));
            
            this.graphPanel.style.width = newWidth + 'px';
            
            // Update content area width accordingly
            const appMain = document.querySelector('.app-main');
            if (appMain && appMain.classList.contains('graph-view-active')) {
                const contentWidth = window.innerWidth - newWidth;
                appMain.querySelector('.content-area').style.width = contentWidth + 'px';
            }
            
            // Update ToC position in real-time during resize
            const tocSidebar = document.querySelector('.toc-sidebar');
            const tocHoverTrigger = document.querySelector('.toc-hover-trigger');
            const tocShowBtn = document.querySelector('.toc-show-btn');
            const tocHideBtn = document.querySelector('.toc-hide-btn');
            
            if (tocSidebar && tocSidebar.classList.contains('visible')) {
                tocSidebar.style.right = `${newWidth + 16}px`;
            }
            
            if (tocHoverTrigger) {
                tocHoverTrigger.style.right = `${newWidth}px`;
            }
            
            if (tocShowBtn) {
                tocShowBtn.style.right = `${newWidth}px`;
            }
            
            if (tocHideBtn) {
                tocHideBtn.style.right = `${newWidth + 280 + 16}px`;
            }
            
            // Debounced graph resize for better performance
            if (this.cy) {
                clearTimeout(this.resizeTimer);
                this.resizeTimer = setTimeout(() => {
                    this.cy.resize();
                }, 50);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Final graph adjustment after resizing is complete
                if (this.cy) {
                    clearTimeout(this.resizeTimer);
                    this.resizeAndAdjustGraph();
                }
                
                // Update ToC position after resizing
                this.updateToCPosition();
            }
        });
    }

    /**
     * Highlight current file in the graph
     */
    highlightCurrentFile() {
        if (!this.cy || !window.app || !window.app.state.currentFile) {
            return;
        }

        const currentFile = window.app.state.currentFile;
        const node = this.cy.nodes().filter(n => n.data('path') === currentFile);
        
        if (node.length > 0) {
            // Remove previous current file highlighting
            this.cy.nodes().removeClass('current-file');
            
            // Add current file class
            node.addClass('current-file');
        }
    }

    /**
     * Focus on current file in the graph
     */
    focusCurrentFile() {
        if (!this.cy || !window.app || !window.app.state.currentFile) {
            Utils.showNotification('No current file to focus on', 'warning');
            return;
        }

        const currentFile = window.app.state.currentFile;
        const node = this.cy.nodes().filter(n => n.data('path') === currentFile);
        
        if (node.length > 0) {
            this.selectNode(node);
            this.focusOnNode(node.id());
            Utils.showNotification('Focused on current file', 'success');
        } else {
            Utils.showNotification('Current file not found in graph', 'warning');
        }
    }

    /**
     * Focus on a specific file in the graph
     * @param {string} filePath - Path to the file to focus on
     */
    focusOnCurrentFile(filePath) {
        console.log('focusOnCurrentFile called with:', filePath);
        
        if (!this.cy || !filePath) {
            console.log('Cannot focus: cy or filePath missing', { cy: !!this.cy, filePath });
            return;
        }

        const node = this.cy.nodes().filter(n => n.data('path') === filePath);
        console.log('Found node for path:', filePath, 'node count:', node.length);
        
        if (node.length > 0) {
            console.log('Focusing on node:', node.id());
            this.selectNode(node);
            this.focusOnNode(node.id());
            Utils.showNotification('Focused on current file', 'success');
        } else {
            console.log('Node not found for path:', filePath);
            // Log available paths for debugging
            const allPaths = this.cy.nodes().map(n => n.data('path'));
            console.log('Available paths:', allPaths);
        }
    }

    /**
     * Focus on a specific node with smooth animation and highlight effect
     */
    focusOnNode(nodeId) {
        if (!this.cy) return;

        const node = this.cy.getElementById(nodeId);
        if (node.length === 0) return;

        // Animate to focus on the node with smooth easing
        this.cy.animate({
            center: {
                eles: node
            },
            zoom: 2
        }, {
            duration: 600,
            easing: 'ease-in-out'
        });

        // Highlight the node temporarily with smooth transition
        node.addClass('highlighted');
        setTimeout(() => {
            node.removeClass('highlighted');
        }, 1500);
    }

    /**
     * Resize and adjust graph layout when panel size changes
     */
    resizeAndAdjustGraph() {
        if (!this.cy) return;

        // Resize the cytoscape container
        this.cy.resize();
        
        // Simple fit without animation for better performance
        this.cy.fit(this.cy.elements(), 50);
        
        // Update graph statistics after resize
        this.updateStats();
        
        // Update ToC position based on current graph panel width
        this.updateToCPosition();
    }

    /**
     * Update ToC position based on graph panel width
     */
    updateToCPosition() {
        if (!this.isVisible) return;
        
        const graphPanel = this.graphPanel;
        if (!graphPanel) return;
        
        const graphWidth = graphPanel.offsetWidth;
        const tocSidebar = document.querySelector('.toc-sidebar');
        const tocHoverTrigger = document.querySelector('.toc-hover-trigger');
        const tocShowBtn = document.querySelector('.toc-show-btn');
        const tocHideBtn = document.querySelector('.toc-hide-btn');
        
        // Update CSS custom property for dynamic positioning
        document.documentElement.style.setProperty('--graph-panel-width', `${graphWidth}px`);
        
        if (tocSidebar) {
            // Force update visible ToC position
            if (tocSidebar.classList.contains('visible')) {
                tocSidebar.style.right = `${graphWidth + 16}px`;
            }
        }
        
        if (tocHoverTrigger) {
            tocHoverTrigger.style.right = `${graphWidth}px`;
        }
        
        if (tocShowBtn) {
            tocShowBtn.style.right = `${graphWidth}px`;
        }
        
        if (tocHideBtn) {
            tocHideBtn.style.right = `${graphWidth + 280 + 16}px`;
        }
    }

    /**
     * Reset ToC position when graph view is hidden
     */
    resetToCPosition() {
        const tocSidebar = document.querySelector('.toc-sidebar');
        const tocHoverTrigger = document.querySelector('.toc-hover-trigger');
        const tocShowBtn = document.querySelector('.toc-show-btn');
        const tocHideBtn = document.querySelector('.toc-hide-btn');
        
        // Remove custom styles to fall back to CSS defaults
        if (tocSidebar) {
            tocSidebar.style.right = '';
        }
        
        if (tocHoverTrigger) {
            tocHoverTrigger.style.right = '';
        }
        
        if (tocShowBtn) {
            tocShowBtn.style.right = '';
        }
        
        if (tocHideBtn) {
            tocHideBtn.style.right = '';
        }
        
        // Clear CSS custom property
        document.documentElement.style.removeProperty('--graph-panel-width');
    }

    /**
     * Toggle settings panel visibility
     */
    toggleSettings() {
        if (this.controls.settingsPanel.style.display === 'none') {
            this.showSettings();
        } else {
            this.hideSettings();
        }
    }

    /**
     * Show settings panel
     */
    showSettings() {
        if (!this.controls.settingsPanel) return;
        
        this.controls.settingsPanel.style.display = 'block';
        
        // Sync current settings with UI
        if (this.controls.autoFocusSetting) {
            this.controls.autoFocusSetting.checked = this.autoFocus;
        }
        if (this.controls.depthSetting) {
            this.controls.depthSetting.value = this.focusDepth === 'all' ? 'all' : this.focusDepth.toString();
        }
        if (this.controls.layoutSetting && this.controls.layoutSelect) {
            this.controls.layoutSetting.value = this.controls.layoutSelect.value;
        }
    }

    /**
     * Hide settings panel
     */
    hideSettings() {
        if (this.controls.settingsPanel) {
            this.controls.settingsPanel.style.display = 'none';
        }
    }

    /**
     * Set focus depth
     */
    setFocusDepth(depth) {
        this.focusDepth = depth === 'all' ? 'all' : parseInt(depth);
        
        // If currently focusing on a node, update the focus
        if (this.currentFocusNode) {
            this.focusOnNodeWithDepth(this.currentFocusNode, this.focusDepth);
        }
        
        if (typeof Utils !== 'undefined' && Utils.showNotification) {
            Utils.showNotification(`Focus depth set to ${depth}`, 'info');
        }
    }

    /**
     * Focus on a specific file with animation
     */
    focusOnFile(filePath) {
        if (!this.cy || !filePath) return;

        const node = this.cy.nodes().filter(n => n.data('path') === filePath);
        
        if (node.length > 0) {
            this.focusOnNodeWithDepth(node[0], this.focusDepth);
        }
    }

    /**
     * Focus on a node with specified depth and smooth animation
     */
    focusOnNodeWithDepth(node, depth) {
        if (!this.cy || !node) return;

        this.currentFocusNode = node;
        
        // Get connected nodes based on depth
        let focusNodes = this.cy.collection();
        focusNodes = focusNodes.union(node);
        
        if (depth !== 'all') {
            // Add nodes within the specified depth
            let currentLevel = this.cy.collection().union(node);
            
            for (let i = 0; i < depth; i++) {
                const nextLevel = currentLevel.neighborhood();
                focusNodes = focusNodes.union(nextLevel);
                currentLevel = nextLevel.nodes();
            }
        } else {
            focusNodes = this.cy.elements();
        }
        
        // Get all nodes and edges
        const allNodes = this.cy.nodes();
        const allEdges = this.cy.edges();
        const hiddenNodes = allNodes.difference(focusNodes.nodes());
        const focusEdges = focusNodes.edgesWith(focusNodes);
        const hiddenEdges = allEdges.difference(focusEdges);
        
        // Step 1: Smoothly fade out non-focus elements
        hiddenNodes.animate({
            style: { 'opacity': 0 }
        }, {
            duration: 300,
            easing: 'ease-out',
            complete: () => {
                // Hide them completely after fade out
                hiddenNodes.style({ 'display': 'none' });
            }
        });
        
        hiddenEdges.animate({
            style: { 'opacity': 0 }
        }, {
            duration: 300,
            easing: 'ease-out',
            complete: () => {
                // Hide them completely after fade out
                hiddenEdges.style({ 'display': 'none' });
            }
        });
        
        // Step 2: Ensure focus elements are visible and animate them in
        focusNodes.nodes().style({
            'display': 'element'
        }).animate({
            style: {
                'opacity': 1,
                'background-color': '#a50034'
            }
        }, {
            duration: 400,
            easing: 'ease-out'
        });
        
        focusEdges.style({
            'display': 'element'
        }).animate({
            style: {
                'opacity': 0.7
            }
        }, {
            duration: 400,
            easing: 'ease-out'
        });
        
        // Step 3: Smoothly animate camera to focus on the target node
        setTimeout(() => {
            this.cy.animate({
                center: { eles: node },
                zoom: 1.5
            }, {
                duration: 600,
                easing: 'ease-in-out'
            });
        }, 150); // Small delay to let the fade effects start
        
        // Update selected node
        this.selectNode(node);
    }

    /**
     * Clear focus and show all nodes with smooth animation
     */
    clearFocus() {
        if (!this.cy) return;

        this.currentFocusNode = null;
        
        // First, make all hidden elements visible but transparent
        const hiddenNodes = this.cy.nodes().filter(node => node.style('display') === 'none');
        const hiddenEdges = this.cy.edges().filter(edge => edge.style('display') === 'none');
        
        hiddenNodes.style({
            'display': 'element',
            'opacity': 0
        });
        
        hiddenEdges.style({
            'display': 'element',
            'opacity': 0
        });
        
        // Animate all nodes and edges back to full visibility
        this.cy.nodes().animate({
            style: {
                'opacity': 1,
                'background-color': '#a50034'
            }
        }, {
            duration: 500,
            easing: 'ease-out'
        });
        
        this.cy.edges().animate({
            style: {
                'opacity': 0.7
            }
        }, {
            duration: 500,
            easing: 'ease-out'
        });
        
        // Smoothly animate camera to fit all elements
        setTimeout(() => {
            this.cy.animate({
                fit: {
                    eles: this.cy.elements(),
                    padding: 50
                }
            }, {
                duration: 600,
                easing: 'ease-in-out'
            });
        }, 100); // Small delay to let the fade-in effects start
    }

    /**
     * Destroy the graph view
     */
    destroy() {
        if (this.cy) {
            this.cy.destroy();
            this.cy = null;
        }
        this.hide();
        this.removeAllListeners();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphView;
} else if (typeof window !== 'undefined') {
    window.GraphView = GraphView;
}
