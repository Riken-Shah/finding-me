#!/usr/bin/env node
import { collectAndSaveMetrics } from './collect-deployment-metrics';

async function main() {
  const [deployTime, buildTime, status, environment, commitSha, branch] = process.argv.slice(2);
  
  if (!deployTime || !buildTime || !status || !environment || !commitSha || !branch) {
    console.error('Usage: collect-metrics-cli.ts <deployTime> <buildTime> <status> <environment> <commitSha> <branch>');
    process.exit(1);
  }
  
  try {
    // Pass an empty context for CLI usage - it will use process.env.DB
    await collectAndSaveMetrics({
      deployTime: parseInt(deployTime, 10),
      buildTime: parseInt(buildTime, 10),
      status,
      environment,
      commitSha,
      branch
    }, {});
  } catch (error) {
    console.error('Failed to collect metrics:', error);
    process.exit(1);
  }
}

main(); 