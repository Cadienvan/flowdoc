/**
 * FlowDoc Types
 * Core type definitions for the FlowDoc extension
 */

/**
 * Represents a link embedded in a FlowDoc node
 */
export interface Link {
  label?: string;
  target: string;
  type: "symbol" | "file" | "url";
  parsed: {
    symbol?: string;
    filePath?: string;
    line?: number;
    url?: string;
  };
}

/**
 * Core entity: a documentation node extracted from @flowdoc-* comments
 */
export interface FlowNode {
  topic: string;
  id: string;
  step: string;
  dependency: string | null;
  dependencyNote: string | null;
  children: string[] | null;
  links: Link[];
  sourceFile: string;
  sourceLine: number;
}

/**
 * Graph structure for a specific topic
 */
export interface TopicGraph {
  topic: string;
  nodesById: Map<string, FlowNode>;
  childrenByDependencyId: Map<string, string[]>;
  roots: string[];
  warnings: GraphWarning[];
  errors: GraphError[];
}

/**
 * Warning generated during graph construction
 */
export interface GraphWarning {
  type: "duplicate-id" | "missing-dependency" | "cycle-detected";
  nodeId: string;
  message: string;
  sourceFile?: string;
  sourceLine?: number;
}

/**
 * Error generated during parsing for missing required fields
 */
export interface GraphError {
  type: "missing-topic" | "missing-id" | "missing-step";
  message: string;
  sourceFile: string;
  sourceLine: number;
  /** Partial data available for context */
  partialData?: {
    topic?: string;
    id?: string;
    step?: string;
  };
}

/**
 * Result from parsing a file, including nodes and validation errors
 */
export interface ParseResult {
  nodes: FlowNode[];
  errors: GraphError[];
}

/**
 * External repository reference configuration
 */
export interface ExternalRepoRef {
  /** Local filesystem path to the repository */
  path: string;
}

/**
 * Project configuration from flowdoc.config.yaml/json
 */
export interface FlowDocConfig {
  version: number;
  /** Map of repo names to their local paths for cross-repo navigation */
  repos?: Record<string, ExternalRepoRef>;
}

/**
 * In-memory index of all FlowDoc nodes in workspace
 */
export interface WorkspaceIndex {
  nodesByFile: Map<string, FlowNode[]>;
  lastUpdated: Date;
}

/**
 * Messages from Webview to Extension
 */
export type WebviewToExtensionMessage = { command: "navigate"; direction: "prev" | "next" } | { command: "selectBranch"; nodeId: string } | { command: "openLink"; link: Link } | { command: "goToSource" } | { command: "goHome" } | { command: "jumpToNode"; nodeId: string } | { command: "setFollowMe"; enabled: boolean };

/**
 * Breadcrumb node for displaying all steps
 */
export interface BreadcrumbNode {
  id: string;
  step: string;
  isCurrent: boolean;
}

/**
 * Messages from Extension to Webview
 */
export type ExtensionToWebviewMessage =
  | {
      command: "updateNode";
      node: SerializedFlowNode;
      prevId: string | null;
      nextOptions: NextOption[];
      breadcrumbs: BreadcrumbNode[];
    }
  | { command: "showWarnings"; warnings: GraphWarning[] }
  | { command: "setTopic"; topic: string };

/**
 * Serialized FlowNode for webview (no Map/Set)
 */
export interface SerializedFlowNode {
  topic: string;
  id: string;
  step: string;
  dependency: string | null;
  dependencyNote: string | null;
  children: string[] | null;
  links: Link[];
  sourceFile: string;
  sourceLine: number;
}

/**
 * Option for branch selection in navigation
 */
export interface NextOption {
  id: string;
  step: string;
  isExternal?: boolean;
}
