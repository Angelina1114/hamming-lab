import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { Menu, X, GraduationCap, Presentation as PresentationIcon } from 'lucide-react';
import { MODULES } from './lib/modules';
import { MessageProvider, useMessage } from './lib/store';
import { encode74 } from './core';
import { BitString } from './components/Bits';

const PAGES: Record<string, ComponentType> = {
  intro: lazy(() => import('./modules/Intro')),
  encode: lazy(() => import('./modules/M1Encoding')),
  matrix: lazy(() => import('./modules/M2Matrices')),
  syndrome: lazy(() => import('./modules/M3Syndrome')),
  distance: lazy(() => import('./modules/M4Limits')),
  extended: lazy(() => import('./modules/M6Extended')),
  secded: lazy(() => import('./modules/M7Secded')),
  'a-0': lazy(() => import('./modules/algebra/A0Map')),
  'a-1': lazy(() => import('./modules/algebra/A1GF2')),
  'a-2': lazy(() => import('./modules/algebra/A2WhyGF8')),
  'a-3': lazy(() => import('./modules/algebra/A3Construct')),
  'a-4': lazy(() => import('./modules/algebra/A4Primitive')),
  'a-5': lazy(() => import('./modules/algebra/A5Generator')),
  'a-6': lazy(() => import('./modules/algebra/A6Cyclic')),
  'a-7': lazy(() => import('./modules/algebra/A7Frobenius')),
  'a-8': lazy(() => import('./modules/algebra/A8MinPoly')),
  'a-9': lazy(() => import('./modules/algebra/A9HMatrix')),
  'a-10': lazy(() => import('./modules/algebra/A10Syndrome')),
  'l2-1': lazy(() => import('./modules/lesson2/L2Flow')),
  'l2-2': lazy(() => import('./modules/lesson2/L2Lfsr')),
  'l2-3': lazy(() => import('./modules/lesson2/L2Division')),
  'l2-4': lazy(() => import('./modules/lesson2/L2Syndrome')),
  'l2-5': lazy(() => import('./modules/lesson2/L2Lookup')),
  'l2-6': lazy(() => import('./modules/lesson2/L2KeyEquation')),
  'l2-7': lazy(() => import('./modules/lesson2/L2Chien')),
  'l2-8': lazy(() => import('./modules/lesson2/L2Xor')),
  'l2-9': lazy(() => import('./modules/lesson2/L2TwoErrors')),
  'l2-10': lazy(() => import('./modules/lesson2/L2ThreeErrors')),
  'l2-11': lazy(() => import('./modules/lesson2/L2Secded')),
  'l2-12': lazy(() => import('./modules/lesson2/L2Params')),
  'l2-13': lazy(() => import('./modules/lesson2/L2Playground')),
  'l2-14': lazy(() => import('./modules/lesson2/L2Quiz')),
};

const Presentation = lazy(() => import('./modules/lesson2/Presentation'));
const Presentation1 = lazy(() => import('./modules/Presentation1'));
const PresentationAlgebra = lazy(() => import('./modules/algebra/Presentation'));
/** presentation decks: one per lesson plus the algebra chapter */
const DECKS: Record<string, ComponentType> = { 'present-1': Presentation1, present: Presentation, 'present-a': PresentationAlgebra };

