import type { ReactNode } from 'react';

/* Shared pieces for the Lesson 1 deck: one file per chapter imports these. */

/** Keeps its place from the first step (so the slide never reflows) and fades in at its step. */
export function Reveal({ on, className = '', children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <div aria-hidden={!on} className={`transition-opacity duration-500 ${on ? 'opacity-100' : 'invisible opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

/** A tinted panel with a bold heading. */
export function Box({ tone, title, children }: { tone: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className={`h-full rounded-2xl p-4 ${tone}`}>
      <div className="mb-1 text-xl font-bold">{title}</div>
      {children}
    </div>
  );
}

/** 'P1' → 'P_1' for KaTeX */
export const sub = (label: string) => label.replace(/(\d)/, '_$1');

/** speaker notes: the bullet list, and the nested list for sub-points */
export const NOTES_UL = 'list-disc space-y-1 pl-5';
export const NOTES_SUB = 'mt-0.5 list-[circle] space-y-0.5 pl-5';
