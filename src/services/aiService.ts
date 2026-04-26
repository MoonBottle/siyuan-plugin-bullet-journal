/**
 * AI 服务封装
 * 支持 OpenAI 格式的 API 调用
 */
import type { AIProviderConfig, ChatMessage, ToolCall, ToolDefinition, UsageInfo } from '@/types/ai';

/**
 * 根据 provider 和 model 返回合适的 temperature
 * Kimi API 要求 temperature 必须为 1
 */
function getTemperature(config: AIProviderConfig): number {
  if (config.provider === 'kimi') {
    return 1;
  }
  return 0.7;
}

/**
 * 规范化消息以兼容各 API
 * Kimi API 要求 assistant 消息的 content 不能为空
 */
function normalizeMessageContent(m: ChatMessage): string {
  if (m.role === 'assistant' && !m.content?.trim()) {
    return ' ';
  }
  return m.content ?? '';
}

/**
 * 构建 API 请求用的消息对象
 * Kimi thinking 模式下，含 tool_calls 的 assistant 消息必须包含 reasoning_content
 */
function buildMessageForApi(m: ChatMessage, config: AIProviderConfig): Record<string, unknown> {
  const content = normalizeMessageContent(m);
  const msg: Record<string, unknown> = {
    role: m.role,
    content
  };
  if (m.role === 'tool' && m.toolCallId) {
    msg.tool_call_id = m.toolCallId;
  }
  if (m.toolCalls && m.toolCalls.length > 0) {
    msg.tool_calls = m.toolCalls;
  }
  if (m.role === 'assistant' && m.reasoning) {
    msg.reasoning_content = m.reasoning;
  }
  return msg;
}

/**
 * 流式 AI 响应结果
 */
export interface StreamAIResponse {
  content: string;
  reasoning?: string;
  usage?: UsageInfo;
}

/**
 * 调用 AI API（支持流式输出）
 */
export async function callAI(
  config: AIProviderConfig,
  messages: ChatMessage[],
  onChunk?: (chunk: string, reasoning?: string, usage?: UsageInfo) => void
): Promise<StreamAIResponse> {
  if (!config.apiKey) {
    throw new Error('API Key 未配置');
  }

  const apiUrl = config.apiUrl;

  const requestBody: Record<string, unknown> = {
    model: config.defaultModel,
    messages: messages.map(m => buildMessageForApi(m, config)),
    temperature: getTemperature(config),
    max_tokens: 4000,
    stream: true,
    stream_options: {
      include_usage: true
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    // 处理流式响应
    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullReasoning = '';
    let lastUsage: UsageInfo | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          // 流式响应结束标记
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content || '';
            const reasoning = delta?.reasoning || '';
            const usage = parsed.usage;

            // 处理 reasoning 字段（某些模型如 step-3.5-flash 会返回）
            if (reasoning) {
              fullReasoning += reasoning;
            }

            // 处理 usage 字段
            if (usage) {
              lastUsage = {
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0,
                cached_tokens: usage.cached_tokens
              };
            }

            if (content) {
              fullContent += content;
              onChunk?.(fullContent, fullReasoning, lastUsage);
            } else if (reasoning || usage) {
              // 即使没有 content，只要有 reasoning 或 usage 变化也触发回调
              onChunk?.(fullContent, fullReasoning, lastUsage);
            }
          } catch {
            // 忽略解析错误的行
          }
        }
      }
    }

    // 清理工具调用相关的内容
    fullContent = cleanToolCallContent(fullContent);

    return {
      content: fullContent || '无响应内容',
      reasoning: fullReasoning || undefined,
      usage: lastUsage
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('调用 AI 服务时发生未知错误');
  }
}



/**
 * 带工具调用的 AI 响应
 */
export interface AIResponseWithTools {
  content: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  usage?: UsageInfo;
}

/**
 * 解析 XML 格式的工具调用
 */
