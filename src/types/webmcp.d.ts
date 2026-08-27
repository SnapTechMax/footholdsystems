/**
 * WebMCP — the W3C draft that lets a page hand an in-browser agent real tools
 * instead of making it guess at the DOM.
 *
 * Declared here rather than pulled from a package because there isn't a stable
 * one to pull: the API is a draft, Chrome shipped it in 157 after the 149–156
 * origin trial, and `navigator.modelContext` is the deprecated pre-150 spelling
 * of `document.modelContext`. Both are optional on purpose — every browser that
 * has neither is the common case, and the call site has to branch anyway.
 *
 * The shapes below cover what src/components/ScanForm.tsx actually calls. This
 * is not an attempt at the full draft; when the API settles, delete this file
 * and take the real types.
 */

/** JSON Schema for a tool's arguments, as the draft specifies. */
interface ModelContextToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

/** What a tool hands back. One text block is enough for everything here. */
interface ModelContextToolResult {
  content: Array<{ type: "text"; text: string }>;
  /** Set when the call failed, so the agent can tell "no" from "broken". */
  isError?: boolean;
}

interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: ModelContextToolSchema;
  execute: (args: Record<string, unknown>) => Promise<ModelContextToolResult>;
}

interface ModelContext {
  /**
   * Returns an unregister function in the current draft, but did not always,
   * so callers have to check before calling it.
   */
  registerTool?: (tool: ModelContextTool) => (() => void) | void;
}

/**
 * The two markup attributes, taught to JSX.
 *
 * React passes unknown lowercase attributes straight through to the DOM at
 * runtime, so this changes nothing about what renders — it stops the type
 * checker rejecting a form annotation that the spec requires be spelled exactly
 * this way, with no data- prefix to hide behind.
 */
declare module "react" {
  interface FormHTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    /** Snake-free, lowercase: the WebMCP draft's own spelling. */
    toolname?: string;
    tooldescription?: string;
  }
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
  interface Navigator {
    /** Deprecated pre-Chrome-150 alias for `document.modelContext`. */
    modelContext?: ModelContext;
  }
}

export {};
