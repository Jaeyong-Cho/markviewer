/**
 * Markdown renderer with PlantUML, Mermaid, and code highlighting support
 */

class MarkdownRenderer extends Utils.EventEmitter {
    constructor(container, options = {}) {
        super();
        this.container = container;
        
        if (!this.container) {
            console.error('MarkdownRenderer: Container is null or undefined');
        }
        
        this.scrollSpyHandler = null;
        
        // Check if ToC should be disabled (e.g., for split panes)
        if (options.disableToC) {
            this.tocEnabled = false;
        } else {
            this.tocEnabled = this.getTocEnabledState();
        }
        
        // Auto-hide functionality
        this.inactivityTimer = null;
        this.autoHideTimeout = this.getAutoHideTimeout();
        this.isAutoTransparent = false;
        
        this.setupMarked();
        this.setupMermaid();
        
        // Always setup ToC toggle (even if disabled, for enabling later)
        this.setupTocToggle();
        
        this.setupAutoHide();
    }

    /**
     * Setup marked.js configuration
     */
    setupMarked() {
        // Configure marked renderer
        const renderer = new marked.Renderer();
        
        // Custom link renderer to handle internal links
        renderer.link = (href, title, text) => {
            const isExternal = href.includes('://') || href.startsWith('mailto:');
            const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            const titleAttr = title ? ` title="${title}"` : '';
            
            return `<a href="${href}"${titleAttr}${target} class="${isExternal ? 'external-link' : 'internal-link'}">${text}</a>`;
        };

        // Custom code renderer for PlantUML detection
        renderer.code = (code, language) => {
            // Check for PlantUML code blocks
            if (language === 'plantuml' || language === 'puml') {
                return this.createPlantUMLBlock(code);
            }
            
            // Check for Mermaid code blocks
            if (language === 'mermaid') {
                return this.createMermaidBlock(code);
            }
            
            // Regular code block with syntax highlighting
            return this.createCodeBlock(code, language);
        };

        // Custom image renderer for better handling with relative path support
        renderer.image = (href, title, text) => {
            const titleAttr = title ? ` title="${Utils.escapeHtml(title)}"` : '';
            const altAttr = text ? ` alt="${Utils.escapeHtml(text)}"` : '';
            
            // Create a unique identifier for this image to handle processing later
            const imageId = Utils.generateId();
            
            return `<img src="${href}"${altAttr}${titleAttr} loading="lazy" data-image-id="${imageId}" data-original-src="${href}" />`;
        };

        // Custom table renderer with responsive wrapper
        renderer.table = (header, body) => {
            return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
        };

        // Configure marked options - WITHOUT highlight function initially
        marked.setOptions({
            renderer: renderer,
            pedantic: false,
            gfm: true,
            breaks: false,
            sanitize: false,
            smartLists: true,
            smartypants: false
        });
        
        // Set up highlight function separately after ensuring hljs is available
        this.setupHighlighting();
    }
    
    /**
     * Setup syntax highlighting after hljs is available
     */
    setupHighlighting() {
        // Wait for hljs to be available
        const checkHighlightJS = () => {
            if (typeof hljs !== 'undefined') {
                // Now add the highlight function
                marked.setOptions({
                    highlight: (code, language) => {
                        try {
                            if (language && hljs.getLanguage(language)) {
                                return hljs.highlight(code, { language }).value;
                            } else {
                                return hljs.highlightAuto(code).value;
                            }
                        } catch (error) {
                            console.warn('Syntax highlighting failed:', error);
                            return Utils.escapeHtml(code);
                        }
                    }
                });
            } else {
                // If hljs is not available after timeout, continue without highlighting
                console.warn('highlight.js not available, syntax highlighting disabled');
                marked.setOptions({
                    highlight: (code, language) => {
                        return Utils.escapeHtml(code);
                    }
                });
            }
        };
        
        // Check immediately
        if (typeof hljs !== 'undefined') {
            checkHighlightJS();
        } else {
            // Wait up to 5 seconds for hljs to load
            let attempts = 0;
            const maxAttempts = 25; // 5 seconds with 200ms intervals
            const checkInterval = setInterval(() => {
                attempts++;
                if (typeof hljs !== 'undefined') {
                    clearInterval(checkInterval);
                    checkHighlightJS();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    checkHighlightJS(); // Will set up fallback
                }
            }, 200);
        }
    }

