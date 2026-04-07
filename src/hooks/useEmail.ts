import { useState, useCallback } from 'react';
import axios from 'axios';
import type { StatusMessage, Template } from '../types/email';

interface EmailState {
  prompt: string;
  draft: string;
  subject: string;
  recipient: string;
  tags: string[];
  context: string | null;
  lastPrompt: string; // For regenerate feature
}

interface UseEmailOptions {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export function useEmail(options: UseEmailOptions = {}) {
  const [state, setState] = useState<EmailState>({
    prompt: '',
    draft: '',
    subject: '',
    recipient: '',
    tags: [],
    context: null,
    lastPrompt: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateStyle, setSelectedTemplateStyle] = useState<string | null>(null);

  // Setters
  const setPrompt = (prompt: string) => setState(s => ({ ...s, prompt }));
  const setDraft = (draft: string) => setState(s => ({ ...s, draft }));
  const setSubject = (subject: string) => setState(s => ({ ...s, subject }));
  const setRecipient = (recipient: string) => setState(s => ({ ...s, recipient }));
  const setTags = (tags: string[]) => setState(s => ({ ...s, tags }));

  const showStatus = useCallback((type: 'success' | 'error', message: string, duration = 3000) => {
    setStatus({ type, message });
    if (duration > 0) {
      setTimeout(() => setStatus(null), duration);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await axios.get('/api/templates');
      setTemplates(res.data);
    } catch {
      console.error('Failed to fetch templates');
    }
  }, []);

  const generate = useCallback(async (promptOverride?: string) => {
    const promptToUse = promptOverride || state.prompt;
    if (!promptToUse.trim() || isLoading) return;

    setIsLoading(true);
    setStatus(null);
    setState(s => ({ ...s, context: null, lastPrompt: promptToUse }));

    try {
      // Fetch context first
      const contextRes = await axios.get(`/api/context?query=${encodeURIComponent(promptToUse)}`);
      const retrievedContext = contextRes.data.context;
      setState(s => ({ ...s, context: retrievedContext }));

      // Generate email
      const genRes = await axios.post('/api/generate', {
        prompt: promptToUse,
        context: retrievedContext,
        templateType: selectedTemplateStyle,
      });

      setState(s => ({
        ...s,
        draft: genRes.data.draft,
        subject: genRes.data.subject || s.subject || promptToUse.split(' ').slice(0, 5).join(' '),
      }));

      options.onSuccess?.();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to generate email';
      showStatus('error', errorMsg, 5000);
      options.onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [state.prompt, isLoading, selectedTemplateStyle, options, showStatus]);

  const regenerate = useCallback(() => {
    if (state.lastPrompt) {
      generate(state.lastPrompt);
    }
  }, [state.lastPrompt, generate]);

  const save = useCallback(async () => {
    if (!state.draft || !state.subject) {
      showStatus('error', 'Subject and content are required');
      return;
    }

    try {
      await axios.post('/api/save', {
        subject: state.subject,
        content: state.draft,
        tags: state.tags,
        recipient: state.recipient,
      });
      showStatus('success', 'Email saved successfully!');
      setState(s => ({ ...s, tags: [] }));
      options.onSuccess?.();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to save';
      showStatus('error', errorMsg);
    }
  }, [state, options, showStatus]);

  const copyToClipboard = useCallback(async (includeSubject = false) => {
    try {
      const textToCopy = includeSubject && state.subject
        ? `Subject: ${state.subject}\n\n${state.draft}`
        : state.draft;
      await navigator.clipboard.writeText(textToCopy);
      showStatus('success', includeSubject ? 'Copied with subject!' : 'Draft copied!');
    } catch {
      showStatus('error', 'Failed to copy');
    }
  }, [state.draft, state.subject, showStatus]);

  const clear = useCallback(() => {
    setState({
      prompt: '',
      draft: '',
      subject: '',
      recipient: '',
      tags: [],
      context: null,
      lastPrompt: '',
    });
    setStatus(null);
  }, []);

  const addTag = useCallback((tag: string) => {
    if (tag.trim() && !state.tags.includes(tag.trim())) {
      setState(s => ({ ...s, tags: [...s.tags, tag.trim()] }));
    }
  }, [state.tags]);

  const removeTag = useCallback((tagToRemove: string) => {
    setState(s => ({ ...s, tags: s.tags.filter(t => t !== tagToRemove) }));
  }, []);

  return {
    // State
    prompt: state.prompt,
    draft: state.draft,
    subject: state.subject,
    recipient: state.recipient,
    tags: state.tags,
    context: state.context,
    lastPrompt: state.lastPrompt,
    isLoading,
    status,
    templates,
    selectedTemplateStyle,

    // Setters
    setPrompt,
    setDraft,
    setSubject,
    setRecipient,
    setTags,
    setSelectedTemplateStyle,
    setStatus,

    // Actions
    generate,
    regenerate,
    save,
    copyToClipboard,
    clear,
    addTag,
    removeTag,
    fetchTemplates,
    showStatus,
  };
}
