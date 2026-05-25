import { Layers, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function ResourceGroups() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs font-medium text-amber-700">
            Resource Groups is scheduled for an upcoming release. No action needed on your end.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Layers className="h-8 w-8 text-slate-400" />
            </div>
            <div className="max-w-sm space-y-2">
              <h2 className="text-sm font-semibold text-slate-700">Resource Groups</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Group VMs, storage, and hosts into logical collections for unified monitoring
                and reporting across teams or projects.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {['Custom groupings', 'Cross-resource views', 'Group-level reports'].map((feat) => (
                <span
                  key={feat}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-medium text-slate-500"
                >
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
