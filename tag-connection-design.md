# Tag-based Graph Connections Design

## Overview

This design extends the existing MarkViewer link analysis system to support Obsidian-style YAML frontmatter tags for creating graph connections between markdown files.

## Architecture

### Backend Changes

#### 1. YAML Frontmatter Parser
- Add `js-yaml` dependency for parsing YAML frontmatter
- Create `extractFrontmatter()` method in `LinkAnalysisService`
- Parse tags property from frontmatter in each markdown file

#### 2. Tag-based Edge Creation
- Extend `LinkAnalysisService` to create tag-based edges
- Add tag metadata to node objects
- Create edges between files sharing common tags
- Distinguish tag edges from link edges

#### 3. Enhanced Graph Data Structure
```javascript
// Enhanced node structure
{
    id: string,
    name: string,
    path: string,
    relativePath: string,
    size: number,
    modified: Date,
    incomingLinks: number,
    outgoingLinks: number,
    tags: string[], // NEW: array of tags from frontmatter
    tagConnections: number // NEW: count of tag-based connections
}

// Enhanced edge structure
{
    source: string,
    target: string,
    sourcePath: string,
    targetPath: string,
    type: 'link' | 'tag', // NEW: edge type
    sharedTags: string[] // NEW: for tag edges, list of shared tags
}
```

### Frontend Changes

#### 1. Visual Distinction
- Different edge styles for tag-based connections (dashed lines, different color)
- Add edge type information to tooltips and node info panels
- Update CSS to support new edge styles

#### 2. Graph Visualization Enhancement
- Add tag information to node tooltips
- Show shared tags information when hovering over tag edges
- Update node info panel to display tags

#### 3. UI Controls (Future Enhancement)
- Tag filtering controls
- Tag cloud visualization
- Toggle to show/hide tag connections

## Data Flow

1. **File Analysis**:
   - Read markdown file content
   - Extract YAML frontmatter if present
   - Parse tags from frontmatter
   - Store tags in node metadata

2. **Tag Connection Creation**:
   - After all files are processed
   - Group files by shared tags
   - Create tag-based edges between files with common tags
   - Store shared tag information in edge metadata

3. **Graph Rendering**:
   - Send enhanced node and edge data to frontend
   - Apply different visual styles based on edge type
   - Display tag information in UI

## Implementation Plan

### Phase 1: Backend Implementation
1. Add js-yaml dependency
2. Implement frontmatter parsing
3. Extend node structure with tag data
4. Create tag-based edge generation
5. Update graph data serialization

### Phase 2: Frontend Implementation
1. Update graph view styles for tag edges
2. Enhance node info display with tags
3. Add tag edge tooltips
4. Update CSS for visual distinction

### Phase 3: Testing and Validation
1. Create test files with various tag configurations
2. Verify tag parsing and edge creation
3. Test visual representation
4. Performance testing with large tag sets

## Edge Cases and Error Handling

1. **Malformed YAML**: Continue processing, log warnings
2. **No tags property**: Treat as empty tag array
3. **Invalid tag values**: Filter out non-string values
4. **Tag normalization**: Convert to lowercase, trim whitespace
5. **Self-connections**: Prevent edges from file to itself
6. **Duplicate edges**: Handle multiple shared tags gracefully

## Performance Considerations

1. **Tag indexing**: Create efficient tag-to-files mapping
2. **Edge deduplication**: Avoid creating multiple edges for multiple shared tags
3. **Memory usage**: Limit tag connections for files with many tags
4. **Rendering**: Use efficient Cytoscape edge styling

## Migration Strategy

- Fully backward compatible - existing functionality unchanged
- Tag features are additive enhancements
- No breaking changes to existing APIs
