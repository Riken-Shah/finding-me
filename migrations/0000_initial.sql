-- Drop existing tables if they exist
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS pageviews;

-- Create events table
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    event_data TEXT NOT NULL,
    page_path TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create pageviews table
CREATE TABLE pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_path TEXT NOT NULL,
    user_agent TEXT,
    referrer TEXT,
    ip_address TEXT,
    country TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_events_event_name ON events(event_name);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_pageviews_page_path ON pageviews(page_path);
CREATE INDEX idx_pageviews_created_at ON pageviews(created_at); 