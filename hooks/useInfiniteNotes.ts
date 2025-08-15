import { useState, useEffect, useCallback } from 'react';
import { Note } from '@/components/note';

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

interface NotesResponse {
  notes: Note[];
  pagination: PaginationInfo;
}

interface UseInfiniteNotesReturn {
  notes: Note[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  addNote: (note: Note) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  removeNote: (noteId: string) => void;
}

export function useInfiniteNotes(boardId: string, limit: number = 20): UseInfiniteNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchNotes = useCallback(async (currentOffset: number, append: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/boards/${boardId}/notes?limit=${limit}&offset=${currentOffset}`);
      if (!response.ok) throw new Error('Failed to fetch notes');
      
      const data: NotesResponse = await response.json();
      
      setNotes(prev => append ? [...prev, ...data.notes] : data.notes);
      setHasMore(data.pagination.hasMore);
      setOffset(data.pagination.nextOffset || data.pagination.offset);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId, limit, loading]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchNotes(offset, true);
    }
  }, [fetchNotes, hasMore, loading, offset]);

  const refresh = useCallback(() => {
    setNotes([]);
    setOffset(0);
    setHasMore(true);
    fetchNotes(0, false);
  }, [fetchNotes]);

  const addNote = useCallback((note: Note) => {
    setNotes(prev => [note, ...prev]);
  }, []);

  const updateNote = useCallback((noteId: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, ...updates } : note
    ));
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
  }, []);

  // Initial load
  useEffect(() => {
    fetchNotes(0, false);
  }, [boardId]); // Only depend on boardId to avoid infinite loops

  return {
    notes,
    loading,
    hasMore,
    loadMore,
    refresh,
    addNote,
    updateNote,
    removeNote,
  };
}