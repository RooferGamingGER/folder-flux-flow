import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export function useThemePreference() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Theme aus DB laden
  const { data: dbTheme } = useQuery({
    queryKey: ['theme-preference', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('theme_preference')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data?.theme_preference || 'system';
    },
    enabled: !!user,
  });

  // Bei Login: Theme aus DB anwenden
  useEffect(() => {
    if (dbTheme && theme !== dbTheme) {
      setTheme(dbTheme);
    }
  }, [dbTheme, theme, setTheme]);

  // Theme in DB speichern
  const updateTheme = useMutation({
    mutationFn: async (newTheme: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', user.id);
      
      if (error) throw error;
      return newTheme;
    },
    onSuccess: (newTheme) => {
      setTheme(newTheme);
      queryClient.invalidateQueries({ queryKey: ['theme-preference', user?.id] });
      toast({
        title: `${newTheme === 'dark' ? '🌙 Dunkel' : newTheme === 'light' ? '☀️ Hell' : '🔄 System'} Modus aktiviert`,
        description: 'Einstellung wurde gespeichert',
        duration: 1500,
      });
    },
    onError: (error) => {
      console.error('Theme update failed:', error);
      toast({
        title: 'Fehler',
        description: 'Theme konnte nicht gespeichert werden',
        variant: 'destructive',
      });
    },
  });

  return {
    theme,
    setTheme: updateTheme.mutate,
    isLoading: updateTheme.isPending,
  };
}
