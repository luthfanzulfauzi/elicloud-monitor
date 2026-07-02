import { useQuery } from '@tanstack/react-query'
import { fetchMe } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: isAuthenticated(),
    staleTime: 0,
    refetchInterval: 4 * 60 * 1000,      // ping /auth/me every 4 min → keeps last_active_at fresh
    refetchOnWindowFocus: true,           // immediately ping when user returns to tab
    retry: false,
  })
}
