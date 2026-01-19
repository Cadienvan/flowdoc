/**
 * FlowDoc Graph Builder
 * Builds navigable graph structures from FlowNodes for a specific topic
 */

import { FlowNode, TopicGraph, GraphWarning, FlowDocConfig } from "../types";

/**
 * Check if a dependency is a cross-repo reference (format: repo-name@node-id)
 * @param dependency - The dependency string to check
 * @returns Object with isExternal flag and parsed repo/nodeId if external
 */
function parseCrossRepoDependency(dependency: string): { isExternal: boolean; repoName?: string; nodeId?: string } {
  const atIndex = dependency.indexOf("@");
  if (atIndex > 0 && atIndex < dependency.length - 1) {
    return {
      isExternal: true,
      repoName: dependency.slice(0, atIndex),
      nodeId: dependency.slice(atIndex + 1),
    };
  }
  return { isExternal: false };
}

/**
 * Build a navigable graph for a specific topic
 * - Detects duplicate IDs (first-wins)
 * - Detects missing dependencies (treated as dangling roots)
 * - Allows cross-repo dependencies if repo is configured
 * - Detects cycles via DFS
 * - Sorts roots and children alphabetically by ID
 * @param nodes - Array of FlowNodes to build graph from
 * @param topic - Topic name to filter nodes
 * @param config - Optional FlowDocConfig for cross-repo validation
 */
export function buildGraph(nodes: FlowNode[], topic: string, config?: FlowDocConfig): TopicGraph {
  const filtered = nodes.filter(n => n.topic === topic);
  const nodesById = new Map<string, FlowNode>();
  const childrenByDependencyId = new Map<string, string[]>();
  const roots: string[] = [];
  const warnings: GraphWarning[] = [];

  // 1. Populate nodesById (first-wins on duplicates)
  for (const node of filtered) {
    if (nodesById.has(node.id)) {
      warnings.push({
        type: "duplicate-id",
        nodeId: node.id,
        message: `Duplicate ID "${node.id}" found. Keeping first occurrence.`,
        sourceFile: node.sourceFile,
        sourceLine: node.sourceLine,
      });
      continue;
    }
    nodesById.set(node.id, node);
  }

  // 2. Build childrenByDependencyId and find roots
  for (const [id, node] of nodesById) {
    if (!node.dependency) {
      roots.push(id);
    } else {
      if (!nodesById.has(node.dependency)) {
        // Check if this is a valid cross-repo dependency
        const crossRepo = parseCrossRepoDependency(node.dependency);
        const isValidCrossRepo = crossRepo.isExternal && config?.repos && crossRepo.repoName && crossRepo.repoName in config.repos;

        if (!isValidCrossRepo) {
          warnings.push({
            type: "missing-dependency",
            nodeId: id,
            message: `Dependency "${node.dependency}" not found. Node treated as root.`,
            sourceFile: node.sourceFile,
            sourceLine: node.sourceLine,
          });
        }
        roots.push(id); // Cross-repo deps and missing deps are both treated as roots
      } else {
        const children = childrenByDependencyId.get(node.dependency) || [];
        children.push(id);
        childrenByDependencyId.set(node.dependency, children);
      }
    }

    // 2b. Handle explicit children declarations (including cross-repo)
    if (node.children && node.children.length > 0) {
      const existingChildren = childrenByDependencyId.get(id) || [];
      const existingChildrenSet = new Set(existingChildren);

      for (const childRef of node.children) {
        // Avoid duplicates (child already declared via dependency)
        if (existingChildrenSet.has(childRef)) {
          continue;
        }

        const crossRepo = parseCrossRepoDependency(childRef);
        if (crossRepo.isExternal) {
          // Cross-repo child reference
          const isValidCrossRepo = config?.repos && crossRepo.repoName && crossRepo.repoName in config.repos;
          if (!isValidCrossRepo) {
            warnings.push({
              type: "missing-dependency",
              nodeId: id,
              message: `Child reference "${childRef}" points to unknown repository "${crossRepo.repoName}". Add it to flowdoc.config.yaml under "repos".`,
              sourceFile: node.sourceFile,
              sourceLine: node.sourceLine,
            });
          }
          // Add cross-repo child regardless (will be handled by webview)
          existingChildren.push(childRef);
          existingChildrenSet.add(childRef);
        } else {
          // Local child reference - validate it exists
          if (!nodesById.has(childRef)) {
            warnings.push({
              type: "missing-dependency",
              nodeId: id,
              message: `Child reference "${childRef}" not found in topic.`,
              sourceFile: node.sourceFile,
              sourceLine: node.sourceLine,
            });
          } else {
            existingChildren.push(childRef);
            existingChildrenSet.add(childRef);
          }
        }
      }

      if (existingChildren.length > 0) {
        childrenByDependencyId.set(id, existingChildren);
      }
    }
  }

  // 3. Sort roots alphabetically
  roots.sort((a, b) => a.localeCompare(b));

  // 4. Sort children alphabetically for each parent
  for (const [parentId, children] of childrenByDependencyId) {
    children.sort((a, b) => a.localeCompare(b));
    childrenByDependencyId.set(parentId, children);
  }

  // 5. Detect cycles via DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleNodes = new Set<string>();

  function detectCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const children = childrenByDependencyId.get(nodeId) || [];
    for (const childId of children) {
      if (detectCycle(childId)) {
        if (!cycleNodes.has(childId)) {
          cycleNodes.add(childId);
          const childNode = nodesById.get(childId);
          warnings.push({
            type: "cycle-detected",
            nodeId: childId,
            message: `Cycle detected involving node "${childId}"`,
            sourceFile: childNode?.sourceFile,
            sourceLine: childNode?.sourceLine,
          });
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const rootId of roots) {
    detectCycle(rootId);
  }

  return {
    topic,
    nodesById,
    childrenByDependencyId,
    roots,
    warnings,
  };
}

/**
 * Get children IDs for a node
 */
export function getChildren(graph: TopicGraph, nodeId: string): string[] {
  return graph.childrenByDependencyId.get(nodeId) || [];
}

/**
 * Check if a node has children
 */
export function hasChildren(graph: TopicGraph, nodeId: string): boolean {
  return getChildren(graph, nodeId).length > 0;
}
