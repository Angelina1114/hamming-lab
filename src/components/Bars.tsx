import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface BarsProps {
  data: { x: number | string; y: number }[];
  xLabel: string;
  yLabel: string;
  /** bars with these x values get the accent colour */
  highlight?: (x: number | string) => boolean;
  color?: string;
  accent?: string;
  height?: number;
  tooltipLabel?: (x: number | string, y: number) => string;
}

/** Single-series bar chart (one hue, accent for the bars the text talks about). */
export function Bars({ data, xLabel, yLabel, highlight, color = '#94a3b8', accent = '#2a55e0', height = 200, tooltipLabel }: BarsProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 18, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="x"
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
            tick={{ fontSize: 11, fill: '#64748b' }}
            label={{ value: xLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#64748b' }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(v: number, _n, item) => [tooltipLabel ? tooltipLabel(item.payload.x, v) : v, yLabel]}
            labelFormatter={(l) => `${xLabel} = ${l}`}
          />
          <Bar dataKey="y" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={String(d.x)} fill={highlight?.(d.x) ? accent : color} />
            ))}
            <LabelList dataKey="y" position="top" fontSize={11} fill="#334155" formatter={(v: number) => (v === 0 ? '' : v)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
