'use client';

import { useState, useEffect } from 'react';
import { InfiniteScroll } from '@/components/infinite-scroll';
import { Note } from '@/components/note';
import type { Note as NoteType } from '@/components/note';

// Mock data generator
const generateMockNote = (id: number): NoteType => ({
  id: `note-${id}`,
  color: ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#fed7d7'][id % 5],
  archivedAt: null,
  createdAt: new Date(Date.now() - id * 1000 * 60 * 60).toISOString(),
  updatedAt: new Date(Date.now() - id * 1000 * 60 * 60).toISOString(),
  boardId: 'demo-board',
  user: {
    id: 'demo-user',
    name: `User ${Math.floor(id / 5) + 1}`,
    email: `user${Math.floor(id / 5) + 1}@example.com`,
  },
  checklistItems: [
    {
      id: `item-${id}-1`,
      content: `Task ${id}: Complete project milestone`,
      checked: Math.random() > 0.5,
      order: 0,
    },
    {
      id: `item-${id}-2`,
      content: `Task ${id}: Review and update documentation`,
      checked: Math.random() > 0.5,
      order: 1,
    },
  ],
});

export default function InfiniteScrollDemo() {
  const [notes, setNotes] = useState<NoteType[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  // Simulate API call
  const loadMoreNotes = async () => {
    if (loading) return;
    
    setLoading(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newNotes = Array.from({ length: limit }, (_, i) => 
      generateMockNote(offset + i)
    );
    
    setNotes(prev => [...prev, ...newNotes]);
    setOffset(prev => prev + limit);
    
    // Stop loading after 50 notes for demo
    if (offset + limit >= 50) {
      setHasMore(false);
    }
    
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    loadMoreNotes();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-800 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Infinite Scroll Demo</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Scroll down to load more notes automatically. This demonstrates pagination with 10 notes per batch.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Loaded: {notes.length} notes | Has more: {hasMore ? 'Yes' : 'No'}
          </p>
        </div>
        
        <InfiniteScroll
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMoreNotes}
          threshold={300}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {notes.map((note) => (
              <div key={note.id} className="h-fit">
                <Note
                  note={note}
                  readonly={true}
                  syncDB={false}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </InfiniteScroll>
        
        {!hasMore && (
          <div className="text-center py-8">
            <p className="text-gray-500">🎉 You've reached the end! All notes loaded.</p>
          </div>
        )}
      </div>
    </div>
  );
}