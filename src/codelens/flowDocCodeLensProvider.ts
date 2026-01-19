/**
 * FlowDoc CodeLens Provider
 * Shows clickable icons next to @flowdoc-id tags in the editor
 */

import * as vscode from "vscode";

const FLOWDOC_ID_PATTERN = /@flowdoc-id:\s*(\S+)/g;
const FLOWDOC_TOPIC_PATTERN = /@flowdoc-topic:\s*(.+)/;

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

      // Track current topic
      const topicMatch = line.match(FLOWDOC_TOPIC_PATTERN);
      if (topicMatch) {
        currentTopic = topicMatch[1].trim();
      }

      // Find @flowdoc-id
      const idMatch = line.match(/@flowdoc-id:\s*(\S+)/);
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
