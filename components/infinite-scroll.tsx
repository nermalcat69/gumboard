'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  threshold?: number;
  children: React.ReactNode;
}

export function InfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  threshold = 200,
  children,
}: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: `${threshold}px`,
      threshold: 0.1,
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleIntersection, threshold]);

  return (
    <>
      {children}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex justify-center items-center py-8"
        >
          {loading && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more notes...</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}