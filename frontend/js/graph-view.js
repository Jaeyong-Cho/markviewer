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
                gravity: 50,
                numIter: 1500,
                initialTemp: 300,
                coolingFactor: 0.95,
                minTemp: 1.0
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#0366d6',
                        'label': 'data(name)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#ffffff',
                        'text-outline-width': 2,
                        'text-outline-color': '#0366d6',
                        'width': 'mapData(degree, 0, 100, 25, 70)',
                        'height': 'mapData(degree, 0, 100, 25, 70)',
                        'font-size': '11px',
                        'font-weight': '600',
                        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        'border-width': 2,
                        'border-color': '#0366d6',
                        'border-opacity': 0.8
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'background-color': '#28a745',
                        'text-outline-color': '#28a745',
                        'border-width': 3,
                        'border-color': '#28a745',
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
                        'background-color': '#28a745',
                        'text-outline-color': '#28a745',
                        'border-color': '#28a745',
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
                        'opacity': 0.7
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'line-color': '#28a745',
                        'target-arrow-color': '#28a745',
                        'width': 3,
                        'opacity': 1
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
                    <span id="graph-stats-orphans">0 orphans</span>
                </div>
                <div class="graph-node-info" id="graph-node-info" style="display: none;">
                    <h4>File Information</h4>
                    <div class="node-info-content">
                        <p><strong>Name:</strong> <span id="node-info-name">-</span></p>
                        <p><strong>Path:</strong> <span id="node-info-path">-</span></p>
                        <p><strong>Incoming:</strong> <span id="node-info-incoming">0</span></p>
                        <p><strong>Outgoing:</strong> <span id="node-info-outgoing">0</span></p>
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
     * Show the graph view
     */
    async show() {
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
        
        // Add class to body for ToC positioning
        document.body.classList.add('graph-panel-open');
        
        // Get current panel width after display is set
        const panelWidth = this.graphPanel.offsetWidth;
        
        // Adjust main content to make room for side panel
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.marginRight = panelWidth + 'px';
        }
        
        // Update ToC position based on panel width
        this.updateToCPosition(panelWidth);
        
        // Adjust graph size to fit the panel
        if (this.cy) {
            setTimeout(() => {
                this.resizeAndAdjustGraph();
            }, 100);
        }
        
        this.isVisible = true;
        this.emit('show');
        console.log('Graph view shown successfully');
    }

    /**
     * Hide the graph view
     */
    hide() {
        if (!this.isVisible) return;

        this.graphPanel.style.display = 'none';
        
        // Reset main content margin
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.marginRight = '0';
        }
        
        // Remove class from body
        document.body.classList.remove('graph-panel-open');
        
        // Reset ToC position custom properties
        document.documentElement.style.removeProperty('--graph-panel-width');
        document.documentElement.style.removeProperty('--toc-right-position');
        document.documentElement.style.removeProperty('--toc-trigger-right-position');
        
        this.isVisible = false;
        this.clearSelection();
        this.emit('hide');
    }

    /**
     * Toggle graph view visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Load and display graph data
     * @param {Object} data - Graph data with nodes and edges
     */
    async loadGraphData(data) {
        console.log('GraphView.loadGraphData() called with data:', data);
        this.graphData = data;
        await this.show();
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
            const isOrphan = node.incomingLinks === 0 && node.outgoingLinks === 0;
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
                    degree: node.incomingLinks + node.outgoingLinks,
                    modified: node.modified,
                    size: node.size
                },
                classes: isOrphan ? 'orphan' : ''
            });
        });

        // Add edges (only if both source and target nodes exist)
        this.graphData.edges.forEach(edge => {
            if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
                elements.push({
                    data: {
                        id: `${edge.source}-${edge.target}`,
                        source: edge.source,
                        target: edge.target,
                        sourcePath: edge.sourcePath,
                        targetPath: edge.targetPath
                    }
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

        // Node hover
        this.cy.on('mouseover', 'node', (event) => {
            const node = event.target;
            this.highlightConnections(node, true);
        });

        this.cy.on('mouseout', 'node', (event) => {
            if (!this.selectedNode) {
                this.clearHighlight();
            }
        });

        // Background click (deselect)
        this.cy.on('tap', (event) => {
            if (event.target === this.cy) {
                this.clearSelection();
            }
        });

        // Double click to open file or focus
        this.cy.on('dbltap', 'node', (event) => {
            const node = event.target;
            
            // If auto focus is enabled, focus on the node, otherwise open the file
            if (this.autoFocus) {
                this.focusOnNodeWithDepth(node, this.focusDepth);
            } else {
                const filePath = node.data('path') || node.data().path;
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
            const type = source.id() === node.id() ? 'outgoing' : 'incoming';
            
            connections.push({
                id: other.id(),
                name: other.data('fullName'),
                type: type
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
            item.innerHTML = `
                <span class="connection-type ${connection.type}">${connection.type}</span>
                <span class="connection-name">${connection.name}</span>
            `;
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
     * Focus on a specific node
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
            duration: 750
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
                idealEdgeLength: 100,
                nodeOverlap: 20,
                refresh: 20,
                randomize: false,
                componentSpacing: 100,
                nodeRepulsion: 400000,
                edgeElasticity: 100,
                nestingFactor: 5,
                gravity: 80,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0
            });
        } else if (layoutName === 'breadthfirst') {
            Object.assign(layoutOptions, {
                directed: true,
                spacingFactor: 1.5
            });
        }

        const layout = this.cy.layout(layoutOptions);
        layout.run();
        
        // Simple fit after layout change without excessive animation
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
            
            // Update main content margin
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.marginRight = newWidth + 'px';
            }
            
            // Update ToC position dynamically
            this.updateToCPosition(newWidth);
            
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
        
        if (node.length === 0) {
            Utils.showNotification('Current file not found in graph', 'warning');
            return;
        }

        // Focus on the node
        this.focusOnNode(node.id());
        
        // Select the node
        this.selectNode(node);
        
        Utils.showNotification('Focused on current file', 'success');
    }

    /**
     * Focus on a specific node
     */
    focusOnNode(nodeId) {
        if (!this.cy) return;

        const node = this.cy.getElementById(nodeId);
        if (node.length === 0) return;

        // Animate to focus on the node
        this.cy.animate({
            center: {
                eles: node
            },
            zoom: 2
        }, {
            duration: 500,
            easing: 'ease-out'
        });

        // Highlight the node temporarily
        node.addClass('highlighted');
        setTimeout(() => {
            node.removeClass('highlighted');
        }, 1500);
    }

    /**
     * Update ToC and toggle button positions based on graph panel width
     */
    updateToCPosition(panelWidth) {
        const tocSidebar = document.querySelector('.toc-sidebar');
        const tocHoverTrigger = document.querySelector('.toc-hover-trigger');
        const tocShowBtn = document.querySelector('.toc-show-btn');
        const tocHideBtn = document.querySelector('.toc-hide-btn');
        
        if (tocSidebar && tocHoverTrigger) {
            // Calculate new positions with 16px margin
            const tocRightPosition = panelWidth + 16;
            const triggerRightPosition = panelWidth;
            
            // Update CSS custom properties for dynamic positioning
            document.documentElement.style.setProperty('--graph-panel-width', panelWidth + 'px');
            document.documentElement.style.setProperty('--toc-right-position', tocRightPosition + 'px');
            document.documentElement.style.setProperty('--toc-trigger-right-position', triggerRightPosition + 'px');
        }
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
     * Focus on a node with specified depth and animation
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
        
        // Hide non-focus nodes completely
        const allNodes = this.cy.nodes();
        const allEdges = this.cy.edges();
        const hiddenNodes = allNodes.difference(focusNodes.nodes());
        const focusEdges = focusNodes.edgesWith(focusNodes);
        const hiddenEdges = allEdges.difference(focusEdges);
        
        // Completely hide nodes and edges outside focus area
        hiddenNodes.style({
            'display': 'none'
        });
        
        hiddenEdges.style({
            'display': 'none'
        });
        
        // Show focus nodes and edges
        focusNodes.nodes().style({
            'display': 'element',
            'opacity': 1,
            'background-color': '#0366d6'
        });
        
        focusEdges.style({
            'display': 'element',
            'opacity': 0.7
        });
        
        // Focus and zoom to the target node with animation
        this.cy.animate({
            center: {
                eles: node
            },
            zoom: 1.5
        }, {
            duration: 500,
            easing: 'ease-out'
        });
        
        // Update selected node
        this.selectNode(node);
    }

    /**
     * Clear focus and show all nodes
     */
    clearFocus() {
        if (!this.cy) return;

        this.currentFocusNode = null;
        
        // Show all nodes and edges
        this.cy.nodes().style({
            'display': 'element',
            'opacity': 1,
            'background-color': '#0366d6'
        });
        
        this.cy.edges().style({
            'display': 'element',
            'opacity': 0.7
        });
        
        // Fit to view
        this.cy.animate({
            fit: {
                eles: this.cy.elements(),
                padding: 50
            }
        }, {
            duration: 500,
            easing: 'ease-out'
        });
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
