# Best Practices

Guidelines for creating effective graph visualizations.

## File Organization

### Directory Structure

Organize your markdown files logically:

```
project/
├── index.md          # Main entry point
├── guides/           # How-to guides
├── api/             # Technical documentation
└── tutorials/       # Step-by-step tutorials
```

### Linking Strategy

- **Hub files**: Create index files that link to related content
- **Bidirectional links**: Link back to parent/related topics
- **Semantic grouping**: Group related files in directories

## Content Guidelines

### Writing Effective Links

```markdown
<!-- Good: Descriptive link text -->
[Getting started guide](getting-started.md)

<!-- Better: Context-aware linking -->
See the [API documentation](api/overview.md) for technical details.
```

### Link Density

- Aim for 3-7 outgoing links per file
- Balance between connectivity and readability
- Use [[wiki-style links]] for quick references

## Performance Optimization

For large documentation sets:

1. Use the [performance guide](performance.md)
2. Configure [API settings](../config/api-config.md) appropriately
3. Consider file organization impact

## Related Topics

- [Getting Started](../getting-started.md) - Basic setup
- [Advanced Features](../advanced/features.md) - Power user tips
- [Troubleshooting](../troubleshooting.md) - Common issues

Return to [main documentation](../index.md).