function useHashRoute(): string {
  const read = () => {
    const raw = window.location.hash.replace(/^#\/?/, '').split(/[/?#]/)[0];
    // former pages that were merged: optional GF(8) page → A0, old A11 (decoder) → A10, old Hamming Bound chapter → chapter 4
    const id = raw === 'advanced' ? 'a-0' : raw === 'a-11' ? 'a-10' : raw === 'bound' ? 'distance' : raw;
    return PAGES[id] || DECKS[id] ? id : 'intro';
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onHash = () => {
      // in-page stage anchors look like "#encode-why"; only "#/<id>" changes the page
      if (!window.location.hash.startsWith('#/') && window.location.hash !== '') return;
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

function SharedMessageChip() {
  const { message } = useMessage();
  const c = encode74(message);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs">
      <div className="mb-1 text-slate-400">共用範例訊息 Shared message</div>
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-data-300">m = {message.join('')}</span>
        <span className="text-slate-500">→</span>
        <BitString bits={c} className="text-slate-100" highlight={(i) => ([0, 1, 3].includes(i) ? 'text-parity-300' : 'text-data-300')} />
      </div>
      <div className="mt-1 text-[11px] leading-snug text-slate-500">第一課第 1、2、3、6、7 章使用同一組訊息，方便串連觀念。</div>
    </div>
  );
}

function Sidebar({ route, onNavigate }: { route: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      <a href="#/intro" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-parity-500 via-data-500 to-overall-500 shadow-lg">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-base font-extrabold tracking-tight text-white">Hamming Lab</div>
          <div className="text-[11px] text-slate-400">錯誤更正碼互動實驗室</div>
        </div>
      </a>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="章節導覽">
        <div className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">第一課 Lesson 1</div>
        <ul className="space-y-0.5">
          {MODULES.filter((m) => !m.advanced && m.lesson !== 2 && m.group !== 'algebra').map((m) => (
            <NavItem key={m.id} m={m} active={route === m.id} onNavigate={onNavigate} />
          ))}
        </ul>
        <div className="mt-4 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">代數基礎與循環碼 Algebra & Cyclic Codes</div>
        <ul className="space-y-0.5">
          {MODULES.filter((m) => m.group === 'algebra').map((m) => (
            <NavItem key={m.id} m={m} active={route === m.id} onNavigate={onNavigate} />
          ))}
        </ul>
        <div className="mt-4 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">第二課 Lesson 2 · From Encoding to Error Correction</div>
        <ul className="space-y-0.5">
          {MODULES.filter((m) => m.lesson === 2).map((m) => (
            <NavItem key={m.id} m={m} active={route === m.id} onNavigate={onNavigate} />
          ))}
        </ul>
        <div className="mt-4 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">報告模式 Presentation Mode</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['#/present-1', '第一課'],
            ['#/present', '第二課'],
            ['#/present-a', '代數'],
          ].map(([href, text]) => (
            <a
              key={href}
              href={href}
              onClick={onNavigate}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              <PresentationIcon className="h-4 w-4 text-parity-300" />
              {text}
            </a>
          ))}
        </div>
      </nav>
      <div className="space-y-3 border-t border-slate-800 p-4">
        <SharedMessageChip />
        <div className="text-[11px] leading-relaxed text-slate-400">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">作者 Author</div>
          <div className="text-sm font-semibold text-slate-200">盧詠涵</div>
          <div>輔仁大學 數學系 資訊數學組</div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ m, active, onNavigate }: { m: (typeof MODULES)[number]; active: boolean; onNavigate?: () => void }) {
  return (
    <li>
      <a
        href={`#/${m.id}`}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}
      >
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold ${
            active ? 'bg-white text-slate-900' : m.group === 'algebra' ? 'bg-overall-500/20 text-overall-300' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
          }`}
        >
          {m.group === 'algebra' ? <span className="text-[10px]">{m.num}</span> : m.lesson === 2 ? <span className="text-[10px]">{m.num.slice(2)}</span> : m.num}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-snug">{m.title}</span>
          <span className="block truncate text-[11px] text-slate-500">{m.en}</span>
        </span>
      </a>
    </li>
  );
}

function Shell() {
  const route = useHashRoute();
  const [drawer, setDrawer] = useState(false);
  const Page = PAGES[route];
  const current = MODULES.find((m) => m.id === route);

  useEffect(() => {
    document.title = `${current ? current.title : '報告模式'} · Hamming Lab`;
  }, [current]);

  const DeckPage = DECKS[route];
  if (DeckPage) {
    return (
      <Suspense fallback={<div className="py-20 text-center text-slate-400">載入中…</div>}>
        <DeckPage />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen lg:pl-72">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <Sidebar route={route} />
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 text-white lg:hidden">
        <button type="button" onClick={() => setDrawer(true)} aria-label="開啟章節選單" className="rounded-lg p-1.5 hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="text-[11px] leading-none text-slate-400">Hamming Lab</div>
          <div className="truncate text-sm font-semibold">{current?.title}</div>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs shadow-2xl">
            <Sidebar route={route} onNavigate={() => setDrawer(false)} />
            <button type="button" onClick={() => setDrawer(false)} aria-label="關閉選單" className="absolute right-3 top-5 rounded-lg p-1.5 text-slate-300 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <Suspense fallback={<div className="py-20 text-center text-slate-400">載入中…</div>}>
          <Page key={route} />
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <MessageProvider>
      <Shell />
    </MessageProvider>
  );
}
