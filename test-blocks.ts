import { parseKramdownBlocks } from './src/parser/core';

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

const blocks = parseKramdownBlocks(kramdown);

console.log('Blocks:');
blocks.forEach((block, i) => {
  console.log(`\n[${i}] blockId: ${block.blockId}`);
  console.log(`    content: ${block.content.substring(0, 100)}...`);
});
