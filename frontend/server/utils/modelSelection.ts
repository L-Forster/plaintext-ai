/**
 * Model Selection Utility
 *
 * Centralized logic for automatic model selection based on task complexity.
 * - gpt-5.2 (alexandria): Complex reasoning, synthesis, analysis
 * - gpt-5-mini (nineveh): Lightweight tasks, formatting, simple extraction
 */

export type TaskType =
  | 'scholar-query'
  | 'contradiction-check'
  | 'literature-review'
  | 'data-analysis'
  | 'workflow-generation'
  | 'claim-extraction'
  | 'reference-formatting';

export type ModelAlias = 'nineveh' | 'alexandria';

export interface AIModel {
  id: ModelAlias;
  name: string;
  modelId: string;
  description: string;
}

/**
 * Available AI models with their OpenAI model IDs
 */
export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'nineveh',
    name: 'Nineveh',
    modelId: 'gpt-5-mini',
    description: 'Lightweight model optimized for fast processing and simple tasks.'
  },
  {
    id: 'alexandria',
    name: 'Alexandria',
    modelId: 'gpt-5.2',
    description: 'Advanced reasoning model for complex analysis and synthesis.'
  }
];

/**
 * Mapping from model alias to OpenAI model ID
 */
export const ALIAS_TO_OPENAI_MODEL: { [key in ModelAlias]: string } = {
  'nineveh': 'gpt-5-mini',
  'alexandria': 'gpt-5.2'
};

/**
 * Automatic model selection based on task type
 */
const TASK_TO_MODEL: { [key in TaskType]: ModelAlias } = {
  // Complex reasoning tasks -> gpt-5.2
  'scholar-query': 'alexandria',
  'contradiction-check': 'alexandria',
  'literature-review': 'alexandria',
  'data-analysis': 'alexandria',
  'workflow-generation': 'alexandria',

  // Simple/mechanical tasks -> gpt-5-mini
  'claim-extraction': 'nineveh',
  'reference-formatting': 'nineveh'
};

/**
 * Get the appropriate model for a given task type
 */
export function selectModelForTask(taskType: TaskType): ModelAlias {
  return TASK_TO_MODEL[taskType];
}

/**
 * Get the OpenAI model ID for a given alias
 */
export function getOpenAIModelId(alias: ModelAlias): string {
  return ALIAS_TO_OPENAI_MODEL[alias];
}

/**
 * Get the OpenAI model ID for a given task type
 */
export function getModelIdForTask(taskType: TaskType): string {
  const alias = selectModelForTask(taskType);
  return getOpenAIModelId(alias);
}

/**
 * Validate if a model alias is valid
 */
export function isValidModelAlias(alias: string): alias is ModelAlias {
  return alias === 'nineveh' || alias === 'alexandria';
}

/**
 * Get model information by alias
 */
export function getModelByAlias(alias: ModelAlias): AIModel | undefined {
  return AVAILABLE_MODELS.find(model => model.id === alias);
}
