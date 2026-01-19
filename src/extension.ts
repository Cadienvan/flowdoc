/**
 * FlowDoc Extension Entry Point
 * Registers commands and initializes the extension
 */

import * as vscode from "vscode";
import * as path from "path";
import { WorkspaceIndexer } from "./indexer/workspaceIndexer";
import { buildGraph } from "./graph/graphBuilder";
import { loadConfig } from "./config/configLoader";
import { FlowDocWebviewProvider } from "./webview/webviewProvider";
import { FlowDocCodeLensProvider } from "./codelens/flowDocCodeLensProvider";
import { FlowDocConfig, TopicGraph } from "./types";

let indexer: WorkspaceIndexer | undefined;
let webviewProvider: FlowDocWebviewProvider | undefined;
let currentConfig: FlowDocConfig | undefined;
let currentGraph: TopicGraph | undefined;

/**
 * Check if a directory is a git repository
 */
async function isGitRepository(workspaceRoot: string): Promise<boolean> {
  const gitPath = path.join(workspaceRoot, ".git");
  const gitUri = vscode.Uri.file(gitPath);

  try {
    const stat = await vscode.workspace.fs.stat(gitUri);
    return stat.type === vscode.FileType.Directory;
  } catch {
    return false;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Get workspace root
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("FlowDoc: No workspace folder open");
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Load config
  currentConfig = await loadConfig(workspaceRoot);

  // Initialize indexer (loads .gitignore patterns)
  indexer = new WorkspaceIndexer();
  await indexer.initialize();

  // Initialize webview provider with config for cross-repo navigation
  webviewProvider = new FlowDocWebviewProvider(context.extensionUri, workspaceRoot, currentConfig);

  // Set callback for Home button
  webviewProvider.setOnGoHomeCallback(() => {
    pickTopic();
  });

  // Register CodeLens provider
  const codeLensProvider = new FlowDocCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider([{ language: "php" }, { language: "typescript" }, { language: "javascript" }], codeLensProvider);

  // Auto-index if this is a git repository
  const isGitRepo = await isGitRepository(workspaceRoot);
  if (isGitRepo) {
    await indexer.fullScan();
    const nodeCount = indexer.getAllNodes().length;
    const topicCount = indexer.getTopics().length;
    if (nodeCount > 0) {
      vscode.window.showInformationMessage(`FlowDoc: Ready! Found ${nodeCount} nodes across ${topicCount} topics.`);
    } else {
      vscode.window.showInformationMessage("FlowDoc: Ready! No @flowdoc-* tags found yet.");
    }
  }

  // Register commands
  const pickTopicCommand = vscode.commands.registerCommand("flowdoc.pickTopic", async () => {
    await pickTopic();
  });

  const openGraphCommand = vscode.commands.registerCommand("flowdoc.openGraph", async () => {
    await openGraph();
  });

  const reindexCommand = vscode.commands.registerCommand("flowdoc.reindex", async () => {
    await reindex();
  });

  const openAtNodeCommand = vscode.commands.registerCommand("flowdoc.openAtNode", async (topic: string, nodeId: string) => {
    await openAtNode(topic, nodeId);
  });

  context.subscriptions.push(pickTopicCommand, openGraphCommand, reindexCommand, openAtNodeCommand, codeLensDisposable, indexer, webviewProvider);
}

/**
 * Command: Pick Topic
 * Shows QuickPick with all available topics
 */
async function pickTopic(): Promise<void> {
  if (!indexer || !webviewProvider) {
    vscode.window.showErrorMessage("FlowDoc: Extension not properly initialized");
    return;
  }

  const topics = indexer.getTopics();

  if (topics.length === 0) {
    vscode.window.showWarningMessage("FlowDoc: No topics found. Add @flowdoc-* comments to your code.");
    return;
  }

  const selected = await vscode.window.showQuickPick(topics, {
    placeHolder: "Select a topic to explore",
    title: "FlowDoc Topics",
  });

  if (selected) {
    const nodes = indexer.getNodesByTopic(selected);
    currentGraph = buildGraph(nodes, selected, currentConfig);
    webviewProvider.showGraph(currentGraph);
  }
}

/**
 * Command: Open Graph
 * Opens webview with current or previously selected topic
 */
async function openGraph(): Promise<void> {
  if (!webviewProvider) {
    vscode.window.showErrorMessage("FlowDoc: Extension not properly initialized");
    return;
  }

  if (currentGraph) {
    webviewProvider.showGraph(currentGraph);
  } else {
    // No graph selected, delegate to pickTopic
    await pickTopic();
  }
}

/**
 * Command: Reindex Workspace
 * Forces a full re-scan of all files
 */
async function reindex(): Promise<void> {
  if (!indexer) {
    vscode.window.showErrorMessage("FlowDoc: Extension not properly initialized");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "FlowDoc: Reindexing workspace...",
      cancellable: false,
    },
    async () => {
      await indexer!.fullScan();
    },
  );

  vscode.window.showInformationMessage(`FlowDoc: Indexed ${indexer.getAllNodes().length} nodes across ${indexer.getTopics().length} topics`);
}

/**
 * Command: Open at specific node (from CodeLens)
 * Opens webview at a specific node within a topic
 */
async function openAtNode(topic: string, nodeId: string): Promise<void> {
  if (!indexer || !webviewProvider) {
    vscode.window.showErrorMessage("FlowDoc: Extension not properly initialized");
    return;
  }

  const nodes = indexer.getNodesByTopic(topic);
  if (nodes.length === 0) {
    vscode.window.showWarningMessage(`FlowDoc: Topic "${topic}" not found.`);
    return;
  }

  currentGraph = buildGraph(nodes, topic, currentConfig);
  webviewProvider.showGraph(currentGraph, nodeId);
}

export function deactivate(): void {
  vscode.window.showInformationMessage("FlowDoc extension deactivated");
}
