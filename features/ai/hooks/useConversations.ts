import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConversations, deleteConversation } from '@/lib/api';

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export function useConversationsList() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const result = await getConversations();
      return (result?.conversations ?? []) as Conversation[];
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previous = queryClient.getQueryData<Conversation[]>(['conversations']);
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
        old?.filter((c) => c.id !== conversationId) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversations'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
