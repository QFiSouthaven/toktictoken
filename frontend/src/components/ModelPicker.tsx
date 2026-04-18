import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface Model {
  id: string;
}

export function ModelPicker({
  chatId,
  currentModel,
}: {
  chatId: number;
  currentModel: string | null;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['models'],
    queryFn: () => api.get<{ models: Model[] }>('/api/models'),
    staleTime: 30_000,
  });

  async function change(model: string) {
    await api.patch(`/api/chats/${chatId}`, { model: model || null });
    await qc.invalidateQueries({ queryKey: ['chat', chatId] });
    await qc.invalidateQueries({ queryKey: ['chats'] });
  }

  if (q.isError) {
    return <span className="muted small">LM Studio unreachable</span>;
  }

  const models = q.data?.models ?? [];
  return (
    <select
      className="model-picker"
      value={currentModel ?? ''}
      onChange={(e) => change(e.target.value)}
      disabled={models.length === 0}
    >
      <option value="">{models.length === 0 ? 'no models' : 'default'}</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.id}
        </option>
      ))}
    </select>
  );
}
