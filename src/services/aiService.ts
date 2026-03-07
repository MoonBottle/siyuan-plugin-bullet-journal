/**
 * AI 服务封装
 * 支持 OpenAI 格式的 API 调用
 */
import type { AIProviderConfig, ChatMessage, ToolCall, ToolDefinition, UsageInfo } from '@/types/ai';
import type { Project, ProjectGroup, Item } from '@/types/models';

// 系统提示词模板
const SYSTEM_PROMPT_TEMPLATE = `你是一个子弹笔记助手，专门帮助用户管理和分析他们的任务数据。

## 子弹笔记数据结构

### 项目（Project）
- 每个文档代表一个项目
- 包含项目名称、描述、任务列表

### 任务（Task）
- 使用 #任务 标记
- 支持层级：@L1（父任务）、@L2（子任务）、@L3
- 可以包含多个工作事项

### 工作事项（Item）
- 具体的待办事项
- 使用 @YYYY-MM-DD 标记日期
- 支持时间范围：@YYYY-MM-DD HH:mm:ss~HH:mm:ss
- 状态：待办（pending）、已完成（completed）、已放弃（abandoned）
- 标记：#done/#已完成 表示完成，#abandoned/#已放弃 表示放弃

### 当前数据概览
{{PROJECTS_DATA}}

## 你的职责
1. 帮助用户分析任务完成情况
2. 提供工作规划建议
3. 回答关于项目进度的问题
4. 根据数据生成周报/月报
5. 识别延期任务并提醒

请基于提供的数据，用中文回答用户的问题。`;

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(
  projects: Project[],
  groups: ProjectGroup[],
  items: Item[]
): string {
  // 构建项目数据摘要
  const projectsSummary = projects.map(p => {
    const taskCount = p.tasks.length;
    const itemCount = p.tasks.reduce((sum, t) => sum + t.items.length, 0);
    const completedItems = p.tasks.reduce(
      (sum, t) => sum + t.items.filter(i => i.status === 'completed').length,
      0
    );
    return `- ${p.name}: ${taskCount}个任务, ${itemCount}个事项 (${completedItems}已完成)`;
  }).join('\n');

  // 构建分组信息
  const groupsSummary = groups.map(g => {
    const groupProjects = projects.filter(p => p.groupId === g.id);
    return `- ${g.name}: ${groupProjects.length}个项目`;
  }).join('\n') || '暂无分组';

  // 获取最近的待办事项
  const pendingItems = items
    .filter(i => i.status === 'pending')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const pendingSummary = pendingItems.map(i => {
    const projectName = i.project?.name || '未分类';
    const taskName = i.task?.name || '';
    return `- [${i.date}] ${i.content} (${projectName}${taskName ? ' / ' + taskName : ''})`;
  }).join('\n') || '暂无待办事项';

  const dataSection = `
### 项目列表
${projectsSummary || '暂无项目'}

### 分组列表
${groupsSummary}

### 最近待办事项（前10个）
${pendingSummary}

### 统计数据
- 总项目数: ${projects.length}
- 总任务数: ${projects.reduce((sum, p) => sum + p.tasks.length, 0)}
- 总事项数: ${items.length}
- 待办事项: ${items.filter(i => i.status === 'pending').length}
- 已完成: ${items.filter(i => i.status === 'completed').length}
- 已放弃: ${items.filter(i => i.status === 'abandoned').length}
`;

  return SYSTEM_PROMPT_TEMPLATE.replace('{{PROJECTS_DATA}}', dataSection);
}

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

  const requestBody = {
    model: config.defaultModel,
    messages: messages.map(m => {
      const msg: Record<string, unknown> = {
        role: m.role,
        content: normalizeMessageContent(m)
      };
      // tool 角色的消息必须包含 tool_call_id
      if (m.role === 'tool' && m.toolCallId) {
        msg.tool_call_id = m.toolCallId;
      }
      // assistant 角色的消息如果包含 tool_calls，需要保留
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls;
      }
      return msg;
    }),
    temperature: getTemperature(config),
    max_tokens: 4000,
    stream: true
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
    messages: messages.map(m => ({
      role: m.role,
      content: normalizeMessageContent(m),
      ...(m.toolCalls && { tool_calls: m.toolCalls }),
      ...(m.toolCallId && { tool_call_id: m.toolCallId })
    })),
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
  onChunk?: (chunk: string, reasoning?: string, usage?: UsageInfo) => void
): Promise<AIResponseWithTools> {
  if (!config.apiKey) {
    throw new Error('API Key 未配置');
  }

  const apiUrl = config.apiUrl;

  const requestBody = {
    model: config.defaultModel,
    messages: messages.map(m => ({
      role: m.role,
      content: normalizeMessageContent(m),
      ...(m.toolCalls && { tool_calls: m.toolCalls }),
      ...(m.toolCallId && { tool_call_id: m.toolCallId })
    })),
    tools,
    tool_choice: 'auto',
    temperature: getTemperature(config),
    max_tokens: 4000,
    stream: true
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
            if (delta?.reasoning) {
              fullReasoning += delta.reasoning;
            }

            // 处理内容增量
            if (delta?.content) {
              fullContent += delta.content;
              onChunk?.(fullContent, fullReasoning, lastUsage);
            } else if (delta?.reasoning || usage) {
              // 即使没有 content，只要有 reasoning 或 usage 变化也触发回调
              onChunk?.(fullContent, fullReasoning, lastUsage);
            }

            // 处理工具调用
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
