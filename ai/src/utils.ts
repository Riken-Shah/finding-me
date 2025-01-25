import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'node:fs';
import * as path from 'node:path';
import fetch from "node-fetch";

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
  // Get the SHA of the default branch
  const mainResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'metrics-improvement-bot'
    }
  });

  const mainData = await mainResponse.json();
  const sha = (mainData as any).object.sha;

  // Create new branch
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
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

  if (!response.ok) {
    throw new Error(`Failed to create branch: ${response.statusText}`);
  }
}

export async function applyChanges(
  changes: UiChange[], 
  githubToken: string, 
  owner: string, 
  repo: string, 
  branchName: string
): Promise<void> {
  for (const change of changes) {
    console.log(`[Git] Applying changes to ${change.filePath}`);
    
    try {
      // Get current file content
      const content = await fetchGitHubContent(change.filePath, githubToken, owner, repo);
      const lines = content.split('\n');
      
      // Apply modifications
      const sortedMods = [...change.modifications].sort((a, b) => b.lineNumber - a.lineNumber);
      for (const mod of sortedMods) {
        if (!mod.content) continue;
        lines[mod.lineNumber - 1] = mod.content;
      }
      
      // Update file in the new branch
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${change.filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'metrics-improvement-bot'
        },
        body: JSON.stringify({
          message: `Update UI changes for ${change.filePath}`,
          content: Buffer.from(lines.join('\n')).toString('base64'),
          branch: branchName,
          sha: await getFileSha(change.filePath, githubToken, owner, repo)
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update ${change.filePath}: ${response.statusText}`);
      }
      
      console.log(`[Git] Successfully updated ${change.filePath}`);
    } catch (error) {
      console.error(`[Git] Error updating ${change.filePath}:`, error);
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