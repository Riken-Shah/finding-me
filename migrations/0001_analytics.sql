-- Drop existing tables if they exist
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS pageviews;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS heatmap_data;

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  total_time_ms INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 1,
  is_bounce BOOLEAN DEFAULT 1,
  is_returning BOOLEAN DEFAULT 0,
  device TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create pageviews table
CREATE TABLE IF NOT EXISTS pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  time_on_page_ms INTEGER DEFAULT 0,
  max_scroll_percentage INTEGER DEFAULT 0,
  entry_page BOOLEAN DEFAULT 0,
  exit_page BOOLEAN DEFAULT 0,
  viewport_width INTEGER,
  viewport_height INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_data TEXT,
  timestamp DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Create heatmap_data table for click tracking
CREATE TABLE heatmap_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  x_coordinate INTEGER NOT NULL,
  y_coordinate INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  element_clicked TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device);
CREATE INDEX IF NOT EXISTS idx_sessions_country ON sessions(country);
CREATE INDEX IF NOT EXISTS idx_sessions_city ON sessions(city);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON sessions(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_pageviews_session ON pageviews(session_id);
CREATE INDEX IF NOT EXISTS idx_pageviews_timestamp ON pageviews(timestamp);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON pageviews(page_path);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);

CREATE INDEX idx_heatmap_session_id ON heatmap_data(session_id);
CREATE INDEX idx_heatmap_page_path ON heatmap_data(page_path); 