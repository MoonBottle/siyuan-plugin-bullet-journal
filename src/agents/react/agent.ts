/**
 * ReAct Agent 核心实现
 * 遵循 Thought -> Action -> Observation -> Answer 循环
 */
import type {
  ReActState,
  ReActContext,
  ReActStep,
  AIResponse,
  ToolResult,
  ReActAgentOptions,
  StreamUpdateCallback
} from './types';
import type { ChatMessage, ToolCall } from '@/types/ai';
import { callAIWithToolsStream } from '@/services/aiService';
import { executeToolCalls, type ToolExecutionContext } from '@/services/aiToolsExecutor';
import type { ConversationData } from '@/services/conversationStorageService';

/**
 * 简单的事件发射器实现
 */
class EventEmitter<T extends Record<string, unknown>> {
  private listeners: { [K in keyof T]?: Array<(data: T[K]) => void> } = {};

  on<K extends keyof T>(event: K, callback: (data: T[K]) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);
    return () => {
      this.listeners[event] = this.listeners[event]?.filter(cb => cb !== callback);
    };
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners[event]?.forEach(callback => callback(data));
  }
}

/**
 * ReAct Agent 事件
 */
interface AgentEvents {
  streamUpdate: {
    content: string;
    reasoning?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
  stepComplete: { step: ReActStep };
  toolExecute: { tool: string; args: Record<string, unknown> };
  toolResult: { result: ToolResult };
  error: { error: Error };
  complete: { answer: string; steps: ReActStep[] };
}

/**
 * ReAct Agent 类
 * 实现 Reasoning + Acting 循环
 */
export class ReActAgent extends EventEmitter<AgentEvents> {
  private state: ReActState;
  private context: ReActContext;
  private toolContext: ToolExecutionContext;
  private onStreamUpdate?: StreamUpdateCallback;

  constructor(options: ReActAgentOptions) {
    super();
    this.context = options.context;
    this.onStreamUpdate = options.onStreamUpdate;
    
    // 初始化状态
    this.state = {
      conversation: null,
      steps: [],
      isLoading: false,
      error: null,
      currentIteration: 0
    };

    // 初始化工具上下文（空数据，后续填充）
    this.toolContext = {
      groups: [],
      projects: [],
      allItems: []
    };
  }

  /**
   * 设置工具执行上下文
   */
  setToolContext(context: ToolExecutionContext): void {
    this.toolContext = context;
  }

  /**
   * 获取当前状态
   */
  getState(): Readonly<ReActState> {
    return this.state;
  }

