# API Endpoints

Detailed documentation for all graph API endpoints.

## Graph Data Endpoint

### GET /api/graph

Returns the complete graph data for visualization.

**Response:**
```json
{
  "nodes": [...],
  "edges": [...],
  "stats": {...}
}
```

## Analysis Endpoint

### POST /api/graph/analyze

Analyzes a directory for markdown links.

**Request Body:**
```json
{
  "path": "/path/to/directory"
}
```

## Related Documentation

- [API Overview](overview.md) - Main API guide
- [Link Analysis](links.md) - Link detection details
- [Configuration](../config/api-config.md) - API configuration

Back to [main documentation](../index.md).
