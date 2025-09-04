/**
 * Markdown renderer with PlantUML, Mermaid, and code highlighting support
 */

class MarkdownRenderer extends Utils.EventEmitter {
    constructor(container, app) {
        super();
        this.container = container;
        this.app = app;
        this.setupMarked();
        this.setupMermaid();
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

        // Custom image renderer for better handling
        renderer.image = (href, title, text) => {
            const titleAttr = title ? ` title="${title}"` : '';
            const altAttr = text ? ` alt="${text}"` : '';
            
            return `<img src="${href}"${altAttr}${titleAttr} loading="lazy" />`;
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
                console.log('Setting up syntax highlighting with hljs version:', hljs.versionString || 'unknown');
                
                // Now add the highlight function
                marked.setOptions({
                    highlight: (code, language) => {
                        try {
                            if (language && hljs.getLanguage(language)) {
                                console.log('Highlighting code as:', language);
                                return hljs.highlight(code, { language }).value;
                            } else {
                                console.log('Auto-highlighting code');
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
                        console.log('No highlighting available, using plain code');
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
        try {
            // Parse markdown to HTML
            let html = marked.parse(content);
            
            // Sanitize HTML for security
            html = Utils.sanitizeHtml(html);
            
            // Set the HTML content
            this.container.innerHTML = html;
            
            // Process special content types
            await this.processPlantUMLBlocks();
            await this.processMermaidBlocks();
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
        return `<div class="plantuml-block" data-id="${id}"><script type="application/plantuml" class="plantuml-source">${Utils.escapeHtml(code)}</script><div class="plantuml-loading"><div class="spinner"></div><p>Rendering PlantUML diagram...</p></div></div>`;
    }

    /**
     * Create Mermaid code block placeholder
     * @param {string} code - Mermaid source code
     * @returns {string} HTML placeholder
     */
    createMermaidBlock(code) {
        const id = Utils.generateId();
        // Store the source in a script tag to avoid data attribute limitations
        return `<div class="mermaid-block" data-id="${id}"><script type="application/mermaid" class="mermaid-source">${Utils.escapeHtml(code)}</script><div class="mermaid-loading"><div class="spinner"></div><p>Rendering Mermaid diagram...</p></div></div>`;
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
     * Process PlantUML blocks in the rendered content
     */
    async processPlantUMLBlocks() {
        const plantumlBlocks = this.container.querySelectorAll('.plantuml-block');
        
        for (const block of plantumlBlocks) {
            try {
                // Get source from script tag instead of data attribute
                const sourceScript = block.querySelector('.plantuml-source');
                if (!sourceScript) {
                    console.warn('PlantUML block missing source script');
                    continue;
                }
                
                // Decode HTML entities from the script content
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sourceScript.textContent;
                const source = tempDiv.textContent || tempDiv.innerText;
                const id = block.dataset.id;
                
                console.log('Processing PlantUML block with source:', source.substring(0, 50) + '...');
                
                // Show loading state
                const loadingDiv = block.querySelector('.plantuml-loading');
                if (loadingDiv) {
                    loadingDiv.innerHTML = `<div class="spinner"></div><p>Rendering PlantUML diagram...</p>`;
                }
                
                // Render PlantUML
                const result = await window.api.renderPlantUML(source);
                
                // Check if result is a string (SVG directly) or object with svg property
                let svg;
                if (typeof result === 'string') {
                    svg = result;
                } else if (result && result.svg) {
                    svg = result.svg;
                } else {
                    throw new Error('PlantUML service returned invalid response');
                }
                
                // Display SVG result
                block.innerHTML = `<div class="plantuml-diagram" id="plantuml-${id}">${svg}</div>`;
                
            } catch (error) {
                console.error('PlantUML rendering failed:', error);
                this.showPlantUMLError(block, error, block.dataset.source);
            }
        }
    }

    /**
     * Process Mermaid blocks in the rendered content
     */
    async processMermaidBlocks() {
        const mermaidBlocks = this.container.querySelectorAll('.mermaid-block');
        
        for (const block of mermaidBlocks) {
            try {
                // Get source from script tag instead of data attribute
                const sourceScript = block.querySelector('.mermaid-source');
                if (!sourceScript) {
                    console.warn('Mermaid block missing source script');
                    continue;
                }
                
                // Decode HTML entities from the script content
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sourceScript.textContent;
                const source = tempDiv.textContent || tempDiv.innerText;
                const id = block.dataset.id;
                
                // Create container for Mermaid diagram
                const diagramContainer = document.createElement('div');
                diagramContainer.className = 'mermaid-diagram';
                diagramContainer.id = `mermaid-${id}`;
                
                // Render Mermaid diagram
                const { svg } = await mermaid.render(`mermaid-svg-${id}`, source);
                diagramContainer.innerHTML = svg;
                
                // Replace loading block with diagram
                block.innerHTML = '';
                block.appendChild(diagramContainer);
                
            } catch (error) {
                console.error('Mermaid rendering failed:', error);
                this.showMermaidError(block, error, source || 'Unknown source');
            }
        }
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
        
        if (headings.length < 2) {
            this.hideTocSidebar();
            return; // Don't show TOC for single heading
        }
        
        // Add IDs to headings for linking
        headings.forEach((heading, index) => {
            heading.id = `heading-${index}`;
        });
        
        // Generate TOC data and update sidebar
        this.updateTocSidebar(headings);
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
            
            tocHtml += `<li class="toc-item toc-level-${level}" style="margin-left: ${indentLevel * 16}px;">
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
        }
    }

    /**
     * Hide the TOC sidebar
     */
    hideTocSidebar() {
        const tocSidebar = document.getElementById('toc-sidebar');
        if (tocSidebar) {
            tocSidebar.classList.remove('visible');
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
                    // Scroll to position the target heading at the top of the viewport
                    Utils.scrollToElement(target, 'smooth', 'start');
                }
            });
        });
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
}

// Make MarkdownRenderer available globally
window.MarkdownRenderer = MarkdownRenderer;
