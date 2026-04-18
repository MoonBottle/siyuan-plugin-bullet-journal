/**
 * Protyle writer 快路径安全判定（块引用等多文本节点场景）
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { isProtyleBlockSafeForWriterFastPath } from '@/utils/protyleWriterDom';

function parseBlock(html: string): HTMLElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild as HTMLElement;
}

describe('isProtyleBlockSafeForWriterFastPath', () => {
  it('纯段落仅一个文本节点 → 可走快路径', () => {
    const el = parseBlock(`
      <div data-node-id="id1" data-type="NodeParagraph" class="p">
        <div contenteditable="true" spellcheck="false">纯文本一行事项</div>
        <div class="protyle-attr" contenteditable="false"><div>​</div></div>
      </div>
    `);
    expect(isProtyleBlockSafeForWriterFastPath(el)).toBe(true);
  });

  it('含块引用 span → 多文本节点，不可走快路径', () => {
    const el = parseBlock(`
      <div data-node-id="id1" data-type="NodeParagraph" class="p">
        <div contenteditable="true" spellcheck="false">
          测试<span data-type="block-ref" data-subtype="d" data-id="20260418163212-tayjs0q">测试引用块</span>修改事项2/jt
        </div>
        <div class="protyle-attr" contenteditable="false"><div>​</div></div>
      </div>
    `);
    expect(isProtyleBlockSafeForWriterFastPath(el)).toBe(false);
  });

  it('行内加粗拆成多文本节点 → 不可走快路径', () => {
    const el = parseBlock(`
      <div data-node-id="id2" data-type="NodeParagraph" class="p">
        <div contenteditable="true" spellcheck="false">
          前缀<strong>粗体</strong>后缀
        </div>
        <div class="protyle-attr" contenteditable="false"><div>​</div></div>
      </div>
    `);
    expect(isProtyleBlockSafeForWriterFastPath(el)).toBe(false);
  });

  it('protyle-attr 内文本不计入', () => {
    const el = parseBlock(`
      <div data-node-id="id3" data-type="NodeParagraph" class="p">
        <div contenteditable="true" spellcheck="false">仅一行</div>
        <div class="protyle-attr" contenteditable="false">
          <div class="protyle-attr--bookmark">🍅</div>
        </div>
      </div>
    `);
    expect(isProtyleBlockSafeForWriterFastPath(el)).toBe(true);
  });
});
