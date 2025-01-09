interface DB {
  prepare: (sql: string) => any;
  run: (sql: string, params?: any[]) => any;
  get: (sql: string, params?: any[]) => any;
  all: (sql: string, params?: any[]) => any[];
}

let db: DB | null = null;

export function getDB(): DB {
  if (!db) {
    // In a real application, this would initialize a database connection
    // For testing, we'll use a mock implementation
    db = {
      prepare: jest.fn(),
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    };
  }
  return db;
} 