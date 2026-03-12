import { Setting } from 'siyuan';
import type TaskAssistantPlugin from '@/index';
import { eventBus, Events, broadcastDataRefresh } from '@/utils/eventBus';
import { addDirectoryConfigItem } from './directoryConfig';
import { addGroupConfigItem } from './groupConfig';
import { addLunchBreakConfigItems } from './lunchBreakConfig';
import { addCalendarConfigItem } from './calendarConfig';
import { addPomodoroConfigItem } from './pomodoroConfig';
import { addMcpConfigItem } from './mcpConfig';
import { addAiConfigItem } from './aiConfig';
import {
  updateDefaultGroupSelect,
  populateGroupSelect,
  updateAllGroupSelects,
  renderGroupsList,
  renderDirectoriesList
} from './utils';
import type { SettingsData } from './types';

export * from './types';
export * from './utils';

/**
 * 创建设置面板
 */
export function createSettingsPanel(plugin: InstanceType<typeof TaskAssistantPlugin>): Setting {
  const settings = plugin.getSettings();

  const setting = new Setting({
    destroyCallback: () => {
      // 关闭设置面板时从存储重新加载，避免未保存的修改在下次打开时仍显示
      void plugin.loadSettings();
    },
    confirmCallback: async () => {
      await plugin.saveSettings();
      // 触发数据刷新：同上下文也传完整 settings（与 Todo 接受分组名称变更一致），保证 Dock/Tab 都能拿到最新配置（含 ai）
      const settings = plugin.getSettings();
      eventBus.emit(Events.DATA_REFRESH, settings);
      broadcastDataRefresh(settings as object);
    }
  });

  // 1. 目录配置（最重要：决定扫描哪些文档）
  addDirectoryConfigItem(
    setting,
    settings as SettingsData,
    (select, selectedId) => populateGroupSelect(select, settings as SettingsData, selectedId)
  );

  // 2. 分组管理
  addGroupConfigItem(
    setting,
    settings as SettingsData,
    (select) => updateDefaultGroupSelect(select, settings as SettingsData),
    () => updateAllGroupSelects(settings as SettingsData)
  );

  // 3. 番茄钟配置
  addPomodoroConfigItem(setting, settings as SettingsData);

  // 4. 日历默认视图
  addCalendarConfigItem(setting, settings as SettingsData);

  // 5. AI 服务配置（多供应商，仅改内存；点弹框底部「保存」才写入文件）
  addAiConfigItem(setting, settings as SettingsData);

  // 6. MCP 配置
  addMcpConfigItem(setting);

  // 7. 午休时间（用于工时计算）
  addLunchBreakConfigItems(setting, settings as SettingsData);

  return setting;
}
