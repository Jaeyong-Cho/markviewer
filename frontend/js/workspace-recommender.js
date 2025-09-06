/**
 * Workspace Recommender Component
 * Provides intelligent workspace directory scanning and recommendations
 */

class WorkspaceRecommender extends Utils.EventEmitter {
    constructor(app) {
        super();
        this.app = app;
        this.currentScanId = null;
        this.scanProgress = null;
        this.recommendations = [];
        this.isScanning = false;
        
        // DOM elements will be created dynamically
        this.elements = {};
        
        // Bind methods
        this.handleScanClick = this.handleScanClick.bind(this);
        this.handleCancelClick = this.handleCancelClick.bind(this);
        this.handleRecommendationClick = this.handleRecommendationClick.bind(this);
        this.updateProgress = this.updateProgress.bind(this);
        
        console.log('WorkspaceRecommender initialized');
    }

    /**
     * Initialize the recommender UI
     */
    init() {
        this.createRecommenderUI();
        this.loadCachedRecommendations();
    }

    /**
     * Create the recommender UI elements
     */
    createRecommenderUI() {
        const workspaceSelector = document.querySelector('.workspace-selector');
        if (!workspaceSelector) {
            console.error('Workspace selector not found');
            return;
        }

        // Create scan button
        const scanButton = document.createElement('button');
        scanButton.id = 'workspace-scan-btn';
        scanButton.className = 'workspace-scan-btn';
        scanButton.innerHTML = `
            <span class="scan-icon">🔍</span>
            <span class="scan-text">Scan for Workspaces</span>
        `;
        scanButton.addEventListener('click', this.handleScanClick);
        
        // Create progress container
        const progressContainer = document.createElement('div');
        progressContainer.id = 'scan-progress';
        progressContainer.className = 'scan-progress hidden';
        progressContainer.innerHTML = `
            <div class="progress-header">
                <span class="progress-text">Scanning directories...</span>
                <button id="scan-cancel-btn" class="scan-cancel-btn" title="Cancel scan">×</button>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-details">
                <span class="current-directory"></span>
                <span class="scan-stats">Found 0 workspaces</span>
            </div>
        `;
        
        // Create recommendations container
        const recommendationsContainer = document.createElement('div');
        recommendationsContainer.id = 'workspace-recommendations';
        recommendationsContainer.className = 'workspace-recommendations hidden';
        recommendationsContainer.innerHTML = `
            <div class="recommendations-header">
                <span class="recommendations-title">📁 Workspace Recommendations</span>
                <span class="recommendations-count">0 found</span>
            </div>
            <div class="recommendations-list"></div>
            <div class="recommendations-footer">
                <button id="scan-again-btn" class="scan-again-btn">Scan Again</button>
                <button id="recommendations-close-btn" class="recommendations-close-btn">Close</button>
            </div>
        `;

        // Insert elements after workspace input container
        const inputContainer = workspaceSelector.querySelector('.workspace-input-container');
        if (inputContainer) {
            inputContainer.after(scanButton);
            scanButton.after(progressContainer);
            progressContainer.after(recommendationsContainer);
        }

        // Cache elements
        this.elements = {
            scanButton,
            progressContainer,
            recommendationsContainer,
            progressText: progressContainer.querySelector('.progress-text'),
            progressFill: progressContainer.querySelector('.progress-fill'),
            currentDirectory: progressContainer.querySelector('.current-directory'),
            scanStats: progressContainer.querySelector('.scan-stats'),
            recommendationsList: recommendationsContainer.querySelector('.recommendations-list'),
            recommendationsCount: recommendationsContainer.querySelector('.recommendations-count'),
            cancelButton: progressContainer.querySelector('#scan-cancel-btn'),
            scanAgainButton: recommendationsContainer.querySelector('#scan-again-btn'),
            closeButton: recommendationsContainer.querySelector('#recommendations-close-btn')
        };

        // Add event listeners
        this.elements.cancelButton.addEventListener('click', this.handleCancelClick);
        this.elements.scanAgainButton.addEventListener('click', this.handleScanClick);
        this.elements.closeButton.addEventListener('click', () => this.hideRecommendations());

        console.log('Workspace recommender UI created');
    }

    /**
     * Handle scan button click
     */
    async handleScanClick() {
        if (this.isScanning) {
            console.log('Scan already in progress');
            return;
        }

        try {
            console.log('Starting workspace scan...');
            
            this.isScanning = true;
            this.showProgress();
            this.hideRecommendations();
            
            // Start scan with default options
            const response = await window.api.startWorkspaceScan({
                maxDepth: 3,
                minMarkdownFiles: 2
            });
            
            this.currentScanId = response.scanId;
            console.log(`Scan started with ID: ${this.currentScanId}`);
            
            // Start polling for progress
            this.startProgressPolling();
            
        } catch (error) {
            console.error('Failed to start scan:', error);
            Utils.showNotification('Failed to start workspace scan: ' + error.message, 'error');
            this.isScanning = false;
            this.hideProgress();
        }
    }

