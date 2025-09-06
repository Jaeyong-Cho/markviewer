/**
 * Workspace autocomplete component for intelligent path completion
 * Provides real-time suggestions as user types in workspace input
 */

class WorkspaceAutocomplete extends Utils.EventEmitter {
    constructor(inputElement, app) {
        super();
        this.inputElement = inputElement;
        this.app = app;
        
        // Create UI elements
        this.suggestionsList = null;
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        this.isVisible = false;
        
        // Debouncing for API calls
        this.debounceTimeout = null;
        this.debounceDelay = 300;
        
        // History management
        this.recentPaths = this.loadRecentPaths();
        
        this.init();
    }

    /**
     * Initialize the autocomplete component
     */
    init() {
        this.createSuggestionsContainer();
        this.setupEventListeners();
        console.log('Workspace autocomplete initialized');
    }

    /**
     * Create the suggestions dropdown container
     */
    createSuggestionsContainer() {
        this.suggestionsList = document.createElement('div');
        this.suggestionsList.className = 'workspace-suggestions';
        this.suggestionsList.style.display = 'none';
        
        // Insert after the input element
        this.inputElement.parentNode.insertBefore(
            this.suggestionsList, 
            this.inputElement.nextSibling
        );
    }

    /**
     * Setup event listeners for input and keyboard interaction
     */
    setupEventListeners() {
        // Input events
        this.inputElement.addEventListener('input', this.handleInput.bind(this));
        this.inputElement.addEventListener('focus', this.handleFocus.bind(this));
        this.inputElement.addEventListener('blur', this.handleBlur.bind(this));
        
        // Keyboard navigation
        this.inputElement.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Click outside to close
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        
        // Prevent form submission on Enter when suggestions are visible
        this.inputElement.addEventListener('keypress', this.handleKeyPress.bind(this));
    }

    /**
     * Handle input changes and trigger suggestions
     * @param {Event} event - Input event
     */
    handleInput(event) {
        const value = event.target.value;
        
        // Clear existing debounce
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        // Debounce API calls
        this.debounceTimeout = setTimeout(() => {
            this.getSuggestions(value);
        }, this.debounceDelay);
    }

    /**
     * Handle input focus - show recent paths if empty
     * @param {Event} event - Focus event
     */
    handleFocus(event) {
        const value = event.target.value;
        
        if (!value || value.length === 0) {
            this.showRecentPaths();
        } else {
            this.getSuggestions(value);
        }
    }

    /**
     * Handle input blur - hide suggestions after delay
     * @param {Event} event - Blur event
     */
    handleBlur(event) {
        // Delay hiding to allow clicking on suggestions
        setTimeout(() => {
            this.hideSuggestions();
        }, 150);
    }

    /**
     * Handle keyboard navigation
     * @param {Event} event - Keyboard event
     */
    handleKeyDown(event) {
        if (!this.isVisible || this.currentSuggestions.length === 0) {
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectNext();
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.selectPrevious();
                break;
                
            case 'Enter':
                event.preventDefault();
                this.acceptSelected();
                break;
                
            case 'Escape':
                event.preventDefault();
                this.hideSuggestions();
                break;
                
            case 'Tab':
                if (this.selectedIndex >= 0) {
                    event.preventDefault();
                    this.acceptSelected();
                }
                break;
        }
    }

    /**
     * Handle key press to prevent form submission
     * @param {Event} event - Key press event
     */
    handleKeyPress(event) {
        if (event.key === 'Enter' && this.isVisible && this.selectedIndex >= 0) {
            event.preventDefault();
        }
    }

    /**
     * Handle clicks outside suggestions to close
     * @param {Event} event - Click event
     */
    handleDocumentClick(event) {
        if (!this.suggestionsList.contains(event.target) && 
            event.target !== this.inputElement) {
            this.hideSuggestions();
        }
    }

    /**
     * Get suggestions from backend
     * @param {string} partialPath - Partial path to complete
     */
    async getSuggestions(partialPath) {
        if (!partialPath || partialPath.length === 0) {
            this.showRecentPaths();
            return;
        }

        try {
            const response = await window.api.getDirectorySuggestions(partialPath);
            
            if (response && response.suggestions) {
                this.currentSuggestions = response.suggestions;
                this.showSuggestions();
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('Error getting directory suggestions:', error);
            this.hideSuggestions();
        }
    }

    /**
     * Show recent paths when input is empty
     */
    showRecentPaths() {
        if (this.recentPaths.length > 0) {
            this.currentSuggestions = this.recentPaths.map(path => ({
                path,
                name: path.split('/').pop() || path,
                type: 'recent',
                isRecent: true
            }));
            this.showSuggestions();
        }
    }

    /**
     * Display suggestions in dropdown
     */
    showSuggestions() {
        if (this.currentSuggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.renderSuggestions();
        this.suggestionsList.style.display = 'block';
        this.isVisible = true;
        this.selectedIndex = -1;
    }

    /**
     * Hide suggestions dropdown
     */
    hideSuggestions() {
        this.suggestionsList.style.display = 'none';
        this.isVisible = false;
        this.selectedIndex = -1;
    }

    /**
     * Render suggestions list
     */
    renderSuggestions() {
        this.suggestionsList.innerHTML = '';

        this.currentSuggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            
            if (suggestion.isRecent) {
                item.classList.add('recent');
            }
            if (suggestion.hasMarkdown) {
                item.classList.add('has-markdown');
            }
            if (suggestion.isCommon) {
                item.classList.add('common');
            }
            if (suggestion.isHome) {
                item.classList.add('home');
            }
            
            const icon = this.getSuggestionIcon(suggestion);
            const name = suggestion.name;
            const path = suggestion.path;
            
            item.innerHTML = `
                <div class="suggestion-content">
                    <div class="suggestion-main">
                        <span class="suggestion-icon">${icon}</span>
                        <span class="suggestion-name">${this.escapeHtml(name)}</span>
                        ${suggestion.hasMarkdown ? '<span class="markdown-indicator">📄</span>' : ''}
                        ${suggestion.isRecent ? '<span class="recent-indicator">⏱️</span>' : ''}
                    </div>
                    <div class="suggestion-path">${this.escapeHtml(this.truncatePath(path, 60))}</div>
                </div>
            `;
            
            // Add click handler
            item.addEventListener('click', () => {
                this.selectSuggestion(index);
            });
            
            // Add hover handler
            item.addEventListener('mouseenter', () => {
                this.highlightSuggestion(index);
            });
            
            this.suggestionsList.appendChild(item);
        });
    }