function parseXmlToolCalls(xmlContent: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  try {
    // 匹配 <tool_call> 标签
    const toolCallMatches = xmlContent.match(/<tool_call>([\s\S]*?)<\/tool_call>/g);
    if (!toolCallMatches) return toolCalls;
    
    toolCallMatches.forEach(toolCallMatch => {
      // 提取 <function> 标签
      const functionMatch = toolCallMatch.match(/<function=([^>]+)>([\s\S]*?)<\/function>/);
      if (!functionMatch) return;
      
      const functionName = functionMatch[1].trim();
      const functionContent = functionMatch[2];
      
      // 提取参数
      const params: Record<string, string> = {};
      const paramMatches = functionContent.match(/<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g);
      if (paramMatches) {
        paramMatches.forEach(paramMatch => {
          const paramMatchDetails = paramMatch.match(/<parameter=([^>]+)>([\s\S]*?)<\/parameter>/);
          if (paramMatchDetails) {
            const paramName = paramMatchDetails[1].trim();
            const paramValue = paramMatchDetails[2].trim();
            params[paramName] = paramValue;
          }
        });
      }
      
      // 创建工具调用对象
      const toolCall: ToolCall = {
        id: `chatcmpl-tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'function',
        function: {
          name: functionName,
          arguments: JSON.stringify(params)
        }
      };
      
      toolCalls.push(toolCall);
    });
  } catch (error) {
    console.error('XML tool call parsing error:', error);
  }
  
  return toolCalls;
}

/**
 * 清理和过滤工具调用相关的内容
 */
function cleanToolCallContent(content: string): string {
  // 移除 XML 工具调用标签
  if (content.includes('<tool_call>')) {
    return '';
  }
  
  // 移除其他工具调用相关的内容
  if (content.includes('parameter') || content.includes('function') || content.includes('tool_call')) {
    return '';
  }
  
  return content;
}

/**
 * 调用 AI API（支持工具调用）
 */
export async function callAIWithTools(
  config: AIProviderConfig,
  messages: ChatMessage[],
  tools: ToolDefinition[]
): Promise<AIResponseWithTools> {
  if (!config.apiKey) {
    throw new Error('API Key 未配置');
  }

  const apiUrl = config.apiUrl;

  const requestBody = {
    model: config.defaultModel,
    messages: messages.map(m => buildMessageForApi(m, config)),
    tools,
    tool_choice: 'auto',
    temperature: getTemperature(config),
    max_tokens: 4000
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    let content = message?.content || '';
    let toolCalls = message?.tool_calls;
    const reasoning = message?.reasoning || '';
    const usage = data.usage;

    // 处理 XML 格式的工具调用（某些模型返回这种格式）
    if (content && content.includes('<tool_call>')) {
      toolCalls = parseXmlToolCalls(content);
      // 清空 content，因为工具调用内容不需要显示
      content = '';
    } else {
      // 清理工具调用相关的内容
      content = cleanToolCallContent(content);
    }

    return {
      content,
      toolCalls,
      reasoning: reasoning || undefined,
      usage: usage ? {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        cached_tokens: usage.cached_tokens
      } : undefined
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('调用 AI 服务时发生未知错误');
  }
}

/**
 * 支持工具调用的流式 AI 调用
 */
export async function callAIWithToolsStream(
  config: AIProviderConfig,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  onChunk?: (chunk: string, reasoning?: string, usage?: UsageInfo, toolCalls?: ToolCall[]) => void
): Promise<AIResponseWithTools> {
  if (!config.apiKey) {
    throw new Error('API Key 未配置');
  }

  const apiUrl = config.apiUrl;

  const requestBody: Record<string, unknown> = {
    model: config.defaultModel,
    messages: messages.map(m => buildMessageForApi(m, config)),
    tools,
    tool_choice: 'auto',
    temperature: getTemperature(config),
    max_tokens: 4000,
    stream: true,
    stream_options: {
      include_usage: true
    }
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullReasoning = '';
    let toolCalls: ToolCall[] | undefined;
    let lastUsage: UsageInfo | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const usage = parsed.usage;

            // 处理 usage 字段
            if (usage) {
              lastUsage = {
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0,
                cached_tokens: usage.cached_tokens
              };
            }

            // 处理 reasoning 字段（思考过程）
            // 支持多种字段名：reasoning (通用) / reasoning_content (Kimi)
            const reasoningChunk = delta?.reasoning || delta?.reasoning_content;
            if (reasoningChunk) {
              fullReasoning += reasoningChunk;
            }

            // 处理工具调用（必须在内容处理之前，以便 toolCalls 能传递给回调）
            if (delta?.tool_calls) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;
                if (!toolCalls) toolCalls = [];
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: toolCallDelta.id || '',
                    type: 'function',
                    function: {
                      name: '',
                      arguments: ''
                    }
                  };
                }
                if (toolCallDelta.function?.name) {
                  toolCalls[index].function.name += toolCallDelta.function.name;
                }
                if (toolCallDelta.function?.arguments) {
                  toolCalls[index].function.arguments += toolCallDelta.function.arguments;
                }
              }
            }

            // 处理内容增量
            if (delta?.content) {
              fullContent += delta.content;
              onChunk?.(fullContent, fullReasoning, lastUsage, toolCalls);
            } else if (delta?.reasoning || delta?.reasoning_content || usage || delta?.tool_calls) {
              // 即使没有 content，只要有 reasoning、usage 或 tool_calls 变化也触发回调
              onChunk?.(fullContent, fullReasoning, lastUsage, toolCalls);
            }
          } catch {
            // 忽略解析错误的行
          }
        }
      }
    }

    // 处理 XML 格式的工具调用（某些模型返回这种格式）
    if (fullContent && fullContent.includes('<tool_call>')) {
      const xmlToolCalls = parseXmlToolCalls(fullContent);
      if (xmlToolCalls.length > 0) {
        return {
          content: '',
          toolCalls: xmlToolCalls,
          reasoning: fullReasoning || undefined,
          usage: lastUsage
        };
      }
    }

    // 清理工具调用相关的内容
    fullContent = cleanToolCallContent(fullContent);

    return {
      content: fullContent,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      reasoning: fullReasoning || undefined,
      usage: lastUsage
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('调用 AI 服务时发生未知错误');
  }
}

/**
 * 验证 AI 配置
 */
export async function validateAIConfig(config: AIProviderConfig): Promise<boolean> {
  try {
    if (!config.apiKey) {
      return false;
    }

    // 发送一个简单的测试请求
    const testMessages: ChatMessage[] = [
      {
        id: 'test',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now()
      }
    ];

    await callAI(config, testMessages);
    return true;
  } catch {
    return false;
  }
}
