# GitHub Copilot Instructions for FlowDoc

## Project Overview

FlowDoc is a VSCode extension that extracts navigable documentation graphs from `@flowdoc-*` comment tags in code. It parses PHP, TypeScript, and JavaScript files to build step-by-step navigation flows with branching support.

**Target audience**: Internal development teams.

**Project status**: Proof of Concept (POC) — prioritize simplicity over extensibility.

## Priority Guidelines

When generating code for this repository:

1. **Library versions**: Always refer to versions defined in `package.json`. Do not hardcode or assume versions.
2. **Codebase Patterns**: Follow existing patterns in the codebase. Consistency is paramount.
3. **Simplicity First**: This is a POC. Prefer simple, readable solutions over complex abstractions.
4. **VSCode API**: Use the VSCode Extension API correctly. Refer to existing usage in `src/` files.

## Planning Before Coding

Before writing any code, always write a plan describing:

1. The steps you will take to implement the change
2. Which files will be affected
3. Any patterns from existing code you will follow
4. Potential edge cases to consider

Wait for user approval before proceeding with code generation.

## Architecture

```
src/
├── extension.ts          # Entry point, command registration
├── types/index.ts        # All TypeScript interfaces (centralized)
├── parser/               # Line-based comment parsing
├── indexer/              # FileSystemWatcher + in-memory caching
├── graph/                # DAG construction with cycle detection
├── config/               # YAML/JSON config loader
└── webview/              # Webview panel management

media/
├── styles.css            # VSCode theme-aware styles
└── main.js               # Vanilla JS webview logic
```

### Layer Responsibilities

| Layer       | Responsibility                              | Dependencies                  |
| ----------- | ------------------------------------------- | ----------------------------- |
| `parser`    | Extract FlowNodes from file content         | `types` only                  |
| `indexer`   | Workspace scanning, file watching, caching  | `parser`, `types`, VSCode API |
| `graph`     | Build TopicGraph, detect cycles/duplicates  | `types` only                  |
| `config`    | Load and validate configuration             | `types`, `yaml` library       |
| `webview`   | UI rendering, message handling              | `graph`, `types`, VSCode API  |
| `extension` | Wire everything together, register commands | All modules                   |

## TypeScript Patterns

### Type Definitions

All types are centralized in `src/types/index.ts`. When adding new types:

```typescript
/**
 * Brief description of the interface
 */
export interface NewType {
  requiredField: string;
  optionalField?: number;
  nullableField: string | null; // Use null, not undefined, for "no value"
}
```

### Null vs Undefined Convention

- Use `null` for intentionally empty values (e.g., `dependency: string | null`)
- Use `undefined` (via `?`) for optional fields that may not exist
- This matches the existing pattern in `FlowNode` and `PendingBlock`

### Function Documentation

Follow JSDoc style matching existing code:

```typescript
/**
 * Brief description of what the function does
 * @param paramName - Description of parameter
 * @returns Description of return value
 */
export function functionName(paramName: Type): ReturnType {
  // implementation
}
```

### Error Handling (POC Pattern)

For this POC, use silent error handling with logging:

```typescript
try {
  // operation
} catch (error) {
  vscode.window.showErrorMessage(`FlowDoc: Error description: ${error}`);
  // continue or return default value
}
```

Do NOT throw errors to the user unless critical. Log and continue.

### Module Exports

- Export functions and classes directly (no default exports)
- Keep exports at the bottom of the file or inline with declaration
- Example: `export function parseFile(...)` or `export class WorkspaceIndexer`

## VSCode Extension Patterns

### Command Registration

Follow the pattern in `extension.ts`:

```typescript
const myCommand = vscode.commands.registerCommand("flowdoc.commandName", async () => {
  await handlerFunction();
});

context.subscriptions.push(myCommand);
```

### User Feedback

```typescript
// Informational
vscode.window.showInformationMessage("FlowDoc: Success message");

// Warning (non-blocking)
vscode.window.showWarningMessage("FlowDoc: Warning message");

// Error (only for critical failures)
vscode.window.showErrorMessage("FlowDoc: Error message");
```

### Progress Notifications

For long operations:

