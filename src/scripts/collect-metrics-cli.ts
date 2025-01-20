#!/usr/bin/env node
import { execSync } from 'child_process';

function extractJsonFromWranglerOutput(output: string): any {
  // Find the first '[' character which indicates the start of JSON
  const jsonStartIndex = output.indexOf('[');
  if (jsonStartIndex === -1) {
    throw new Error('No JSON data found in wrangler output');
  }
  
  // Extract everything from the first '[' to the end
  const jsonStr = output.substring(jsonStartIndex);
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(`Failed to parse JSON from wrangler output: ${error}`);
  }
}

async function main() {
  const [deployTime, buildTime, status, environment, commitSha, branch] = process.argv.slice(2);
  
  if (!deployTime || !buildTime || !status || !environment || !commitSha || !branch) {
    console.error('Usage: collect-metrics-cli.ts <deployTime> <buildTime> <status> <environment> <commitSha> <branch>');
    process.exit(1);
  }

  try {
    const currentEnd = Math.floor(Date.now() / 1000);
    const currentStart = currentEnd - 86400;
    const previousEnd = currentStart;
    const previousStart = previousEnd - 86400;

    const deploymentDuration = parseInt(deployTime) - parseInt(buildTime);

    // Create deployment metrics table if not exists
    const createDeploymentTableQuery = `
      CREATE TABLE IF NOT EXISTS deployment_metrics (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Execute create table query
    execSync(`wrangler d1 execute analytics-db --remote --command "${createDeploymentTableQuery}"`, { stdio: 'inherit' });

    // Get analytics metrics for the deployment timeframe
    const analyticsQuery = `
      WITH session_metrics AS (
        SELECT 
          COUNT(DISTINCT pv.session_id) as total_visitors,
          ROUND(
            CAST(
              SUM(CASE WHEN (
                SELECT COUNT(*) 
                FROM page_views pv2 
                WHERE pv2.session_id = pv.session_id
                AND pv2.timestamp >= ${currentStart}
                AND pv2.timestamp <= ${currentEnd}
              ) = 1 THEN 1 ELSE 0 END) AS FLOAT
            ) / NULLIF(COUNT(DISTINCT pv.session_id), 0) * 100,
            2
          ) as bounce_rate,
          ROUND(
            AVG(
              CASE 
                WHEN (
                  SELECT COUNT(*) 
                  FROM page_views pv3 
                  WHERE pv3.session_id = pv.session_id
                  AND pv3.timestamp >= ${currentStart}
                  AND pv3.timestamp <= ${currentEnd}
                ) > 1 
                THEN COALESCE(
                  (
                    SELECT MAX(time_spent)
                    FROM page_views pv4
                    WHERE pv4.session_id = pv.session_id
                    AND pv4.timestamp >= ${currentStart}
                    AND pv4.timestamp <= ${currentEnd}
                  ), 0
                )
                ELSE 0 
              END
            ),
            2
          ) as avg_time_spent_seconds,
          ROUND(
            CAST(
              COUNT(DISTINCT CASE 
                WHEN e.event_name = 'conversion' 
                AND e.timestamp >= ${currentStart}
                AND e.timestamp <= ${currentEnd}
                THEN pv.session_id 
              END) AS FLOAT
            ) / NULLIF(COUNT(DISTINCT pv.session_id), 0) * 100,
            2
          ) as conversion_rate
        FROM page_views pv
        LEFT JOIN events e ON e.session_id = pv.session_id
        WHERE pv.timestamp >= ${currentStart} 
        AND pv.timestamp <= ${currentEnd}
      )
      SELECT 
        total_visitors,
        bounce_rate,
        avg_time_spent_seconds,
        conversion_rate
      FROM session_metrics;
    `;

    // Get analytics metrics
    const analyticsOutput = execSync(`wrangler d1 execute analytics-db --remote --command "${analyticsQuery}"`, { encoding: 'utf-8' });
    const analyticsJson = extractJsonFromWranglerOutput(analyticsOutput);
    const { total_visitors, bounce_rate, avg_time_spent_seconds, conversion_rate } = analyticsJson[0]?.results[0] || {
      total_visitors: 0,
      bounce_rate: 0,
      avg_time_spent_seconds: 0,
      conversion_rate: 0
    };

    // Insert deployment metrics with analytics
    const insertQuery = `
      INSERT INTO deployment_metrics (
        deploy_time,
        build_time,
        deployment_duration,
        status,
        environment,
        commit_sha,
        branch,
        metrics_start_time,
        metrics_end_time,
        bounce_rate,
        avg_time_spent_seconds,
        total_visitors,
        conversion_rate
      ) VALUES (
        ${deployTime},
        ${buildTime},
        ${deploymentDuration},
        '${status}',
        '${environment}',
        '${commitSha}',
        '${branch}',
        ${currentStart},
        ${currentEnd},
        ${bounce_rate},
        ${avg_time_spent_seconds},
        ${total_visitors},
        ${conversion_rate}
      );
    `;

    // Execute the insert query with --remote flag
    execSync(`wrangler d1 execute analytics-db --remote --command "${insertQuery}"`, { stdio: 'inherit' });

    console.log('::group::Deployment Metrics');
    console.log(`Deploy Time: ${deployTime}`);
    console.log(`Build Time: ${buildTime}`);
    console.log(`Duration: ${deploymentDuration} seconds`);
    console.log(`Status: ${status}`);
    console.log(`Environment: ${environment}`);
    console.log(`Commit SHA: ${commitSha}`);
    console.log(`Branch: ${branch}`);
    console.log('\nAnalytics Metrics:');
    console.log(`Total Visitors: ${total_visitors}`);
    console.log(`Bounce Rate: ${bounce_rate}%`);
    console.log(`Avg Time Spent: ${avg_time_spent_seconds} seconds`);
    console.log(`Conversion Rate: ${conversion_rate}%`);
    console.log('::endgroup::');

  } catch (error) {
    console.error('Failed to collect metrics:', error);
    process.exit(1);
  }
}

main(); 