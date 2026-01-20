# FlowDoc - VSCode Extension (POC)

Navigate code documentation graphs extracted from `@flowdoc-*` comment tags.

## Features

- 📝 Parse `@flowdoc-*` tags from PHP, TypeScript, JavaScript files
- 🔗 Build navigable graphs per topic
- 🧭 Step-by-step navigation with branching support
- ⚠️ Warnings for duplicates, missing dependencies, cycles

## Quick Start

### 1. Add FlowDoc comments to your code

```php
// @flowdoc-topic: user-registration
// @flowdoc-id: REG-001
// @flowdoc-step: User submits registration form

// @flowdoc-topic: user-registration
// @flowdoc-id: REG-002
// @flowdoc-step: Validate email and password
// @flowdoc-dependency: REG-001

// @flowdoc-topic: user-registration
// @flowdoc-id: REG-003
// @flowdoc-step: Create user in database
// @flowdoc-dependency: REG-002 [After validation passes]
// @flowdoc-links: file:app/Models/User.php:45; symbol:App\\Models\\User@create
```

### 2. Navigate

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run `FlowDoc: Pick Topic`
3. Select a topic
4. Use **Prev/Next** buttons to navigate the graph

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.85+

### Setup

```bash
cd flowdoc
npm install
npm run compile
```

### Run/Debug (F5)

1. Open the `flowdoc` folder in VS Code
2. Press `F5` (or Run → Start Debugging)
3. A new VS Code window opens (Extension Development Host)
4. Open a folder with `@flowdoc-*` comments
5. Run `FlowDoc: Pick Topic` from Command Palette

### Watch Mode

```bash
npm run watch
```

Changes auto-compile. Reload Extension Host with `Cmd+R` / `Ctrl+R`.

## Configuration (Optional)

Create `flowdoc.config.yaml` in workspace root:

```yaml
version: 1
repos:
  other-repo:
    path: /path/to/other/repo
```

### Cross-Repository Navigation

FlowDoc supports bidirectional navigation between repositories:

**Backward navigation** (child → parent): Use `@flowdoc-dependency` with `repo-name@node-id`:
```php
// In frontend-app repo
// @flowdoc-topic: authentication
// @flowdoc-id: login-handler
// @flowdoc-step: Handle login form submission
// @flowdoc-dependency: backend-api@auth-endpoint
```

**Forward navigation** (parent → children): Use `@flowdoc-children` with comma-separated IDs:
```php
// In backend-api repo
// @flowdoc-topic: authentication
// @flowdoc-id: auth-endpoint
// @flowdoc-step: Backend auth endpoint
// @flowdoc-children: frontend-app@login-handler, mobile-app@auth-screen
```

Cross-repo navigation opens the target repository in a new VS Code window.

## Tag Reference

### Multi-line Format

| Tag                   | Required | Description                                 |
| --------------------- | -------- | ------------------------------------------- |
| `@flowdoc-topic`      | ✅        | Topic name (groups nodes)                   |
| `@flowdoc-id`         | ✅        | Unique identifier                           |
| `@flowdoc-step`       | ✅        | Step description                            |
| `@flowdoc-dependency` | ❌        | Parent node ID `[optional note]`            |
| `@flowdoc-children`   | ❌        | Comma-separated child IDs (for forward nav) |
| `@flowdoc-links`      | ❌        | Semicolon-separated links                   |

### One-liner Format

Use `@flowdoc-line` for compact single-line documentation:

```
@flowdoc-line: TOPIC | ID | STEP | links | dependency | children
```

| Position | Field      | Required | Description                      |
| -------- | ---------- | -------- | -------------------------------- |
| 1        | TOPIC      | ✅        | Topic name                       |
| 2        | ID         | ✅        | Unique identifier                |
| 3        | STEP       | ✅        | Step description                 |
| 4        | links      | ❌        | Semicolon-separated links        |
| 5        | dependency | ❌        | Parent node ID `[optional note]` |
| 6        | children   | ❌        | Comma-separated child IDs        |

**Examples:**
```php
// Minimal (required fields only)
// @flowdoc-line: checkout | CART-001 | User adds item to cart

// With dependency
// @flowdoc-line: checkout | CART-002 | Cart totals calculated | | CART-001

// Full format
// @flowdoc-line: checkout | CART-003 | Proceed to payment | file:checkout.ts:50 | CART-002 [After validation] | CART-004
```

### Auto-Numeric Sequences

FlowDoc automatically detects numeric sequences in IDs and creates bidirectional links:

```php
// No explicit dependencies needed - FlowDoc auto-links these!
// @flowdoc-topic: onboarding
// @flowdoc-id: STEP-001
// @flowdoc-step: Welcome screen

// @flowdoc-topic: onboarding
// @flowdoc-id: STEP-2       // Auto-linked to STEP-001
// @flowdoc-step: Profile setup

// @flowdoc-topic: onboarding
// @flowdoc-id: STEP-03      // Auto-linked to STEP-2
// @flowdoc-step: Preferences
```

**How it works:**
- Detects numeric suffix in IDs (e.g., `STEP-001`, `TASK-2`, `FLOW-03`)
- Handles mixed formats: `001` links to `2` links to `03`
- Auto-assigns **dependency** to `{prefix}{n-1}` if it exists
- Auto-assigns **children** to `{prefix}{n+1}` if it exists
- Only applies within the same topic
- Explicit dependencies/children override auto-detection

### Link Formats

| Format    | Example                        | Action                              |
| --------- | ------------------------------ | ----------------------------------- |
| `symbol:` | `symbol:App\\Class@method`     | Opens Quick Open with symbol search |
| `file:`   | `file:path/to/file.ts:42`      | Opens file at line                  |
| `url:`    | `url:https://docs.example.com` | Opens in browser                    |

## Errors and Warnings

### Errors (Yellow underlines in editor)

FlowDoc shows validation errors as VS Code diagnostics (yellow underlines) directly in your code for missing required fields:

- **missing-topic**: Block has `@flowdoc-id` but no `@flowdoc-topic`
- **missing-id**: Block has `@flowdoc-topic` but no `@flowdoc-id`
- **missing-step**: Block has topic and id but no `@flowdoc-step`

These appear in the Problems panel and as squiggly underlines in the editor.

### Warnings (Yellow in webview)

FlowDoc shows non-blocking warnings in the webview panel for:

- **Duplicate ID**: Same ID used twice in a topic (first occurrence wins)
- **Missing Dependency**: Dependency ID not found (node treated as root)
- **Cycle Detected**: Circular dependency chain

## Commands

| Command                      | Description                 |
| ---------------------------- | --------------------------- |
| `FlowDoc: Pick Topic`        | Select topic and open graph |
| `FlowDoc: Open Graph`        | Reopen last viewed graph    |
| `FlowDoc: Reindex Workspace` | Force full re-scan          |

## Supported Files

- `.php`
- `.ts`
- `.js`

Files in `node_modules` are excluded.

## Architecture

```
src/
├── extension.ts          # Entry point, command registration
├── types/
│   └── index.ts          # TypeScript interfaces
├── parser/
│   └── commentParser.ts  # Line-based @flowdoc-* parser
├── indexer/
│   └── workspaceIndexer.ts  # FileSystemWatcher + caching
├── graph/
│   └── graphBuilder.ts   # DAG construction with cycle detection
├── config/
│   └── configLoader.ts   # YAML/JSON config loader
└── webview/
    └── webviewProvider.ts  # Webview panel management

media/
├── styles.css            # VSCode theme-aware styles
└── main.js               # Webview UI logic
```

## License

MIT
