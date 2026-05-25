import { useCurrentUser } from './useCurrentUser'
import type { AppModule } from '@/lib/api'

export function usePermission(module: AppModule): { view: boolean; manage: boolean } {
  const { data: user } = useCurrentUser()
  if (!user) return { view: false, manage: false }
  return user.permissions[module]
}