```typescript
await vscode.window.withProgress(
  {
    location: vscode.ProgressLocation.Notification,
    title: "FlowDoc: Operation description...",
    cancellable: false,
  },
  async () => {
    await longOperation();
  },
);
```

### Disposable Pattern

Classes managing resources must implement `vscode.Disposable`:

```typescript
export class MyClass implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  // Register disposables
  this.disposables.push(someWatcher);

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
```

### FileSystemWatcher

Follow the pattern in `workspaceIndexer.ts`:

```typescript
const watcher = vscode.workspace.createFileSystemWatcher(globPattern);

watcher.onDidChange(
  uri => {
    /* handle */
  },
  null,
  this.disposables,
);
watcher.onDidCreate(
  uri => {
    /* handle */
  },
  null,
  this.disposables,
);
watcher.onDidDelete(
  uri => {
    /* handle */
  },
  null,
  this.disposables,
);

this.disposables.push(watcher);
```

## Webview Patterns

### Extension ↔ Webview Communication

Messages are typed in `src/types/index.ts`:

```typescript
// Extension → Webview
export type ExtensionToWebviewMessage = { command: "commandA"; data: TypeA } | { command: "commandB"; data: TypeB };

// Webview → Extension
export type WebviewToExtensionMessage = { command: "actionA"; payload: PayloadA } | { command: "actionB"; payload: PayloadB };
```

### Webview JavaScript (media/main.js)

- Use vanilla JavaScript (no frameworks)
- Use `@ts-check` for basic type checking
- Use IIFE to avoid global scope pollution
- Use `acquireVsCodeApi()` for communication

```javascript
// @ts-check

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  // Event handling
  element?.addEventListener("click", () => {
    vscode.postMessage({ command: "action", data: value });
  });

  // Receive messages
  window.addEventListener("message", event => {
    const message = event.data;
    switch (message.command) {
      case "update":
        // handle
        break;
    }
  });
})();
```

### CSS Styling

Use VSCode CSS variables for theme integration:

```css
/* Colors */
color: var(--vscode-foreground);
background-color: var(--vscode-editor-background);
border-color: var(--vscode-panel-border);

/* Buttons */
background-color: var(--vscode-button-background);
color: var(--vscode-button-foreground);

/* Links */
color: var(--vscode-textLink-foreground);
```

## Parser Patterns

### Line-Based Parsing

The parser uses a simple line-based approach (no AST):

1. Iterate line by line
2. Check if line is a comment (`//`, `#`, `*`, `/*`)
3. Extract `@flowdoc-*` tags via regex
4. Accumulate tags into a "pending block"
5. Finalize block when encountering non-flowdoc content

### Adding New Tags

To add a new `@flowdoc-*` tag:

1. Update `TAG_PATTERN` regex in `commentParser.ts`
2. Add field to `PendingBlock` interface
3. Add field to `FlowNode` interface in `types/index.ts`
4. Handle the tag in the `switch` statement
5. Include in `finalizeBlock()` output

## Graph Builder Patterns

### Warning Generation

Warnings are non-blocking. Follow this pattern:

```typescript
warnings.push({
  type: "warning-type", // Use kebab-case
  nodeId: id,
  message: `Human-readable message describing the issue.`,
  sourceFile: node.sourceFile,
  sourceLine: node.sourceLine,
});
```

### Sorting Convention

- Sort roots alphabetically by ID
- Sort children alphabetically by ID
- Use `localeCompare` for string comparison:

```typescript
array.sort((a, b) => a.localeCompare(b));
```

## File Naming Conventions

| Type               | Convention       | Example                          |
| ------------------ | ---------------- | -------------------------------- |
| TypeScript modules | camelCase        | `commentParser.ts`               |
| Directories        | camelCase        | `src/parser/`                    |
| Interfaces         | PascalCase       | `FlowNode`, `TopicGraph`         |
| Functions          | camelCase        | `parseFile`, `buildGraph`        |
| Constants          | UPPER_SNAKE_CASE | `SUPPORTED_GLOB`, `TAG_PATTERN`  |
| CSS classes        | kebab-case       | `node-header`, `branch-selector` |

## Configuration

### flowdoc.config.yaml/json

The extension looks for config in workspace root:

