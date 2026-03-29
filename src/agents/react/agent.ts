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
import type { ChatMessage, ToolCall, UsageInfo } from '@/types/ai';
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
  private agentId: string;
  private runId: number = 0;

  constructor(options: ReActAgentOptions) {
    super();
    this.context = options.context;
    this.onStreamUpdate = options.onStreamUpdate;
    this.agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
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
    
    console.log(`[ReActAgent:${this.agentId}] 创建实例`);
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
    this.runId++;
    const currentRun = this.runId;
    const logPrefix = `[ReActAgent:${this.agentId}:run${currentRun}]`;
    
    console.log(`${logPrefix} =======================================`);
    console.log(`${logPrefix} RUN START`, {
      userInput: userInput.substring(0, 50),
      conversationId: conversation?.id,
      initialMessageCount: conversation?.messages?.length || 0,
      maxIterations: this.context.maxIterations
    });
    console.log(`${logPrefix} 初始消息:`, JSON.stringify(conversation?.messages?.map((m, i) => ({
      index: i,
      role: m.role,
      contentLength: m.content?.length || 0,
      hasToolCalls: !!m.toolCalls?.length,
      toolCallId: m.toolCallId,
      id: m.id?.substring(0, 20)
    })) || []));
    
    try {
      this.state.conversation = conversation;
      this.state.isLoading = true;
      this.state.error = null;
      this.state.currentIteration = 0;

      // Step 0: 添加用户消息
      this.addUserMessage(userInput);

      // ReAct 循环
      while (this.state.currentIteration < this.context.maxIterations) {
        console.log(`${logPrefix} --- 迭代 ${this.state.currentIteration + 1} ---`);
        
        // Step 1: Thought - 思考
        console.log(`${logPrefix} 调用 think(), 消息数:`, this.state.conversation?.messages?.length);
        const thought = await this.think();
        console.log(`${logPrefix} think() 返回:`, {
          hasToolCalls: !!thought.toolCalls?.length,
          toolCallsCount: thought.toolCalls?.length || 0,
          contentLength: thought.content?.length || 0,
          messageId: thought.messageId?.substring(0, 20)
        });
        
        // Step 2: 检查是否需要工具调用
        if (!thought.toolCalls || thought.toolCalls.length === 0) {
          // 直接回答，结束循环
          console.log(`${logPrefix} 无工具调用，直接回答`);
          this.finalize(thought.content, thought.messageId, thought.usage);
          console.log(`${logPrefix} RUN END (直接回答)`);
          return;
        }

        // Step 3: Action - 执行工具
        console.log(`${logPrefix} 执行 ${thought.toolCalls.length} 个工具调用:`, 
          thought.toolCalls.map(tc => ({ id: tc.id, name: tc.function.name })));
        
        // 先保存完整的 toolCalls 到消息，避免循环执行时被覆盖
        if (thought.messageId && thought.toolCalls) {
          this.updateAssistantToolCalls(thought.messageId, thought.toolCalls);
        }
        for (const toolCall of thought.toolCalls) {
          console.log(`${logPrefix} 执行工具:`, { toolCallId: toolCall.id, name: toolCall.function.name });
          await this.executeAction(toolCall, thought.messageId);
          console.log(`${logPrefix} 工具执行完成:`, { toolCallId: toolCall.id });
        }
        
        console.log(`${logPrefix} 迭代完成后消息数:`, this.state.conversation?.messages?.length);
        // 打印当前消息历史状态
        this.debugPrintMessages(`${logPrefix} 迭代后消息状态`);

        this.state.currentIteration++;
      }

      // 达到最大迭代次数
      throw new Error('达到最大迭代次数，请简化您的问题');

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.error = err.message;
      console.error(`${logPrefix} RUN ERROR:`, err.message);
      console.error(`${logPrefix} 错误时会话消息数:`, this.state.conversation?.messages?.length);
      this.debugPrintMessages(`${logPrefix} 错误时消息状态`);
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
    const logPrefix = `[ReActAgent:${this.agentId}:think]`;
    const messages = this.buildMessages();
    
    // 验证消息格式，检查 tool_calls 是否被正确跟随
    console.log(`${logPrefix} 构建消息列表，数量:`, messages.length);
    this.validateToolCallMessages(messages, logPrefix);
    
    // 打印构建的消息（用于调试）
    console.log(`${logPrefix} 发送给API的消息:`, messages.map((m, i) => ({
      index: i,
      role: m.role,
      contentLength: m.content?.length || 0,
      hasToolCalls: !!m.toolCalls?.length,
      toolCallsInfo: m.toolCalls?.map(tc => ({ id: tc.id, name: tc.function.name })),
      toolCallId: m.toolCallId
    })));

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
            // 清除"思考中..."占位，只保留 toolCalls，同时保存 usage
            this.clearAssistantMessageContent(aiMessageId);
            // 保存 usage 到消息
            if (lastUsage) {
              const messages = this.state.conversation?.messages;
              const message = messages?.find(m => m.id === aiMessageId);
              if (message) message.usage = lastUsage;
            }
          } else if (!fullContent.includes('<tool_call>')) {
            // 没有工具调用，更新为最终内容
            this.updateAssistantMessage(aiMessageId, response.content || fullContent, fullReasoning, lastUsage);
          } else {
            // XML 格式的工具调用，也需要清除 content
            this.clearAssistantMessageContent(aiMessageId);
            // 保存 usage 到消息
            if (lastUsage) {
              const messages = this.state.conversation?.messages;
              const message = messages?.find(m => m.id === aiMessageId);
              if (message) message.usage = lastUsage;
            }
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
    const logPrefix = `[ReActAgent:${this.agentId}:updateAssistantToolCalls]`;
    const messages = this.state.conversation?.messages;
    if (!messages) return;

    const message = messages.find(m => m.id === id);
    if (message && message.role === 'assistant') {
      console.log(`${logPrefix} 更新消息 ${id.substring(0, 20)} 的 toolCalls:`, 
        toolCalls.map(tc => ({ id: tc.id, name: tc.function.name })));
      message.toolCalls = toolCalls;
      this.emit('messageUpdate', { id, content: message.content, reasoning: message.reasoning });
    } else {
      console.warn(`${logPrefix} 警告: 未找到消息 ${id.substring(0, 20)}`);
    }
  }

  /**
   * Action 步骤：执行工具
   */
  private async executeAction(toolCall: ToolCall, parentMessageId?: string): Promise<void> {
    const logPrefix = `[ReActAgent:${this.agentId}:executeAction]`;
    console.log(`${logPrefix} 开始执行工具:`, { 
      toolCallId: toolCall.id, 
      name: toolCall.function.name,
      parentMessageId: parentMessageId?.substring(0, 20)
    });
    
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

    // 注意：不再在这里更新 toolCalls，因为完整的 toolCalls 已经在 think() 或 run() 中保存
    // 这里只执行工具调用，不修改消息的 toolCalls 属性

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
  private finalize(answer: string, messageId?: string, usage?: UsageInfo): void {
    const logPrefix = `[ReActAgent:${this.agentId}:finalize]`;
    console.log(`${logPrefix} 完成回复, 内容长度:`, answer?.length, 'messageId:', messageId?.substring(0, 20));
    
    // 记录 Answer 步骤
    const answerStep: ReActStep = {
      type: 'answer',
      content: answer,
      timestamp: Date.now()
    };
    this.addStep(answerStep);

    // 更新指定的 AI 消息或最后一条 AI 消息
    if (messageId) {
      this.updateAssistantMessage(messageId, answer, undefined, usage);
    } else {
      const lastMessage = this.state.conversation?.messages[this.state.conversation.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        lastMessage.content = answer;
        lastMessage.loading = false;
        if (usage) lastMessage.usage = usage;
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
  private updateAssistantMessage(id: string, content: string, reasoning?: string, usage?: UsageInfo): void {
    const messages = this.state.conversation?.messages;
    if (!messages) return;

    const message = messages.find(m => m.id === id);
    if (message && message.role === 'assistant') {
      message.content = content;
      message.reasoning = reasoning;
      message.loading = false;
      if (usage) message.usage = usage;
      // 触发消息更新事件，通知外部刷新
      this.emit('messageUpdate', { id, content, reasoning, usage });
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
    const logPrefix = `[ReActAgent:${this.agentId}:addAssistantMessage]`;
    const message: ChatMessage = {
      id: `msg-${Date.now()}-ai-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      toolCalls,
      loading
    };
    console.log(`${logPrefix} 添加assistant消息:`, {
      messageId: message.id.substring(0, 20),
      contentLength: content.length,
      hasToolCalls: !!toolCalls?.length,
      toolCallsInfo: toolCalls?.map(tc => ({ id: tc.id, name: tc.function.name })),
      loading,
      currentMessageCount: (this.state.conversation?.messages?.length || 0)
    });
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
    const logPrefix = `[ReActAgent:${this.agentId}:addToolMessage]`;
    const message: ChatMessage = {
      id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'tool',
      content,
      timestamp: Date.now(),
      toolCallId
    };
    console.log(`${logPrefix} 添加tool消息:`, { 
      toolCallId, 
      messageId: message.id.substring(0, 20),
      contentLength: content.length,
      currentMessageCount: this.state.conversation?.messages?.length || 0
    });
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

  /**
   * 验证 tool_calls 消息格式
   * Kimi API 要求：assistant message with 'tool_calls' must be followed by tool messages
   */
  private validateToolCallMessages(messages: ChatMessage[], logPrefix: string): void {
    const pendingToolCallIds = new Set<string>();
    
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      
      // 如果是 assistant 消息且有 tool_calls，记录所有 tool_call_id
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        for (const tc of m.toolCalls) {
          pendingToolCallIds.add(tc.id);
          console.log(`${logPrefix} 检测到tool_call:`, { id: tc.id, name: tc.function.name, atIndex: i });
        }
      }
      
      // 如果是 tool 消息，移除对应的 tool_call_id
      if (m.role === 'tool' && m.toolCallId) {
        if (pendingToolCallIds.has(m.toolCallId)) {
          pendingToolCallIds.delete(m.toolCallId);
          console.log(`${logPrefix} 检测到tool结果:`, { toolCallId: m.toolCallId, atIndex: i, resolved: true });
        } else {
          console.warn(`${logPrefix} 警告: tool消息没有对应的tool_call:`, { toolCallId: m.toolCallId, atIndex: i });
        }
      }
    }
    
    // 检查是否有未解决的 tool_call
    if (pendingToolCallIds.size > 0) {
      console.error(`${logPrefix} 错误: 有 ${pendingToolCallIds.size} 个 tool_call 没有对应的 tool 消息:`, 
        Array.from(pendingToolCallIds));
    }
  }

  /**
   * 调试打印消息状态
   */
  private debugPrintMessages(label: string): void {
    const messages = this.state.conversation?.messages || [];
    console.log(`${label}:`, messages.map((m, i) => ({
      index: i,
      role: m.role,
      contentPreview: m.content?.substring(0, 50) || '',
      hasToolCalls: !!m.toolCalls?.length,
      toolCallsInfo: m.toolCalls?.map(tc => ({ id: tc.id, name: tc.function.name })),
      toolCallId: m.toolCallId,
      id: m.id?.substring(0, 20)
    })));
  }
}
