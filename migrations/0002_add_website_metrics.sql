-- Add website performance metrics columns
ALTER TABLE deployment_metrics ADD COLUMN total_sessions INTEGER;
ALTER TABLE deployment_metrics ADD COLUMN total_pageviews INTEGER;
ALTER TABLE deployment_metrics ADD COLUMN bounce_rate REAL;
ALTER TABLE deployment_metrics ADD COLUMN engagement_rate REAL;
ALTER TABLE deployment_metrics ADD COLUMN avg_time_spent REAL;

-- Add Core Web Vitals columns
ALTER TABLE deployment_metrics ADD COLUMN avg_fcp REAL;
ALTER TABLE deployment_metrics ADD COLUMN avg_lcp REAL;
ALTER TABLE deployment_metrics ADD COLUMN avg_cls REAL;

-- Add comparison metrics columns
ALTER TABLE deployment_metrics ADD COLUMN sessions_change REAL;
ALTER TABLE deployment_metrics ADD COLUMN pageviews_change REAL;
ALTER TABLE deployment_metrics ADD COLUMN bounce_rate_change REAL;
ALTER TABLE deployment_metrics ADD COLUMN engagement_rate_change REAL;

-- Add time window columns for context
ALTER TABLE deployment_metrics ADD COLUMN metrics_start_time INTEGER;
ALTER TABLE deployment_metrics ADD COLUMN metrics_end_time INTEGER; 