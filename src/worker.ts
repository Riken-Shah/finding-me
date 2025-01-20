export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env) {
    return new Response('Worker is running');
  },
}; 