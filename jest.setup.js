// Mock D1 types
global.D1Database = class {
  prepare() { return this; }
  bind() { return this; }
  first() { return null; }
  all() { return []; }
  run() { return { success: true }; }
};

// Mock process.env
process.env = {
  ...process.env,
  DB: new global.D1Database(),
}; 