/**
 * FlowDoc Cross-Repo Index
 * Manages shared index files in globalStorageUri for cross-window navigation
 */

import * as vscode from "vscode";
import { FlowNode } from "../types";

/**
 * Node location info stored in the cross-repo index
 */
export interface CrossRepoNodeLocation {
  sourceFile: string;
  sourceLine: number;
}

/**
 * Index structure for a single topic: nodeId -> location
 */
export type TopicIndex = Record<string, CrossRepoNodeLocation>;

/**
 * Full repo index structure: topic -> nodeId -> location
 */
export type RepoIndex = Record<string, TopicIndex>;

/**
 * Encode a repo path for use as a filename
 * Uses encodeURIComponent and replaces % with _ for filesystem safety
 * @param repoPath - Absolute path to the repository
 * @returns Encoded string safe for filenames
 */
function encodeRepoPath(repoPath: string): string {
  return encodeURIComponent(repoPath).replace(/%/g, "_");
}

/**
 * Get the index file URI for a repository
 * @param globalStorageUri - Extension's global storage directory
 * @param repoPath - Absolute path to the repository
 * @returns URI to the index file
 */
function getIndexUri(globalStorageUri: vscode.Uri, repoPath: string): vscode.Uri {
  const encodedPath = encodeRepoPath(repoPath);
  return vscode.Uri.joinPath(globalStorageUri, `index-${encodedPath}.json`);
}

/**
 * Build a RepoIndex from FlowNodes
 * @param nodes - All FlowNodes from the workspace
 * @returns Index mapping topic -> nodeId -> location
 */
export function buildRepoIndex(nodes: FlowNode[]): RepoIndex {
  const index: RepoIndex = {};

  for (const node of nodes) {
    if (!index[node.topic]) {
      index[node.topic] = {};
    }

    index[node.topic][node.id] = {
      sourceFile: node.sourceFile,
      sourceLine: node.sourceLine,
    };
  }

  return index;
}

/**
 * Write repo index to global storage
 * Creates the global storage directory if it doesn't exist
 * @param globalStorageUri - Extension's global storage directory
 * @param repoPath - Absolute path to the repository being indexed
 * @param nodes - All FlowNodes from the workspace
 */
export async function writeRepoIndex(globalStorageUri: vscode.Uri, repoPath: string, nodes: FlowNode[]): Promise<void> {
  try {
    // Ensure global storage directory exists
    try {
      await vscode.workspace.fs.createDirectory(globalStorageUri);
    } catch {
      // Directory may already exist, ignore error
    }

    const index = buildRepoIndex(nodes);
    const indexUri = getIndexUri(globalStorageUri, repoPath);
    const content = Buffer.from(JSON.stringify(index, null, 2), "utf8");

    await vscode.workspace.fs.writeFile(indexUri, content);
  } catch (error) {
    // Log but don't fail - cross-repo navigation is optional
    console.error(`FlowDoc: Failed to write cross-repo index: ${error}`);
  }
}

/**
 * Read repo index from global storage
 * @param globalStorageUri - Extension's global storage directory
 * @param repoPath - Absolute path to the target repository
 * @returns RepoIndex or null if not found
 */
export async function readRepoIndex(globalStorageUri: vscode.Uri, repoPath: string): Promise<RepoIndex | null> {
  try {
    const indexUri = getIndexUri(globalStorageUri, repoPath);
    const content = await vscode.workspace.fs.readFile(indexUri);
    const json = Buffer.from(content).toString("utf8");
    return JSON.parse(json) as RepoIndex;
  } catch {
    // Index doesn't exist or is unreadable
    return null;
  }
}

/**
 * Get node location from a cross-repo index
 * @param globalStorageUri - Extension's global storage directory
 * @param repoPath - Absolute path to the target repository
 * @param topic - Topic name
 * @param nodeId - Node ID to find
 * @returns Node location or null if not found
 */
export async function getCrossRepoNodeLocation(globalStorageUri: vscode.Uri, repoPath: string, topic: string, nodeId: string): Promise<CrossRepoNodeLocation | null> {
  const index = await readRepoIndex(globalStorageUri, repoPath);

  if (!index) {
    return null;
  }

  const topicIndex = index[topic];
  if (!topicIndex) {
    return null;
  }

  return topicIndex[nodeId] || null;
}

/**
 * Delete repo index from global storage (for cleanup)
 * @param globalStorageUri - Extension's global storage directory
 * @param repoPath - Absolute path to the repository
 */
export async function deleteRepoIndex(globalStorageUri: vscode.Uri, repoPath: string): Promise<void> {
  try {
    const indexUri = getIndexUri(globalStorageUri, repoPath);
    await vscode.workspace.fs.delete(indexUri);
  } catch {
    // Index doesn't exist, ignore
  }
}
