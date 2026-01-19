/**
 * FlowDoc Workspace Indexer
 * Manages file system watching and maintains an in-memory index of all FlowNodes
 */

import * as vscode from "vscode";
import * as path from "path";
import { FlowNode, WorkspaceIndex } from "../types";
import { parseFile } from "../parser/commentParser";

const SUPPORTED_GLOB = "**/*.{php,ts,js}";
const DEFAULT_EXCLUDES = ["**/node_modules/**", "**/.git/**", "**/vendor/**", "**/dist/**", "**/build/**"];

export class WorkspaceIndexer implements vscode.Disposable {
  private index: WorkspaceIndex;
  private watcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];
  private workspaceRoot: string | undefined;
  private excludePatterns: string[] = DEFAULT_EXCLUDES;

  constructor() {
    this.index = {
      nodesByFile: new Map(),
      lastUpdated: new Date(),
    };

    // Get workspace root for gitignore loading
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      this.workspaceRoot = workspaceFolder.uri.fsPath;
    }
  }

  /**
   * Initialize the indexer: load gitignore + setup watcher
   */
  async initialize(): Promise<void> {
    await this.loadGitignorePatterns();
    this.setupWatcher();
  }

  /**
   * Load and parse .gitignore patterns from workspace root
   */
  private async loadGitignorePatterns(): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }

    const gitignorePath = path.join(this.workspaceRoot, ".gitignore");
    const gitignoreUri = vscode.Uri.file(gitignorePath);

    try {
      const content = await vscode.workspace.fs.readFile(gitignoreUri);
      const gitignoreContent = Buffer.from(content).toString("utf8");
      const patterns = this.parseGitignore(gitignoreContent);

      // Merge with default excludes, avoiding duplicates
      const allPatterns = new Set([...DEFAULT_EXCLUDES, ...patterns]);
      this.excludePatterns = Array.from(allPatterns);
    } catch {
      // No .gitignore or can't read it - use defaults
      console.log("FlowDoc: No .gitignore found, using default excludes");
    }
  }

  /**
   * Parse .gitignore content into glob patterns
   * @param content - Raw .gitignore file content
   * @returns Array of glob patterns for VS Code findFiles exclude
   */
  private parseGitignore(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Skip negation patterns (not supported by VS Code glob exclude)
      if (trimmed.startsWith("!")) {
        continue;
      }

      // Convert gitignore pattern to VS Code glob pattern
      let pattern = trimmed;

      // Remove leading slash (gitignore uses it for root-relative)
      if (pattern.startsWith("/")) {
        pattern = pattern.slice(1);
      }

      // Handle directory patterns (ending with /)
      if (pattern.endsWith("/")) {
        pattern = pattern.slice(0, -1);
      }

      // Wrap with **/ if it doesn't start with ** (to match anywhere in tree)
      if (!pattern.startsWith("**")) {
        pattern = `**/${pattern}`;
      }

      // Add /** suffix for directories to match all contents
      if (!pattern.endsWith("/**") && !pattern.includes(".")) {
        pattern = `${pattern}/**`;
      }

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Build exclude glob pattern from all exclude patterns
   */
  private buildExcludeGlob(): string {
    return `{${this.excludePatterns.join(",")}}`;
  }

  /**
   * Full scan of workspace for all supported files with progress reporting
   */
  async fullScan(): Promise<void> {
    this.index.nodesByFile.clear();

    const excludeGlob = this.buildExcludeGlob();
    const files = await vscode.workspace.findFiles(SUPPORTED_GLOB, excludeGlob);
    const totalFiles = files.length;

    if (totalFiles === 0) {
      this.index.lastUpdated = new Date();
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "FlowDoc: Indexing workspace",
        cancellable: false,
      },
      async progress => {
        let processedFiles = 0;

        // Process files in parallel with concurrency limit
        const BATCH_SIZE = 50;
        for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(uri => this.indexFile(uri)));

          processedFiles += batch.length;
          const percentage = Math.round((processedFiles / totalFiles) * 100);
          progress.report({
            increment: (batch.length / totalFiles) * 100,
            message: `${processedFiles}/${totalFiles} files (${percentage}%)`,
          });
        }
      },
    );

    this.index.lastUpdated = new Date();
  }

  /**
   * Index a single file
   */
  private async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      const nodes = parseFile(content, uri.fsPath);

      if (nodes.length > 0) {
        this.index.nodesByFile.set(uri.fsPath, nodes);
      } else {
        this.index.nodesByFile.delete(uri.fsPath);
      }
    } catch (error) {
      console.error(`FlowDoc: Error indexing ${uri.fsPath}:`, error);
    }
  }

  /**
   * Re-index a single file (on save/change)
   */
  async reindexFile(uri: vscode.Uri): Promise<void> {
    await this.indexFile(uri);
    this.index.lastUpdated = new Date();
  }

  /**
   * Remove file from index
   */
  removeFile(uri: vscode.Uri): void {
    this.index.nodesByFile.delete(uri.fsPath);
    this.index.lastUpdated = new Date();
  }

  /**
   * Setup FileSystemWatcher for incremental updates
   */
  private setupWatcher(): void {
    this.watcher = vscode.workspace.createFileSystemWatcher(SUPPORTED_GLOB);

    this.watcher.onDidChange(
      uri => {
        this.reindexFile(uri);
      },
      null,
      this.disposables,
    );

    this.watcher.onDidCreate(
      uri => {
        this.reindexFile(uri);
      },
      null,
      this.disposables,
    );

    this.watcher.onDidDelete(
      uri => {
        this.removeFile(uri);
      },
      null,
      this.disposables,
    );

    this.disposables.push(this.watcher);
  }

  /**
   * Get all unique topics, sorted alphabetically
   */
  getTopics(): string[] {
    const topicSet = new Set<string>();
    for (const nodes of this.index.nodesByFile.values()) {
      for (const node of nodes) {
        topicSet.add(node.topic);
      }
    }
    return Array.from(topicSet).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get all nodes for a specific topic
   */
  getNodesByTopic(topic: string): FlowNode[] {
    const result: FlowNode[] = [];
    for (const nodes of this.index.nodesByFile.values()) {
      for (const node of nodes) {
        if (node.topic === topic) {
          result.push(node);
        }
      }
    }
    return result;
  }

  /**
   * Get all nodes in the index
   */
  getAllNodes(): FlowNode[] {
    const result: FlowNode[] = [];
    for (const nodes of this.index.nodesByFile.values()) {
      result.push(...nodes);
    }
    return result;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
