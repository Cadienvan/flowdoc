/**
 * FlowDoc Webview Provider
 * Manages the webview panel for graph navigation
 */

import * as vscode from "vscode";
import { TopicGraph, FlowNode, Link, WebviewToExtensionMessage, ExtensionToWebviewMessage, NextOption, SerializedFlowNode, BreadcrumbNode, FlowDocConfig } from "../types";
import { getChildren } from "../graph/graphBuilder";

export class FlowDocWebviewProvider implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private currentGraph: TopicGraph | undefined;
  private currentNodeId: string | undefined;
  private branchSelections: Map<string, string> = new Map();
  private disposables: vscode.Disposable[] = [];
  private followMeEnabled: boolean = true;
  private onGoHomeCallback: (() => void) | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceRoot: string,
    private readonly config?: FlowDocConfig,
  ) {}

  /**
   * Set callback for when user clicks Home button
   */
  setOnGoHomeCallback(callback: () => void): void {
    this.onGoHomeCallback = callback;
  }

  /**
   * Show graph in webview panel
   */
  showGraph(graph: TopicGraph, startNodeId?: string): void {
    this.currentGraph = graph;
    this.branchSelections.clear();

    if (!this.panel) {
      this.createPanel();
    }

    this.panel!.reveal(vscode.ViewColumn.Beside);

    // Send topic info
    this.postMessage({ command: "setTopic", topic: graph.topic });

    // Show warnings if any
    if (graph.warnings.length > 0) {
      this.postMessage({ command: "showWarnings", warnings: graph.warnings });
    }

    // Navigate to specified node or first root
    if (startNodeId && graph.nodesById.has(startNodeId)) {
      this.navigateTo(startNodeId);
    } else if (graph.roots.length > 0) {
      this.navigateTo(graph.roots[0]);
    }
  }

  /**
   * Create webview panel
   */
  private createPanel(): void {
    this.panel = vscode.window.createWebviewPanel("flowdocGraph", "FlowDoc", vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    });

    this.panel.webview.html = this.getHtmlContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        this.handleMessage(message);
      },
      null,
      this.disposables,
    );

    // Handle panel close
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.disposables,
    );
  }

  /**
   * Navigate to a specific node
   */
  private navigateTo(nodeId: string): void {
    if (!this.currentGraph) {
      return;
    }

    const node = this.currentGraph.nodesById.get(nodeId);
    if (!node) {
      return;
    }

    this.currentNodeId = nodeId;

    // Get prev (dependency) - enable for both local and cross-repo dependencies
    let prevId: string | null = null;
    if (node.dependency) {
      if (this.currentGraph.nodesById.has(node.dependency)) {
        // Local dependency
        prevId = node.dependency;
      } else if (node.dependency.includes("@")) {
        // Cross-repo dependency - use special marker
        prevId = node.dependency;
      }
    }

    // Get next options (children) - includes cross-repo children
    const children = getChildren(this.currentGraph, nodeId);
    const nextOptions: NextOption[] = children.map(childId => {
      // Check if this is a cross-repo reference
      const isExternal = childId.includes("@");
      if (isExternal) {
        // Cross-repo child: extract node ID for step display
        const atIndex = childId.indexOf("@");
        const repoName = childId.substring(0, atIndex);
        const externalNodeId = childId.substring(atIndex + 1);
        return {
          id: childId,
          step: `[${repoName}] ${externalNodeId}`,
          isExternal: true,
        };
      }
      const childNode = this.currentGraph!.nodesById.get(childId);
      return {
        id: childId,
        step: childNode?.step || "",
      };
    });

    // Build breadcrumbs (all nodes in order)
    const breadcrumbs = this.buildBreadcrumbs(nodeId);

    // Send update to webview
    this.postMessage({
      command: "updateNode",
      node: this.serializeNode(node),
      prevId,
      nextOptions,
      breadcrumbs,
    });

    // Follow me: open source file automatically
    if (this.followMeEnabled) {
      this.openSourceInEditor(node);
    }
  }

  /**
   * Build breadcrumb trail for the current topic
   * Returns all nodes sorted by traversal order
   */
  private buildBreadcrumbs(currentNodeId: string): BreadcrumbNode[] {
    if (!this.currentGraph) {
      return [];
    }

    const breadcrumbs: BreadcrumbNode[] = [];
    const visited = new Set<string>();

    // DFS to build ordered list
    const traverse = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);

      const node = this.currentGraph!.nodesById.get(nodeId);
      if (node) {
        breadcrumbs.push({
          id: node.id,
          step: node.step,
          isCurrent: node.id === currentNodeId,
        });

        const children = getChildren(this.currentGraph!, nodeId);
        for (const childId of children) {
          traverse(childId);
        }
      }
    };

    // Start from all roots
    for (const rootId of this.currentGraph.roots) {
      traverse(rootId);
    }

    return breadcrumbs;
  }

  /**
   * Open source file in editor (for follow me feature)
   */
  private openSourceInEditor(node: FlowNode): void {
    const fileUri = vscode.Uri.file(node.sourceFile);
    const line = node.sourceLine - 1; // 0-based
    vscode.window.showTextDocument(fileUri, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: true, // Keep focus on webview
      selection: new vscode.Range(line, 0, line, 0),
    });
  }

  /**
   * Serialize FlowNode for webview (no Map/Set)
   */
  private serializeNode(node: FlowNode): SerializedFlowNode {
    return {
      topic: node.topic,
      id: node.id,
      step: node.step,
      dependency: node.dependency,
      dependencyNote: node.dependencyNote,
      children: node.children,
      links: node.links,
      sourceFile: node.sourceFile,
      sourceLine: node.sourceLine,
    };
  }

  /**
   * Handle messages from webview
   */
  private handleMessage(message: WebviewToExtensionMessage): void {
    switch (message.command) {
      case "navigate":
        this.handleNavigate(message.direction);
        break;
      case "selectBranch":
        this.handleSelectBranch(message.nodeId);
        break;
      case "openLink":
        this.handleOpenLink(message.link);
        break;
      case "goToSource":
        this.handleGoToSource();
        break;
      case "goHome":
        this.handleGoHome();
        break;
      case "jumpToNode":
        this.handleJumpToNode(message.nodeId);
        break;
      case "setFollowMe":
        this.followMeEnabled = message.enabled;
        break;
    }
  }

  /**
   * Handle Home button click
   */
  private handleGoHome(): void {
    if (this.onGoHomeCallback) {
      this.onGoHomeCallback();
    }
  }

  /**
   * Handle jump to specific node (from breadcrumbs)
   */
  private handleJumpToNode(nodeId: string): void {
    if (this.currentGraph && this.currentGraph.nodesById.has(nodeId)) {
      this.navigateTo(nodeId);
    }
  }

  /**
   * Handle navigation (prev/next)
   */
  private handleNavigate(direction: "prev" | "next"): void {
    if (!this.currentGraph || !this.currentNodeId) {
      return;
    }

    if (direction === "prev") {
      const node = this.currentGraph.nodesById.get(this.currentNodeId);
      if (node?.dependency) {
        // Check if this is a cross-repo dependency (format: repo-name@node-id)
        if (node.dependency.includes("@")) {
          this.handleCrossRepoNavigation(node.dependency);
        } else if (this.currentGraph.nodesById.has(node.dependency)) {
          this.navigateTo(node.dependency);
        }
      }
    } else {
      // next
      const children = getChildren(this.currentGraph, this.currentNodeId);
      if (children.length === 1) {
        this.navigateTo(children[0]);
      } else if (children.length > 1) {
        // Check if branch was previously selected
        const savedSelection = this.branchSelections.get(this.currentNodeId);
        if (savedSelection && children.includes(savedSelection)) {
          this.navigateTo(savedSelection);
        }
        // Otherwise, webview should show branch selector
      }
    }
  }

  /**
   * Handle cross-repo navigation
   * Opens another repo folder in VS Code with FlowDoc at specified node
   * Uses URI handler to trigger navigation in the new window after indexing
   */
  private async handleCrossRepoNavigation(dependency: string): Promise<void> {
    const atIndex = dependency.indexOf("@");
    if (atIndex === -1) {
      return;
    }

    const repoName = dependency.substring(0, atIndex);
    const nodeId = dependency.substring(atIndex + 1);

    // Get current topic - cross-repo references assume same topic
    const topic = this.currentGraph?.topic;
    if (!topic) {
      vscode.window.showErrorMessage("FlowDoc: Cannot navigate to cross-repo node without a current topic.");
      return;
    }

    // Look up repo path in config
    const repoRef = this.config?.repos?.[repoName];
    if (!repoRef) {
      vscode.window.showWarningMessage(`FlowDoc: Unknown repository "${repoName}". Add it to flowdoc.config.yaml under "repos".`);
      return;
    }

    const repoPath = repoRef.path;
    const repoUri = vscode.Uri.file(repoPath);

    // Check if folder exists
    try {
      const stat = await vscode.workspace.fs.stat(repoUri);
      if (stat.type !== vscode.FileType.Directory) {
        vscode.window.showErrorMessage(`FlowDoc: "${repoPath}" is not a directory.`);
        return;
      }
    } catch {
      vscode.window.showErrorMessage(`FlowDoc: Repository path "${repoPath}" not found.`);
      return;
    }

    // Show notification about what's happening
    vscode.window.showInformationMessage(`FlowDoc: Opening "${repoName}" repository. Will index and navigate to "${nodeId}" automatically.`);

    // Open folder in new window
    await vscode.commands.executeCommand("vscode.openFolder", repoUri, {
      forceNewWindow: true,
    });

    // Build the URI with topic and nodeId for the new window to handle
    // Format: vscode://flowdoc/open?topic=X&nodeId=Y
    const navigationUri = vscode.Uri.from({
      scheme: vscode.env.uriScheme,
      authority: "flowdoc",
      path: "/open",
      query: `topic=${encodeURIComponent(topic)}&nodeId=${encodeURIComponent(nodeId)}`,
    });

    // Open the URI - this will trigger the URI handler in the new window
    // We use a small delay to allow the new window to initialize
    setTimeout(async () => {
      await vscode.env.openExternal(navigationUri);
    }, 1000);
  }

  /**
   * Handle branch selection
   */
  private handleSelectBranch(nodeId: string): void {
    // Check if this is a cross-repo reference
    if (nodeId.includes("@")) {
      this.handleCrossRepoNavigation(nodeId);
      return;
    }

    if (this.currentNodeId) {
      this.branchSelections.set(this.currentNodeId, nodeId);
    }
    this.navigateTo(nodeId);
  }

  /**
   * Handle link click
   */
  private handleOpenLink(link: Link): void {
    switch (link.type) {
      case "file":
        if (link.parsed.filePath) {
          const fileUri = vscode.Uri.file(`${this.workspaceRoot}/${link.parsed.filePath}`);
          const options: vscode.TextDocumentShowOptions = {};
          if (link.parsed.line) {
            const line = link.parsed.line - 1; // 0-based
            options.selection = new vscode.Range(line, 0, line, 0);
          }
          vscode.window.showTextDocument(fileUri, options);
        }
        break;

      case "url":
        if (link.parsed.url) {
          vscode.env.openExternal(vscode.Uri.parse(link.parsed.url));
        }
        break;

      case "symbol":
        if (link.parsed.symbol) {
          // Open Quick Open with symbol search
          vscode.commands.executeCommand("workbench.action.quickOpen", `#${link.parsed.symbol}`);
        }
        break;
    }
  }

  /**
   * Handle "Go to Source" click
   */
  private handleGoToSource(): void {
    if (!this.currentGraph || !this.currentNodeId) {
      return;
    }

    const node = this.currentGraph.nodesById.get(this.currentNodeId);
    if (node) {
      const fileUri = vscode.Uri.file(node.sourceFile);
      const line = node.sourceLine - 1; // 0-based
      // Open in main editor column, don't close webview
      vscode.window.showTextDocument(fileUri, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false, // Focus the editor
        selection: new vscode.Range(line, 0, line, 0),
      });
    }
  }

  /**
   * Post message to webview
   */
  private postMessage(message: ExtensionToWebviewMessage): void {
    this.panel?.webview.postMessage(message);
  }

  /**
   * Generate HTML content for webview
   */
  private getHtmlContent(): string {
    const webview = this.panel!.webview;

    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "styles.css"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "main.js"));

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link href="${stylesUri}" rel="stylesheet">
  <title>FlowDoc</title>
