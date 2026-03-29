/**
 * ReAct Agent 类型定义
 * Reasoning + Acting 架构的核心类型
 */
import type { ChatMessage, ToolCall, ToolDefinition, UsageInfo } from '@/types/ai';
import type { AIProviderConfig } from '@/types/ai';
import type { ConversationData } from '@/services/conversationStorageService';

/**
 * ReAct 步骤类型
 * Thought -> Action -> Observation -> Answer
 */
export type ReActStep =
  | { type: 'thought'; content: string; timestamp: number }
  | { type: 'action'; tool: string; args: Record<string, unknown>; timestamp: number }
  | { type: 'observation'; result: string; timestamp: number }
  | { type: 'answer'; content: string; timestamp: number };

/**
 * ReAct 状态
 */
export interface ReActState {
  conversation: ConversationData | null;
  steps: ReActStep[];
  isLoading: boolean;
  error: string | null;
  currentIteration: number;
}

/**
 * ReAct 上下文配置
 */
export interface ReActContext {
  conversationId: string;
  provider: AIProviderConfig;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxIterations: number;
}

/**
 * AI 响应结果
 */
export interface AIResponse {
  content: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  usage?: UsageInfo;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  toolCallId: string;
  result: string;
  error?: string;
}

/**
 * Agent 事件类型
 */
export interface ReActAgentEvents {
  'streamUpdate': {
    content: string;
    reasoning?: string;
    usage?: UsageInfo;
  };
  'stepComplete': {
    step: ReActStep;
  };
  'toolExecute': {
    tool: string;
    args: Record<string, unknown>;
  };
  'toolResult': {
    result: ToolResult;
  };
  'messageAdd': {
    message: ChatMessage;
  };
  'messageUpdate': {
    id: string;
    content: string;
    reasoning?: string;
  };
  'error': {
    error: Error;
  };
  'complete': {
    answer: string;
    steps: ReActStep[];
  };
}

/**
 * 流式更新回调
 */
export type StreamUpdateCallback = (
  content: string,
  reasoning?: string,
  usage?: UsageInfo,
  toolCalls?: ToolCall[]
) => void;

/**
 * Agent 配置选项
 */
export interface ReActAgentOptions {
  context: ReActContext;
  onStreamUpdate?: StreamUpdateCallback;
  onStepComplete?: (step: ReActStep) => void;
  onError?: (error: Error) => void;
  onComplete?: (answer: string, steps: ReActStep[]) => void;
}
