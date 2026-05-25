import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { HostTrendPoint } from '@/lib/api'

interface HostTrendChartProps {
  data: HostTrendPoint[]
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HostTrendChart({ data }: HostTrendChartProps) {
  const chartData = data.map((d) => ({
    date: d.date,
    cpuPct: d.cpu_total > 0 ? Math.round((d.cpu_allocated / d.cpu_total) * 100) : 0,
    memPct: d.memory_total_gb > 0 ? Math.round((d.memory_allocated_gb / d.memory_total_gb) * 100) : 0,
    cpuLabel: `${d.cpu_allocated} / ${d.cpu_total} vCPU`,
    memLabel: `${d.memory_allocated_gb} / ${d.memory_total_gb} GB`,
  }))

  const filtered = chartData.filter((_, i) => i % 3 === 0 || i === chartData.length - 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 20, left: -16, bottom: 0 }}>
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
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
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
          formatter={(value: number, name: string, props: { payload?: { cpuLabel: string; memLabel: string } }) => {
            const extra = name === 'cpuPct' ? props.payload?.cpuLabel : props.payload?.memLabel
            return [`${value}% (${extra ?? ''})`, name === 'cpuPct' ? 'CPU Allocated' : 'Memory Allocated']
          }}
          cursor={{ stroke: '#e2e8f0' }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          formatter={(value) => (value === 'cpuPct' ? 'CPU Allocation %' : 'Memory Allocation %')}
          wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 4, fontFamily: 'Plus Jakarta Sans' }}
        />
        <Line
          type="monotone"
          dataKey="cpuPct"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={chartData.length <= 5 ? { r: 4, fill: '#f59e0b', strokeWidth: 0 } : { r: 2, fill: '#f59e0b', strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="memPct"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={chartData.length <= 5 ? { r: 4, fill: '#0ea5e9', strokeWidth: 0 } : { r: 2, fill: '#0ea5e9', strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
