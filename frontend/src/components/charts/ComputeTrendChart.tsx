import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ComputePoint } from '@/lib/api'

interface ComputeTrendChartProps {
  data: ComputePoint[]
}

function formatXAxis(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ComputeTrendChart({ data }: ComputeTrendChartProps) {
  const filtered = data.filter((_, i) => i % 3 === 0 || i === data.length - 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
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
          yAxisId="vcpu"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
          label={{
            value: 'vCPU',
            angle: -90,
            position: 'insideLeft',
            offset: 16,
            style: { fontSize: 9, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' },
          }}
        />
        <YAxis
          yAxisId="ram"
          orientation="right"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
          axisLine={false}
          tickLine={false}
          label={{
            value: 'GB',
            angle: 90,
            position: 'insideRight',
            offset: 16,
            style: { fontSize: 9, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' },
          }}
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
          formatter={(value: number, name: string) =>
            name === 'vcpu' ? [`${value} vCPU`, 'vCPU'] : [`${value} GB`, 'RAM']
          }
          cursor={{ fill: 'rgba(14,165,233,0.06)' }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          formatter={(value) => (value === 'vcpu' ? 'vCPU' : 'RAM (GB)')}
          wrapperStyle={{ fontSize: 10, color: '#94a3b8', paddingTop: 4, fontFamily: 'Plus Jakarta Sans' }}
        />
        <Bar yAxisId="vcpu" dataKey="vcpu" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={14} />
        <Bar yAxisId="ram" dataKey="ram_gb" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}