    /**
     * Setup Mermaid configuration
     */
    setupMermaid() {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'arial',
            fontSize: 14,
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            },
            sequence: {
                useMaxWidth: true,
                wrap: true
            },
            gantt: {
                useMaxWidth: true
            }
        });
    }

    /**
     * Render markdown content
     * @param {string} content - Markdown content
     */
    async renderMarkdown(content) {
        if (!this.container) {
            console.error('MarkdownRenderer: Container element not found');
            throw new Error('Container element not found');
        }
        
        try {
            // Parse markdown to HTML
            let html = marked.parse(content);
            
            // Sanitize HTML for security
            html = Utils.sanitizeHtml(html);
            
            // Set the HTML content
            this.container.innerHTML = html;
            
            // Process special content types (non-blocking for diagrams)
            this.processImages();
            
            // Process diagrams asynchronously in parallel
            this.processDiagramsAsync();
            this.processInternalLinks();
            this.addCodeCopyButtons();
            this.generateTableOfContents();
            
            // Emit render complete event
            this.emit('renderComplete', content);
        } catch (error) {
            console.error('Markdown rendering failed:', error);
            this.showRenderError(error);
        }
    }

    /**
     * Create PlantUML code block placeholder
     * @param {string} code - PlantUML source code
     * @returns {string} HTML placeholder
     */
    createPlantUMLBlock(code) {
        const id = Utils.generateId();
        // Store the source in a script tag to avoid data attribute limitations
        return `<div class="plantuml-block" data-id="${id}">
            <script type="application/plantuml" class="plantuml-source">${Utils.escapeHtml(code)}</script>
            <div class="plantuml-loading">
                <div class="diagram-loading-container">
                    <div class="spinner"></div>
                    <p class="loading-text">준비 중...</p>
                    <div class="loading-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Create Mermaid code block placeholder
     * @param {string} code - Mermaid source code
     * @returns {string} HTML placeholder
     */
    createMermaidBlock(code) {
        const id = Utils.generateId();
        // Store the source in a script tag to avoid data attribute limitations
        return `<div class="mermaid-block" data-id="${id}">
            <script type="application/mermaid" class="mermaid-source">${Utils.escapeHtml(code)}</script>
            <div class="mermaid-loading">
                <div class="diagram-loading-container">
                    <div class="spinner"></div>
                    <p class="loading-text">준비 중...</p>
                    <div class="loading-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Create regular code block with syntax highlighting
     * @param {string} code - Source code
     * @param {string} language - Programming language
     * @returns {string} HTML code block
     */
    createCodeBlock(code, language) {
        // Trim leading and trailing whitespace, but preserve internal formatting
        const trimmedCode = code.trim();
        let highlightedCode = trimmedCode;
        
        // Check if highlight.js is available
        if (typeof hljs !== 'undefined') {
            try {
                if (language && hljs.getLanguage(language)) {
                    highlightedCode = hljs.highlight(trimmedCode, { language }).value;
                } else {
                    highlightedCode = hljs.highlightAuto(trimmedCode).value;
                }
                // Additional trim for highlighted code to remove any leading/trailing whitespace
                highlightedCode = highlightedCode.trim();
                
                // Remove leading and trailing newlines from highlighted HTML
                highlightedCode = highlightedCode.replace(/^[\r\n]+|[\r\n]+$/g, '');
            } catch (error) {
                console.warn('Code highlighting failed:', error);
                highlightedCode = Utils.escapeHtml(trimmedCode);
            }
        } else {
            console.warn('highlight.js not available, using plain code');
            highlightedCode = Utils.escapeHtml(trimmedCode);
        }
            
        const languageClass = language ? ` language-${language}` : '';
        const languageLabel = language ? `<span class="code-language">${language}</span>` : '';
        
        // Properly encode the original trimmed code for the data attribute by using base64
        const encodedCode = btoa(unescape(encodeURIComponent(trimmedCode)));
        
        const result = `<div class="code-block-wrapper"><div class="code-block-header">${languageLabel}<button class="code-copy-btn" data-code-b64="${encodedCode}" title="Copy code">Copy</button></div><pre><code class="hljs${languageClass}">${highlightedCode}</code></pre></div>`;
        
        return result;
    }

    /**
     * Process diagrams asynchronously and in parallel
     */
    async processDiagramsAsync() {
        try {
            // Start both diagram types processing in parallel
            const plantumlPromise = this.processPlantUMLBlocksAsync();
            const mermaidPromise = this.processMermaidBlocksAsync();
            
            // Wait for both to complete (but don't block the main render)
            await Promise.allSettled([plantumlPromise, mermaidPromise]);
        } catch (error) {
            console.error('Error processing diagrams:', error);
        }
    }

    /**
     * Process PlantUML blocks asynchronously
     */
    async processPlantUMLBlocksAsync() {
        const plantumlBlocks = this.container.querySelectorAll('.plantuml-block');
        
        if (plantumlBlocks.length === 0) return;
        
        // Process all PlantUML blocks in parallel
        const processingPromises = Array.from(plantumlBlocks).map(block => 
            this.processSinglePlantUMLBlock(block)
        );
        
        await Promise.allSettled(processingPromises);
    }

    /**
     * Process a single PlantUML block
     * @param {HTMLElement} block - PlantUML block element
     */
    async processSinglePlantUMLBlock(block) {
        try {
            // Get source from script tag instead of data attribute
            const sourceScript = block.querySelector('.plantuml-source');
            if (!sourceScript) {
                console.warn('PlantUML block missing source script');
                return;
            }
            
            // Decode HTML entities from the script content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = sourceScript.textContent;
            const source = tempDiv.textContent || tempDiv.innerText;
            const id = block.dataset.id;
            
            // Enhanced loading state with Korean support
            const loadingDiv = block.querySelector('.plantuml-loading');
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <div class="diagram-loading-container">
                        <div class="spinner"></div>
                        <p class="loading-text">PlantUML 다이어그램 렌더링 중...</p>
                        <div class="loading-progress">
                            <div class="progress-bar"></div>
                        </div>
                    </div>
                `;
            }
            
            // Create timeout for rendering
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('PlantUML rendering timeout')), 30000);
            });
            
            // Render PlantUML with timeout
            const renderPromise = window.api.renderPlantUML(source);
            const result = await Promise.race([renderPromise, timeoutPromise]);
            
            // Check if result is a string (SVG directly) or object with svg property
            let svg;
            if (typeof result === 'string') {
                svg = result;
            } else if (result && result.svg) {
                svg = result.svg;
            } else {
                throw new Error('PlantUML service returned invalid response');
            }
            
            // Display SVG result with fade-in animation
            const diagramHtml = `<div class="plantuml-diagram fade-in" id="plantuml-${id}">${svg}</div>`;
            block.innerHTML = diagramHtml;
            
        } catch (error) {
            console.error('PlantUML rendering failed:', error);
            this.showPlantUMLError(block, error, source || 'Unknown source');
        }
    }

    /**
     * Process Mermaid blocks asynchronously
     */
    async processMermaidBlocksAsync() {
        const mermaidBlocks = this.container.querySelectorAll('.mermaid-block');
        
        if (mermaidBlocks.length === 0) return;
        
        // Process all Mermaid blocks in parallel
        const processingPromises = Array.from(mermaidBlocks).map(block => 
            this.processSingleMermaidBlock(block)
        );
        
        await Promise.allSettled(processingPromises);
    }

    /**
     * Process a single Mermaid block
     * @param {HTMLElement} block - Mermaid block element
     */
    async processSingleMermaidBlock(block) {
        try {
            // Get source from script tag instead of data attribute
            const sourceScript = block.querySelector('.mermaid-source');
            if (!sourceScript) {
                console.warn('Mermaid block missing source script');
                return;
            }
            
            // Decode HTML entities from the script content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = sourceScript.textContent;
            const source = tempDiv.textContent || tempDiv.innerText;
            const id = block.dataset.id;
            
            // Enhanced loading state with Korean support
            const loadingDiv = block.querySelector('.mermaid-loading');
            if (loadingDiv) {
                loadingDiv.innerHTML = `
                    <div class="diagram-loading-container">
                        <div class="spinner"></div>
                        <p class="loading-text">Mermaid 다이어그램 렌더링 중...</p>
                        <div class="loading-progress">
                            <div class="progress-bar"></div>
                        </div>
                    </div>
                `;
            }
            
            // Create container for Mermaid diagram
            const diagramContainer = document.createElement('div');
            diagramContainer.className = 'mermaid-diagram fade-in';
            diagramContainer.id = `mermaid-${id}`;
            
            // Create timeout for rendering
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Mermaid rendering timeout')), 15000);
            });
            
            // Render Mermaid diagram with timeout
            const renderPromise = mermaid.render(`mermaid-svg-${id}`, source);
            const { svg } = await Promise.race([renderPromise, timeoutPromise]);
            
            diagramContainer.innerHTML = svg;
            
            // Replace loading block with diagram
            block.innerHTML = '';
            block.appendChild(diagramContainer);
            
        } catch (error) {
            console.error('Mermaid rendering failed:', error);
            this.showMermaidError(block, error, source || 'Unknown source');
        }
    }

    /**
     * Process images to handle relative paths and improve loading
     */
    processImages() {
        const images = this.container.querySelectorAll('img[data-image-id]');
        
        images.forEach((img, index) => {
            const originalSrc = img.dataset.originalSrc;
            
            if (!originalSrc) return;
            
            // Check if this is a relative path (doesn't start with http/https or /)
            if (!originalSrc.startsWith('http://') && 
                !originalSrc.startsWith('https://') && 
                !originalSrc.startsWith('/') && 
                !originalSrc.startsWith('data:')) {
                
                // Get current file from global app state
                const currentFile = window.app && window.app.state ? window.app.state.currentFile : null;
                
                if (currentFile) {
                    // Build API URL for relative image
                    const apiUrl = `/api/image?imagePath=${encodeURIComponent(originalSrc)}&markdownPath=${encodeURIComponent(currentFile)}`;
                    img.src = apiUrl;
                } else {
                    // Fallback: try to load as relative to current location
                    console.warn('MarkdownRenderer: No current file context for relative image:', originalSrc);
                    img.src = originalSrc; // Try as-is
                }
            } else {
                // This is an absolute URL (http/https) or data URL - use it directly
                img.src = originalSrc;
            }
            
            // Add error handling for broken images
            img.addEventListener('error', function(event) {
                console.error('MarkdownRenderer: Image failed to load:', originalSrc);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'image-error';
                errorDiv.innerHTML = `
                    <div class="image-error-content">
                        <span class="image-error-icon">🖼️</span>
                        <span class="image-error-message">Image not found</span>
                        <span class="image-error-path">${originalSrc}</span>
                    </div>
                `;
                
                // Replace the image with error message
                if (img.parentNode) {
                    img.parentNode.replaceChild(errorDiv, img);
                }
            });
            
            // Add loading indicator for larger images
            img.addEventListener('load', function() {
                img.classList.add('image-loaded');
            });
        });
    }

    /**
     * Process internal links to enable navigation
     */
    processInternalLinks() {
        const internalLinks = this.container.querySelectorAll('a.internal-link');
        
        internalLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const href = link.getAttribute('href');
                this.emit('linkClick', href);
            });
        });
    }

    /**
     * Add copy buttons to code blocks
     */
    addCodeCopyButtons() {
        const copyButtons = this.container.querySelectorAll('.code-copy-btn');
        
        copyButtons.forEach(button => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                
                // Handle both old data-code and new data-code-b64 attributes
                let code;
                if (button.dataset.codeB64) {
                    // Decode base64 encoded code
                    try {
                        code = decodeURIComponent(escape(atob(button.dataset.codeB64)));
                    } catch (error) {
                        console.error('Failed to decode base64 code:', error);
                        code = button.dataset.codeB64; // Fallback to raw data
                    }
                } else {
                    // Legacy support for data-code attribute
                    code = button.dataset.code;
                }
                
                try {
                    const success = await Utils.copyToClipboard(code);
                    if (success) {
                        button.textContent = 'Copied!';
                        button.title = 'Copied!';
                        setTimeout(() => {
                            button.textContent = 'Copy';
                            button.title = 'Copy code';
                        }, 2000);
                    } else {
                        throw new Error('Copy failed');
                    }
                } catch (error) {
                    button.textContent = 'Failed';
                    button.title = 'Copy failed';
                    setTimeout(() => {
                        button.textContent = 'Copy';
                        button.title = 'Copy code';
                    }, 2000);
                }
            });
        });
    }

    /**
     * Generate table of contents from headings
     */
    generateTableOfContents() {
        const headings = this.container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        // Update toggle button visibility first
        this.updateTocToggleButton();
        
        if (headings.length < 2) {
            this.hideTocSidebar();
            return; // Don't show TOC for single heading
        }
        
        // If ToC is disabled, don't generate it but still add IDs for direct linking
        if (!this.tocEnabled) {
            // Add IDs to headings for direct linking
            headings.forEach((heading, index) => {
                heading.id = `heading-${index}`;
            });
            this.hideTocSidebar();
            return;
        }
        
        // Add IDs to headings for linking
        headings.forEach((heading, index) => {
            heading.id = `heading-${index}`;
        });
        
        // Generate TOC data and update sidebar
        this.updateTocSidebar(headings);
        this.updateTocVisibility();
    }

    /**
     * Update the TOC sidebar with heading data
     * @param {NodeList} headings - List of heading elements
     */
    updateTocSidebar(headings) {
        let tocHtml = '<div class="toc-content"><h3>Table of Contents</h3><ul class="toc-list">';
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent;
            const id = `heading-${index}`;
            
            // Calculate indentation based on header level (h1=0, h2=1, h3=2, etc.)
            const indentLevel = Math.max(0, level - 1);
            
            tocHtml += `<li class="toc-item toc-level-${level}" style="margin-left: ${indentLevel * 12}px;">
                <a href="#${id}" class="toc-link">${text}</a>
            </li>`;
        });
        
        tocHtml += '</ul></div>';
        
        // Update TOC sidebar content
        const tocSidebar = document.getElementById('toc-sidebar');
        if (tocSidebar) {
            tocSidebar.innerHTML = tocHtml;
            this.showTocSidebar();
            this.setupTocLinks();
        }
    }

    /**
     * Show the TOC sidebar
     */
    showTocSidebar() {
        const tocSidebar = document.getElementById('toc-sidebar');
        if (tocSidebar) {
            tocSidebar.classList.add('visible');
            // Start auto-hide timer when showing ToC
            this.resetInactivityTimer();
        }
    }

    /**
     * Hide the TOC sidebar
     */
    hideTocSidebar() {
        const tocSidebar = document.getElementById('toc-sidebar');
        if (tocSidebar) {
            tocSidebar.classList.remove('visible');
            tocSidebar.classList.remove('auto-transparent'); // Remove auto-transparency when hiding
        }
        
        // Clean up scroll spy and auto-hide when hiding ToC
        this.cleanupScrollSpy();
        this.cleanupAutoHide();
    }

    /**
     * Clean up scroll spy event listener
     */
    cleanupScrollSpy() {
        if (this.scrollSpyHandler) {
            window.removeEventListener('scroll', this.scrollSpyHandler);
            this.scrollSpyHandler = null;
        }
    }

    /**
     * Setup ToC toggle functionality
     */
    setupTocToggle() {
        const tocToggleBtn = document.getElementById('toc-toggle');
        const tocShowBtn = document.getElementById('toc-show-btn');
        const tocHideBtn = document.getElementById('toc-hide-btn');
        
        // Header ToC toggle button
        if (tocToggleBtn) {
            tocToggleBtn.addEventListener('click', () => {
                this.toggleToc();
            });
            
            tocToggleBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.toggleToc();
                }
            });
        }
        
        // Edge ToC show button
        if (tocShowBtn) {
            tocShowBtn.addEventListener('click', () => {
                this.showToc();
            });
            
            tocShowBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.showToc();
                }
            });
        }
        
        // Edge ToC hide button
        if (tocHideBtn) {
            tocHideBtn.addEventListener('click', () => {
                this.hideToc();
            });
            
            tocHideBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.hideToc();
                }
            });
        }
        
        this.updateTocToggleButton();
    }    /**
     * Get ToC enabled state from localStorage
     * @returns {boolean} Whether ToC is enabled
     */
    getTocEnabledState() {
        try {
            const stored = localStorage.getItem('tocEnabled');
            return stored !== null ? JSON.parse(stored) : true; // Default to enabled
        } catch (error) {
            console.warn('Failed to get ToC state from localStorage:', error);
            return true;
        }
    }

    /**
     * Set ToC enabled state in localStorage
     * @param {boolean} enabled - Whether ToC should be enabled
     */
    setTocEnabledState(enabled) {
        try {
            localStorage.setItem('tocEnabled', JSON.stringify(enabled));
            this.tocEnabled = enabled;
        } catch (error) {
            console.warn('Failed to save ToC state to localStorage:', error);
        }
    }

    /**
     * Toggle ToC visibility
     */
    toggleToc() {
        this.setTocEnabledState(!this.tocEnabled);
        this.updateTocToggleButton();
        this.updateTocVisibility();
    }

    /**
     * Show ToC
     */
    showToc() {
        this.setTocEnabledState(true);
        this.updateTocToggleButton();
        this.updateTocVisibility();
        
        // Regenerate ToC if content is already loaded
        const headings = this.container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length >= 2) {
            this.generateTableOfContents();
        }
        
        // Reset auto-hide timer when ToC is shown
        this.resetInactivityTimer();
    }

    /**
     * Hide ToC
     */
    hideToc() {
        this.setTocEnabledState(false);
        this.updateTocToggleButton();
        this.updateTocVisibility();
        
        // Clean up auto-hide state when ToC is hidden
        this.cleanupAutoHide();
        this.restoreTocOpacity();
        
        // Restart auto-hide timer for the show button
        this.resetInactivityTimer();
    }

    /**
     * Update ToC toggle buttons appearance
     */
    updateTocToggleButton() {
        const tocToggleBtn = document.getElementById('toc-toggle');
        const tocShowBtn = document.getElementById('toc-show-btn');
        const tocHideBtn = document.getElementById('toc-hide-btn');
        
        const headings = this.container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        // Update header toggle button
        if (tocToggleBtn) {
            // Hide button if content has fewer than 2 headings
            if (headings.length < 2) {
                tocToggleBtn.classList.add('hidden');
                tocToggleBtn.disabled = true;
            } else {
                tocToggleBtn.classList.remove('hidden');
                tocToggleBtn.disabled = false;
                
                // Update visual state based on ToC enabled status
                if (this.tocEnabled) {
                    tocToggleBtn.classList.remove('disabled');
                    tocToggleBtn.setAttribute('aria-pressed', 'true');
                    tocToggleBtn.title = 'Hide Table of Contents';
                } else {
                    tocToggleBtn.classList.add('disabled');
                    tocToggleBtn.setAttribute('aria-pressed', 'false');
                    tocToggleBtn.title = 'Show Table of Contents';
                }
            }
        }
        
        // Update edge toggle buttons
        if (!tocShowBtn || !tocHideBtn) return;
        
        // Hide buttons if content has fewer than 2 headings
        if (headings.length < 2) {
            tocShowBtn.style.display = 'none';
            tocHideBtn.style.display = 'none';
            return;
        }
        
        tocShowBtn.style.display = 'flex';
        tocHideBtn.style.display = 'flex';
        
        // The CSS handles the visibility and positioning based on ToC state
        // No need for additional logic here as CSS classes handle the states
    }

    /**
     * Update ToC visibility based on current state
     */
    updateTocVisibility() {
        const contentSection = document.querySelector('.content-area');
        if (!contentSection) return;

        if (this.tocEnabled) {
            contentSection.classList.remove('toc-disabled');
        } else {
            contentSection.classList.add('toc-disabled');
            this.hideTocSidebar();
        }
    }

    /**
     * Setup click handlers for TOC links
     */
    setupTocLinks() {
        const tocLinks = document.querySelectorAll('#toc-sidebar .toc-link');
        tocLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    // Remove active class from all ToC links
                    tocLinks.forEach(l => l.classList.remove('active'));
                    // Add active class to clicked link
                    link.classList.add('active');
                    
                    // Scroll to position the target heading at the top of the viewport
                    Utils.scrollToElement(target, 'smooth', 'start');
                    
                    // Scroll ToC to show active item
                    this.scrollTocToActiveItem(link);
                }
            });
        });
        
        // Setup scroll spy to highlight current section
        this.setupScrollSpy();
        
        // Setup keyboard navigation
        this.setupTocKeyboardNavigation();
    }

    /**
     * Setup keyboard navigation for ToC
     */
    setupTocKeyboardNavigation() {
        const tocSidebar = document.getElementById('toc-sidebar');
        if (!tocSidebar) return;
        
        tocSidebar.addEventListener('keydown', (event) => {
            const tocLinks = Array.from(document.querySelectorAll('#toc-sidebar .toc-link'));
            const activeElement = document.activeElement;
            const currentIndex = tocLinks.indexOf(activeElement);
            
            let targetIndex = -1;
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    targetIndex = currentIndex < tocLinks.length - 1 ? currentIndex + 1 : 0;
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    targetIndex = currentIndex > 0 ? currentIndex - 1 : tocLinks.length - 1;
                    break;
                case 'Home':
                    event.preventDefault();
                    targetIndex = 0;
                    break;
                case 'End':
                    event.preventDefault();
                    targetIndex = tocLinks.length - 1;
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    if (currentIndex >= 0) {
                        tocLinks[currentIndex].click();
                    }
                    return;
            }
            
            if (targetIndex >= 0 && tocLinks[targetIndex]) {
                tocLinks[targetIndex].focus();
                this.scrollTocToActiveItem(tocLinks[targetIndex]);
            }
        });
        
        // Make ToC links focusable
        const tocLinks = document.querySelectorAll('#toc-sidebar .toc-link');
        tocLinks.forEach((link, index) => {
            link.setAttribute('tabindex', index === 0 ? '0' : '-1');
            link.setAttribute('role', 'menuitem');
        });
        
        // Set role for ToC list
        const tocList = document.querySelector('#toc-sidebar .toc-list');
        if (tocList) {
            tocList.setAttribute('role', 'menu');
            tocList.setAttribute('aria-label', 'Table of Contents');
        }
    }

    /**
     * Scroll ToC sidebar to show the active item
     * @param {HTMLElement} activeLink - The active ToC link element
     */
    scrollTocToActiveItem(activeLink) {
        const tocContent = document.querySelector('#toc-sidebar .toc-content');
        if (!tocContent || !activeLink) return;
        
        const tocRect = tocContent.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        
        // Calculate if the active link is outside the visible area
        const linkTop = linkRect.top - tocRect.top + tocContent.scrollTop;
        const linkBottom = linkTop + linkRect.height;
        const visibleTop = tocContent.scrollTop;
        const visibleBottom = visibleTop + tocContent.clientHeight;
        
        // Scroll to center the active item in the ToC
        if (linkTop < visibleTop || linkBottom > visibleBottom) {
            const scrollTo = linkTop - (tocContent.clientHeight / 2) + (linkRect.height / 2);
            tocContent.scrollTo({
                top: Math.max(0, scrollTo),
                behavior: 'smooth'
            });
        }
    }

    /**
     * Setup scroll spy to highlight current section in ToC
     */
    setupScrollSpy() {
        let ticking = false;
        
        const updateActiveSection = () => {
            const headings = document.querySelectorAll('#markdown-content h1, #markdown-content h2, #markdown-content h3, #markdown-content h4, #markdown-content h5, #markdown-content h6');
            const tocLinks = document.querySelectorAll('#toc-sidebar .toc-link');
            
            if (headings.length === 0 || tocLinks.length === 0) return;
            
            // Get the scrollable container
            const scrollContainer = document.querySelector('.content-body');
            if (!scrollContainer) return;
            
            // Find the current section based on scroll position
            let currentHeading = null;
            const scrollPos = scrollContainer.scrollTop + 120; // Offset for better detection
            
            // Check if we're at the bottom of the container
            const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 50;
            
            if (isAtBottom) {
                // If at bottom, highlight the last heading
                currentHeading = headings[headings.length - 1];
            } else if (scrollContainer.scrollTop < 100) {
                // If near the top, always select the first heading
                currentHeading = headings[0];
            } else {
                // Find the current heading based on scroll position
                for (let i = headings.length - 1; i >= 0; i--) {
                    const heading = headings[i];
                    // Get heading position relative to the scroll container
                    const headingTop = heading.offsetTop - scrollContainer.offsetTop;
                    if (headingTop <= scrollPos) {
                        currentHeading = heading;
                        break;
                    }
                }
                
                // Fallback: if still no heading found, use the first one
                if (!currentHeading && headings.length > 0) {
                    currentHeading = headings[0];
                }
            }
            
            // Update active state in ToC
            let activeLink = null;
            tocLinks.forEach(link => {
                link.classList.remove('active');
                if (currentHeading && link.getAttribute('href') === `#${currentHeading.id}`) {
                    link.classList.add('active');
                    activeLink = link;
                }
            });
            
            // Auto-scroll ToC to show active item
            if (activeLink) {
                this.scrollTocToActiveItem(activeLink);
            }
            
            ticking = false;
        };
        
        const onScroll = () => {
            if (!ticking) {
                requestAnimationFrame(updateActiveSection);
                ticking = true;
            }
        };
        
        // Get the scrollable container
        const scrollContainer = document.querySelector('.content-body');
        if (!scrollContainer) return;
        
        // Remove existing scroll listener if any
        if (this.scrollSpyHandler) {
            scrollContainer.removeEventListener('scroll', this.scrollSpyHandler);
        }
        
        // Add new scroll listener to the container
        this.scrollSpyHandler = onScroll;
        scrollContainer.addEventListener('scroll', this.scrollSpyHandler, { passive: true });
        
        // Trigger initial update
        updateActiveSection();
    }

    /**
     * Show PlantUML rendering error
     * @param {HTMLElement} block - PlantUML block element
     * @param {Error} error - Error object
     * @param {string} source - PlantUML source code
     */
    showPlantUMLError(block, error, source) {
        block.innerHTML = `<div class="plantuml-error"><div class="plantuml-error-title">PlantUML Error</div><div class="plantuml-error-message">${Utils.escapeHtml(error.message)}</div><details><summary>Source Code</summary><pre class="plantuml-error-source"><code>${Utils.escapeHtml(source)}</code></pre></details></div>`;
    }

    /**
     * Show Mermaid rendering error
     * @param {HTMLElement} block - Mermaid block element
     * @param {Error} error - Error object
     * @param {string} source - Mermaid source code
     */
    showMermaidError(block, error, source) {
        block.innerHTML = `<div class="mermaid-error"><div class="mermaid-error-title">Mermaid Error</div><div class="mermaid-error-message">${Utils.escapeHtml(error.message)}</div><details><summary>Source Code</summary><pre class="mermaid-error-source"><code>${Utils.escapeHtml(source)}</code></pre></details></div>`;
    }

    /**
     * Show general rendering error
     * @param {Error} error - Error object
     */
    showRenderError(error) {
        this.container.innerHTML = `<div class="render-error"><h2>Rendering Error</h2><p>Failed to render markdown content:</p><pre><code>${Utils.escapeHtml(error.message)}</code></pre><p>Please check the markdown syntax and try again.</p></div>`;
    }

    /**
     * Clear the content area
     */
    clear() {
        this.container.innerHTML = '';
    }

    /**
     * Get rendered HTML content
     * @returns {string} HTML content
     */
    getContent() {
        return this.container.innerHTML;
    }

    /**
     * Search within rendered content
     * @param {string} query - Search query
     * @returns {Array} Array of matches with context
     */
    searchContent(query) {
        const content = this.container.textContent || this.container.innerText;
        const matches = [];
        
        if (!query.trim()) return matches;
        
        const lines = content.split('\n');
        const queryLower = query.toLowerCase();
        
        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(queryLower)) {
                matches.push({
                    line: index + 1,
                    content: line.trim(),
                    context: this.getLineContext(lines, index)
                });
            }
        });
        
        return matches;
    }

    /**
     * Get context lines around a match
     * @param {Array} lines - All lines
     * @param {number} lineIndex - Index of matching line
     * @returns {string} Context string
     */
    getLineContext(lines, lineIndex) {
        const start = Math.max(0, lineIndex - 1);
        const end = Math.min(lines.length - 1, lineIndex + 1);
        
        return lines.slice(start, end + 1).join(' ').trim();
    }

    /**
     * Highlight search terms in content
     * @param {string} query - Search query
     */
    highlightSearchTerms(query) {
        if (!query.trim()) {
            this.clearHighlights();
            return;
        }
        
        // Use a simple text replacement for highlighting
        // In a more complex implementation, you might use a library like mark.js
        const walker = document.createTreeWalker(
            this.container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const regex = new RegExp(`(${Utils.escapeHtml(query)})`, 'gi');
            
            if (regex.test(text)) {
                const highlightedText = text.replace(regex, '<mark>$1</mark>');
                const wrapper = document.createElement('span');
                wrapper.innerHTML = highlightedText;
                textNode.parentNode.replaceChild(wrapper, textNode);
            }
        });
    }

    /**
     * Clear search highlights
     */
    clearHighlights() {
        const highlights = this.container.querySelectorAll('mark');
        highlights.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize(); // Merge adjacent text nodes
        });
    }

    /**
     * Setup auto-hide functionality for ToC
     */
    setupAutoHide() {
        this.setupActivityDetection();
        this.resetInactivityTimer();
    }

    /**
     * Setup activity detection for auto-hide
     */
    setupActivityDetection() {
        const events = ['mousedown', 'mousemove', 'keypress', 'touchstart', 'click'];
        
        const resetTimer = () => {
            this.resetInactivityTimer();
        };

        // Add throttled activity detection to avoid too frequent timer resets
        const throttledReset = Utils.throttle(resetTimer, 100);

        // Add listeners for general events
        events.forEach(event => {
            document.addEventListener(event, throttledReset, { passive: true });
        });
        
        // Add scroll listeners to multiple targets for better coverage
        const scrollTargets = [
            document,
            window,
            document.getElementById('main-content'),
            document.getElementById('markdown-content'),
            document.querySelector('.content-body'),
            document.querySelector('.app-main'),
            document.body
        ];
        
        // Test scroll detection with direct event listeners
        const testScrollHandler = (e) => {
            throttledReset();
        };
        
        scrollTargets.forEach(target => {
            if (target) {
                target.addEventListener('scroll', testScrollHandler, { passive: true });
            }
        });
    }

    /**
     * Reset the inactivity timer
     */
    resetInactivityTimer() {
        // Clear existing timer
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }

        // Restore ToC opacity if it's currently transparent
        if (this.isAutoTransparent) {
            this.restoreTocOpacity();
        }

        // Set new timer
        this.inactivityTimer = setTimeout(() => {
            this.makeTocTransparent();
        }, this.autoHideTimeout);
    }

    /**
     * Make ToC transparent due to inactivity
     */
    makeTocTransparent() {
        const tocSidebar = document.getElementById('toc-sidebar');
        const tocShowBtn = document.getElementById('toc-show-btn');
        const tocHideBtn = document.getElementById('toc-hide-btn');

        // Check if ToC is currently visible - use multiple indicators
        const isTocVisible = tocSidebar && (
            tocSidebar.classList.contains('visible') || 
            !tocSidebar.classList.contains('hidden') ||
            this.tocEnabled
        );

        if (isTocVisible && this.tocEnabled) {
            // ToC is open - make ToC sidebar and hide button transparent
            tocSidebar.classList.add('auto-transparent');
            
            // Only hide button should be transparent when ToC is open
            if (tocHideBtn && window.getComputedStyle(tocHideBtn).display !== 'none') {
                tocHideBtn.classList.add('auto-transparent');
            }
            
            this.isAutoTransparent = true;
        } else {
            // ToC is hidden - only make show button slightly transparent (to hint it's there)
            if (tocShowBtn && window.getComputedStyle(tocShowBtn).display !== 'none') {
                tocShowBtn.classList.add('auto-transparent');
                this.isAutoTransparent = true;
            } else {
                this.isAutoTransparent = false;
            }
            // Don't touch hide button when ToC is hidden
        }
    }

    /**
     * Restore ToC opacity after activity
     */
    restoreTocOpacity() {
        const tocSidebar = document.getElementById('toc-sidebar');
        const tocShowBtn = document.getElementById('toc-show-btn');
        const tocHideBtn = document.getElementById('toc-hide-btn');

        if (tocSidebar) {
            tocSidebar.classList.remove('auto-transparent');
        }

        // Always restore toggle buttons opacity when activity is detected
        if (tocShowBtn) {
            tocShowBtn.classList.remove('auto-transparent');
        }
        
        if (tocHideBtn) {
            tocHideBtn.classList.remove('auto-transparent');
        }

        this.isAutoTransparent = false;
    }

    /**
     * Get auto-hide timeout from localStorage
     * @returns {number} Timeout in milliseconds
     */
    getAutoHideTimeout() {
        try {
            const stored = localStorage.getItem('tocAutoHideTimeout');
            return stored !== null ? parseInt(stored, 10) : 3000; // Default 3 seconds
        } catch (error) {
            console.warn('Failed to get auto-hide timeout from localStorage:', error);
            return 3000;
        }
    }

    /**
     * Set auto-hide timeout in localStorage
     * @param {number} timeout - Timeout in milliseconds
     */
    setAutoHideTimeout(timeout) {
        try {
            localStorage.setItem('tocAutoHideTimeout', timeout.toString());
            this.autoHideTimeout = timeout;
        } catch (error) {
            console.warn('Failed to save auto-hide timeout to localStorage:', error);
        }
    }

    /**
     * Clean up auto-hide timers
     */
    cleanupAutoHide() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }
}

// Make MarkdownRenderer available globally
window.MarkdownRenderer = MarkdownRenderer;
