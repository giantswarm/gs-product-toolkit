import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { IssueReportGenerator } from './services/report-generator';

const app = express();
const PORT = process.env.PORT || 3001;

// Shared report generator instance to maintain state between requests
const reportGenerator = new IssueReportGenerator();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/roadmap-options', async (req: Request, res: Response) => {
  try {
    const { GitHubAPIService } = await import('./services/github-api');
    const githubAPI = new GitHubAPIService();
    const options = await githubAPI.getRoadmapTeamAndStatusOptions();
    res.json(options);
  } catch (error) {
    console.error('Error fetching roadmap options:', error);
    res.status(500).json({ error: 'Failed to fetch roadmap options' });
  }
});

app.post('/api/generate-report', async (req: Request, res: Response) => {
  try {
    const { team, status } = req.body;
    if (!team || !status) {
      return res.status(400).json({ error: 'Team and status are required' });
    }
    const report = await reportGenerator.generateReportForTeamStatus(team, status);
    return res.json({ success: true, report, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/update-report-status', async (req: Request, res: Response) => {
  try {
    const { newStatus } = req.body;
    if (!newStatus) {
      return res.status(400).json({ error: 'newStatus is required' });
    }
    
    // Use the shared report generator instance
    const result = await reportGenerator.updateLastReportIssuesStatus(newStatus);
    
    return res.json({
      success: result.success,
      updated: result.updated,
      failed: result.failed,
      totalIssues: result.totalIssues,
      errors: result.errors,
      message: result.success 
        ? `Successfully updated status for ${result.updated} out of ${result.totalIssues} issues`
        : `Failed to update status for ${result.failed} out of ${result.totalIssues} issues`
    });
  } catch (error) {
    console.error('Error updating report status:', error);
    return res.status(500).json({ 
      error: 'Failed to update report status', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Safe test endpoint to check Kind field (READ-ONLY)
app.post('/api/test-issue-kind', async (req: Request, res: Response) => {
  try {
    const { issueNumber, repository } = req.body;
    if (!issueNumber || !repository) {
      return res.status(400).json({ error: 'Issue number and repository are required' });
    }
    
    const { GitHubAPIService } = await import('./services/github-api');
    const githubAPI = new GitHubAPIService();
    
    // Get the project item ID
    const itemId = await githubAPI.getProjectItemIdWithRepo(issueNumber, repository);
    if (!itemId) {
      return res.status(404).json({ error: `Issue #${issueNumber} not found in Roadmap project` });
    }
    
    // Get the Roadmap project ID using the existing method
    const projectQuery = `
      query GetRoadmapProject($owner: String!) {
        organization(login: $owner) {
          projectsV2(first: 10, query: "Roadmap") {
            nodes {
              id
              title
            }
          }
        }
      }
    `;
    
    // Use the GitHub API service's internal method
    const projectResult: any = await (githubAPI as any).makeGraphQLRequest(projectQuery, { owner: 'giantswarm' });
    const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
    if (!roadmapProject) {
      return res.status(404).json({ error: 'Roadmap project not found' });
    }
    
    // Get the Kind field
    const kind = await githubAPI.getIssueKind(roadmapProject.id, itemId);
    
    return res.json({
      success: true,
      issueNumber,
      repository,
      kind: kind || 'Not set',
      itemId
    });
  } catch (error) {
    console.error('Error testing issue kind:', error);
    return res.status(500).json({ 
      error: 'Failed to test issue kind', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../ui/build')));

// For any other request, send back the React app
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../ui/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
}); 