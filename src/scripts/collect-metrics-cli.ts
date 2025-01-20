#!/usr/bin/env node
import { execSync } from 'child_process';

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

    // Create table if not exists
    const createTableQuery = `
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Execute create table query
    execSync(`wrangler d1 execute analytics-db --remote --command "${createTableQuery}"`, { stdio: 'inherit' });

    // Insert deployment metrics
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
        metrics_end_time
      ) VALUES (
        ${deployTime},
        ${buildTime},
        ${deploymentDuration},
        '${status}',
        '${environment}',
        '${commitSha}',
        '${branch}',
        ${currentStart},
        ${currentEnd}
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
    console.log('::endgroup::');

  } catch (error) {
    console.error('Failed to collect metrics:', error);
    process.exit(1);
  }
}

main(); 