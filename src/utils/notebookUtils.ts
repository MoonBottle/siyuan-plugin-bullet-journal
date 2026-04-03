/**
 * 笔记本工具函数
 */
import { lsNotebooks, createNotebook } from '@/api';
import { getCurrentLocale } from '@/i18n';

/**
 * 获取任务助手笔记本名称（根据当前语言）
 * @returns 笔记本名称（中文："任务助手"，英文："Task Assistant"）
 */
export function getTaskAssistantNotebookName(): string {
  const lang = getCurrentLocale();
  return lang.startsWith('en') ? 'Task Assistant' : '任务助手';
}

/**
 * 获取或创建任务助手笔记本
 * @returns 笔记本信息 { id, name } 或 null
 */
export async function getOrCreateTaskAssistantNotebook(): Promise<{ id: string; name: string } | null> {
  try {
    const result = await lsNotebooks();
    if (!result) {
      console.error('[Task Assistant] Failed to query notebooks: API returned null');
      return null;
    }

    const targetName = getTaskAssistantNotebookName();

    // 查找已存在的笔记本（不区分大小写，只找未关闭的）
    const availableNotebooks = result.notebooks?.filter(nb => !nb.closed) || [];
    const existingNotebook = availableNotebooks.find(
      nb => nb.name.toLowerCase() === targetName.toLowerCase()
    );

    if (existingNotebook) {
      console.log('[Task Assistant] Found existing notebook:', existingNotebook.name, 'id:', existingNotebook.id);
      return { id: existingNotebook.id, name: existingNotebook.name };
    }

    // 创建新笔记本
    console.log('[Task Assistant] Creating new notebook:', targetName);
    const createResult = await createNotebook(targetName);
    // API 返回结构为 { notebook: { id, name, ... } }
    const newNotebook = createResult?.notebook;
    if (newNotebook && newNotebook.id) {
      console.log('[Task Assistant] Created new notebook:', newNotebook.name, 'id:', newNotebook.id);
      return { id: newNotebook.id, name: newNotebook.name };
    }

    console.error('[Task Assistant] createNotebook returned invalid result:', createResult);
    return null;
  } catch (error) {
    console.error('[Task Assistant] Failed to get or create notebook:', error);
    return null;
  }
}
