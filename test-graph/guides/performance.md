# Performance Guide

Optimize graph visualization for large documentation sets.

## Understanding Performance

Graph performance depends on:

- **Number of nodes**: Files in your documentation
- **Number of edges**: Links between files
- **Browser rendering**: Layout complexity

## Optimization Strategies

### File Management

1. **Organize hierarchically**: Use subdirectories
2. **Limit link density**: Avoid over-connecting files
3. **Remove orphaned files**: Files with no connections

### Graph Settings

Configure in [settings](../config/settings.md):

- Use simpler layouts for large graphs
- Reduce visual effects
- Limit simultaneous connections shown

### API Optimization

See [API configuration](../config/api-config.md) for:

- Node count limits
- Caching strategies
- Background processing

## Monitoring Performance

Watch for:

- Slow graph loading
- Laggy interactions
- Memory usage

## When to Optimize

Consider optimization when:

- More than 500 nodes
- Complex interconnections
- Slow user interactions

## Related Resources

- [Best Practices](best-practices.md) - General guidelines
- [Advanced Features](../advanced/features.md) - Power features
- [Troubleshooting](../troubleshooting.md) - Performance issues

Back to [main documentation](../index.md).
