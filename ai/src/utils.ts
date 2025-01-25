import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'node:fs';
import * as path from 'node:path';
import fetch from "node-fetch";
import { Ai } from '@cloudflare/ai';

export interface FileChange {
  file: string;
  changes: string[];
}

export interface RepoAnalysis {
  pages: PageAnalysis[];
  recentChanges: FileChange[];
}

export interface PageAnalysis {
  mainFile: string;
  components: string[];
  content: {
    [filePath: string]: string;
  };
}

export interface UiChange {
  filePath: string;
  modifications: Array<{
    type: UiChangeType;
    lineNumber: number;
    content?: string;
    reasoning: string;
  }>;
  confidence_score: number;
  reasoning: string;
}

type UiChangeType = 
  | 'TEXT_CHANGE'
  | 'SPACING'
  | 'PLACEMENT_CHANGE'
  | 'COLOR_CHANGE'
  | 'SIZE_CHANGE'
  | 'VISIBILITY_CHANGE'
  | 'ANIMATION_CHANGE'
  | 'CTA_CHANGE'
  | 'LAYOUT_CHANGE'
  | 'RESPONSIVE_CHANGE';

interface GitHubRef {
  ref: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
}

interface GitHubContent {
  sha: string;
  content: string;
  path: string;
  size: number;
}

export async function setupRepo(repoUrl: string, githubToken: string): Promise<void> {
  // Validate the token works by making a test API call
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'metrics-improvement-bot'
    }
  });

  if (!response.ok) {
    throw new Error('Invalid GitHub token or API access');
  }

  console.log('[Git] GitHub API access validated');
}

export async function createBranch(githubToken: string, owner: string, repo: string, branchName: string): Promise<void> {
  try {
    // First check if branch exists
    const branchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'metrics-improvement-bot'
      }
    });

    if (branchResponse.status === 404) {
      // Branch doesn't exist, create it from default branch
      const defaultBranchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'metrics-improvement-bot'
        }
      });

      if (!defaultBranchResponse.ok) {
        throw new Error(`Failed to get default branch: ${defaultBranchResponse.statusText}`);
      }

      const defaultBranchData = await defaultBranchResponse.json() as GitHubRef;
      const sha = defaultBranchData.object.sha;

      // Create new branch
      const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'metrics-improvement-bot'
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: sha
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(`Failed to create branch: ${createResponse.statusText} - ${JSON.stringify(errorData)}`);
      }

      console.log(`[Git] Created new branch: ${branchName}`);
    } else if (branchResponse.ok) {
      console.log(`[Git] Branch ${branchName} already exists, will update existing branch`);
    } else {
      throw new Error(`Unexpected status checking branch: ${branchResponse.statusText}`);
    }
  } catch (error) {
    console.error('[Git] Branch creation error:', error);
    throw error;
  }
}

export async function applyChanges(
  changes: UiChange[], 
  githubToken: string, 
  owner: string, 
  repo: string, 
  branchName: string,
  ai: Ai
): Promise<void> {
  // Group changes by file
  const changesByFile = changes.reduce((acc, change) => {
    if (!acc[change.filePath]) {
      acc[change.filePath] = [];
    }
    acc[change.filePath].push(change);
    return acc;
  }, {} as Record<string, UiChange[]>);

  for (const [filePath, fileChanges] of Object.entries(changesByFile)) {
    console.log(`[Git] Applying changes to ${filePath}`);
    
    try {
      // Get current file content
      const content = await fetchGitHubContent(filePath, githubToken, owner, repo);
      
      // Prepare the prompt for LLM
      const prompt = `You are an expert code modifier. Below is a file's content and a list of changes to apply.
Return ONLY the complete modified file content without any additional text, markdown formatting, or code block markers.

FILE CONTENT:
${content}

CHANGES TO APPLY:
${fileChanges.map(change => 
  change.modifications.map(mod => 
    `Line ${mod.lineNumber}: ${mod.type}
     Content: ${mod.content || 'No content change'}
     Reasoning: ${mod.reasoning}`
  ).join('\n\n')
).join('\n\n')}

RULES:
1. Return ONLY the modified code
2. No explanations or markdown
3. No code block markers
4. Keep all imports and dependencies
5. Maintain indentation
6. Skip invalid line numbers`;

      // Get file SHA from the target branch
      const shaResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branchName}`,
        {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'metrics-improvement-bot'
          }
        }
      );

      let fileSha: string;
      if (shaResponse.status === 404) {
        console.log(`[Git] File ${filePath} doesn't exist in branch ${branchName}, will create it`);
        fileSha = '';
      } else if (!shaResponse.ok) {
        throw new Error(`Failed to get file SHA: ${shaResponse.statusText}`);
      } else {
        const fileData = await shaResponse.json() as GitHubContent;
        fileSha = fileData.sha;
      }

      // Call Cloudflare AI to apply changes
      const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', { 
        prompt,
        max_tokens: 2000,
        temperature: 0.2,
        stream: false
      });

      let modifiedContent = '';
      if (response && typeof response === 'object' && 'response' in response) {
        modifiedContent = (response.response as string).trim();
      } else if (response instanceof ReadableStream) {
        const reader = response.getReader();
        const decoder = new TextDecoder();
        let result = await reader.read();
        while (!result.done) {
          modifiedContent += decoder.decode(result.value);
          result = await reader.read();
        }
      }

      if (!modifiedContent) {
        throw new Error('Failed to get valid response from AI');
      }

      // Clean up any potential formatting
      modifiedContent = modifiedContent
        .replace(/^[\s\S]*?(?=import|export|class|function|const|let|var|\/\*|\/\/|<!DOCTYPE|<\?|<html)/i, '')  // Remove any prefix until code starts
        .replace(/```[\w]*\n?|\n?```/g, '')  // Remove code block markers
        .trim();

      if (!modifiedContent) {
        throw new Error('Failed to extract valid file content from AI response');
      }
      
      // Update file in the branch
      const updateResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'metrics-improvement-bot'
        },
        body: JSON.stringify({
          message: `Update UI changes for ${filePath}`,
          content: Buffer.from(modifiedContent).toString('base64'),
          branch: branchName,
          ...(fileSha && { sha: fileSha })
        })
      });
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`Failed to update ${filePath}: ${updateResponse.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      console.log(`[Git] Successfully updated ${filePath}`);
    } catch (error) {
      console.error(`[Git] Error updating ${filePath}:`, error);
      throw error;
    }
  }
}

export async function createPullRequest(
  githubToken: string, 
  owner: string, 
  repo: string, 
  branchName: string, 
  title: string, 
  body: string
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'metrics-improvement-bot'
    },
    body: JSON.stringify({
      title,
      body,
      head: branchName,
      base: 'main'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create pull request: ${response.statusText}`);
  }
}

