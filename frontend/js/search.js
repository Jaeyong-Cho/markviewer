/**
 * Search component for full-text search across markdown files
 */

class SearchComponent extends Utils.EventEmitter {
    constructor(app) {
        super();
        
        // Store reference to main app instance for state access
        this.app = app;
        
        // Cache DOM elements
        this.searchInput = document.getElementById('search-input');
        this.searchClear = document.getElementById('search-clear');
        this.searchResults = document.getElementById('search-results');
        this.searchResultsList = document.getElementById('search-results-list');
        this.searchQuery = document.getElementById('search-query');
        this.searchCount = document.getElementById('search-count');
        
        // Verify critical elements exist
        if (!this.searchInput) {
            console.error('Search input element not found');
            return;
        }
        
        // Verify app instance is provided
        if (!this.app) {
            console.error('SearchComponent requires app instance for state access');
            return;
        }
        
        // Search state
        this.currentQuery = '';
        this.currentResults = null;
        this.searchTimeout = null;
        this.isSearching = false;
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for search functionality
     */
    setupEventListeners() {
        if (!this.searchInput) {
            console.warn('Search input not found, skipping event listeners setup');
            return;
        }

        // Search input events
        this.searchInput.addEventListener('input', (event) => {
            this.handleSearchInput(event.target.value);
        });

        this.searchInput.addEventListener('keydown', (event) => {
            this.handleSearchKeydown(event);
        });

        this.searchInput.addEventListener('focus', () => {
            this.showSearchShortcuts();
        });

        this.searchInput.addEventListener('blur', () => {
            this.hideSearchShortcuts();
        });

        // Clear button
        if (this.searchClear) {
            this.searchClear.addEventListener('click', () => {
                this.clear();
            });
        }

        // Handle result clicks
        if (this.searchResultsList) {
            this.searchResultsList.addEventListener('click', (event) => {
                this.handleResultClick(event);
            });
        }
    }

    /**
     * Handle search input changes with debouncing
     * @param {string} query - Search query
     */
    handleSearchInput(query) {
        this.currentQuery = query.trim();
        
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Update clear button visibility
        this.updateClearButtonVisibility();
        
        // If query is empty, clear results
        if (!this.currentQuery) {
            this.clear();
            return;
        }
        
        // Debounce search execution
        this.searchTimeout = setTimeout(() => {
            this.executeSearch(this.currentQuery);
        }, 300);
    }

    /**
     * Handle keyboard shortcuts in search input
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleSearchKeydown(event) {
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                if (this.currentQuery) {
                    this.executeSearch(this.currentQuery);
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                this.clear();
                this.searchInput.blur();
                break;
                
            case 'ArrowDown':
                event.preventDefault();
                this.focusFirstResult();
                break;
        }
    }

    /**
     * Execute search with the given query
     * @param {string} query - Search query
     */
    async executeSearch(query) {
        if (!query || this.isSearching) return;
        
        console.log('Search executing:', { query, rootDirectory: this.app.state.rootDirectory });
        
        // Check if root directory is selected
        if (!this.app.state.rootDirectory) {
            Utils.showNotification('Please select a workspace directory first', 'error');
            return;
        }
        
        try {
            this.setSearchingState(true);
            
            // Execute search via API
            const results = await window.api.searchFiles(query, this.app.state.rootDirectory);
            
            console.log('Search API response:', results);
            
            this.currentResults = results;
            this.emit('searchResults', results);
            
            console.log(`Search completed: ${results.total} results for "${query}"`);
        } catch (error) {
            console.error('Search failed:', error);
            Utils.showNotification('Search failed: ' + error.message, 'error');
            this.showSearchError(error);
        } finally {
            this.setSearchingState(false);
        }
    }

    /**
     * Display search results
     * @param {Object} results - Search results object
     */
    displayResults(results) {
        if (!results) return;
        
        // Update search header
        this.searchQuery.textContent = `"${results.query}"`;
        this.searchCount.textContent = `${results.total} result${results.total !== 1 ? 's' : ''}`;
        
        // Clear previous results
        this.searchResultsList.innerHTML = '';
        
        if (results.total === 0) {
            this.showNoResults(results.query);
            return;
        }
        
        // Render results
        results.results.forEach((result, index) => {
            const resultElement = this.createResultElement(result, index);
            this.searchResultsList.appendChild(resultElement);
        });
        
        // Show results container
        this.searchResults.classList.remove('hidden');
    }

    /**
     * Create a search result element
     * @param {Object} result - Search result data
     * @param {number} index - Result index
     * @returns {HTMLElement} Result element
     */
    createResultElement(result, index) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'search-result';
        resultDiv.setAttribute('data-path', result.file);
        resultDiv.setAttribute('tabindex', '0');
        resultDiv.setAttribute('role', 'button');
        
        // Create match details
        const matchDetails = [];
        if (result.filenameMatches > 0) {
            matchDetails.push(`${result.filenameMatches} filename`);
        }
        if (result.contentMatches > 0) {
            matchDetails.push(`${result.contentMatches} content`);
        }
        const matchText = matchDetails.length > 0 ? matchDetails.join(', ') : `${result.matches}`;
        
        resultDiv.innerHTML = `
            <div class="search-result-header">
                <h3 class="search-result-title">${Utils.escapeHtml(result.title)}</h3>
                <span class="search-result-path">${Utils.escapeHtml(result.relativePath)}</span>
            </div>
            <div class="search-result-meta">
                <span class="search-result-matches">${matchText} match${result.matches !== 1 ? 'es' : ''}</span>
                <div class="search-result-actions">
                    <button class="search-result-preview-btn" onclick="event.stopPropagation(); this.closest('.search-result').classList.toggle('show-preview')">
                        Preview
                    </button>
                    ${result.preview ? `
                        <button class="search-result-expand-btn" onclick="event.stopPropagation(); window.searchComponent.expandPreview('${Utils.escapeHtml(result.file)}')">
                            Expand
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="search-result-snippets">
                ${result.snippets.map(snippet => this.createSnippetElement(snippet)).join('')}
            </div>
            ${result.preview ? `
                <div class="search-result-preview">
                    <div class="search-result-preview-content">
                        ${Utils.escapeHtml(result.preview)}
                    </div>
                </div>
            ` : ''}
        `;
        
        // Add click handler
        resultDiv.addEventListener('click', () => {
            this.selectResult(result.file);
        });
        
        // Add keyboard handler
        resultDiv.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.selectResult(result.file);
            }
        });
        
        return resultDiv;
    }

    /**
     * Create a snippet element
     * @param {Object} snippet - Snippet data
     * @returns {string} Snippet HTML
     */
    createSnippetElement(snippet) {
        const snippetClass = snippet.isFilename ? 'search-snippet filename-match' : 'search-snippet';
        const label = snippet.isFilename ? 'FILE' : 'CONTENT';
        
        return `
            <div class="${snippetClass}">
                <div class="search-snippet-content">
                    <span class="search-snippet-label">${label}</span>
                    ${snippet.content}
                </div>
                <div class="search-snippet-context">${snippet.context}</div>
            </div>
        `;
    }

    /**
     * Show no results message
     * @param {string} query - Search query
     */
    showNoResults(query) {
        this.searchResultsList.innerHTML = `
            <div class="search-no-results">
                <h3>No results found</h3>
                <p>No files contain "${Utils.escapeHtml(query)}"</p>
                <div class="search-suggestions">
                    <h4>Search tips:</h4>
                    <ul>
                        <li>Check your spelling</li>
                        <li>Try different keywords</li>
                        <li>Use simpler terms</li>
                        <li>Make sure you're in the right directory</li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Show search error
     * @param {Error} error - Error object
     */
    showSearchError(error) {
        this.searchResultsList.innerHTML = `
            <div class="search-error">
                <h3>Search Error</h3>
                <p>Failed to search files: ${Utils.escapeHtml(error.message)}</p>
                <button onclick="this.parentElement.style.display='none'">Dismiss</button>
            </div>
        `;
    }

    /**
     * Handle result click
     * @param {Event} event - Click event
     */
    handleResultClick(event) {
        const resultElement = event.target.closest('.search-result');
        if (!resultElement) return;
        
        const filePath = resultElement.dataset.path;
        this.selectResult(filePath);
    }

    /**
     * Select a search result
     * @param {string} filePath - File path to select
     */
    selectResult(filePath) {
        this.emit('resultSelect', filePath);
    }

    /**
     * Focus first search result
     */
    focusFirstResult() {
        const firstResult = this.searchResultsList.querySelector('.search-result');
        if (firstResult) {
            firstResult.focus();
        }
    }

    /**
     * Set searching state
     * @param {boolean} isSearching - Whether search is in progress
     */
    setSearchingState(isSearching) {
        this.isSearching = isSearching;
        
        if (isSearching) {
            this.searchInput.classList.add('searching');
            this.showSearchLoading();
        } else {
            this.searchInput.classList.remove('searching');
        }
    }

    /**
     * Show search loading state
     */
    showSearchLoading() {
        this.searchResultsList.innerHTML = `
            <div class="search-loading">
                <div class="spinner"></div>
                <p>Searching files...</p>
            </div>
        `;
        this.searchResults.classList.remove('hidden');
    }

    /**
     * Update clear button visibility
     */
    updateClearButtonVisibility() {
        if (!this.searchClear) return;
        
        if (this.currentQuery) {
            this.searchClear.style.opacity = '1';
            this.searchClear.style.pointerEvents = 'auto';
        } else {
            this.searchClear.style.opacity = '0';
            this.searchClear.style.pointerEvents = 'none';
        }
    }

    /**
     * Show search shortcuts tooltip
     */
    showSearchShortcuts() {
        // This could show a tooltip with keyboard shortcuts
        // Implementation depends on design requirements
    }

    /**
     * Hide search shortcuts tooltip
     */
    hideSearchShortcuts() {
        // Hide the shortcuts tooltip
    }

    /**
     * Clear search input and results
     */
    clear() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.currentQuery = '';
        this.currentResults = null;
        
        // Clear timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
        
        // Update UI
        this.updateClearButtonVisibility();
        if (this.searchResults) {
            this.searchResults.classList.add('hidden');
        }
        this.setSearchingState(false);
        
        // Emit clear event
        this.emit('searchClear');
    }

