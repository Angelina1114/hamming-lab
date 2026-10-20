import katex from 'katex';
import { memo, useMemo } from 'react';

interface TexProps {
  children: string;
  block?: boolean;
  className?: string;
}

/** KaTeX renderer. `block` = display mode. */
export const Tex = memo(function Tex({ children, block = false, className = '' }: TexProps) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: block,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        macros: {
          '\\F': '\\mathbb{F}',
          '\\GF': '\\mathrm{GF}',
          // KaTeX draws ≠ by overlaying a private-use glyph from its own font; where web fonts are blocked
          // (Safari Lockdown Mode, some extensions) that shows as a box over "=". Overlay a plain "/" instead,
          // the way KaTeX builds \notin: it renders with or without the KaTeX fonts.
          '\\neq': '\\mathrel{{=}\\mathllap{/\\mskip2.5mu}}',
          '\\ne': '\\mathrel{{=}\\mathllap{/\\mskip2.5mu}}',
        },
      }),
    [children, block],
  );
  const Tag = block ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Shorthand for inline math. */
export const M = ({ children }: { children: string }) => <Tex>{children}</Tex>;