    /**
     * Get appropriate icon for suggestion type
     * @param {Object} suggestion - Suggestion object
     * @returns {string} Icon character
     */
    getSuggestionIcon(suggestion) {
        if (suggestion.isHome) return '🏠';
        if (suggestion.isRecent) return '📁';
        if (suggestion.isCommon) return '📂';
        if (suggestion.hasMarkdown) return '📋';
        return '📁';
    }

    /**
     * Select next suggestion
     */
    selectNext() {
        this.selectedIndex = Math.min(
            this.selectedIndex + 1, 
            this.currentSuggestions.length - 1
        );
        this.updateSelection();
    }

    /**
     * Select previous suggestion
     */
    selectPrevious() {
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
    }

    /**
     * Update visual selection in suggestions list
     */
    updateSelection() {
        const items = this.suggestionsList.querySelectorAll('.suggestion-item');
        
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Highlight suggestion on hover
     * @param {number} index - Suggestion index
     */
    highlightSuggestion(index) {
        this.selectedIndex = index;
        this.updateSelection();
    }

    /**
     * Accept the currently selected suggestion
     */
    acceptSelected() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.currentSuggestions.length) {
            this.selectSuggestion(this.selectedIndex);
        }
    }

    /**
     * Select a specific suggestion
     * @param {number} index - Suggestion index
     */
    selectSuggestion(index) {
        const suggestion = this.currentSuggestions[index];
        if (!suggestion) return;

        // Update input value
        this.inputElement.value = suggestion.path;
        
        // Add to recent paths
        this.addToRecentPaths(suggestion.path);
        
        // Hide suggestions
        this.hideSuggestions();
        
        // Emit selection event
        this.emit('pathSelected', suggestion.path);
        
        // Focus back to input
        this.inputElement.focus();
        
        // Trigger the workspace change
        if (this.app && typeof this.app.setRootDirectory === 'function') {
            this.app.setRootDirectory(suggestion.path);
        }
    }

    /**
     * Add path to recent paths history
     * @param {string} path - Directory path
     */
    addToRecentPaths(path) {
        // Remove if already exists
        this.recentPaths = this.recentPaths.filter(p => p !== path);
        
        // Add to beginning
        this.recentPaths.unshift(path);
        
        // Limit to 10 recent paths
        this.recentPaths = this.recentPaths.slice(0, 10);
        
        // Save to localStorage
        this.saveRecentPaths();
    }

    /**
     * Load recent paths from localStorage
     * @returns {Array} Array of recent paths
     */
    loadRecentPaths() {
        try {
            const stored = localStorage.getItem('markviewer-recent-paths');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Failed to load recent paths:', error);
            return [];
        }
    }

    /**
     * Save recent paths to localStorage
     */
    saveRecentPaths() {
        try {
            localStorage.setItem('markviewer-recent-paths', JSON.stringify(this.recentPaths));
        } catch (error) {
            console.warn('Failed to save recent paths:', error);
        }
    }

    /**
     * Truncate path for display
     * @param {string} path - Full path
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated path
     */
    truncatePath(path, maxLength) {
        if (path.length <= maxLength) return path;
        
        const parts = path.split('/');
        if (parts.length <= 2) return path;
        
        // Show first and last parts with ellipsis
        const first = parts[0] || '/';
        const last = parts[parts.length - 1];
        const remaining = maxLength - first.length - last.length - 5; // 5 for "/.../""
        
        if (remaining > 0) {
            return `${first}/.../${last}`;
        }
        
        return `${first}/.../`;
    }

    /**
     * Escape HTML characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Destroy the autocomplete component
     */
    destroy() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        if (this.suggestionsList && this.suggestionsList.parentNode) {
            this.suggestionsList.parentNode.removeChild(this.suggestionsList);
        }
        
        // Remove event listeners would go here if needed
        console.log('Workspace autocomplete destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkspaceAutocomplete;
} else {
    window.WorkspaceAutocomplete = WorkspaceAutocomplete;
}
