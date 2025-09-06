# Advanced Features

Powerful features for experienced users of the graph visualization.

## Advanced Navigation

### Keyboard Shortcuts

- `G` - Toggle graph view
- `F` - Focus on selected node
- `R` - Reset zoom and position
- `Esc` - Clear selection

### Multi-node Selection

- Hold `Ctrl` and click to select multiple nodes
- Use selection for batch operations
- View connections between selected nodes

## Power User Features

### Custom Layouts

Beyond the standard layouts, you can:

1. Save custom layout configurations
2. Create layout presets for different use cases
3. Script layout changes via API

### Filtering and Search

Advanced search capabilities:

```
# Search syntax examples
name:tutorial          # Files with "tutorial" in name
path:api/*            # Files in api directory
links:>5              # Files with more than 5 links
orphan:true           # Orphaned files
```

### Graph Analysis

Use the graph to analyze your documentation:

- **Hub detection**: Find highly connected files
- **Orphan identification**: Locate isolated content
- **Path analysis**: Trace connections between topics

## Integration Features

### Export Options

- Export graph data as JSON
- Generate SVG/PNG images
- Create connection reports

### API Integration

Advanced API usage covered in:

- [API Documentation](../api/overview.md)
- [Endpoint Details](../api/endpoints.md)
- [Configuration](../config/api-config.md)

## Customization

### Styling

- Custom CSS for graph elements
- Theme integration
- Brand-specific colors

### Behavior Modification

- Custom interaction handlers
- Plugin development
- Event system integration

## Related Documentation

- [Basic Tutorial](../tutorials/basic-tutorial.md) - Start here first
- [Best Practices](../guides/best-practices.md) - Optimization tips
- [Performance Guide](../guides/performance.md) - Scale considerations

Return to [main documentation](../index.md).