    /**
     * Get current search query
     * @returns {string} Current query
     */
    getCurrentQuery() {
        return this.currentQuery;
    }

    /**
     * Get current search results
     * @returns {Object|null} Current results
     */
    getCurrentResults() {
        return this.currentResults;
    }

    /**
     * Set search query programmatically
     * @param {string} query - Query to set
     */
    setQuery(query) {
        this.searchInput.value = query;
        this.handleSearchInput(query);
    }

    /**
     * Focus search input
     */
    focus() {
        this.searchInput.focus();
        this.searchInput.select();
    }

    /**
     * Check if search is active
     * @returns {boolean} True if search is active
     */
    isActive() {
        return this.currentQuery.length > 0 || !this.searchResults.classList.contains('hidden');
    }

    /**
     * Expand preview in a modal or full view
     * @param {string} filePath - Path to the file to expand
     */
    expandPreview(filePath) {
        // Emit event to open file in main content area
        this.emit('openFile', filePath);
        
        // Optionally close search results to give more space
        // this.clear();
    }

    /**
     * Get search statistics
     * @returns {Object} Search statistics
     */
    getStats() {
        return {
            currentQuery: this.currentQuery,
            isSearching: this.isSearching,
            hasResults: !!this.currentResults,
            resultCount: this.currentResults ? this.currentResults.total : 0
        };
    }

    /**
     * Export search results
     * @returns {Array} Exportable results data
     */
    exportResults() {
        if (!this.currentResults) return [];
        
        return this.currentResults.results.map(result => ({
            file: result.file,
            title: result.title,
            matches: result.matches,
            snippets: result.snippets.map(snippet => ({
                content: Utils.extractTextFromHtml(snippet.content),
                context: snippet.context
            }))
        }));
    }
}

// Make SearchComponent available globally
window.SearchManager = SearchComponent;
window.SearchComponent = SearchComponent;
