import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { StorageCapacityPoint } from '@/lib/api'

interface StorageCapacityTrendChartProps {
  data: StorageCapacityPoint[]
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StorageCapacityTrendChart({ data }: StorageCapacityTrendChartProps) {
  const chartData = data.map((d) => ({
    date: d.date,
    used: d.capacity_used_tb,
    free: Math.max(0, +(d.capacity_total_tb - d.capacity_used_tb).toFixed(2)),
    total: d.capacity_total_tb,
    usedPct:
      d.capacity_total_tb > 0
        ? Math.round((d.capacity_used_tb / d.capacity_total_tb) * 100)
        : 0,
  }))

  const filtered = chartData.filter((_, i) => i % 3 === 0 || i === chartData.length - 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 20, left: -4, bottom: 0 }} stackOffset="none">
        <defs>
          <linearGradient id="gradUsed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.75} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.15} />
          </linearGradient>
          <linearGradient id="gradFree" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e2e8f0" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#e2e8f0" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="4 4" />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          ticks={filtered.map((d) => d.date)}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v} TB`}
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
          labelFormatter={(l: string) =>
            new Date(l).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          }
          formatter={(value: number, name: string, props: { payload?: { usedPct: number } }) => {
            if (name === 'used')
              return [`${value.toFixed(2)} TB (${props.payload?.usedPct ?? 0}% utilized)`, 'Used']
            if (name === 'free') return [`${value.toFixed(2)} TB`, 'Free']
            return [value, name]
          }}
          cursor={{ stroke: '#e2e8f0' }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          formatter={(value) => (value === 'used' ? 'Used' : 'Free')}
          wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 4, fontFamily: 'Plus Jakarta Sans' }}
        />
        <Area
          type="monotone"
          dataKey="free"
          stackId="1"
          stroke="#cbd5e1"
          fill="url(#gradFree)"
          strokeWidth={1}
          dot={chartData.length <= 5 ? { r: 3, fill: '#cbd5e1', strokeWidth: 0 } : false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="used"
          stackId="1"
          stroke="#8b5cf6"
          fill="url(#gradUsed)"
          strokeWidth={2}
          dot={chartData.length <= 5 ? { r: 3, fill: '#8b5cf6', strokeWidth: 0 } : false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
