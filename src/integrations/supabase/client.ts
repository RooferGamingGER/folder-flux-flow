// SELF-HOSTED VERSION - Manually configured for nobis-overdick.digital
// This file is normally auto-generated, but for self-hosted we override it
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Self-hosted Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nobis-overdick.digital/api';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'WlfcSIeL2PrnArmA0y4sqy8jLHMRYg8BAJLbvUIg';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});