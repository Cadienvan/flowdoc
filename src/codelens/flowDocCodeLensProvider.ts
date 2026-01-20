/**
 * FlowDoc CodeLens Provider
 * Shows clickable icons next to @flowdoc-id and @flowdoc-line tags in the editor
 */

import * as vscode from "vscode";

const FLOWDOC_ID_PATTERN = /@flowdoc-id:\s*(\S+)/;
const FLOWDOC_TOPIC_PATTERN = /@flowdoc-topic:\s*(.+)/;
const FLOWDOC_LINE_PATTERN = /@flowdoc-line:\s*([^|]+)\s*\|\s*([^|]+)\s*\|/;

export class FlowDocCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    // Refresh codelenses when documents change
    vscode.workspace.onDidChangeTextDocument(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  /**
   * Provide CodeLenses for the document
   */
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    let currentTopic: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for one-liner format first (self-contained, higher priority)
      const oneLineMatch = line.match(FLOWDOC_LINE_PATTERN);
      if (oneLineMatch) {
        const topic = oneLineMatch[1].trim();
        const nodeId = oneLineMatch[2].trim();

        if (topic && nodeId) {
          const range = new vscode.Range(i, 0, i, line.length);

          const codeLens = new vscode.CodeLens(range, {
            title: "▶ FlowDoc",
            tooltip: `Open FlowDoc: ${topic} → ${nodeId}`,
            command: "flowdoc.openAtNode",
            arguments: [topic, nodeId],
          });

          codeLenses.push(codeLens);
        }
        // Don't update currentTopic from one-liners (self-contained)
        continue;
      }

      // Track current topic (for multi-line format)
      const topicMatch = line.match(FLOWDOC_TOPIC_PATTERN);
      if (topicMatch) {
        currentTopic = topicMatch[1].trim();
      }

      // Find @flowdoc-id (multi-line format)
      const idMatch = line.match(FLOWDOC_ID_PATTERN);
      if (idMatch && currentTopic) {
        const nodeId = idMatch[1];
        const range = new vscode.Range(i, 0, i, line.length);

        const codeLens = new vscode.CodeLens(range, {
          title: "▶ FlowDoc",
          tooltip: `Open FlowDoc: ${currentTopic} → ${nodeId}`,
          command: "flowdoc.openAtNode",
          arguments: [currentTopic, nodeId],
        });

        codeLenses.push(codeLens);
      }
    }

    return codeLenses;
  }
}
