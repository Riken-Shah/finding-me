import { analyzeRepo, RepoAnalysis, UiChange, applyChanges, commitAndPush, setupRepo, PageAnalysis, FileChange } from './utils';
import simpleGit from 'simple-git';

export interface Env {
	// If you set another name in wrangler.toml as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: Ai;
	DB: D1Database;
	GITHUB_TOKEN: string;
}

interface DeploymentMetrics {
	id: number;
	deploy_time: number;
	build_time: number;
	deployment_duration: number;
	status: string;
	environment: string;
	commit_sha: string;
	branch: string;
	metrics_start_time: number;
	metrics_end_time: number;
	bounce_rate: number;
	avg_time_spent_seconds: number;
	total_visitors: number;
	conversion_rate: number;
	created_at: number;
}

// Define specific UI change types
type UiChangeType = 
	| 'TEXT_CHANGE'        // Changes to text content, wording, or messaging
	| 'SPACING'            // Changes to margins, padding, or layout spacing
	| 'PLACEMENT_CHANGE'   // Repositioning elements on the page
	| 'COLOR_CHANGE'       // Changes to colors, backgrounds, or themes
	| 'SIZE_CHANGE'        // Changes to element dimensions
	| 'VISIBILITY_CHANGE'  // Show/hide elements or change opacity
	| 'ANIMATION_CHANGE'   // Add/modify animations or transitions
	| 'CTA_CHANGE'         // Changes to call-to-action elements
	| 'LAYOUT_CHANGE'      // Changes to overall layout structure
	| 'RESPONSIVE_CHANGE'; // Changes specific to certain screen sizes

interface UIModification {
	type: UiChangeType;
	lineNumber: number;
	content?: string;
	reasoning: string;
	previous_metric_evidence?: {
		deployment_time: number;
		metric_improvement: {
			bounce_rate_change?: number;
			avg_time_change?: number;
			conversion_rate_change?: number;
		};
	};
}

interface AIResponse {
	changes: Array<{
		filePath: string;
		modifications: UIModification[];
		confidence_score: number; // 0 to 1
		reasoning: string; // Overall reasoning for changes in this file
	}>;
}

async function getLastDeployments(db: D1Database, limit: number = 3): Promise<DeploymentMetrics[]> {
	const metrics = await db
		.prepare('SELECT * FROM deployment_metrics ORDER BY deploy_time DESC LIMIT ?')
		.bind(limit)
		.all();
	return metrics.results as unknown as DeploymentMetrics[];
}

