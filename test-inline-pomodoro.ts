import { parseKramdown } from './src/parser/core';

const kramdown = `{: id="20260308203826-lvk1d7h" updated="20260308203826"}

- {: id="20260308203827-fmms29h" updated="20260308211218"}任务 #任务#
  {: id="20260308203827-druqqpi" updated="20260308203837"}

  - {: id="20260308203822-5gz124r" updated="20260308211218"}[ ] 事项列表未完成事项内容 @2026-03-08
    🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈
    {: id="20260308203822-j3j7gl8" updated="20260308211218"}

    - {: updated="20260308160041" id="20260308203822-p5gpzvm"}🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈
      {: id="20260308203822-61okbi6" updated="20260308160041"}
    - {: id="20260308203822-k76696i" updated="20260308160041"}🍅2026-03-08 16:00:00\\~16:25:00 专注工作
      {: id="20260308203822-hwhumxq" updated="20260308160041"}
    {: id="20260308203822-2a09qae" updated="20260308160041"}
  - {: id="20260308203822-n577cpp" updated="20260308211209"}[X] 事项列表已完成状态事项 @2026-03-08
    {: updated="20260308211209" id="20260308203822-jy3e94v"}
  {: id="20260308203829-6510isx" updated="20260308211218"}
{: id="20260308203822-cj5emas" updated="20260308211218"}

{: updated="20260308203908" id="20260308203908-rjdehwq"}

{: id="20260308203758-iva2ubz" title="事项列表" type="doc" updated="20260308211218"}`;

const project = parseKramdown(kramdown, 'test-doc');

if (project && project.tasks.length > 0) {
  const task = project.tasks[0];
  console.log('Task:', task.name);
  console.log('Task blockId:', task.blockId);
  
  if (task.items.length > 0) {
    const item = task.items[0];
    console.log('\n=== 事项信息 ===');
    console.log('Item content:', item.content);
    console.log('Item blockId:', item.blockId);
    console.log('Item contentBlockId:', item.contentBlockId);
    console.log('Item pomodoros count:', item.pomodoros?.length);
    
    if (item.pomodoros && item.pomodoros.length > 0) {
      console.log('\n=== 番茄钟列表 ===');
      item.pomodoros.forEach((pomodoro, index) => {
        console.log(`\n[${index + 1}] 番茄钟:`);
        console.log('  blockId:', pomodoro.blockId);
        console.log('  description:', pomodoro.description);
        console.log('  time:', pomodoro.startTime, '~', pomodoro.endTime);
      });
    }
    
    console.log('\n=== 对比 ===');
    console.log('事项 blockId:', item.blockId);
    console.log('事项 contentBlockId:', item.contentBlockId);
    console.log('第一个番茄钟 blockId:', item.pomodoros?.[0]?.blockId);
    console.log('第二个番茄钟 blockId:', item.pomodoros?.[1]?.blockId);
    console.log('第三个番茄钟 blockId:', item.pomodoros?.[2]?.blockId);
  }
}
