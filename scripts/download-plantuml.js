const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Download PlantUML jar file from the official release using curl
 */
async function downloadPlantUML() {
    const plantUMLUrl = 'https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar';
    const toolsDir = path.join(__dirname, '..', 'tools');
    const jarPath = path.join(toolsDir, 'plantuml.jar');

    // Ensure tools directory exists
    if (!fs.existsSync(toolsDir)) {
        fs.mkdirSync(toolsDir, { recursive: true });
    }

    // Check if PlantUML jar already exists and has valid size
    if (fs.existsSync(jarPath)) {
        const stats = fs.statSync(jarPath);
        if (stats.size > 1024 * 1024) { // At least 1MB (PlantUML jar is typically ~22MB)
            console.log('PlantUML jar already exists at:', jarPath);
            console.log('File size:', Math.round(stats.size / 1024 / 1024), 'MB');
            return;
        } else {
            console.log('Existing PlantUML jar is corrupted (size:', stats.size, 'bytes). Re-downloading...');
            fs.unlinkSync(jarPath);
        }
    }

    console.log('Downloading PlantUML jar file using curl...');
    
    return new Promise((resolve, reject) => {
        // Use curl with -L to follow redirects, -o to specify output file
        const curlCommand = `curl -L -o "${jarPath}" "${plantUMLUrl}"`;
        
        exec(curlCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('Download failed:', error.message);
                // Clean up partial download
                if (fs.existsSync(jarPath)) {
                    fs.unlinkSync(jarPath);
                }
                reject(error);
                return;
            }

            // Verify the download
            if (!fs.existsSync(jarPath)) {
                reject(new Error('Downloaded file does not exist'));
                return;
            }

            const stats = fs.statSync(jarPath);
            if (stats.size < 1024 * 1024) { // Less than 1MB indicates a failed download
                fs.unlinkSync(jarPath);
                reject(new Error(`Downloaded file is too small (${stats.size} bytes). Download may have failed.`));
                return;
            }

            console.log('PlantUML jar downloaded successfully to:', jarPath);
            console.log('File size:', Math.round(stats.size / 1024 / 1024), 'MB');
            resolve();
        });
    });
}

// Check Java availability
function checkJava() {
    return new Promise((resolve, reject) => {
        exec('java -version', (error, stdout, stderr) => {
            if (error) {
                console.error('Java is not installed or not in PATH.');
                console.error('Please install Java Runtime Environment (JRE) to use PlantUML features.');
                reject(error);
            } else {
                console.log('Java is available:', stderr.split('\n')[0]);
                resolve();
            }
        });
    });
}

async function setup() {
    try {
        await checkJava();
        await downloadPlantUML();
        console.log('PlantUML setup completed successfully!');
    } catch (error) {
        console.error('Setup failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    setup();
}

module.exports = { downloadPlantUML, checkJava };
