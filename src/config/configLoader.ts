/**
 * FlowDoc Config Loader
 * Loads and parses flowdoc.config.yaml/json from workspace root
 */

import * as vscode from "vscode";
import * as path from "path";
import * as yaml from "yaml";
import { FlowDocConfig, ExternalRepoRef } from "../types";

const CONFIG_FILES = ["flowdoc.config.yaml", "flowdoc.config.yml", "flowdoc.config.json"];

const DEFAULT_CONFIG: FlowDocConfig = {
  version: 1,
};

/**
 * Load FlowDoc configuration from workspace root
 * Tries yaml/yml/json in order, returns default if none found
 */
export async function loadConfig(workspaceRoot: string): Promise<FlowDocConfig> {
  for (const filename of CONFIG_FILES) {
    const configPath = path.join(workspaceRoot, filename);
    const configUri = vscode.Uri.file(configPath);

    try {
      const fileContent = await vscode.workspace.fs.readFile(configUri);
      const content = Buffer.from(fileContent).toString("utf-8");

      if (filename.endsWith(".json")) {
        const parsed = JSON.parse(content);
        return validateConfig(parsed, workspaceRoot);
      } else {
        const parsed = yaml.parse(content);
        return validateConfig(parsed, workspaceRoot);
      }
    } catch {
      // File not found or parse error, try next
      continue;
    }
  }

  // No config found, return default
  return DEFAULT_CONFIG;
}

/**
 * Validate and normalize config object
 */
function validateConfig(raw: unknown, workspaceRoot: string): FlowDocConfig {
  if (!raw || typeof raw !== "object") {
    vscode.window.showWarningMessage("FlowDoc: Invalid config format, using defaults");
    return DEFAULT_CONFIG;
  }

  const obj = raw as Record<string, unknown>;

  return {
    version: typeof obj.version === "number" ? obj.version : 1,
    repos: validateRepos(obj.repos, workspaceRoot),
  };
}

/**
 * Validate repos structure and resolve relative paths
 */
function validateRepos(raw: unknown, workspaceRoot: string): Record<string, ExternalRepoRef> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const result: Record<string, ExternalRepoRef> = {};
  const obj = raw as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && "path" in value && typeof (value as Record<string, unknown>).path === "string") {
      let repoPath = (value as Record<string, unknown>).path as string;

      // Resolve relative paths against workspace root
      if (!path.isAbsolute(repoPath)) {
        repoPath = path.resolve(workspaceRoot, repoPath);
      }

      result[key] = { path: repoPath };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
