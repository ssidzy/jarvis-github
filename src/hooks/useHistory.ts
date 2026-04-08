import { useState, useCallback } from 'react';
import api from '../lib/api';
import type { HistoryItem, ViewingEmail } from '../types/email';

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [viewingEmail, setViewingEmail] = useState<ViewingEmail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/api/history');
      setHistory(res.data);
    } catch {
      console.error('Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchByDate = useCallback(async (date: string) => {
    setSelectedDate(date);
    try {
      const res = await api.get(`/api/search?date=${date}`);
      setSearchResults(res.data);
    } catch {
      console.error('Search failed');
    }
  }, []);

  const searchByKeyword = useCallback(async (keyword: string) => {
    try {
      const res = await api.get(`/api/search?keyword=${encodeURIComponent(keyword)}`);
      setSearchResults(res.data);
    } catch {
      console.error('Search failed');
    }
  }, []);

  const searchByTag = useCallback(async (tag: string) => {
    try {
      const res = await api.get(`/api/search?tag=${encodeURIComponent(tag)}`);
      setSearchResults(res.data);
    } catch {
      console.error('Search failed');
    }
  }, []);

  const viewEmail = useCallback(async (date: string, filename: string): Promise<boolean> => {
    try {
      const res = await api.get(`/api/email/${encodeURIComponent(date)}/${encodeURIComponent(filename)}`);
      setViewingEmail(res.data);
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearViewing = useCallback(() => {
    setViewingEmail(null);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSelectedDate(undefined);
  }, []);

  const datesWithEmails = history.map(h => h.date);

  return {
    history,
    selectedDate,
    searchResults,
    viewingEmail,
    isLoading,
    datesWithEmails,

    fetchHistory,
    searchByDate,
    searchByKeyword,
    searchByTag,
    viewEmail,
    clearViewing,
    clearSearch,
    setSelectedDate,
  };
}
