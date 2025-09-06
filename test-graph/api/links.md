# Link Analysis

How the system detects and analyzes markdown links.

## Supported Link Formats

### Standard Markdown Links

```markdown
[Display Text](target-file.md)
[Relative Link](../other-file.md)
```

### Obsidian-Style Links

```markdown
[[target-file]]
[[target-file|Display Text]]
```

## Link Resolution

The system resolves links relative to the current file location.

See the [API endpoints](endpoints.md) for technical details.

## Best Practices

For optimal link detection:

- Use relative paths when possible
- Ensure target files exist
- Follow [best practices guide](../guides/best-practices.md)

Return to [API overview](overview.md) or [main page](../index.md).
