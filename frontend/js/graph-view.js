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
            <div class="graph-panel">
                <div class="graph-resizer" id="graph-resizer"></div>
                <div class="graph-header">
                    <h3>Document Graph</h3>
                    <div class="graph-header-controls">
                        <button class="graph-btn graph-btn-small" id="graph-refresh" title="Refresh Graph">
                            <span class="icon">�</span>
                        </button>
                        <button class="graph-btn graph-btn-small" id="graph-center-current" title="Focus Current File">
                            <span class="icon">🎯</span>
                        </button>
                        <button class="graph-btn graph-btn-small" id="graph-fit-view" title="Fit to View">
                            <span class="icon">📐</span>
                        </button>
                        <select id="graph-layout-select" class="graph-layout-select">
                            <option value="cose">Force</option>
                            <option value="circle">Circle</option>
                            <option value="grid">Grid</option>
                            <option value="breadthfirst">Tree</option>
                            <option value="concentric">Concentric</option>
                        </select>
                        <button class="graph-btn graph-btn-small graph-close" id="graph-close" title="Close Graph">
                            <span class="icon">✕</span>
                        </button>
                    </div>
                </div>
                <div class="graph-search-bar">
                    <input type="text" id="graph-search-input" placeholder="Search files..." class="graph-search-input">
                    <button class="graph-btn graph-btn-small" id="graph-clear-search" title="Clear Search">✕</button>
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
            refreshBtn: this.container.querySelector('#graph-refresh'),
            centerCurrentBtn: this.container.querySelector('#graph-center-current'),
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
        // Control buttons - with null checks
        if (this.controls.refreshBtn) {
            this.controls.refreshBtn.addEventListener('click', () => this.refreshGraph());
        }
        
        if (this.controls.centerCurrentBtn) {
            this.controls.centerCurrentBtn.addEventListener('click', () => this.focusCurrentFile());
        }
        
        if (this.controls.fitView) {
            this.controls.fitView.addEventListener('click', () => this.fitToView());
        }
        
        if (this.controls.clearSearch) {
            this.controls.clearSearch.addEventListener('click', () => this.clearSearch());
        }
        
        if (this.controls.closeGraph) {
            this.controls.closeGraph.addEventListener('click', () => this.hide());
        }
        
        // Layout selector
        if (this.controls.layoutSelect) {
            this.controls.layoutSelect.addEventListener('change', (e) => {
                this.changeLayout(e.target.value);
            });
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
        
        // Ensure the graph fits the current panel size after layout change
        layout.on('layoutstop', () => {
            setTimeout(() => {
                this.resizeAndAdjustGraph();
            }, 100);
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
            
            // Resize and adjust cytoscape canvas
            if (this.cy) {
                this.resizeAndAdjustGraph();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
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
        
        // Get current viewport and zoom
        const zoom = this.cy.zoom();
        const pan = this.cy.pan();
        
        // Fit the graph to the new container size with animation
        this.cy.animate({
            fit: {
                eles: this.cy.elements(),
                padding: 50
            }
        }, {
            duration: 300,
            easing: 'ease-out'
        });
        
        // Update graph statistics after resize
        setTimeout(() => {
            this.updateGraphStats();
        }, 350);
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
