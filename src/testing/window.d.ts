import type { AsteroidsTestApi } from './testApi.ts';

declare global {
  interface Window {
    __ASTEROIDS_TEST_API__?: AsteroidsTestApi;
  }
}

export {};