  /**
   * 运行 Agent 循环
   * @param userInput 用户输入
   * @param conversation 当前会话
   */
  async run(userInput: string, conversation: ConversationData): Promise<void> {
    try {
      this.state.conversation = conversation;
      this.state.isLoading = true;
      this.state.error = null;
      this.state.currentIteration = 0;

      // Step 0: 添加用户消息
      this.addUserMessage(userInput);

      // ReAct 循环
      while (this.state.currentIteration < this.context.maxIterations) {
        // Step 1: Thought - 思考
        const thought = await this.think();
        
        // Step 2: 检查是否需要工具调用
        if (!thought.toolCalls || thought.toolCalls.length === 0) {
          // 直接回答，结束循环
          this.finalize(thought.content, thought.messageId);
          return;
        }

        // Step 3: Action - 执行工具
        for (const toolCall of thought.toolCalls) {
          await this.executeAction(toolCall, thought.messageId);
        }

        this.state.currentIteration++;
      }

      // 达到最大迭代次数
      throw new Error('达到最大迭代次数，请简化您的问题');

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.error = err.message;
      this.emit('error', { error: err });
      throw err;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Thought 步骤：调用 AI 进行思考
   * @returns AI 响应和消息 ID
   */
  private async think(): Promise<AIResponse & { messageId: string }> {
    const messages = this.buildMessages();

    // 记录思考开始
    const thoughtStep: ReActStep = {
      type: 'thought',
      content: '正在思考...',
      timestamp: Date.now()
    };
    this.addStep(thoughtStep);

    // 添加 AI 消息占位（在流式开始前）
    const aiMessage = this.addAssistantMessage('', undefined, true);
    const aiMessageId = aiMessage.id;

    return new Promise((resolve, reject) => {
      let fullContent = '';
      let fullReasoning = '';
      let toolCalls: ToolCall[] | undefined;
      let lastUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
      let detectedToolCalls = false;

      callAIWithToolsStream(
        this.context.provider,
        messages,
        this.context.tools,
        (chunk, reasoning, usage, receivedToolCalls) => {
          fullContent = chunk;
          if (reasoning) fullReasoning = reasoning;
          if (usage) lastUsage = usage;
          if (receivedToolCalls) toolCalls = receivedToolCalls;

          // 检查是否有工具调用
          if (!detectedToolCalls) {
            // 流式过程中检查是否包含工具调用
            if (receivedToolCalls && receivedToolCalls.length > 0) {
              detectedToolCalls = true;
              // 有工具调用，更新为静态提示
              this.updateAssistantMessage(aiMessageId, '思考中...', reasoning);
              // 同时更新消息的 toolCalls，以便工具结果能正确关联
              this.updateAssistantToolCalls(aiMessageId, receivedToolCalls);
            } else if (chunk.includes('<tool_call>') || chunk.includes('function')) {
              detectedToolCalls = true;
              // 有工具调用（XML格式），更新为静态提示
              this.updateAssistantMessage(aiMessageId, '思考中...', reasoning);
            } else {
              // 无工具调用，流式显示内容
              this.updateAssistantMessage(aiMessageId, chunk, reasoning);
            }
          }

          // 触发流式更新
          this.emit('streamUpdate', {
            content: chunk,
            reasoning,
            usage
          });
          this.onStreamUpdate?.(chunk, reasoning, usage);
        }
      )
        .then(response => {
          // 更新思考步骤
          const stepIndex = this.state.steps.findIndex(
            s => s.type === 'thought' && s.timestamp === thoughtStep.timestamp
          );
          if (stepIndex !== -1) {
            this.state.steps[stepIndex] = {
              type: 'thought',
              content: fullReasoning || fullContent,
              timestamp: thoughtStep.timestamp
            };
          }

          // 如果有工具调用，更新消息的 toolCalls 并清除 content（工具调用不需要显示内容）
          if (response.toolCalls && response.toolCalls.length > 0) {
            this.updateAssistantToolCalls(aiMessageId, response.toolCalls);
            // 清除"思考中..."占位，只保留 toolCalls
            this.clearAssistantMessageContent(aiMessageId);
          } else if (!fullContent.includes('<tool_call>')) {
            // 没有工具调用，更新为最终内容
            this.updateAssistantMessage(aiMessageId, response.content || fullContent, fullReasoning);
          } else {
            // XML 格式的工具调用，也需要清除 content
            this.clearAssistantMessageContent(aiMessageId);
          }

          resolve({
            content: response.content || fullContent,
            toolCalls: response.toolCalls,
            reasoning: fullReasoning || undefined,
            usage: lastUsage,
            messageId: aiMessageId
          });
        })
        .catch(reject);
    });
  }

  /**
   * 更新 AI 消息的 toolCalls
   */
  private updateAssistantToolCalls(id: string, toolCalls: ToolCall[]): void {
    const messages = this.state.conversation?.messages;
    if (!messages) return;

    const message = messages.find(m => m.id === id);
    if (message && message.role === 'assistant') {
      message.toolCalls = toolCalls;
      this.emit('messageUpdate', { id, content: message.content, reasoning: message.reasoning });
    }
  }

  /**
   * Action 步骤：执行工具
   */
  private async executeAction(toolCall: ToolCall, parentMessageId?: string): Promise<void> {
    const args = JSON.parse(toolCall.function.arguments || '{}');

    // 记录 Action 步骤
    const actionStep: ReActStep = {
      type: 'action',
      tool: toolCall.function.name,
      args,
      timestamp: Date.now()
    };
    this.addStep(actionStep);

    // 触发工具执行事件
    this.emit('toolExecute', {
      tool: toolCall.function.name,
      args
    });

    // 如果有父消息ID，更新父消息的 toolCalls
    if (parentMessageId) {
      this.updateAssistantToolCalls(parentMessageId, [toolCall]);
    } else {
      // 否则添加新的 AI 消息（包含工具调用）
      this.addAssistantMessage('', [toolCall]);
    }

    try {
      // 执行工具调用
      const results = await executeToolCalls([toolCall], this.toolContext);
      const result = results[0];

      // 记录 Observation 步骤
      const observationStep: ReActStep = {
        type: 'observation',
        result: result.result,
        timestamp: Date.now()
      };
      this.addStep(observationStep);

      // 添加工具结果消息
      this.addToolMessage(result.result, toolCall.id);

      // 触发工具结果事件
      this.emit('toolResult', { result });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 记录失败的 Observation
      const observationStep: ReActStep = {
        type: 'observation',
        result: `错误: ${errorMessage}`,
        timestamp: Date.now()
      };
      this.addStep(observationStep);

      // 添加错误结果消息
      this.addToolMessage(`错误: ${errorMessage}`, toolCall.id);

      // 触发工具结果事件
      this.emit('toolResult', {
        result: {
          toolCallId: toolCall.id,
          result: errorMessage,
          error: errorMessage
        }
      });
    }
  }

  /**
   * 完成对话
   */
  private finalize(answer: string, messageId?: string): void {
    // 记录 Answer 步骤
    const answerStep: ReActStep = {
      type: 'answer',
      content: answer,
      timestamp: Date.now()
    };
    this.addStep(answerStep);

    // 更新指定的 AI 消息或最后一条 AI 消息
    if (messageId) {
      this.updateAssistantMessage(messageId, answer);
    } else {
      const lastMessage = this.state.conversation?.messages[this.state.conversation.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = answer;
        lastMessage.loading = false;
      }
    }

    // 触发完成事件
    this.emit('complete', {
      answer,
      steps: [...this.state.steps]
    });
  }

  /**
   * 添加步骤记录
   */
  private addStep(step: ReActStep): void {
    this.state.steps.push(step);
    this.emit('stepComplete', { step });
  }

  /**
   * 添加用户消息
   */
  private addUserMessage(content: string): void {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    this.state.conversation?.messages.push(message);
    if (this.state.conversation) {
      this.state.conversation.updatedAt = Date.now();
    }
  }

  /**
   * 更新 AI 消息内容
   */
  private updateAssistantMessage(id: string, content: string, reasoning?: string): void {
    const messages = this.state.conversation?.messages;
    if (!messages) return;

    const message = messages.find(m => m.id === id);
    if (message && message.role === 'assistant') {
      message.content = content;
      message.reasoning = reasoning;
      message.loading = false;
      // 触发消息更新事件，通知外部刷新
      this.emit('messageUpdate', { id, content, reasoning });
    }
  }

  /**
   * 清除 AI 消息内容（用于工具调用后清除"思考中..."占位）
   */
  private clearAssistantMessageContent(id: string): void {
    const messages = this.state.conversation?.messages;
    if (!messages) return;

    const message = messages.find(m => m.id === id);
    if (message && message.role === 'assistant') {
      message.content = '';
      message.loading = false;
      // 触发消息更新事件，通知外部刷新
      this.emit('messageUpdate', { id, content: '', reasoning: message.reasoning });
    }
  }

  /**
   * 添加 AI 消息
   */
  private addAssistantMessage(content: string, toolCalls?: ToolCall[], loading = false): ChatMessage {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-ai-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      toolCalls,
      loading
    };
    this.state.conversation?.messages.push(message);
    if (this.state.conversation) {
      this.state.conversation.updatedAt = Date.now();
    }
    // 触发消息添加事件
    this.emit('messageAdd', { message });
    return message;
  }

  /**
   * 添加工具消息
   */
  private addToolMessage(content: string, toolCallId: string): void {
    const message: ChatMessage = {
      id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'tool',
      content,
      timestamp: Date.now(),
      toolCallId
    };
    this.state.conversation?.messages.push(message);
    if (this.state.conversation) {
      this.state.conversation.updatedAt = Date.now();
    }
  }

  /**
   * 构建发送给 AI 的消息列表
   */
  private buildMessages(): ChatMessage[] {
    const systemMessage: ChatMessage = {
      id: 'system',
      role: 'system',
      content: this.context.systemPrompt,
      timestamp: Date.now()
    };

    return [systemMessage, ...(this.state.conversation?.messages || [])];
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state.steps = [];
    this.state.isLoading = false;
    this.state.error = null;
    this.state.currentIteration = 0;
  }
}
