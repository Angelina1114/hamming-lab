import type { Bit } from '../../core';
import { BitStrip } from './Common';
import { usePresenting } from '../../lib/presenting';

/** The unified Lesson 2 examples. Only error positions are listed; every value shown is computed. */
export const L2_PRESETS: { key: string; label: string; errors: number[] }[] = [
  { key: 'none', label: '正常傳送', errors: [] },
  { key: 'single', label: '單一錯誤（位置 2）', errors: [2] },
  { key: 'double', label: '兩個錯誤（位置 2、7）', errors: [2, 7] },
  { key: 'triple', label: '三個錯誤（x³、x¹、x⁰）', errors: [4, 6, 7] },
];

export function MessagePicker({ u, onChange, size = 'md' }: { u: Bit[]; onChange: (u: Bit[]) => void; size?: 'sm' | 'md' | 'lg' }) {
  const presenting = usePresenting();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-semibold text-slate-500">訊息 u{!presenting && '（點擊切換）'}</span>
      <BitStrip bits={u} topExp={3} roles={['info', 'info', 'info', 'info']} groups={false} size={size} onToggle={(i) => onChange(u.map((b, j) => (j === i ? ((1 - b) as Bit) : b)))} />
    </div>
  );
}

export function PresetButtons({ errors, onPick, presets = L2_PRESETS }: { errors: number[]; onPick: (e: number[]) => void; presets?: typeof L2_PRESETS }) {
  const key = errors.slice().sort((a, b) => a - b).join(',');
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((p) => (
        <button key={p.key} type="button" className={`btn-ghost !py-1 text-xs ${p.errors.join(',') === key ? '!border-slate-900 !bg-slate-900 !text-white' : ''}`} onClick={() => onPick(p.errors)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** toggle a 1-based position in an error list, keeping at most `max` positions */
export function toggleError(errors: number[], pos: number, max = 3): number[] {
  if (errors.includes(pos)) return errors.filter((p) => p !== pos);
  if (errors.length >= max) return [...errors.slice(1), pos].sort((a, b) => a - b);
  return [...errors, pos].sort((a, b) => a - b);
}