</head>
<body>
  <div id="app">
    <header>
      <div class="header-left">
        <button id="btn-home" class="icon-button" title="Back to topics">🏠</button>
        <h1 id="topic-title">FlowDoc</h1>
      </div>
      <div class="header-right">
        <label class="follow-me-label" title="Auto-follow source code">
          <input type="checkbox" id="follow-me" checked>
          <span>Follow</span>
        </label>
        <button id="btn-breadcrumbs" class="icon-button" title="Show all steps">📋</button>
        <button id="warnings-toggle" class="icon-button" hidden title="Show warnings">
          ⚠️ <span id="warnings-count">0</span>
        </button>
      </div>
    </header>

    <div id="breadcrumbs-panel" hidden>
      <div class="breadcrumbs-header">
        <h3>📋 All Steps</h3>
        <button id="close-breadcrumbs" class="icon-button">✕</button>
      </div>
      <ul id="breadcrumbs-list"></ul>
    </div>

    <main id="node-card">
      <div class="node-header">
        <span class="node-id" id="node-id"></span>
        <button id="go-to-source" class="text-button" title="Go to source">📍 Source</button>
      </div>
      <p class="node-step" id="node-step"></p>
      <p class="node-dependency-note" id="node-dependency-note"></p>
      <div id="links-section" hidden>
        <h4>Links</h4>
        <ul class="node-links" id="node-links"></ul>
      </div>
    </main>

    <nav id="navigation">
      <button id="btn-prev" disabled>← Prev</button>
      <span id="nav-info"></span>
      <button id="btn-next" disabled>Next →</button>
    </nav>

    <div id="branch-selector" hidden>
      <h4>Choose next step:</h4>
      <ul id="branch-list"></ul>
    </div>

    <aside id="warnings-panel" hidden>
      <div class="warnings-header">
        <h3>⚠️ Warnings</h3>
        <button id="close-warnings" class="icon-button">✕</button>
      </div>
      <ul id="warnings-list"></ul>
    </aside>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.panel?.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}

/**
 * Generate nonce for CSP
 */
function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
