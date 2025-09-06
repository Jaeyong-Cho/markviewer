# API Configuration

Configuration options for the graph API.

## Server Settings

### Endpoint Configuration

```json
{
  "graph": {
    "maxNodes": 1000,
    "excludeDirs": [".git", "node_modules"],
    "includePatterns": ["*.md", "*.markdown"]
  }
}
```

### Performance Tuning

- Set reasonable node limits
- Configure file watching
- Optimize link analysis

## Security Settings

- CORS configuration
- Rate limiting
- File access restrictions

## Related Configuration

- [General Settings](settings.md) - UI configuration
- [Performance Guide](../guides/performance.md) - Optimization
- [API Endpoints](../api/endpoints.md) - Endpoint details

Return to [API overview](../api/overview.md) or [main page](../index.md).