    /**
     * Handle cancel button click
     */
    async handleCancelClick() {
        if (!this.currentScanId) return;

        try {
            await window.api.cancelScan(this.currentScanId);
            console.log('Scan cancelled');
            this.stopProgressPolling();
            this.isScanning = false;
            this.hideProgress();
            Utils.showNotification('Scan cancelled', 'info');
        } catch (error) {
            console.error('Failed to cancel scan:', error);
            Utils.showNotification('Failed to cancel scan: ' + error.message, 'error');
        }
    }

    /**
     * Handle recommendation item click
     */
    handleRecommendationClick(workspace) {
        console.log('Selecting workspace:', workspace.path);
        
        // Update the workspace input
        this.app.elements.workspaceInput.value = workspace.path;
        
        // Trigger workspace selection
        this.app.setRootDirectory(workspace.path);
        
        // Hide recommendations
        this.hideRecommendations();
        
        Utils.showNotification(`Workspace selected: ${workspace.name}`, 'success');
    }

    /**
     * Start progress polling
     */
    startProgressPolling() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.progressInterval = setInterval(async () => {
            if (!this.currentScanId || !this.isScanning) {
                this.stopProgressPolling();
                return;
            }

            try {
                const progress = await window.api.getScanProgress(this.currentScanId);
                this.updateProgress(progress);

                if (progress.status === 'completed') {
                    this.onScanCompleted(progress);
                } else if (progress.status === 'error' || progress.status === 'cancelled') {
                    this.onScanError(progress);
                }
            } catch (error) {
                console.error('Error getting scan progress:', error);
                this.onScanError({ error: error.message });
            }
        }, 1000); // Poll every second
    }

    /**
     * Stop progress polling
     */
    stopProgressPolling() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    /**
     * Update progress display
     */
    updateProgress(progress) {
        if (!progress || !this.elements.progressContainer) return;

        const { scannedDirectories, totalDirectories, currentDirectory, foundWorkspaces } = progress.progress || {};
        
        // Update progress bar
        const percentage = totalDirectories > 0 ? Math.round((scannedDirectories / totalDirectories) * 100) : 0;
        this.elements.progressFill.style.width = `${percentage}%`;
        
        // Update text
        this.elements.progressText.textContent = `Scanning directories... (${scannedDirectories}/${totalDirectories})`;
        
        // Update current directory (truncate if too long)
        if (currentDirectory) {
            const truncated = currentDirectory.length > 50 
                ? '...' + currentDirectory.slice(-47) 
                : currentDirectory;
            this.elements.currentDirectory.textContent = truncated;
        }
        
        // Update stats
        this.elements.scanStats.textContent = `Found ${foundWorkspaces || 0} workspaces`;
    }

    /**
     * Handle scan completion
     */
    onScanCompleted(progress) {
        console.log('Scan completed:', progress);
        
        this.stopProgressPolling();
        this.isScanning = false;
        this.currentScanId = null;
        this.hideProgress();
        
        this.recommendations = progress.recommendations || [];
        
        if (this.recommendations.length > 0) {
            this.showRecommendations();
            Utils.showNotification(`Found ${this.recommendations.length} workspace recommendations`, 'success');
        } else {
            Utils.showNotification('No workspace recommendations found', 'info');
        }
    }

    /**
     * Handle scan error
     */
    onScanError(progress) {
        console.error('Scan error:', progress);
        
        this.stopProgressPolling();
        this.isScanning = false;
        this.currentScanId = null;
        this.hideProgress();
        
        const errorMessage = progress.error || 'Unknown error occurred';
        Utils.showNotification('Scan failed: ' + errorMessage, 'error');
    }

    /**
     * Show progress UI
     */
    showProgress() {
        this.elements.scanButton.disabled = true;
        this.elements.progressContainer.classList.remove('hidden');
        
        // Reset progress
        this.elements.progressFill.style.width = '0%';
        this.elements.progressText.textContent = 'Starting scan...';
        this.elements.currentDirectory.textContent = '';
        this.elements.scanStats.textContent = 'Found 0 workspaces';
    }

    /**
     * Hide progress UI
     */
    hideProgress() {
        this.elements.scanButton.disabled = false;
        this.elements.progressContainer.classList.add('hidden');
    }

    /**
     * Show recommendations UI
     */
    showRecommendations() {
        this.elements.recommendationsContainer.classList.remove('hidden');
        this.displayRecommendations();
    }

    /**
     * Hide recommendations UI
     */
    hideRecommendations() {
        this.elements.recommendationsContainer.classList.add('hidden');
    }

    /**
     * Display recommendations in the UI
     */
    displayRecommendations() {
        if (!this.elements.recommendationsList) return;

        // Update count
        this.elements.recommendationsCount.textContent = `${this.recommendations.length} found`;

        // Clear existing recommendations
        this.elements.recommendationsList.innerHTML = '';

        if (this.recommendations.length === 0) {
            this.elements.recommendationsList.innerHTML = `
                <div class="no-recommendations">
                    <span class="no-recommendations-icon">📂</span>
                    <span class="no-recommendations-text">No workspace recommendations found</span>
                    <span class="no-recommendations-hint">Try scanning with different settings or check your directories</span>
                </div>
            `;
            return;
        }

        // Create recommendation items
        this.recommendations.forEach((workspace, index) => {
            const item = this.createRecommendationItem(workspace, index);
            this.elements.recommendationsList.appendChild(item);
        });
    }

    /**
     * Create a recommendation item element
     */
    createRecommendationItem(workspace, index) {
        const item = document.createElement('div');
        item.className = 'recommendation-item';
        item.setAttribute('data-index', index);
        
        // Generate star rating
        const stars = '★'.repeat(Math.ceil(workspace.score * 5));
        const emptyStars = '☆'.repeat(5 - Math.ceil(workspace.score * 5));
        
        // Format last modified
        const lastModified = workspace.lastModified 
            ? new Date(workspace.lastModified).toLocaleDateString()
            : 'Unknown';
        
        // Create preview structure
        const previewItems = workspace.preview?.structure?.slice(0, 3) || [];
        const moreCount = (workspace.preview?.structure?.length || 0) - 3;
        
        item.innerHTML = `
            <div class="recommendation-header">
                <div class="recommendation-path">
                    <span class="path-name">${workspace.name}</span>
                    <span class="path-full" title="${workspace.path}">${workspace.path}</span>
                </div>
                <div class="recommendation-score" title="Score: ${(workspace.score * 100).toFixed(0)}%">
                    <span class="stars">${stars}${emptyStars}</span>
                </div>
            </div>
            <div class="recommendation-details">
                <span class="detail-item">📄 ${workspace.markdownCount} files</span>
                <span class="detail-item">📁 ${workspace.subdirectories?.length || 0} folders</span>
                <span class="detail-item">📅 ${lastModified}</span>
            </div>
            <div class="recommendation-preview">
                ${previewItems.map(item => `<span class="preview-item">${item}</span>`).join('')}
                ${moreCount > 0 ? `<span class="preview-more">+${moreCount} more...</span>` : ''}
            </div>
        `;

        // Add click handler
        item.addEventListener('click', () => {
            this.handleRecommendationClick(workspace);
        });

        // Add hover effects
        item.addEventListener('mouseenter', () => {
            item.classList.add('hover');
        });
        
        item.addEventListener('mouseleave', () => {
            item.classList.remove('hover');
        });

        return item;
    }

    /**
     * Load cached recommendations if available
     */
    async loadCachedRecommendations() {
        try {
            const response = await window.api.getCachedRecommendations();
            
            if (response.recommendations && response.recommendations.length > 0) {
                this.recommendations = response.recommendations;
                console.log(`Loaded ${this.recommendations.length} cached recommendations`);
                
                // Show scan button with indicator that cached recommendations are available
                if (this.elements.scanButton) {
                    this.elements.scanButton.innerHTML = `
                        <span class="scan-icon">🔍</span>
                        <span class="scan-text">Scan for Workspaces</span>
                        <span class="cached-indicator" title="${this.recommendations.length} cached recommendations">(${this.recommendations.length})</span>
                    `;
                }
            }
        } catch (error) {
            console.log('No cached recommendations available:', error.message);
        }
    }

    /**
     * Show cached recommendations
     */
    showCachedRecommendations() {
        if (this.recommendations.length > 0) {
            this.showRecommendations();
        } else {
            Utils.showNotification('No cached recommendations available', 'info');
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stopProgressPolling();
        
        // Remove event listeners and DOM elements
        if (this.elements.scanButton) {
            this.elements.scanButton.remove();
        }
        if (this.elements.progressContainer) {
            this.elements.progressContainer.remove();
        }
        if (this.elements.recommendationsContainer) {
            this.elements.recommendationsContainer.remove();
        }
        
        console.log('WorkspaceRecommender destroyed');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WorkspaceRecommender = WorkspaceRecommender;
}
