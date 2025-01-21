-- Create deployment_metrics table
CREATE TABLE deployment_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deploy_time INTEGER NOT NULL,
  build_time INTEGER NOT NULL,
  deployment_duration INTEGER NOT NULL,
  status TEXT NOT NULL,
  environment TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  metrics_start_time INTEGER NOT NULL,
  metrics_end_time INTEGER NOT NULL,
  bounce_rate REAL,
  avg_time_spent_seconds REAL,
  total_visitors INTEGER,
  conversion_rate REAL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Create indexes for better query performance
CREATE INDEX idx_deployment_metrics_deploy_time ON deployment_metrics(deploy_time);
CREATE INDEX idx_deployment_metrics_environment ON deployment_metrics(environment);
CREATE INDEX idx_deployment_metrics_status ON deployment_metrics(status);
CREATE INDEX idx_deployment_metrics_metrics_time ON deployment_metrics(metrics_start_time, metrics_end_time); 