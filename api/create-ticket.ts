// Avoid importing '@vercel/node' types to prevent build errors when
// the package's type declarations are not available in the environment.
// Use `any` for the request/response parameters instead.

// GitHub API endpoint for creating issues
const GITHUB_API_URL = 'https://api.github.com/repos/henrylay1/ManageDle/issues';

// Map ticket types to GitHub labels
const LABEL_MAP: Record<string, string> = {
  bug: 'bug',
  feature: 'enhancement',
  question: 'question',
};

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get GitHub token from environment
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('GITHUB_TOKEN not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { type, description, userAgent } = req.body;

    // Validate input
    if (!type || !description) {
      return res.status(400).json({ error: 'Missing required fields: type and description' });
    }

    if (!['bug', 'feature', 'question'].includes(type)) {
      return res.status(400).json({ error: 'Invalid ticket type' });
    }

    // Build issue title
    const titlePrefix = type === 'bug' ? '🐞' : type === 'feature' ? '✨' : '❓';
    const title = `${titlePrefix} [${type.toUpperCase()}] User Report`;

    // Build issue body with metadata
    const body = `## Description\n\n${description}\n\n---\n\n### Environment\n- User Agent: ${userAgent || 'Not provided'}\n- Submitted: ${new Date().toISOString()}\n- App Version: v1.0.0`;

    // Create GitHub issue
    const response = await fetch(GITHUB_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels: [LABEL_MAP[type]],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('GitHub API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Failed to create GitHub issue',
        details: errorData.message 
      });
    }

    const issue = await response.json();

    return res.status(200).json({
      success: true,
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
