#!/bin/bash

# MarkViewer Demo Script
# This script demonstrates the key features of MarkViewer

echo "🚀 MarkViewer Demo"
echo "=================="
echo

# Check if servers are running
echo "📋 Checking server status..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Backend server is running on port 3000"
else
    echo "❌ Backend server is not running. Start it with: cd backend && npm start"
    exit 1
fi

# Test API endpoints
echo
echo "🔌 Testing API endpoints..."

echo "📁 Directory tree API:"
curl -s "http://localhost:3000/api/directory?path=/Users/jaeyong/workspace/markviewer/test-content" | jq '.name, .children[].name'

echo
echo "📄 File content API:"
curl -s "http://localhost:3000/api/file?path=/Users/jaeyong/workspace/markviewer/test-content/README.md" | jq '.path'

echo
echo "🎨 PlantUML rendering API:"
curl -s -X POST -H "Content-Type: application/json" \
     -d '{"source":"@startuml\nAlice -> Bob: Hello\n@enduml"}' \
     http://localhost:3000/api/plantuml | jq -r '.svg' | head -c 100
echo "... [SVG content truncated]"

echo
echo "🔍 Search API:"
curl -s "http://localhost:3000/api/search?q=markdown&path=/Users/jaeyong/workspace/markviewer/test-content" | jq '.total, .results[0].title // "No results"'

echo
echo "🌐 Frontend Application:"
echo "   Open your browser and go to: http://localhost:3000"
echo "   Or click the browser tab that just opened."

echo
echo "📖 Demo Instructions:"
echo "   1. Click 'Select Root Directory'"
echo "   2. Enter: /Users/jaeyong/workspace/markviewer/test-content"
echo "   3. Browse the files in the sidebar"
echo "   4. Try searching for 'PlantUML' or 'API'"
echo "   5. View the rendered markdown with diagrams"

echo
echo "✨ Features demonstrated:"
echo "   ✅ Markdown rendering"
echo "   ✅ PlantUML diagrams"
echo "   ✅ Mermaid diagrams"
echo "   ✅ Code highlighting"
echo "   ✅ Directory navigation"
echo "   ✅ Full-text search"
echo "   ✅ Responsive design"

echo
echo "🎉 MarkViewer is ready to use!"
echo "   Visit http://localhost:3000 to start exploring your markdown files."
