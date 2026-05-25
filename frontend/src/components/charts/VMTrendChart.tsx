import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { VMTrendPoint } from '@/lib/api'

interface VMTrendChartProps {
  data: VMTrendPoint[]
}

function formatXAxis(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function VMTrendChart({ data }: VMTrendChartProps) {
  const filtered = data.filter((_, i) => i % 3 === 0 || i === data.length - 1)
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="4 4" />
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxis}
          ticks={filtered.map((d) => d.date)}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: 12,
            fontFamily: 'Plus Jakarta Sans',
          }}
          labelFormatter={(label: string) =>
            new Date(label).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          }
          formatter={(value: number) => [value, 'VMs created']}
          cursor={{ fill: 'rgba(14,165,233,0.06)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.count === max ? '#0ea5e9' : entry.count === 0 ? '#e2e8f0' : '#38bdf8'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
