import { useQuery } from '@tanstack/react-query'
import { fetchMe } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: isAuthenticated(),
    staleTime: Infinity,
    retry: false,
  })
}
