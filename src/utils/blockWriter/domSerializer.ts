type ApiLute = LuteInstance & {
  Md2BlockDOM?: (markdown: string) => string;
  SetHTMLTag2TextMark?: (enable: boolean) => void;
  SetTextMark?: (enable: boolean) => void;
  SetProtyleWYSIWYG?: (enable: boolean) => void;
  SetBlockRef?: (enable: boolean) => void;
  SetFileAnnotationRef?: (enable: boolean) => void;
  SetKramdownIAL?: (enable: boolean) => void;
  SetTag?: (enable: boolean) => void;
  SetSuperBlock?: (enable: boolean) => void;
  SetImgPathAllowSpace?: (enable: boolean) => void;
  SetGitConflict?: (enable: boolean) => void;
  SetMark?: (enable: boolean) => void;
  SetSup?: (enable: boolean) => void;
  SetSub?: (enable: boolean) => void;
  SetInlineMathAllowDigitAfterOpenMarker?: (enable: boolean) => void;
  SetFootnotes?: (enable: boolean) => void;
  SetToC?: (enable: boolean) => void;
  SetIndentCodeBlock?: (enable: boolean) => void;
  SetParagraphBeginningSpace?: (enable: boolean) => void;
  SetAutoSpace?: (enable: boolean) => void;
  SetHeadingID?: (enable: boolean) => void;
  SetSetext?: (enable: boolean) => void;
  SetYamlFrontMatter?: (enable: boolean) => void;
  SetLinkRef?: (enable: boolean) => void;
  SetCodeSyntaxHighlight?: (enable: boolean) => void;
  SetSanitize?: (enable: boolean) => void;
};

export function createApiLute(): ApiLute | null {
  if (typeof window === 'undefined' || !window.Lute?.New) {
    return null;
  }

  try {
    const lute = window.Lute.New() as ApiLute;
    lute.SetHTMLTag2TextMark?.(true);
    lute.SetTextMark?.(true);
    lute.SetProtyleWYSIWYG?.(true);
    lute.SetBlockRef?.(true);
    lute.SetFileAnnotationRef?.(true);
    lute.SetKramdownIAL?.(true);
    lute.SetTag?.(true);
    lute.SetSuperBlock?.(true);
    lute.SetImgPathAllowSpace?.(true);
    lute.SetGitConflict?.(true);
    lute.SetMark?.(true);
    lute.SetSup?.(true);
    lute.SetSub?.(true);
    lute.SetInlineMathAllowDigitAfterOpenMarker?.(true);
    lute.SetFootnotes?.(false);
    lute.SetToC?.(false);
    lute.SetIndentCodeBlock?.(false);
    lute.SetParagraphBeginningSpace?.(true);
    lute.SetAutoSpace?.(false);
    lute.SetHeadingID?.(false);
    lute.SetSetext?.(false);
    lute.SetYamlFrontMatter?.(false);
    lute.SetLinkRef?.(false);
    lute.SetCodeSyntaxHighlight?.(false);
    lute.SetSanitize?.(true);
    return lute;
  }
  catch (error) {
    console.error('[BlockWriter] createApiLute failed:', error);
    return null;
  }
}

export function markdownToBlockDOM(markdown: string): string | null {
  const lute = createApiLute();
  if (!lute || typeof lute.Md2BlockDOM !== 'function') {
    return null;
  }

  try {
    const dom = lute.Md2BlockDOM(markdown);
    return typeof dom === 'string' && dom.trim() ? dom : null;
  }
  catch (error) {
    console.error('[BlockWriter] markdownToBlockDOM failed:', error);
    return null;
  }
}