async function analyzePageAndSuggestChanges(
	ai: Ai,
	page: PageAnalysis,
	metrics: DeploymentMetrics[],
	recentChanges: FileChange[]
): Promise<AIResponse> {
	console.log(`\n[AI] 🤖 Starting analysis for page: ${page.mainFile}`);
	
	// Sort metrics by deploy time to analyze trends
	const sortedMetrics = [...metrics].sort((a, b) => b.deploy_time - a.deploy_time);
	console.log(`[AI] 📊 Analyzing ${sortedMetrics.length} deployment metrics`);
	
	// Calculate metric changes between deployments
	const metricChanges = sortedMetrics.map((metric, index) => {
		if (index === sortedMetrics.length - 1) return null;
		const nextMetric = sortedMetrics[index + 1];
		return {
			deploy_time: metric.deploy_time,
			commit_sha: metric.commit_sha,
			changes: {
				bounce_rate_change: metric.bounce_rate - nextMetric.bounce_rate,
				avg_time_change: metric.avg_time_spent_seconds - nextMetric.avg_time_spent_seconds,
				visitors_change: metric.total_visitors - nextMetric.total_visitors,
				conversion_change: metric.conversion_rate - nextMetric.conversion_rate
			}
		};
	}).filter(Boolean);
	
	// Filter changes relevant to this page and its components
	const relevantFiles = [page.mainFile, ...page.components];
	const relevantChanges = recentChanges.filter(change => 
		relevantFiles.some(file => change.changes.some((line: string) => line.includes(file)))
	);
	
	console.log(`[AI] 📝 Preparing prompt with:`);
	console.log(`     - ${page.components.length} components`);
	console.log(`     - ${metricChanges.length} metric changes`);
	console.log(`     - ${relevantChanges.length} recent file changes`);
	console.log(`     - ${Object.keys(page.content).length} files to analyze`);

	const prompt = `
		You are an AI agent responsible for improving website metrics through specific UI changes.
		Analyze this page and suggest improvements based on historical data.
		
		PAGE BEING ANALYZED:
		Main File: ${page.mainFile}
		Component Files: ${page.components.join(', ')}
		
		FILE CONTENTS:
		${Object.entries(page.content).map(([file, content]) => `
		--- ${file} ---
		${content}
		`).join('\n')}
		
		METRICS HISTORY:
		${JSON.stringify(sortedMetrics, null, 2)}
		
		METRIC CHANGES AFTER DEPLOYMENTS:
		${JSON.stringify(metricChanges, null, 2)}
		
		RECENT CHANGES TO THIS PAGE:
		${JSON.stringify(relevantChanges, null, 2)}
		
		AVAILABLE UI CHANGE TYPES:
		1. TEXT_CHANGE: Modify text content, wording, or messaging
		2. SPACING: Adjust margins, padding, or layout spacing
		3. PLACEMENT_CHANGE: Reposition elements on the page
		4. COLOR_CHANGE: Modify colors, backgrounds, or themes
		5. SIZE_CHANGE: Adjust element dimensions
		6. VISIBILITY_CHANGE: Show/hide elements or change opacity
		7. ANIMATION_CHANGE: Add/modify animations or transitions
		8. CTA_CHANGE: Modify call-to-action elements
		9. LAYOUT_CHANGE: Change overall layout structure
		10. RESPONSIVE_CHANGE: Modify behavior on different screen sizes

		RESPONSE FORMAT:
		Return a valid JSON array of changes:
		{
			"changes": [
				{
					"filePath": string,
					"modifications": [
						{
							"type": "TEXT_CHANGE" | "SPACING" | "PLACEMENT_CHANGE" | "COLOR_CHANGE" | 
									"SIZE_CHANGE" | "VISIBILITY_CHANGE" | "ANIMATION_CHANGE" | 
									"CTA_CHANGE" | "LAYOUT_CHANGE" | "RESPONSIVE_CHANGE",
							"lineNumber": number,
							"content": string (if applicable),
							"reasoning": string (specific reasoning for this change),
							"previous_metric_evidence": {
								"deployment_time": number,
								"metric_improvement": {
									"bounce_rate_change": number (optional),
									"avg_time_change": number (optional),
									"conversion_rate_change": number (optional)
								}
							}
						}
					],
					"confidence_score": number (0 to 1),
					"reasoning": string (overall reasoning for changes in this file)
				}
			]
		}
		
		REQUIREMENTS:
		1. Only suggest changes with clear evidence of positive impact from historical data
		2. Each modification must have specific reasoning explaining why it will help
		3. Include overall reasoning for each file's changes
		4. Each change should reference specific metrics or user behavior patterns
		5. Confidence score should be based on historical success of similar changes
		6. Response must be valid JSON
	`;

	console.log(`[AI] 🚀 Sending request to AI model for ${page.mainFile}`);
	console.log(`[AI] ⚙️  Model parameters: max_tokens=2000, temperature=0.2`);
	
	try {
		const response = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { 
			prompt,
			max_tokens: 2000,
			temperature: 0.2,
			stream: false
		});
		
		console.log('[AI] ✅ Received response from AI model');
		console.log('[AI] 🔍 Parsing AI response');

		// Handle the response based on its type
		let responseText = '';
		if (response && typeof response === 'object') {
			if ('response' in response) {
				responseText = response.response as string;
			} else if (response instanceof ReadableStream) {
				const reader = response.getReader();
				let result = await reader.read();
				const decoder = new TextDecoder();
				while (!result.done) {
					responseText += decoder.decode(result.value);
					result = await reader.read();
				}
			}
		}

		console.log('[AI] 📜 Raw response:', responseText);
		
		// Try to extract and combine multiple JSON objects from the response
		let allChanges: any[] = [];
		const jsonMatches = responseText.match(/\{[\s\S]*?\}/g) || [];
		
		if (jsonMatches.length === 0) {
			console.error('[AI] ❌ No JSON objects found in response');
			throw new Error('No JSON found in AI response');
		}

		console.log(`[AI] 🔍 Found ${jsonMatches.length} JSON objects in response`);
		
		// Parse each JSON object and collect all changes
		for (const jsonStr of jsonMatches) {
			try {
				const parsed = JSON.parse(jsonStr);
				if (parsed.changes && Array.isArray(parsed.changes)) {
					allChanges = [...allChanges, ...parsed.changes];
				}
			} catch (parseError) {
				console.warn('[AI] ⚠️ Failed to parse one JSON object, continuing with others:', parseError);
			}
		}

		if (allChanges.length === 0) {
			console.error('[AI] ❌ No valid changes found in any JSON object');
			throw new Error('No valid changes found in AI response');
		}

		// Combine all changes into a single response
		const result: AIResponse = {
			changes: allChanges.map(change => ({
				...change,
				confidence_score: change.confidence_score || 0.5, // Default confidence if missing
				modifications: Array.isArray(change.modifications) ? change.modifications : [],
				reasoning: change.reasoning || 'No reasoning provided'
			}))
		};
		
		console.log(`[AI] ✨ Successfully combined ${result.changes.length} changes from ${jsonMatches.length} JSON objects`);
		result.changes.forEach((change, index) => {
			console.log(`\n[AI] 📌 Change ${index + 1}/${result.changes.length}:`);
			console.log(`    File: ${change.filePath}`);
			console.log(`    Confidence: ${(change.confidence_score * 100).toFixed(1)}%`);
			console.log(`    Modifications: ${change.modifications.length}`);
		});
		
		return result;
	} catch (error) {
		console.error('[AI] ❌ Failed to process AI response:', error);
		throw new Error('Failed to generate valid UI improvement suggestions');
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			console.log('[Worker] Starting metrics improvement analysis');
			
			// 1. Get last 3 deployments metrics
			console.log('[DB] Fetching deployment metrics');
			const lastDeployments = await getLastDeployments(env.DB);
			console.log(`[DB] Found ${lastDeployments.length} deployments`);

			// 2. Analyze repository
			console.log('[Git] Setting up repository analysis');
			const repoUrl = 'https://github.com/riken-shah/finding-me';
			console.log("Github token: ", env.GITHUB_TOKEN)
			const repoAnalysis = await analyzeRepo(repoUrl, env.GITHUB_TOKEN);
			
			// Filter out route files and log relevant files
			const relevantPages = repoAnalysis.pages.filter(page => {
				const isRouteFile = page.mainFile.includes('route.ts') || page.mainFile.includes('api/');
				const isRelevantFile = page.mainFile.endsWith('.tsx') || 
									 page.mainFile.endsWith('.jsx') || 
									 page.mainFile.endsWith('.css');
				return !isRouteFile && isRelevantFile;
			});

			console.log('\n[Analysis] Files to be processed:');
			relevantPages.forEach(page => {
				console.log(`📄 ${page.mainFile}`);
				if (page.components.length > 0) {
					console.log('   Components:');
					page.components.forEach(comp => console.log(`   └─ ${comp}`));
				}
			});
			console.log(`\n[Git] Found ${relevantPages.length} relevant pages to analyze\n`);

			// 3. Analyze each page and collect suggestions
			console.log('[Analysis] Starting page-by-page analysis');
			const allSuggestions: AIResponse[] = [];
			for (const page of relevantPages) {
				console.log(`[Page] Analyzing ${page.mainFile}`);
				const analysis = await analyzePageAndSuggestChanges(
					env.AI,
					page,
					lastDeployments,
					repoAnalysis.recentChanges
				);
				allSuggestions.push(analysis);
			}
			console.log(`[Analysis] Completed analysis for ${allSuggestions.length} pages`);

			// 4. Apply changes using git
			console.log('[Git] Starting to apply changes');
			const git = simpleGit('/tmp/repo-analysis');
			const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
			for (const analysis of allSuggestions) {
				await applyChanges(analysis.changes, env.GITHUB_TOKEN, owner, repo, 'metrics-improvement');
			}
			console.log('[Git] Finished applying all changes');

			// 5. Commit and push changes
			console.log('[Git] Committing changes');
			const commitMessage = `UI improvements based on metric analysis\n\n${
				allSuggestions.map(analysis => 
					analysis.changes.map(change => 
						`File: ${change.filePath}\nReasoning: ${change.reasoning}`
					).join('\n\n')
				).join('\n\n')
			}`;
			await commitAndPush(env.GITHUB_TOKEN, commitMessage, owner, repo, 'metrics-improvement');
			console.log('[Git] Successfully pushed changes');

			// 6. Return analysis and suggestions
			console.log('[Worker] Preparing response');
			return new Response(JSON.stringify({
				status: 'success',
				deployments: lastDeployments,
				repoAnalysis,
				suggestions_by_page: allSuggestions,
				changes_applied: true
			}), {
				headers: {
					'Content-Type': 'application/json',
				},
			});
		} catch (error: unknown) {
			console.error('[Worker] Error:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			return new Response(JSON.stringify({
				status: 'error',
				message: errorMessage,
			}), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}
	},
} satisfies ExportedHandler<Env>;