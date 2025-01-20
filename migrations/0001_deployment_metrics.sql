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
  created_at INTEGER DEFAULT (unixepoch())
);

-- Create indexes for better query performance
CREATE INDEX idx_deployment_metrics_deploy_time ON deployment_metrics(deploy_time);
CREATE INDEX idx_deployment_metrics_environment ON deployment_metrics(environment);
CREATE INDEX idx_deployment_metrics_status ON deployment_metrics(status); 