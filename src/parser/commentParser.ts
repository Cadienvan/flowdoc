/**
 * FlowDoc Comment Parser
 * Line-based parser for extracting FlowNode from @flowdoc-* comment tags
 */

import { FlowNode, Link, GraphError, ParseResult } from "../types";

/**
 * Regex patterns for parsing
 */
const COMMENT_LINE_PATTERN = /^\s*(?:\/\/|#|\*|\/\*)\s*/;
const TAG_PATTERN = /@flowdoc-(topic|id|step|dependency|links|children):\s*(.+)/;
const LINE_TAG_PATTERN = /@flowdoc-line:\s*(.+)/;
const DEPENDENCY_WITH_NOTE_PATTERN = /^(\S+)\s*\[(.+)\]$/;
const LINK_SEPARATOR = /\s*;\s*/;
const CHILDREN_SEPARATOR = /\s*,\s*/;

/**
 * Temporary structure while accumulating a block
 */
interface PendingBlock {
  startLine: number;
  topic?: string;
  id?: string;
  step?: string;
  dependency?: string;
  dependencyNote?: string | null;
  linksRaw?: string;
  childrenRaw?: string;
}

/**
 * Parse a single link string into a Link object
 */
function parseLink(raw: string): Link {
  const trimmed = raw.trim();

  if (trimmed.startsWith("symbol:")) {
    const symbol = trimmed.slice(7);
    return {
      target: trimmed,
      type: "symbol",
      parsed: { symbol },
    };
  }

  if (trimmed.startsWith("file:")) {
    const rest = trimmed.slice(5);
    const colonIndex = rest.lastIndexOf(":");
    if (colonIndex > 0) {
      const filePath = rest.slice(0, colonIndex);
      const line = parseInt(rest.slice(colonIndex + 1), 10);
      return {
        target: trimmed,
        type: "file",
        parsed: { filePath, line: isNaN(line) ? undefined : line },
      };
    }
    return {
      target: trimmed,
      type: "file",
      parsed: { filePath: rest },
    };
  }

  if (trimmed.startsWith("url:")) {
    return {
      target: trimmed,
      type: "url",
      parsed: { url: trimmed.slice(4) },
    };
  }

  // Default: treat as URL
  return {
    target: `url:${trimmed}`,
    type: "url",
    parsed: { url: trimmed },
  };
}

/**
 * Parse multiple links from raw string
 */
function parseLinks(raw: string): Link[] {
  return raw.split(LINK_SEPARATOR).filter(Boolean).map(parseLink);
}

/**
 * Parse children string (comma-separated list of node IDs)
 * Supports cross-repo references in format: repo-name@node-id
 */
function parseChildren(raw: string): string[] {
  return raw
    .split(CHILDREN_SEPARATOR)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Parse dependency string, extracting optional note in brackets
 */
function parseDependency(raw: string): { id: string; note: string | null } {
  const match = raw.match(DEPENDENCY_WITH_NOTE_PATTERN);
  if (match) {
    return { id: match[1], note: match[2] };
  }
  return { id: raw.trim(), note: null };
}

/**
 * Convert a complete pending block to a FlowNode
 * Returns node if valid, or errors if missing required fields
 */
function finalizeBlock(block: PendingBlock, sourceFile: string): { node: FlowNode | null; errors: GraphError[] } {
  const errors: GraphError[] = [];
  const partialData = {
    topic: block.topic,
    id: block.id,
    step: block.step,
  };

  if (!block.topic) {
    errors.push({
      type: "missing-topic",
      message: `Missing @flowdoc-topic in block${block.id ? ` (id: ${block.id})` : ""}.`,
      sourceFile,
      sourceLine: block.startLine,
      partialData,
    });
  }

  if (!block.id) {
    errors.push({
      type: "missing-id",
      message: `Missing @flowdoc-id in block${block.topic ? ` (topic: ${block.topic})` : ""}.`,
      sourceFile,
      sourceLine: block.startLine,
      partialData,
    });
  }

  if (!block.step) {
    errors.push({
      type: "missing-step",
      message: `Missing @flowdoc-step in block${block.id ? ` (id: ${block.id})` : ""}.`,
      sourceFile,
      sourceLine: block.startLine,
      partialData,
    });
  }

  if (errors.length > 0) {
    return { node: null, errors };
  }

  return {
    node: {
      topic: block.topic!,
      id: block.id!,
      step: block.step!,
      dependency: block.dependency || null,
      dependencyNote: block.dependencyNote || null,
      children: block.childrenRaw ? parseChildren(block.childrenRaw) : null,
      links: block.linksRaw ? parseLinks(block.linksRaw) : [],
      sourceFile,
      sourceLine: block.startLine,
    },
    errors: [],
  };
}

/**
 * Check if a line is a comment line (for supported languages)
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/**
 * Extract flowdoc tag from a comment line
 * Returns null if line doesn't contain a flowdoc tag
 */
function extractTag(line: string): { tag: string; value: string } | null {
  const withoutComment = line.replace(COMMENT_LINE_PATTERN, "");
  const match = withoutComment.match(TAG_PATTERN);
  if (match) {
    return { tag: match[1], value: match[2].trim() };
  }
  return null;
}

/**
 * Parse a one-liner @flowdoc-line tag
 * Format: TOPIC | ID | STEP | links | dependency | children
 * Returns null if line doesn't contain a one-liner tag
 */
function parseOneLiner(line: string): PendingBlock | null {
  const withoutComment = line.replace(COMMENT_LINE_PATTERN, "");
  const match = withoutComment.match(LINE_TAG_PATTERN);
  if (!match) {
    return null;
  }

  const parts = match[1].split("|").map(p => p.trim());

  // Need at least topic, id, step (3 parts)
  if (parts.length < 3) {
    return null;
  }

  const [topic, id, step, linksRaw, dependencyRaw, childrenRaw] = parts;

  const block: PendingBlock = {
    startLine: 0, // Will be set by caller
    topic: topic || undefined,
    id: id || undefined,
    step: step || undefined,
  };

  // Parse optional fields if present and non-empty
  if (linksRaw) {
    block.linksRaw = linksRaw;
  }

  if (dependencyRaw) {
    const { id: depId, note } = parseDependency(dependencyRaw);
    block.dependency = depId;
    block.dependencyNote = note;
  }

  if (childrenRaw) {
    block.childrenRaw = childrenRaw;
  }

  return block;
}

/**
 * Main parser function: extracts all FlowNodes from file content
 * @param content - File content to parse
 * @param filePath - Absolute path to the file (for error reporting)
 * @returns ParseResult with nodes and validation errors
 */
export function parseFile(content: string, filePath: string): ParseResult {
  const lines = content.split("\n");
  const nodes: FlowNode[] = [];
  const errors: GraphError[] = [];
  let currentBlock: PendingBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1; // 1-based

    if (!isCommentLine(line)) {
      // Non-comment line: finalize current block if exists
      if (currentBlock) {
        const result = finalizeBlock(currentBlock, filePath);
        if (result.node) {
          nodes.push(result.node);
        }
        errors.push(...result.errors);
        currentBlock = null;
      }
      continue;
    }

    // Check for one-liner first (self-contained, higher priority)
    const oneLiner = parseOneLiner(line);
    if (oneLiner) {
      // Finalize any existing block first
      if (currentBlock) {
        const result = finalizeBlock(currentBlock, filePath);
        if (result.node) {
          nodes.push(result.node);
        }
        errors.push(...result.errors);
        currentBlock = null;
      }

      // Process the one-liner
      oneLiner.startLine = lineNumber;
      const result = finalizeBlock(oneLiner, filePath);
      if (result.node) {
        nodes.push(result.node);
      }
      errors.push(...result.errors);
      continue;
    }

    const tagResult = extractTag(line);

    if (!tagResult) {
      // Comment line but no flowdoc tag: finalize block
      if (currentBlock) {
        const result = finalizeBlock(currentBlock, filePath);
        if (result.node) {
          nodes.push(result.node);
        }
        errors.push(...result.errors);
        currentBlock = null;
      }
      continue;
    }

    // Found a flowdoc tag
    const { tag, value } = tagResult;

    // Start new block if needed
    if (!currentBlock) {
      currentBlock = { startLine: lineNumber };
    }

    switch (tag) {
      case "topic":
        currentBlock.topic = value;
        break;
      case "id":
        currentBlock.id = value;
        break;
      case "step":
        currentBlock.step = value;
        break;
      case "dependency": {
        const { id, note } = parseDependency(value);
        currentBlock.dependency = id;
        currentBlock.dependencyNote = note;
        break;
      }
      case "links":
        currentBlock.linksRaw = value;
        break;
      case "children":
        currentBlock.childrenRaw = value;
        break;
    }
  }

  // Finalize last block
  if (currentBlock) {
    const result = finalizeBlock(currentBlock, filePath);
    if (result.node) {
      nodes.push(result.node);
    }
    errors.push(...result.errors);
  }

  return { nodes, errors };
}
