import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createTestLeaderboardClient } from '../testing/testLeaderboard.ts';

const LEADERBOARD_LIMIT = 10;

type LeaderboardRow = {
  created_at: string;
  id: number;
  initials: string;
  score: number;
};

export type LeaderboardEntry = {
  createdAt: string;
  id: number;
  initials: string;
  score: number;
};

export type LeaderboardSubmissionInput = {
  initials: string;
  score: number;
};

export type LeaderboardClient = {
  getTopScores: () => Promise<LeaderboardEntry[]>;
  isConfigured: boolean;
  submitScore: (input: LeaderboardSubmissionInput) => Promise<void>;
};

export function createLeaderboardClient(): LeaderboardClient {
  if (import.meta.env.MODE === 'test') {
    return createTestLeaderboardClient();
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      getTopScores: async () => {
        throw new Error(
          'Leaderboard is unavailable until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
        );
      },
      isConfigured: false,
      submitScore: async () => {
        throw new Error(
          'Leaderboard is unavailable until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
        );
      },
    };
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return {
    getTopScores: () => getTopScores(supabase),
    isConfigured: true,
    submitScore: (input) => submitScore(supabase, input),
  };
}

async function getTopScores(
  supabase: SupabaseClient,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('id, initials, score, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(LEADERBOARD_LIMIT);

  if (error) {
    throw new Error('Leaderboard load failed. Check Supabase access.');
  }

  return (data satisfies LeaderboardRow[]).map((entry) => ({
    createdAt: entry.created_at,
    id: entry.id,
    initials: entry.initials,
    score: entry.score,
  }));
}

async function submitScore(
  supabase: SupabaseClient,
  input: LeaderboardSubmissionInput,
): Promise<void> {
  const { error } = await supabase.from('leaderboard_entries').insert({
    initials: sanitizeInitials(input.initials),
    score: input.score,
  });

  if (error) {
    throw new Error('Score submission failed. Check Supabase access.');
  }
}

function sanitizeInitials(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}
