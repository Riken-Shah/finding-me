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

    // Execute the insert query
    execSync(`wrangler d1 execute analytics-db --command "${insertQuery}"`, { stdio: 'inherit' });

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