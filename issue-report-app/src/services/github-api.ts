import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config/environment';
import {
  GitHubIssue,
  GitHubComment,
  GitHubProject,
  GitHubProjectColumn,
  GitHubProjectCard,
  GitHubRepository,
} from '../types/github';

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

export class GitHubAPIService {
  private client: AxiosInstance;
  private graphqlClient: AxiosInstance;
  private requestCount = 0;
  private resetTime = Date.now();

  constructor() {
    this.client = axios.create({
      baseURL: config.githubApiBaseUrl,
      headers: {
        'Authorization': `token ${config.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'github-ai-typescript-client',
      },
      timeout: 30000,
    });

    this.graphqlClient = axios.create({
      baseURL: 'https://api.github.com/graphql',
      headers: {
        'Authorization': `token ${config.githubToken}`,
        'User-Agent': 'github-ai-typescript-client',
      },
      timeout: 30000,
    });

    // Add response interceptor for rate limiting
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(response);
        return response;
      },
      (error) => {
        if (error.response) {
          this.updateRateLimitInfo(error.response);
        }
        throw this.handleAPIError(error);
      }
    );
  }

  private updateRateLimitInfo(response: AxiosResponse): void {
    const remaining = response.headers['x-ratelimit-remaining'];
    const reset = response.headers['x-ratelimit-reset'];
    
    if (remaining !== undefined) {
      this.requestCount = parseInt(remaining, 10);
    }
    
    if (reset !== undefined) {
      this.resetTime = parseInt(reset, 10) * 1000;
    }
  }

  private handleAPIError(error: any): GitHubAPIError {
    if (error.response) {
      const { status, data } = error.response;
      let message = `GitHub API error: ${status}`;
      
      if (data?.message) {
        message += ` - ${data.message}`;
      }
      
      return new GitHubAPIError(message, status, data);
    }
    
    if (error.code === 'ECONNABORTED') {
      return new GitHubAPIError('Request timeout');
    }
    
    return new GitHubAPIError(`Network error: ${error.message}`);
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.get<T>(endpoint, { params });
      return response.data;
    } catch (error) {
      throw this.handleAPIError(error);
    }
  }

  private async makeGraphQLRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      const response = await this.graphqlClient.post<{ data: T; errors?: any }>('', {
        query,
        variables,
      });
      if (response.data.errors) {
        console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      }
      if (!response.data.data) {
        console.error('GraphQL response missing data:', JSON.stringify(response.data, null, 2));
      }
      return response.data.data;
    } catch (error) {
      console.error('GraphQL request failed:', error);
      throw this.handleAPIError(error);
    }
  }

  /**
   * Get a specific issue from a repository
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.makeRequest<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  /**
   * Get all issues from a repository with optional filtering
   */
  async getIssues(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      assignee?: string;
      creator?: string;
      mentioned?: string;
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      since?: string;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<GitHubIssue[]> {
    return this.makeRequest<GitHubIssue[]>(`/repos/${owner}/${repo}/issues`, options);
  }

  /**
   * Get comments for a specific issue
   */
  async getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    options: {
      since?: string;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<GitHubComment[]> {
    return this.makeRequest<GitHubComment[]>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      options
    );
  }

  /**
   * Get a specific comment
   */
  async getIssueComment(
    owner: string,
    repo: string,
    commentId: number
  ): Promise<GitHubComment> {
    return this.makeRequest<GitHubComment>(`/repos/${owner}/${repo}/issues/comments/${commentId}`);
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.makeRequest<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  /**
   * Perform GraphQL introspection to examine the ProjectV2ItemFieldValue union type
   */
  async introspectProjectV2ItemFieldValue(): Promise<any> {
    const introspectionQuery = `
      query IntrospectProjectV2ItemFieldValue {
        __type(name: "ProjectV2ItemFieldValue") {
          name
          description
          possibleTypes {
            name
            description
            fields {
              name
              description
              type {
                name
                kind
                ofType {
                  name
                  kind
                  ofType {
                    name
                    kind
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(introspectionQuery);
      console.log('ProjectV2ItemFieldValue introspection result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Introspection failed:', error);
      throw error;
    }
  }

  /**
   * Introspect the Issue type to understand available fields for relationships
   */
  async introspectIssueType(): Promise<any> {
    const introspectionQuery = `
      query IntrospectIssueType {
        __type(name: "Issue") {
          name
          description
          fields {
            name
            description
            type {
              name
              kind
              ofType {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(introspectionQuery);
      console.log('Issue type introspection result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Introspection failed:', error);
      throw error;
    }
  }

  /**
   * Introspect the ProjectV2FieldConfiguration to understand available field types
   */
  async introspectProjectV2FieldConfiguration(): Promise<any> {
    const introspectionQuery = `
      query IntrospectProjectV2FieldConfiguration {
        __type(name: "ProjectV2FieldConfiguration") {
          name
          description
          possibleTypes {
            name
            description
            fields {
              name
              description
              type {
                name
                kind
                ofType {
                  name
                  kind
                  ofType {
                    name
                    kind
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(introspectionQuery);
      console.log('ProjectV2FieldConfiguration introspection result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Introspection failed:', error);
      throw error;
    }
  }

  /**
   * Perform GraphQL introspection to examine the projectsV2Item schema
   */
  async introspectProjectsV2Item(): Promise<any> {
    const introspectionQuery = `
      query IntrospectProjectsV2Item {
        __type(name: "ProjectV2Item") {
          name
          description
          fields {
            name
            description
            type {
              name
              kind
              ofType {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(introspectionQuery);
      console.log('ProjectsV2Item introspection result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('Introspection failed:', error);
      throw error;
    }
  }

  /**
   * Get projects (ProjectsV2) linked to an issue using GraphQL API (efficient approach)
   * Also fetches Status, Team, and Kind fields for each project item.
   */
  async getProjectsLinkedToIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<(GitHubProject & { status?: string; team?: string; kind?: string; parentIssue?: { number: number; title: string; url: string } })[]> {
    try {
      const query = `
        query GetIssueLinkedProjects($owner: String!, $repo: String!, $issueNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
              id
              parent {
                number
                title
                url
              }
              projectsV2(first: 10) {
                nodes {
                  id
                  title
                  number
                  url
                  createdAt
                  updatedAt
                  shortDescription
                  creator {
                    login
                    avatarUrl
                    url
                  }
                }
              }
            }
          }
        }
      `;
      const variables = { owner, repo, issueNumber };
      const result: any = await this.makeGraphQLRequest<any>(query, variables);
      const projects = result?.repository?.issue?.projectsV2?.nodes;
      const parentIssue = result?.repository?.issue?.parent;
      
      if (!projects || projects.length === 0) {
        console.log(`DEBUG: No projects linked to issue #${issueNumber}`);
        return [];
      }
      
      console.log(`DEBUG: Found ${projects.length} projects linked to issue #${issueNumber}:`);
      projects.forEach((p: any) => console.log(`  - ${p.title} (${p.id})`));
      
      if (parentIssue) {
        console.log(`DEBUG: Found parent issue: #${parentIssue.number} - "${parentIssue.title}"`);
      } else {
        console.log(`DEBUG: No parent issue found`);
      }
      
      // Look for the Roadmap project
      const roadmapProject = projects.find((p: any) => p.title === "Roadmap");
      if (!roadmapProject) {
        console.log(`DEBUG: Roadmap project not found in linked projects`);
        return [];
      }
      
      console.log(`DEBUG: Found Roadmap project linked to issue`);
      
      // Query the project items to find the specific issue with pagination
      const issueId = result?.repository?.issue?.id;
      let item = null;
      let hasNextPage = true;
      let endCursor = null;
      
      while (hasNextPage && !item) {
        const itemsQuery = `
          query GetProjectItems($projectId: ID!, $after: String) {
            node(id: $projectId) {
              ... on ProjectV2 {
                items(first: 100, after: $after) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    id
                    content {
                      ... on Issue {
                        __typename
                        number
                        title
                        url
                        state
                        createdAt
                        updatedAt
                        parent {
                          number
                          title
                          url
                        }
                      }
                    }
                    fieldValues(first: 100) {
                      nodes {
                        ... on ProjectV2ItemFieldTextValue {
                          __typename
                          text
                          field {
                            ... on ProjectV2Field {
                              name
                            }
                          }
                        }
                        ... on ProjectV2ItemFieldSingleSelectValue {
                          __typename
                          name
                          field {
                            ... on ProjectV2SingleSelectField {
                              name
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        
        const itemsResult: any = await this.makeGraphQLRequest<any>(itemsQuery, { 
          projectId: roadmapProject.id,
          after: endCursor
        });
        
        const items = itemsResult?.node?.items?.nodes || [];
        const pageInfo = itemsResult?.node?.items?.pageInfo;
        
        console.log(`DEBUG: Processing ${items.length} items (hasNextPage: ${pageInfo?.hasNextPage})`);
        
        // Look for the issue in this batch
        item = items.find((it: any) => it.content?.id === issueId);
        
        if (item) {
          console.log(`DEBUG: Found issue in batch!`);
          break;
        }
        
        hasNextPage = pageInfo?.hasNextPage || false;
        endCursor = pageInfo?.endCursor;
      }
      
      if (!item) {
        console.log(`DEBUG: Issue not found in Roadmap project after checking all pages`);
        return [];
      }
      
      console.log(`DEBUG: Found issue item in Roadmap project`);
      let status, team, kind;
      if (item.fieldValues && item.fieldValues.nodes) {
        console.log(`DEBUG: Item has ${item.fieldValues.nodes.length} field values`);
        for (const fv of item.fieldValues.nodes) {
          console.log(`DEBUG: Field: ${fv?.field?.name} = ${fv.name || fv.text}`);
          if (fv?.field?.name) {
            const fname = fv.field.name.toLowerCase();
            if (fname === 'status') status = fv.name || fv.text;
            if (fname === 'team') team = fv.name || fv.text;
            if (fname === 'kind') kind = fv.name || fv.text;
          }
        }
      }
      
      console.log(`DEBUG: Extracted - Status: ${status}, Team: ${team}, Kind: ${kind}`);
      
      const projectResult: any = {
        id: parseInt(roadmapProject.id.split('_')[1] || '0'),
        node_id: roadmapProject.id,
        name: roadmapProject.title,
        number: roadmapProject.number,
        url: roadmapProject.url,
        state: 'open' as 'open' | 'closed',
        created_at: roadmapProject.createdAt,
        updated_at: roadmapProject.updatedAt,
        body: roadmapProject.shortDescription,
        creator: {
          login: roadmapProject.creator.login,
          avatar_url: roadmapProject.creator.avatarUrl,
          url: roadmapProject.creator.url,
          id: 0,
          node_id: '',
          gravatar_id: '',
          html_url: '',
          followers_url: '',
          following_url: '',
          gists_url: '',
          starred_url: '',
          subscriptions_url: '',
          organizations_url: '',
          repos_url: '',
          events_url: '',
          received_events_url: '',
          type: '',
          site_admin: false,
        },
        owner_url: '',
        columns_url: '',
        status,
        team,
        kind
      };
      
      if (parentIssue) {
        projectResult.parentIssue = {
          number: parentIssue.number,
          title: parentIssue.title,
          url: parentIssue.url
        };
      }
      
      return [projectResult];
    } catch (error) {
      console.warn(`Warning: Could not fetch projects for issue: ${error}`);
      return [];
    }
  }

  /**
   * Get detailed issue information including comments, repository, and linked projects
   */
  async getDetailedIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<{
    issue: GitHubIssue;
    comments: GitHubComment[];
    repository: GitHubRepository;
    linkedProjects: GitHubProject[];
  }> {
    const [issue, comments, repository, linkedProjects] = await Promise.all([
      this.getIssue(owner, repo, issueNumber),
      this.getIssueComments(owner, repo, issueNumber),
      this.getRepository(owner, repo),
      this.getProjectsLinkedToIssue(owner, repo, issueNumber),
    ]);

    return {
      issue,
      comments,
      repository,
      linkedProjects,
    };
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo(): {
    remaining: number;
    resetTime: Date;
    resetTimeMs: number;
  } {
    return {
      remaining: this.requestCount,
      resetTime: new Date(this.resetTime),
      resetTimeMs: this.resetTime,
    };
  }

  /**
   * Check if rate limit is exceeded
   */
  isRateLimitExceeded(): boolean {
    return this.requestCount <= 0 && Date.now() < this.resetTime;
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getTimeUntilReset(): number {
    return Math.max(0, this.resetTime - Date.now());
  }

  /**
   * Search for issues in the Roadmap project with specific field values
   */
  async searchRoadmapIssues(
    teamFilter?: string,
    statusFilter?: string,
    kindFilter?: string
  ): Promise<Array<{
    issue: {
      number: number;
      title: string;
      url: string;
      state: string;
      created_at: string;
      updated_at: string;
    };
    status?: string;
    team?: string;
    kind?: string;
    projectItemId?: string;
    parentIssue?: {
      number: number;
      title: string;
      url: string;
    };
  }>> {
    try {
      // First, get the Roadmap project ID
      const projectQuery = `
        query GetRoadmapProject($owner: String!) {
          organization(login: $owner) {
            projectsV2(first: 10, query: "Roadmap") {
              nodes {
                id
                title
                number
              }
            }
          }
        }
      `;
      
      const projectResult: any = await this.makeGraphQLRequest<any>(projectQuery, { owner: 'giantswarm' });
      const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
      
      if (!roadmapProject) {
        console.log('DEBUG: Roadmap project not found');
        return [];
      }
      
      console.log(`DEBUG: Found Roadmap project: ${roadmapProject.title} (${roadmapProject.id})`);
      
      const results: any[] = [];
      let hasNextPage = true;
      let endCursor = null;
      
      while (hasNextPage) {
        const itemsQuery = `
          query GetProjectItems($projectId: ID!, $after: String) {
            node(id: $projectId) {
              ... on ProjectV2 {
                items(first: 100, after: $after) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    id
                    content {
                      ... on Issue {
                        __typename
                        number
                        title
                        url
                        state
                        createdAt
                        updatedAt
                        parent {
                          number
                          title
                          url
                        }
                      }
                    }
                    fieldValues(first: 100) {
                      nodes {
                        ... on ProjectV2ItemFieldTextValue {
                          __typename
                          text
                          field {
                            ... on ProjectV2Field {
                              name
                            }
                          }
                        }
                        ... on ProjectV2ItemFieldSingleSelectValue {
                          __typename
                          name
                          field {
                            ... on ProjectV2SingleSelectField {
                              name
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        
        const itemsResult: any = await this.makeGraphQLRequest<any>(itemsQuery, { 
          projectId: roadmapProject.id,
          after: endCursor
        });
        
        const items = itemsResult?.node?.items?.nodes || [];
        const pageInfo = itemsResult?.node?.items?.pageInfo;
        
        console.log(`DEBUG: Processing ${items.length} items (hasNextPage: ${pageInfo?.hasNextPage})`);
        
        for (const item of items) {
          if (item.content?.__typename !== 'Issue') continue;
          
          let status, team, kind;
          if (item.fieldValues && item.fieldValues.nodes) {
            for (const fv of item.fieldValues.nodes) {
              if (fv?.field?.name) {
                const fname = fv.field.name.toLowerCase();
                if (fname === 'status') status = fv.name || fv.text;
                if (fname === 'team') team = fv.name || fv.text;
                if (fname === 'kind') kind = fv.name || fv.text;
              }
            }
          }
          
          // Apply filters
          if (teamFilter && team !== teamFilter) continue;
          if (statusFilter && status !== statusFilter) continue;
          if (kindFilter && kind !== kindFilter) continue;
          
          results.push({
            issue: {
              number: item.content.number,
              title: item.content.title,
              url: item.content.url,
              state: item.content.state,
              created_at: item.content.createdAt,
              updated_at: item.content.updatedAt,
            },
            status,
            team,
            kind,
            projectItemId: item.id,
            parentIssue: item.content.parent ? {
              number: item.content.parent.number,
              title: item.content.parent.title,
              url: item.content.parent.url
            } : undefined
          });
        }
        
        hasNextPage = pageInfo?.hasNextPage || false;
        endCursor = pageInfo?.endCursor;
      }
      
      console.log(`DEBUG: Found ${results.length} matching issues`);
      return results;
      
    } catch (error) {
      console.error('Error searching Roadmap issues:', error);
      return [];
    }
  }

  /**
   * Get all single-select field options for Team and Status from the Roadmap project
   */
  async getRoadmapTeamAndStatusOptions(): Promise<{ teamOptions: string[]; statusOptions: string[] }> {
    // 1. Get the Roadmap project ID
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
    const projectResult: any = await this.makeGraphQLRequest<any>(projectQuery, { owner: 'giantswarm' });
    const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
    if (!roadmapProject) {
      throw new Error('Roadmap project not found');
    }
    // 2. Get all fields for the project
    const fieldsQuery = `
      query GetProjectFields($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 50) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
    const fieldsResult: any = await this.makeGraphQLRequest<any>(fieldsQuery, { projectId: roadmapProject.id });
    const fields = fieldsResult?.node?.fields?.nodes || [];
    const teamField = fields.find((f: any) => f.name === 'Team');
    const statusField = fields.find((f: any) => f.name === 'Status');
    const teamOptions = teamField?.options?.map((o: any) => o.name) || [];
    const statusOptions = statusField?.options?.map((o: any) => o.name) || [];
    return { teamOptions, statusOptions };
  }

  /**
   * Update the Status field of a ProjectV2 item
   */
  async updateProjectItemStatus(
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation UpdateProjectV2ItemFieldValue($input: UpdateProjectV2ItemFieldValueInput!) {
          updateProjectV2ItemFieldValue(input: $input) {
            projectV2Item {
              id
              fieldValues(first: 100) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                      }
                    }
                  }
                }
              }
            }
            clientMutationId
          }
        }
      `;

      const variables = {
        input: {
          projectId,
          itemId,
          fieldId,
          value: {
            singleSelectOptionId: optionId
          },
          clientMutationId: `update-status-${Date.now()}`
        }
      };

      console.log(`DEBUG: Updating status for item ${itemId} in project ${projectId}`);
      console.log(`DEBUG: Field ID: ${fieldId}, Option ID: ${optionId}`);

      const result: any = await this.makeGraphQLRequest<any>(mutation, variables);
      
      if (result?.updateProjectV2ItemFieldValue?.projectV2Item) {
        console.log(`DEBUG: Successfully updated status for item ${itemId}`);
        return {
          success: true,
          message: 'Status updated successfully'
        };
      } else {
        console.error('DEBUG: Failed to update status - no response data');
        return {
          success: false,
          message: 'Failed to update status - no response data'
        };
      }
    } catch (error) {
      console.error('DEBUG: Error updating status:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get the Status field ID and option IDs for the Roadmap project
   */
  async getStatusFieldConfiguration(): Promise<{
    fieldId: string;
    options: Array<{ id: string; name: string }>;
  }> {
    try {
      // 1. Get the Roadmap project ID
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
      const projectResult: any = await this.makeGraphQLRequest<any>(projectQuery, { owner: 'giantswarm' });
      const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
      if (!roadmapProject) {
        throw new Error('Roadmap project not found');
      }

      // 2. Get the Status field configuration
      const fieldsQuery = `
        query GetProjectFields($projectId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              fields(first: 50) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                    options {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const fieldsResult: any = await this.makeGraphQLRequest<any>(fieldsQuery, { projectId: roadmapProject.id });
      const fields = fieldsResult?.node?.fields?.nodes || [];
      const statusField = fields.find((f: any) => f.name === 'Status');
      
      if (!statusField) {
        throw new Error('Status field not found in Roadmap project');
      }

      return {
        fieldId: statusField.id,
        options: statusField.options || []
      };
    } catch (error) {
      console.error('Error getting status field configuration:', error);
      throw error;
    }
  }

  /**
   * Get ProjectV2 item ID for a specific issue in the Roadmap project
   */
  async getProjectItemId(issueNumber: number): Promise<string | null> {
    try {
      // 1. Get the Roadmap project ID
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
      const projectResult: any = await this.makeGraphQLRequest<any>(projectQuery, { owner: 'giantswarm' });
      const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
      if (!roadmapProject) {
        throw new Error('Roadmap project not found');
      }

      // 2. Search for the issue in the project
      const issueQuery = `
        query GetIssueInProject($owner: String!, $repo: String!, $issueNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
              id
            }
          }
        }
      `;
      const issueResult: any = await this.makeGraphQLRequest<any>(issueQuery, { 
        owner: 'giantswarm', 
        repo: 'roadmap', 
        issueNumber 
      });
      const issueId = issueResult?.repository?.issue?.id;
      if (!issueId) {
        throw new Error(`Issue #${issueNumber} not found`);
      }

      // 3. Find the project item for this issue
      let hasNextPage = true;
      let endCursor = null;
      
      while (hasNextPage) {
        const itemsQuery = `
          query GetProjectItems($projectId: ID!, $after: String) {
            node(id: $projectId) {
              ... on ProjectV2 {
                items(first: 100, after: $after) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    id
                    content {
                      ... on Issue {
                        id
                        number
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        
        const itemsResult: any = await this.makeGraphQLRequest<any>(itemsQuery, { 
          projectId: roadmapProject.id,
          after: endCursor
        });
        
        const items = itemsResult?.node?.items?.nodes || [];
        const pageInfo = itemsResult?.node?.items?.pageInfo;
        
        // Look for the issue in this batch
        const item = items.find((it: any) => it.content?.id === issueId);
        if (item) {
          return item.id;
        }
        
        hasNextPage = pageInfo?.hasNextPage || false;
        endCursor = pageInfo?.endCursor;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting project item ID for issue #${issueNumber}:`, error);
      return null;
    }
  }

  /**
   * Get the Kind field value for a specific project item
   */
  async getIssueKind(projectId: string, itemId: string): Promise<string | null> {
    try {
      const query = `
        query GetProjectItemKind($projectId: ID!, $itemId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              item(id: $itemId) {
                fieldValues(first: 100) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      __typename
                      name
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      __typename
                      text
                      field {
                        ... on ProjectV2Field {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const result: any = await this.makeGraphQLRequest<any>(query, { 
        projectId, 
        itemId 
      });
      
      const fieldValues = result?.node?.item?.fieldValues?.nodes || [];
      
      for (const fv of fieldValues) {
        if (fv?.field?.name && fv.field.name.toLowerCase() === 'kind') {
          return fv.name || fv.text || null;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting Kind field for item ${itemId}:`, error);
      return null;
    }
  }

  /**
   * Update status for multiple issues in a report with repository information
   */
  async updateIssuesStatusWithRepos(
    issues: Array<{ issueNumber: number; repository: string }>,
    newStatus: string
  ): Promise<{
    success: boolean;
    updated: number;
    failed: number;
    errors: Array<{ issueNumber: number; error: string }>;
  }> {
    try {
      // Get the Roadmap project ID first
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
      const projectResult: any = await this.makeGraphQLRequest<any>(projectQuery, { owner: 'giantswarm' });
      const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
      if (!roadmapProject) {
        throw new Error('Roadmap project not found');
      }

      // Get status field configuration
      const statusConfig = await this.getStatusFieldConfiguration();
      const targetOption = statusConfig.options.find(opt => opt.name === newStatus);
      
      if (!targetOption) {
        throw new Error(`Status option "${newStatus}" not found`);
      }

      const results = {
        success: true,
        updated: 0,
        failed: 0,
        errors: [] as Array<{ issueNumber: number; error: string }>
      };

      // Process each issue
      for (const { issueNumber, repository } of issues) {
        try {
          console.log(`DEBUG: Processing issue #${issueNumber} from repository ${repository}`);
          
          // Get the project item ID and check the Kind field for this issue
          const itemId = await this.getProjectItemIdWithRepo(issueNumber, repository);
          if (!itemId) {
            results.failed++;
            results.errors.push({
              issueNumber,
              error: `Issue not found in Roadmap project (repository: ${repository})`
            });
            continue;
          }

          // Get the Kind field for this issue to check if it's an Epic
          const issueKind = await this.getIssueKind(roadmapProject.id, itemId);
          if (issueKind === 'Epic 🎯') {
            console.log(`DEBUG: Skipping Epic issue #${issueNumber} (Kind: ${issueKind})`);
            results.failed++;
            results.errors.push({
              issueNumber,
              error: 'Cannot update status for Epic issues'
            });
            continue;
          }

          console.log(`DEBUG: Issue #${issueNumber} is not an Epic (Kind: ${issueKind}), proceeding with update`);

          // Update the status
          const updateResult = await this.updateProjectItemStatus(
            roadmapProject.id,
            itemId,
            statusConfig.fieldId,
            targetOption.id
          );

          if (updateResult.success) {
            results.updated++;
            console.log(`DEBUG: Successfully updated status for issue #${issueNumber}`);
          } else {
            results.failed++;
            results.errors.push({
              issueNumber,
              error: updateResult.message
            });
          }

          // Add a small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.failed++;
          results.errors.push({
            issueNumber,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      if (results.failed > 0) {
        results.success = false;
      }

      return results;
    } catch (error) {
      console.error('Error updating issues status:', error);
      throw error;
    }
  }

  /**
   * Get project item ID for an issue with repository information
   */
  async getProjectItemIdWithRepo(issueNumber: number, repository: string): Promise<string | null> {
    try {
      // 1. Get the Roadmap project ID
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
      const projectResult: any = await this.makeGraphQLRequest<any>(projectQuery, { owner: 'giantswarm' });
      const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
      if (!roadmapProject) {
        throw new Error('Roadmap project not found');
      }

      // 2. Search for the issue in the specified repository
      const issueQuery = `
        query GetIssueInProject($owner: String!, $repo: String!, $issueNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
              id
            }
          }
        }
      `;
      const issueResult: any = await this.makeGraphQLRequest<any>(issueQuery, { 
        owner: 'giantswarm', 
        repo: repository, 
        issueNumber 
      });
      const issueId = issueResult?.repository?.issue?.id;
      if (!issueId) {
        throw new Error(`Issue #${issueNumber} not found in repository ${repository}`);
      }

      // 3. Find the project item for this issue
      let hasNextPage = true;
      let endCursor = null;
      
      while (hasNextPage) {
        const itemsQuery = `
          query GetProjectItems($projectId: ID!, $after: String) {
            node(id: $projectId) {
              ... on ProjectV2 {
                items(first: 100, after: $after) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    id
                    content {
                      ... on Issue {
                        id
                        number
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        
        const itemsResult: any = await this.makeGraphQLRequest<any>(itemsQuery, { 
          projectId: roadmapProject.id,
          after: endCursor
        });
        
        const items = itemsResult?.node?.items?.nodes || [];
        const pageInfo = itemsResult?.node?.items?.pageInfo;
        
        // Look for the issue in this batch
        const item = items.find((it: any) => it.content?.id === issueId);
        if (item) {
          return item.id;
        }
        
        hasNextPage = pageInfo?.hasNextPage || false;
        endCursor = pageInfo?.endCursor;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting project item ID for issue #${issueNumber} in repository ${repository}:`, error);
      return null;
    }
  }

  /**
   * Update status for multiple issues using stored project item IDs
   */
  async updateIssuesStatusWithProjectItemIds(
    issues: Array<{ issueNumber: number; repository: string; projectItemId: string; kind?: string }>,
    newStatus: string
  ): Promise<{
    success: boolean;
    updated: number;
    failed: number;
    errors: Array<{ issueNumber: number; error: string }>;
  }> {
    try {
      // Get the Roadmap project ID first
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
      const projectResult: any = await this.makeGraphQLRequest<any>(projectQuery, { owner: 'giantswarm' });
      const roadmapProject = projectResult?.organization?.projectsV2?.nodes?.find((p: any) => p.title === 'Roadmap');
      if (!roadmapProject) {
        throw new Error('Roadmap project not found');
      }

      // Get status field configuration
      const statusConfig = await this.getStatusFieldConfiguration();
      const targetOption = statusConfig.options.find(opt => opt.name === newStatus);
      
      if (!targetOption) {
        throw new Error(`Status option "${newStatus}" not found`);
      }

      const results = {
        success: true,
        updated: 0,
        failed: 0,
        errors: [] as Array<{ issueNumber: number; error: string }>
      };

      // Process each issue
      for (const { issueNumber, repository, projectItemId, kind } of issues) {
        try {
          console.log(`DEBUG: Processing issue #${issueNumber} from repository ${repository} (Kind: ${kind})`);
          
          // Check if it's an Epic first
          if (kind === 'Epic 🎯') {
            console.log(`DEBUG: Skipping Epic issue #${issueNumber} (Kind: ${kind})`);
            results.failed++;
            results.errors.push({
              issueNumber,
              error: 'Cannot update status for Epic issues'
            });
            continue;
          }

          console.log(`DEBUG: Issue #${issueNumber} is not an Epic (Kind: ${kind}), proceeding with update`);

          // Update the status using the stored project item ID
          const updateResult = await this.updateProjectItemStatus(
            roadmapProject.id,
            projectItemId,
            statusConfig.fieldId,
            targetOption.id
          );

          if (updateResult.success) {
            results.updated++;
            console.log(`DEBUG: Successfully updated status for issue #${issueNumber}`);
          } else {
            results.failed++;
            results.errors.push({
              issueNumber,
              error: updateResult.message
            });
          }

          // Add a small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.failed++;
          results.errors.push({
            issueNumber,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      if (results.failed > 0) {
        results.success = false;
      }

      return results;
    } catch (error) {
      console.error('Error updating issues status with project item IDs:', error);
      throw error;
    }
  }
} 