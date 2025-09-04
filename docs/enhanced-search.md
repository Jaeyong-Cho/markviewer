# Enhanced Search Functionality

## Overview
The search functionality has been enhanced to provide comprehensive search capabilities across markdown files in the selected root directory.

## Features

### 1. Content and Filename Search
- **Content Search**: Searches within the text content of markdown files
- **Filename Search**: Searches in the filename itself
- **Combined Results**: Shows both content and filename matches with clear indicators

### 2. Enhanced Result Display
- **Match Breakdown**: Shows separate counts for filename vs. content matches
- **Visual Indicators**: 
  - "FILE" label for filename matches
  - "CONTENT" label for content matches
- **Preview Support**: Click "Preview" button to see file content without opening

### 3. Improved Search Results
- **Snippets**: Shows relevant text snippets with context
- **Ranking**: Results are ranked by relevance (total matches, then filename)
- **File Previews**: Clean markdown preview without syntax formatting

## Usage

1. **Select Root Directory**: Choose the directory containing markdown files
2. **Enter Search Query**: Type your search term in the search box
3. **View Results**: See files matching your query with:
   - File title and path
   - Match counts (filename + content)
   - Text snippets showing matches
   - Preview option for quick content review
4. **Open Files**: Click on any result to open the file

## Search Types

### Simple Text Search
- Case-insensitive matching
- Searches both filenames and content
- Example: "readme" matches "README.md" and files containing "readme"

### Advanced Features
- **Real-time Search**: Results update as you type (debounced)
- **Multiple Matches**: Shows multiple snippets per file
- **Context Preview**: See file content without opening
- **Smart Ranking**: Most relevant results shown first

## Technical Details

### Backend Enhancements
- Added filename search capability
- Implemented content preview generation
- Enhanced result ranking algorithm
- Added match type classification

### Frontend Improvements
- Updated UI to show match breakdowns
- Added preview toggle functionality
- Improved visual indicators for match types
- Enhanced CSS styling for better UX

## Examples

### Searching for "API"
- Finds files named "api.md"
- Finds files containing "API" in content
- Shows both types with appropriate labels
- Provides previews of matching content

### Searching for filenames
- "README" finds all README files
- Shows filename match with "FILE" label
- Still searches content for additional matches