// Helper functions
async function getFileSha(filePath: string, githubToken: string, owner: string, repo: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'metrics-improvement-bot'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get file SHA: ${response.statusText}`);
  }
  
  const data = await response.json();
  return (data as any).sha;
}

function isPageFile(filePath: string): boolean {
  // Typically in Next.js, pages are in the pages/ or app/ directory
  return (
    filePath.includes('/pages/') ||
    filePath.includes('/app/') ||
    filePath.includes('/views/') ||
    filePath.includes('/routes/')
  ) && !filePath.includes('/_');
}

async function fetchGitHubContent(path: string, githubToken: string, owner: string, repo: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'metrics-improvement-bot'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }
  
  return await response.text();
}

async function findComponentImports(content: string): Promise<string[]> {
  const imports: string[] = [];
  const importRegex = /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      imports.push(importPath);
    }
  }

  return imports;
}

export async function analyzeRepo(repoUrl: string, githubToken: string): Promise<RepoAnalysis> {
  console.log('[Git] Analyzing repository structure');
  
  // Parse owner and repo from URL
  const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');
  
  try {
    // Get recent changes through GitHub API
    const recentChangesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'metrics-improvement-bot'
      }
    });
    
    const commits = await recentChangesResponse.json();
    
    // Check if commits is an array and handle error case
    if (!Array.isArray(commits)) {
      console.error('[Git] Unexpected commits response:', commits);
      const recentChanges: FileChange[] = [];
      return { pages: [], recentChanges };
    }

    const recentChanges: FileChange[] = commits.slice(0, 3).map((commit: any) => ({
      file: commit.sha,
      changes: commit.commit.message.split('\n')
    }));

    // Get repository contents
    const contentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'metrics-improvement-bot'
      }
    });
    
    const contents = await contentsResponse.json();
    const pages: PageAnalysis[] = [];
    
    for (const item of (contents as any).tree) {
      if (isPageFile(item.path)) {
        console.log(`[Git] Analyzing page: ${item.path}`);
        const content = await fetchGitHubContent(item.path, githubToken, owner, repo);
        const components = await findComponentImports(content);
        
        const pageContent: { [key: string]: string } = {
          [item.path]: content
        };
        
        // Get component contents
        for (const component of components) {
          try {
            const componentPath = resolveImportPath(item.path, component);
            const componentContent = await fetchGitHubContent(componentPath, githubToken, owner, repo);
            pageContent[componentPath] = componentContent;
          } catch (error) {
            console.warn(`[Git] Failed to fetch component ${component}:`, error);
          }
        }
        
        pages.push({
          mainFile: item.path,
          components,
          content: pageContent
        });
      }
    }
    
    return { pages, recentChanges };
  } catch (error) {
    console.error('[Git] Error analyzing repository:', error);
    throw error;
  }
}

function resolveImportPath(currentFile: string, importPath: string): string {
  const parts = currentFile.split('/');
  parts.pop(); // Remove filename
  
  const importParts = importPath.split('/');
  for (const part of importParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }
  
  if (!parts[parts.length - 1].includes('.')) {
    parts[parts.length - 1] += '.tsx';
  }
  
  return parts.join('/');
}

export async function commitAndPush(
  githubToken: string,
  owner: string,
  repo: string,
  branchName: string,
  message: string
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'metrics-improvement-bot'
    },
    body: JSON.stringify({
      message,
      branch: branchName
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to commit and push changes: ${response.statusText}`);
  }

  console.log(`[Git] Successfully committed and pushed changes to ${branchName}`);
} 