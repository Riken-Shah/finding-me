import { analyzeRepo, RepoAnalysis, UiChange, applyChanges, commitAndPush, setupRepo, PageAnalysis, FileChange, createBranch, createPullRequest } from './utils';

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

// Define specific UI change types with detailed descriptions
type UiChangeType = 
	| 'TEXT_CHANGE'        // Changes to text content, headlines, paragraphs, labels, or any textual elements
	| 'SPACING'            // Adjustments to margins, padding, gaps between elements, or whitespace
	| 'PLACEMENT_CHANGE'   // Changes to element positioning, reordering, or structural hierarchy
	| 'COLOR_CHANGE'       // Modifications to colors including text, backgrounds, borders, gradients, or themes
	| 'SIZE_CHANGE'        // Adjustments to width, height, font sizes, or scaling of elements
	| 'VISIBILITY_CHANGE'  // Toggle visibility, opacity changes, or conditional rendering of elements
	| 'ANIMATION_CHANGE'   // Add/modify transitions, hover effects, loading states, or motion design
	| 'CTA_CHANGE'         // Modifications to buttons, links, forms, or any interactive elements
	| 'LAYOUT_CHANGE'      // Changes to grid systems, flexbox layouts, or overall page structure
	| 'RESPONSIVE_CHANGE'; // Mobile-specific adjustments, breakpoints, or adaptive layouts

interface UIModification {
	type: UiChangeType;
	lineNumber: number;
	content?: string;           // The actual code change to be applied
	reasoning: string;          // Detailed explanation of why this change will improve metrics
	previous_metric_evidence?: {
		deployment_time: number;  // Unix timestamp of the previous deployment
		metric_improvement: {
			bounce_rate_change?: number;    // Percentage change in bounce rate (-100 to 100)
			avg_time_change?: number;       // Change in average time spent in seconds
			conversion_rate_change?: number; // Percentage change in conversion rate (-100 to 100)
		};
	};
}

interface AIResponse {
	changes: Array<{
		filePath: string;           // Full path to the file being modified
		modifications: UIModification[];
		confidence_score: number;    // 0 to 1, where 1 represents highest confidence
		reasoning: string;          // Overall explanation for all changes in this file
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
		
		IMPORTANT: 
		1. Return ONLY valid JSON without any additional text or explanation
		2. Do not use escaped characters in strings
		3. Use single quotes for HTML/JSX attributes
		4. Keep all strings simple and avoid special characters
		
		EXPECTED RESPONSE SCHEMA:
		{
			"changes": [
				{
					"filePath": "string",
					"modifications": [
						{
							"type": "string",
							"lineNumber": number,
							"content": "string",
							"reasoning": "string"
						}
					],
					"confidence_score": number,
					"reasoning": "string"
				}
			]
		}

		UI CHANGE TYPES EXPLANATION:
		- TEXT_CHANGE: Modifications to any textual content including headlines, paragraphs, labels
		- SPACING: Adjustments to margins, padding, gaps between elements, whitespace
		- PLACEMENT_CHANGE: Changes to element positioning, reordering, structural hierarchy
		- COLOR_CHANGE: Modifications to colors including text, backgrounds, borders, gradients, themes
		- SIZE_CHANGE: Adjustments to width, height, font sizes, element scaling
		- VISIBILITY_CHANGE: Toggle visibility, opacity changes, conditional rendering
		- ANIMATION_CHANGE: Add/modify transitions, hover effects, loading states, motion design
		- CTA_CHANGE: Modifications to buttons, links, forms, interactive elements
		- LAYOUT_CHANGE: Changes to grid systems, flexbox layouts, overall page structure
		- RESPONSIVE_CHANGE: Mobile-specific adjustments, breakpoints, adaptive layouts

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

		// Clean up the response text before parsing
		const cleanedResponse = responseText
			.trim()
			// Remove any markdown code block markers
			.replace(/```json\s*|\s*```/g, '')
			// Remove any non-JSON text before or after the JSON object
			.replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1');

		try {
			const parsed = JSON.parse(cleanedResponse);
			
			// Validate the response structure
			if (!parsed.changes || !Array.isArray(parsed.changes)) {
				throw new Error('Invalid response format: missing changes array');
			}

			// Clean and validate each change
			const result: AIResponse = {
				changes: parsed.changes.map(change => ({
					filePath: String(change.filePath || ''),
					modifications: Array.isArray(change.modifications) 
						? change.modifications.map(mod => ({
							type: mod.type,
							lineNumber: Number(mod.lineNumber),
							content: mod.content ? String(mod.content) : undefined,
							reasoning: String(mod.reasoning)
						}))
						: [],
					confidence_score: Number(change.confidence_score) || 0.5,
					reasoning: String(change.reasoning || 'No reasoning provided')
				}))
			};

			console.log(`[AI] ✨ Successfully parsed ${result.changes.length} changes`);
			return result;

		} catch (parseError) {
			console.error('[AI] ❌ JSON Parse Error:', parseError);
			console.error('[AI] Raw Response:', responseText);
			console.error('[AI] Cleaned Response:', cleanedResponse);
			throw new Error(`Failed to parse AI response JSON: ${parseError.message}`);
		}
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
			
			// Filter to only analyze page.tsx
			const relevantPages = repoAnalysis.pages.filter(page => 
				page.mainFile.endsWith('page.tsx')
			);

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
				
				// Log the suggestions for this page
				console.log('\n[Suggestions] 📝 Proposed changes for:', page.mainFile);
				analysis.changes.forEach(change => {
					console.log(`\nFile: ${change.filePath}`);
					console.log(`Confidence: ${change.confidence_score}`);
					console.log(`Reasoning: ${change.reasoning}`);
					console.log('\nModifications:');
					change.modifications.forEach(mod => {
						console.log(`\n  Type: ${mod.type}`);
						console.log(`  Line: ${mod.lineNumber}`);
						console.log(`  Reasoning: ${mod.reasoning}`);
						if (mod.content) {
							console.log(`  Content:\n    ${mod.content.replace(/\n/g, '\n    ')}`);
						}
					});
				});
				console.log('\n-------------------');
			}
			console.log(`[Analysis] Completed analysis for ${allSuggestions.length} pages`);

			// 4. Apply changes using GitHub API
			console.log('[Git] Starting to apply changes');
			const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
			
			// Create a unique branch name with timestamp
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const branchName = `metrics-improvement-${timestamp}`;
			
			// Create a new branch for improvements
			console.log(`[Git] Creating new branch: ${branchName}`);
			await createBranch(env.GITHUB_TOKEN, owner, repo, branchName);

			// Apply changes to files
			for (const analysis of allSuggestions) {
				await applyChanges(analysis.changes, env.GITHUB_TOKEN, owner, repo, branchName, env.AI);
			}
			console.log('[Git] Finished applying all changes');

			// Create a pull request with the changes
			console.log('[Git] Creating pull request');
			const prTitle = `UI Improvements based on Metric Analysis - ${timestamp}`;
			const prBody = allSuggestions.map(analysis => 
				analysis.changes.map(change => 
					`## ${change.filePath}\n\n${change.reasoning}\n\n${
						change.modifications.map(mod => 
							`- ${mod.type}: ${mod.reasoning}`
						).join('\n')
					}`
				).join('\n\n')
			).join('\n\n');

			await createPullRequest(
				env.GITHUB_TOKEN,
				owner,
				repo,
				branchName,
				prTitle,
				prBody
			);
			console.log('[Git] Successfully created pull request');

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