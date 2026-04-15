import type {
  LeaderboardClient,
  LeaderboardEntry,
  LeaderboardSubmissionInput,
} from '../services/leaderboardClient.ts';

type TestLeaderboardState = {
  entries: LeaderboardEntry[];
  failLoad: boolean;
  failSubmit: boolean;
  nextId: number;
};

const state: TestLeaderboardState = {
  entries: [],
  failLoad: false,
  failSubmit: false,
  nextId: 1,
};

export function createTestLeaderboardClient(): LeaderboardClient {
  return {
    getTopScores: async () => {
      if (state.failLoad) {
        throw new Error('Leaderboard load failed. Check Supabase access.');
      }

      return [...state.entries]
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }

          return left.createdAt.localeCompare(right.createdAt);
        })
        .slice(0, 10);
    },
    isConfigured: true,
    submitScore: async (input) => {
      if (state.failSubmit) {
        throw new Error('Score submission failed. Check Supabase access.');
      }

      state.entries.push({
        createdAt: new Date().toISOString(),
        id: state.nextId++,
        initials: sanitizeInitials(input.initials),
        score: input.score,
      });
    },
  };
}

export function resetTestLeaderboard(entries: LeaderboardSubmissionInput[] = []): void {
  state.entries = entries.map((entry) => ({
    createdAt: new Date().toISOString(),
    id: state.nextId++,
    initials: sanitizeInitials(entry.initials),
    score: entry.score,
  }));
  state.failLoad = false;
  state.failSubmit = false;
}

export function setTestLeaderboardFailure(patch: {
  failLoad?: boolean;
  failSubmit?: boolean;
}): void {
  if (typeof patch.failLoad === 'boolean') {
    state.failLoad = patch.failLoad;
  }

  if (typeof patch.failSubmit === 'boolean') {
    state.failSubmit = patch.failSubmit;
  }
}

function sanitizeInitials(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}
