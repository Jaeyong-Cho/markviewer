#!/usr/bin/env node

/**
 * Download frontend libraries script
 * Downloads all external CDN dependencies to local files using Node.js built-in modules
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class FrontendLibsDownloader {
    constructor() {
        this.libsDir = path.join(__dirname, '..', 'frontend', 'libs');
        this.libraries = [
            {
                name: 'marked',
                version: '9.1.2',
                url: 'https://cdn.jsdelivr.net/npm/marked@9.1.2/marked.min.js',
                filename: 'marked.min.js'
            },
            {
                name: 'socket.io-client',
                version: '4.7.4',
                url: 'https://cdn.socket.io/4.7.4/socket.io.min.js',
                filename: 'socket.io.min.js'
            },
            {
                name: 'cytoscape',
                version: '3.26.0',
                url: 'https://cdn.jsdelivr.net/npm/cytoscape@3.26.0/dist/cytoscape.min.js',
                filename: 'cytoscape.min.js'
            },
            {
                name: 'highlight.js',
                version: '11.9.0',
                url: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
                filename: 'highlight.min.js'
            },
            {
                name: 'mermaid',
                version: '10.6.1',
                url: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
                filename: 'mermaid.min.js'
            },
            {
                name: 'github-css',
                version: '11.9.0',
                url: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css',
                filename: 'github.min.css'
            }
        ];
    }

    /**
     * Ensure libs directory exists
     */
    ensureLibsDirectory() {
        if (!fs.existsSync(this.libsDir)) {
            fs.mkdirSync(this.libsDir, { recursive: true });
            console.log(`📁 Created libs directory: ${this.libsDir}`);
        }
    }

    /**
     * Check if a library file exists and has valid size
     */
    isLibraryExists(filename) {
        const filePath = path.join(this.libsDir, filename);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            return stats.size > 1024; // At least 1KB
        }
        return false;
    }

    /**
     * Download a file using Node.js built-in modules
     */
    downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            const file = fs.createWriteStream(filePath);

            const request = client.get(url, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    file.close();
                    fs.unlinkSync(filePath);
                    return this.downloadFile(response.headers.location, filePath)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(filePath);
                    return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (err) => {
                    file.close();
                    fs.unlinkSync(filePath);
                    reject(err);
                });
            });

            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                reject(err);
            });

            request.setTimeout(30000, () => {
                request.abort();
                file.close();
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                reject(new Error('Download timeout'));
            });
        });
    }

    /**
     * Download a single library
     */
    async downloadLibrary(library) {
        const { name, url, filename } = library;
        const filePath = path.join(this.libsDir, filename);

        if (this.isLibraryExists(filename)) {
            console.log(`✅ ${name} already exists: ${filename}`);
            return;
        }

        console.log(`⬇️  Downloading ${name}...`);
        
        try {
            await this.downloadFile(url, filePath);
            
            // Verify download
            if (this.isLibraryExists(filename)) {
                const stats = fs.statSync(filePath);
                console.log(`✅ Downloaded ${name}: ${filename} (${Math.round(stats.size / 1024)}KB)`);
            } else {
                throw new Error('Downloaded file is empty or invalid');
            }
        } catch (error) {
            console.error(`❌ Failed to download ${name}: ${error.message}`);
            
            // Clean up failed download
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            throw error;
        }
    }

    /**
     * Download all libraries
     */
    async downloadAllLibraries() {
        console.log('📦 Downloading frontend libraries...\n');
        
        this.ensureLibsDirectory();
        
        let successful = 0;
        let failed = 0;

        for (const library of this.libraries) {
            try {
                await this.downloadLibrary(library);
                successful++;
            } catch (error) {
                console.error(`Failed to download ${library.name}: ${error.message}`);
                failed++;
            }
        }
        
        console.log('\n📊 Download Summary:');
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        
        if (failed > 0) {
            console.log('\n⚠️  Some downloads failed. The application will fall back to CDN for missing libraries.');
        } else {
            console.log('\n🎉 All frontend libraries downloaded successfully!');
        }
    }

    /**
     * Create a manifest file with library information
     */
    createManifest() {
        const manifestPath = path.join(this.libsDir, 'manifest.json');
        const manifest = {
            generated: new Date().toISOString(),
            libraries: this.libraries.map(lib => ({
                name: lib.name,
                version: lib.version,
                filename: lib.filename,
                exists: this.isLibraryExists(lib.filename)
            }))
        };
        
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log('📝 Created library manifest: libs/manifest.json');
    }

    /**
     * Main download process
     */
    async download() {
        try {
            await this.downloadAllLibraries();
            this.createManifest();
        } catch (error) {
            console.error('❌ Frontend libraries download failed:', error.message);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const downloader = new FrontendLibsDownloader();
    downloader.download();
}

module.exports = FrontendLibsDownloader;
