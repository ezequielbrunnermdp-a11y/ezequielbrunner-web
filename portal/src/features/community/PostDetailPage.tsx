import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { rpc } from '@/lib/supabase';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui';
import { PostCard, type FeedPost } from './PostCard';

export function PostDetailPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['feed', 'post', id], queryFn: async () => (await rpc<FeedPost[]>('feed_post', { p_id: id }))[0] ?? null });
  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/comunidad" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2"><ArrowLeft className="h-4 w-4" />Comunidad</Link>
      {q.isLoading ? <LoadingList rows={1} /> : q.isError ? <ErrorState error={q.error} /> : !q.data
        ? <EmptyState icon={<FileQuestion className="h-5 w-5" />} title="Publicación no disponible" description="Puede haber sido eliminada o no tenés acceso." />
        : <PostCard post={q.data} detail />}
    </div>
  );
}
