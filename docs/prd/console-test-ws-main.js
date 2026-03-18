/**
 * 控制台测试脚本：ws-main 事件解析 + attributes 表与 getBlockAttrs 一致性验证
 *
 * 使用方法：
 * 1. 打开思源笔记，按 Ctrl+Shift+I 打开开发者工具
 * 2. 切换到 Console 标签
 * 3. 复制本文件全部内容粘贴到控制台执行
 *
 * 测试说明：
 * - 监听 ws-main 事件，解析 transactions 中的 rootIds 和变更块 ID
 * - 触发一次编辑（如修改文档、完成番茄钟）后查看输出
 * - 调用 compareAttrs(blockId) 可对比 attributes 表与 getBlockAttrs 的结果
 */

(function () {
  // 思源 API 使用相对路径，需在主窗口控制台执行（非 Dock iframe）
  async function apiPost(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (json.code !== 0) {
      throw new Error(json.msg || 'API 失败');
    }
    return json.data;
  }

  async function sql(stmt) {
    return apiPost('/api/query/sql', { stmt });
  }

  async function getBlockAttrs(blockId) {
    return apiPost('/api/attr/getBlockAttrs', { id: blockId });
  }

  // ========== 1. ws-main 监听 ==========
  // 思源 eventBus 可能不通过 document 派发，尝试多种目标
  const handler = (e) => {
    const d = e?.detail;
    if (!d) return;

    if (d.cmd !== 'transactions') {
      console.log('[ws-main 测试] 收到事件 cmd:', d.cmd);
      return;
    }

    const rootIds = d.context?.rootIDs || [];
    const blockIds = [];
    const actions = new Set();

    if (Array.isArray(d.data)) {
      for (const tx of d.data) {
        for (const op of tx.doOperations || []) {
          actions.add(op.action);
          if (op.id) blockIds.push(op.id);
        }
      }
    }

    console.log('[ws-main 测试] transactions 解析:', {
      rootIds,
      blockIds,
      actions: [...actions],
      hasUpdateAttrs: actions.has('updateAttrs')
    });
  };

  document.addEventListener('ws-main', handler);
  document.addEventListener('ws-main', handler, true);
  window.addEventListener('ws-main', handler);
  let eventBusRef = null;
  for (const path of ['siyuan.ws.app.eventBus', 'siyuan.app.eventBus', 'eventBus']) {
    const bus = path.split('.').reduce((o, k) => o?.[k], window);
    if (bus?.on) {
      bus.on('ws-main', handler);
      eventBusRef = bus;
      console.log('[ws-main 测试] 已通过', path, '监听');
      break;
    }
  }
  console.log('[ws-main 测试] 已监听 ws-main，请编辑文档或完成番茄钟触发事件');
  console.log('[ws-main 测试] 若无输出：1) 确认在主窗口控制台执行 2) 执行 findEventBus() 查找 eventBus');
  window.findEventBus = () => {
    const candidates = [];
    const check = (obj, path) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.on && typeof obj.on === 'function') candidates.push(path);
      const depth = (path.match(/\./g) || []).length;
      if (depth < 4) {
        Object.keys(obj).slice(0, 15).forEach((k) => {
          try {
            check(obj[k], path ? `${path}.${k}` : k);
          } catch (_) {}
        });
      }
    };
    if (window.siyuan) check(window.siyuan, 'siyuan');
    console.log('[findEventBus] 可能的 eventBus:', candidates);
    return candidates;
  };

  // ========== 2. attributes 与 getBlockAttrs 对比 ==========
  window.compareAttrs = async function (blockId) {
    if (!blockId) {
      console.warn('用法: compareAttrs("块ID")，块 ID 可从上方 ws-main 输出的 blockIds 中获取');
      return;
    }

    const attrsFromApi = await getBlockAttrs(blockId).catch((e) => {
      console.error('getBlockAttrs 失败:', e);
      return null;
    });

    const attrsFromSql = await sql(
      `SELECT name, value FROM attributes WHERE block_id = '${blockId}' AND name LIKE 'custom-%'`
    ).catch((e) => {
      console.error('attributes SQL 失败:', e);
      return null;
    });

    const sqlMap = attrsFromSql ? Object.fromEntries(attrsFromSql.map((r) => [r.name, r.value])) : {};
    const apiMap = attrsFromApi || {};
    // 仅比较 custom-* 属性（id/updated 来自 blocks.ial，不在 attributes 表）
    const customKeys = (k) => k.startsWith('custom-');
    const apiCustom = Object.fromEntries(Object.entries(apiMap).filter(([k]) => customKeys(k)));
    const sqlCustom = Object.fromEntries(Object.entries(sqlMap).filter(([k]) => customKeys(k)));
    const keys = new Set([...Object.keys(apiCustom), ...Object.keys(sqlCustom)]);
    const diff = [];
    for (const k of keys) {
      const a = apiCustom[k];
      const b = sqlCustom[k];
      if (a !== b) diff.push({ key: k, api: a, sql: b });
    }

    console.log('[compareAttrs] blockId:', blockId);
    console.log('[compareAttrs] getBlockAttrs (custom-):', apiCustom);
    console.log('[compareAttrs] attributes 表 (custom-):', sqlCustom);
    console.log('[compareAttrs] custom 属性差异:', diff.length ? diff : '无差异，一致');
  };

  window.stopWsMainTest = () => {
    document.removeEventListener('ws-main', handler);
    document.removeEventListener('ws-main', handler, true);
    window.removeEventListener('ws-main', handler);
    if (eventBusRef?.off) eventBusRef.off('ws-main', handler);
    console.log('[ws-main 测试] 已移除监听');
  };

  console.log('[ws-main 测试] 可用命令: compareAttrs(blockId), stopWsMainTest()');
})();
