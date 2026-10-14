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
        },
      }),
    [children, block],
  );
  const Tag = block ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Shorthand for inline math. */
export const M = ({ children }: { children: string }) => <Tex>{children}</Tex>;
