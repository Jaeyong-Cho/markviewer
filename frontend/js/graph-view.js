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
            return;
        }
        
        this.graphData = null;
        this.isVisible = false;
        this.selectedNode = null;
        
        // Cytoscape instance
        this.cy = null;
        
        // Graph settings
        this.settings = {
            layout: {
                name: 'cose',
                idealEdgeLength: 100,
                nodeOverlap: 20,
                refresh: 20,
                fit: true,
                padding: 30,
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
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#4f81bd',
                        'label': 'data(name)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#ffffff',
                        'text-outline-width': 2,
                        'text-outline-color': '#4f81bd',
                        'width': 'mapData(degree, 0, 100, 20, 60)',
                        'height': 'mapData(degree, 0, 100, 20, 60)',
                        'font-size': '10px',
                        'font-weight': 'bold'
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'background-color': '#ff6b6b',
                        'text-outline-color': '#ff6b6b',
                        'border-width': 3,
                        'border-color': '#ff0000'
                    }
                },
                {
                    selector: 'node.orphan',
                    style: {
                        'background-color': '#95a5a6',
                        'text-outline-color': '#95a5a6'
                    }
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'background-color': '#ff6b6b',
                        'text-outline-color': '#ff6b6b'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#999',
                        'target-arrow-color': '#999',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.2
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'line-color': '#ff6b6b',
                        'target-arrow-color': '#ff6b6b',
                        'width': 3
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
            <div class="graph-view-container" style="display: none;">
                <div class="graph-controls">
                    <div class="graph-toolbar">
                        <button class="graph-btn" id="graph-reset-zoom" title="Reset Zoom">
                            <span class="icon">🔍</span> Reset Zoom
                        </button>
                        <button class="graph-btn" id="graph-center-view" title="Center View">
                            <span class="icon">🎯</span> Center
                        </button>
                        <button class="graph-btn" id="graph-fit-view" title="Fit to View">
                            <span class="icon">📐</span> Fit
                        </button>
                        <div class="graph-search">
                            <input type="text" id="graph-search-input" placeholder="Search files..." class="graph-search-input">
                            <button class="graph-btn" id="graph-clear-search" title="Clear Search">✕</button>
                        </div>
                        <div class="graph-layout-selector">
                            <select id="graph-layout-select" class="graph-layout-select">
                                <option value="cose">Force Directed</option>
                                <option value="circle">Circle</option>
                                <option value="grid">Grid</option>
                                <option value="breadthfirst">Hierarchical</option>
                                <option value="concentric">Concentric</option>
                            </select>
                        </div>
                        <button class="graph-btn graph-close" id="graph-close" title="Close Graph View">
                            <span class="icon">✕</span> Close
                        </button>
                    </div>
                    <div class="graph-stats">
                        <span id="graph-stats-files">0 files</span>
                        <span class="graph-stats-separator">•</span>
                        <span id="graph-stats-links">0 links</span>
                        <span class="graph-stats-separator">•</span>
                        <span id="graph-stats-orphans">0 orphans</span>
                    </div>
                </div>
                <div class="graph-content">
                    <div class="graph-canvas" id="graph-canvas"></div>
                    <div class="graph-sidebar">
                        <div class="graph-node-info" id="graph-node-info" style="display: none;">
                            <h3>File Information</h3>
                            <div class="node-info-content">
                                <p><strong>Name:</strong> <span id="node-info-name">-</span></p>
                                <p><strong>Path:</strong> <span id="node-info-path">-</span></p>
                                <p><strong>Incoming Links:</strong> <span id="node-info-incoming">0</span></p>
                                <p><strong>Outgoing Links:</strong> <span id="node-info-outgoing">0</span></p>
                                <p><strong>Modified:</strong> <span id="node-info-modified">-</span></p>
                            </div>
                            <div class="node-connections">
                                <h4>Connected Files</h4>
                                <div id="node-connections-list" class="connections-list"></div>
                            </div>
                            <div class="node-actions">
                                <button class="graph-btn" id="node-open-file">Open File</button>
                                <button class="graph-btn" id="node-focus">Focus</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.graphContainer = this.container.querySelector('.graph-view-container');
        this.graphCanvas = this.container.querySelector('#graph-canvas');
        this.nodeInfoPanel = this.container.querySelector('#graph-node-info');
    }

    /**
     * Create graph controls and toolbar
     */
    createControls() {
        this.controls = {
            resetZoom: this.container.querySelector('#graph-reset-zoom'),
            centerView: this.container.querySelector('#graph-center-view'),
            fitView: this.container.querySelector('#graph-fit-view'),
            searchInput: this.container.querySelector('#graph-search-input'),
            clearSearch: this.container.querySelector('#graph-clear-search'),
            layoutSelect: this.container.querySelector('#graph-layout-select'),
            closeGraph: this.container.querySelector('#graph-close'),
            statsFiles: this.container.querySelector('#graph-stats-files'),
            statsLinks: this.container.querySelector('#graph-stats-links'),
            statsOrphans: this.container.querySelector('#graph-stats-orphans')
        };
    }

    /**
     * Setup event listeners for controls
     */
    setupEventListeners() {
        // Control buttons
        this.controls.resetZoom.addEventListener('click', () => this.resetZoom());
        this.controls.centerView.addEventListener('click', () => this.centerView());
        this.controls.fitView.addEventListener('click', () => this.fitToView());
        this.controls.clearSearch.addEventListener('click', () => this.clearSearch());
        this.controls.closeGraph.addEventListener('click', () => this.hide());
        
        // Layout selector
        this.controls.layoutSelect.addEventListener('change', (e) => {
            this.changeLayout(e.target.value);
        });
        
        // Search functionality
        this.controls.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        // Node info panel actions
        const openFileBtn = this.container.querySelector('#node-open-file');
        const focusBtn = this.container.querySelector('#node-focus');
        
        if (openFileBtn) {
            openFileBtn.addEventListener('click', () => {
                if (this.selectedNode) {
                    this.emit('fileSelect', this.selectedNode.data.path);
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

        // Resize handling
        window.addEventListener('resize', () => {
            if (this.isVisible && this.cy) {
                this.cy.resize();
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

        console.log('Showing graph container');
        this.graphContainer.style.display = 'block';
        this.isVisible = true;
        this.emit('show');
        console.log('Graph view shown successfully');
    }

    /**
     * Hide the graph view
     */
    hide() {
        if (!this.isVisible) return;

        this.graphContainer.style.display = 'none';
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

        // Double click to focus
        this.cy.on('dbltap', 'node', (event) => {
            const node = event.target;
            this.focusOnNode(node.id());
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
