/**
 * PlaintextAI SDK
 * 
 * Use the workflow components in your own React app.
 * 
 * @example
 * ```tsx
 * import { WorkflowBuilder, ToolNode, createApiClient } from 'plaintextai/sdk';
 * ```
 */

// Components
export { default as WorkflowBuilder } from '../client/src/components/workflow/WorkflowBuilder';
export { default as ToolNode, ToolNodeWrapper } from '../client/src/components/workflow/ToolNode';
export { default as WorkflowChatPanel } from '../client/src/components/workflow/WorkflowChatPanel';

// Types
export type { ToolType, ToolConfig, ToolNodeData } from '../client/src/components/workflow/ToolNode';

// Presets
export * from '../client/src/components/workflow/presets';

// API Client
export { createApiClient } from './api-client';