- `flowdoc.config.yaml` (preferred)
- `flowdoc.config.yml`
- `flowdoc.config.json`

Default config if none found:

```typescript
const DEFAULT_CONFIG: FlowDocConfig = {
  version: 1,
};
```

### Cross-Repository Navigation

FlowDoc supports bidirectional navigation between repositories via the `repos` configuration.

**Backward navigation** (child → parent): Use `@flowdoc-dependency` with `repo-name@node-id` format:

```typescript
// In frontend-app repo
// @flowdoc-topic: authentication
// @flowdoc-id: frontend-login
// @flowdoc-step: User login form submission
// @flowdoc-dependency: backend-api@auth-endpoint
```

**Forward navigation** (parent → children): Use `@flowdoc-children` with comma-separated `repo-name@node-id`:

```typescript
// In backend-api repo
// @flowdoc-topic: authentication
// @flowdoc-id: auth-endpoint
// @flowdoc-step: Backend authentication endpoint
// @flowdoc-children: frontend-app@frontend-login, mobile-app@mobile-login
```

**Config example:**

```yaml
version: 1
repos:
  backend-api:
    path: ../backend-api # Relative to workspace root
  shared-lib:
    path: /absolute/path/to/shared-lib # Absolute path
```

When navigating to cross-repo nodes, FlowDoc will open the target repository folder in a new VS Code window.

### Auto-Indexing

FlowDoc automatically indexes the workspace on activation if the root folder is a git repository (contains `.git` folder). This enables immediate usage without manual reindexing.

## Code Quality Guidelines

### Maintainability

- Keep functions focused on single responsibility
- Maximum function length: ~50 lines (match existing patterns)
- Extract complex logic into helper functions

### Performance

- Use batched parallel processing for file operations (BATCH_SIZE = 50)
- Use Map for O(1) lookups (nodesById, childrenByDependencyId)
- Avoid unnecessary file reads; use caching via WorkspaceIndex

### Security (Webview)

- Always use CSP (Content Security Policy) with nonce
- Use `localResourceRoots` to restrict resource access
- Sanitize any user-provided content before rendering

## Common Patterns Reference

### QuickPick for Selection

```typescript
const selected = await vscode.window.showQuickPick(items, {
  placeHolder: "Placeholder text",
  title: "Dialog Title",
});

if (selected) {
  // User made a selection
}
```

### Opening Files at Specific Line

```typescript
const fileUri = vscode.Uri.file(absolutePath);
const line = lineNumber - 1; // Convert to 0-based
await vscode.window.showTextDocument(fileUri, {
  selection: new vscode.Range(line, 0, line, 0),
});
```

### External URL Opening

```typescript
await vscode.env.openExternal(vscode.Uri.parse(url));
```

## What NOT to Do

- ❌ Do NOT use default exports
- ❌ Do NOT throw errors without catching them (POC: log and continue)
- ❌ Do NOT use `any` type without `@ts-ignore` comment explaining why
- ❌ Do NOT add external dependencies without strong justification
- ❌ Do NOT use frameworks in webview (keep vanilla JS)
- ❌ Do NOT hardcode file paths; use `vscode.Uri` and `path.join`
- ❌ Do NOT ignore the Disposable pattern for resources

## Supported File Types

Currently: `.php`, `.ts`, `.js`

Files in `node_modules` are excluded via glob pattern.

## Glossary

| Term                  | Definition                                                       |
| --------------------- | ---------------------------------------------------------------- |
| FlowNode              | A documentation node extracted from @flowdoc-\* comments         |
| TopicGraph            | The complete graph structure for a single topic                  |
| Topic                 | A grouping identifier for related FlowNodes                      |
| Dependency            | Reference to a parent FlowNode (creates backward graph edge)     |
| Children              | Explicit forward references to child FlowNodes                   |
| Cross-repo Dependency | Dependency in format `repo-name@node-id` for external repos      |
| Cross-repo Child      | Child reference in format `repo-name@node-id` for external repos |
| Root                  | A FlowNode with no dependency (entry point)                      |
| Dangling Root         | A FlowNode whose dependency doesn't exist                        |
| ExternalRepoRef       | Configuration entry mapping repo name to local filesystem path   |
