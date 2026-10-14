import type { ReactNode } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { MODULES, moduleIndex } from '../../lib/modules';

export interface UnitLink {
  to: string;
  text: ReactNode;
}

/** Cards that jump to related units (existing Lesson 1 / Lesson 2 pages or other algebra units). */
export function RelatedLinks({ links, title = '相關單元' }: { links: UnitLink[]; title?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Link2 className="h-4 w-4" />
        {title}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {links.map((l) => {
          const m = MODULES[moduleIndex(l.to)];
          if (!m) return null;
          return (
            <a key={l.to + String(l.text)} href={`#/${l.to}`} className="group flex gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400 hover:bg-slate-50">
              <span className={`grid h-7 min-w-[1.75rem] shrink-0 place-items-center rounded-md px-1 text-[11px] font-bold ${m.group === 'algebra' ? 'bg-overall-100 text-overall-700' : m.lesson === 2 ? 'bg-parity-100 text-parity-700' : 'bg-data-100 text-data-700'}`}>
                {m.num}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{m.title}</span>
                <span className="block text-xs text-slate-500">{l.text}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 self-center text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-600" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

