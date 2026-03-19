import { useQuery } from '@tanstack/react-query';
import { getCollection } from '@/lib/api';

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: async () => {
      if (!id) return null;
      const result = await getCollection(id);
      return result?.collection ?? null;
    },
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
