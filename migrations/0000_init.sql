-- Create sessions table
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  start_time INTEGER,
  end_time INTEGER,
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,
  device_type TEXT,
  country TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL
);

-- Create page_views table
CREATE TABLE page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  page TEXT,
  timestamp INTEGER,
  time_spent INTEGER,
  scroll_depth INTEGER,
  ttfb REAL,
  fcp REAL,
  lcp REAL,
  cls REAL,
  fid REAL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

-- Create events table
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_name TEXT,
  element TEXT,
  href TEXT,
  timestamp INTEGER,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_sessions_timestamp ON sessions(start_time);
CREATE INDEX idx_pageviews_session ON page_views(session_id);
CREATE INDEX idx_pageviews_timestamp ON page_views(timestamp);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_timestamp ON events(timestamp); 