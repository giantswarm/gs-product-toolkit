## GitHub API Development Context
You are developing code to interact with the GitHub API for various automation, data analysis, and integration purposes. This guide provides essential context and guardrails for working with GitHub's REST and GraphQL APIs effectively.

### Core Principles
- **Rate Limiting Awareness:** Always respect GitHub's rate limits and implement proper handling
- **API Selection:** Choose the right API (REST vs GraphQL) based on your specific use case
- **Error Handling:** Implement robust error handling for API failures and edge cases
- **Authentication:** Use appropriate authentication methods (Personal Access Token, OAuth, etc.)
- **Pagination:** Always handle pagination for large datasets
- **Type Safety:** Use TypeScript interfaces for API responses when possible
- **Schema Discovery:** Always use introspection (GraphQL) or documentation (REST) instead of guessing field names
- **Dynamic Data:** Never hardcode issue numbers, repository names, or field values - always fetch from the API
- **Code Reuse:** Reuse existing functionality and store fetched data instead of redundant API calls
- **Safety First:** Prioritize safety when testing against production data

### API Selection Guidelines

#### When to Use GraphQL
- **Complex queries** requiring data from multiple resources
- **Project management** (ProjectsV2, items, field values)
- **Issue relationships** (parent/child issues, linked projects)
- **Bulk data fetching** with specific field selection
- **Real-time data** where you need specific fields only
- **Nested data structures** that would require multiple REST calls

#### When to Use REST
- **Simple CRUD operations** (create, read, update, delete)
- **File operations** (commits, blobs, trees)
- **Webhook handling** and event processing
- **Authentication flows** and OAuth
- **Repository management** (branches, tags, releases)
- **Legacy integrations** that already use REST
- **Simple data retrieval** where GraphQL complexity isn't needed

#### Important Note: Both APIs Are Active
- **REST API**: Fully supported, versioned (v2022-11-28), actively maintained
- **GraphQL API**: Fully supported, actively maintained
- **Choose based on use case**, not deprecation status

### Project Management (ProjectsV2) Specifics

#### Key Learnings
- **Project Items Query:** Use `node(id: $projectId)` with `... on ProjectV2` for project queries
- **Field Values:** Access via `fieldValues` with proper union type handling
- **Content Types:** Always check `content.__typename` before processing items
- **Pagination:** ProjectsV2 items require pagination with `first` and `after` parameters
- **Field Extraction:** Handle different field value types (SingleSelect, Text, User, etc.)

#### Common Field Value Types
```typescript
// Single Select Fields
... on ProjectV2ItemFieldSingleSelectValue {
  name
  field {
    ... on ProjectV2SingleSelectField {
      name
    }
  }
}

// Text Fields
... on ProjectV2ItemFieldTextValue {
  text
  field {
    ... on ProjectV2Field {
      name
    }
  }
}

// User Fields
... on ProjectV2ItemFieldUserValue {
  users {
    nodes {
      login
      name
    }
  }
}
```

### GraphQL Query Best Practices

#### Query Structure
```graphql
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
              parent {
                number
                title
                url
              }
            }
          }
          fieldValues(first: 100) {
            nodes {
              # Handle union types properly
            }
          }
        }
      }
    }
  }
}
```

#### Pagination Implementation
```typescript
const results: any[] = [];
let hasNextPage = true;
let endCursor = null;

while (hasNextPage) {
  const response = await makeGraphQLRequest(query, { 
    projectId, 
    after: endCursor 
  });
  
  const items = response?.node?.items?.nodes || [];
  const pageInfo = response?.node?.items?.pageInfo;
  
  // Process items...
  
  hasNextPage = pageInfo?.hasNextPage || false;
  endCursor = pageInfo?.endCursor;
}
```

### Error Handling and Rate Limiting

#### Rate Limiting
```typescript
private updateRateLimitInfo(response: AxiosResponse): void {
  const remaining = response.headers['x-ratelimit-remaining'];
  const resetTime = response.headers['x-ratelimit-reset'];
  
  if (remaining !== undefined) {
    this.requestCount = parseInt(remaining);
  }
  
  if (resetTime !== undefined) {
    this.resetTime = parseInt(resetTime) * 1000;
  }
}

isRateLimitExceeded(): boolean {
  return this.requestCount <= 0 && Date.now() < this.resetTime;
}
```

#### GraphQL Error Handling
```typescript
private async makeGraphQLRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
  try {
    const response = await this.graphqlClient.post('', {
      query,
      variables
    });
    
    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors);
      throw new GitHubAPIError('GraphQL query failed', 400, response.data);
    }
    
    return response.data.data;
  } catch (error) {
    throw this.handleAPIError(error);
  }
}
```

### Data Processing Patterns

#### Field Value Extraction
```typescript
function extractFieldValues(fieldValues: any[]): {
  status?: string;
  team?: string;
  kind?: string;
} {
  let status, team, kind;
  
  for (const fv of fieldValues) {
    if (fv?.field?.name) {
      const fname = fv.field.name.toLowerCase();
      if (fname === 'status') status = fv.name || fv.text;
      if (fname === 'team') team = fv.name || fv.text;
      if (fname === 'kind') kind = fv.name || fv.text;
    }
  }
  
  return { status, team, kind };
}
```

#### Content Type Filtering
```typescript
for (const item of items) {
  if (item.content?.__typename !== 'Issue') continue;
  
  // Process issue content...
}
```

### Schema Discovery and Validation

#### CRITICAL: Never Guess Field Names or Hardcode Values
- **Always use introspection** for GraphQL API field discovery
- **Always consult documentation** for REST API field names
- **Field names can change** between API versions
- **Union types require specific handling** that introspection reveals
- **Never hardcode issue numbers, repository names, or field values** - always fetch from the API
- **Use dynamic discovery** for all data relationships and identifiers

#### GraphQL Introspection Best Practices
- **Start with introspection** before writing any GraphQL query
- **Use specific type queries** to understand field structures
- **Check union types** to understand all possible field value types
- **Validate field existence** before using in production code

#### Example Introspection Queries
```graphql
# Get all possible types for a union
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
        }
      }
    }
  }
}

# Get specific type details
query IntrospectSingleSelectField {
  __type(name: "ProjectV2ItemFieldSingleSelectValue") {
    name
    description
    fields {
      name
      description
      type {
        name
        kind
      }
    }
  }
}
```

#### Validation Process
1. **GraphQL**: Run introspection queries first
2. **REST**: Check official documentation
3. **Test**: Use small data sets to verify
4. **Validate**: Handle all possible field types
5. **Document**: Record discovered field names for your use case
6. **Dynamic**: Ensure all identifiers are fetched from API, not hardcoded

### Debugging and Troubleshooting

#### Common Issues and Solutions
1. **"Field doesn't accept argument 'query'"** - ProjectsV2 items don't support text search
2. **"Item type: undefined"** - Check content.__typename before processing
3. **"No field values found"** - Verify fieldValues.nodes exists and has content
4. **"Rate limit exceeded"** - Implement exponential backoff and retry logic
5. **"Field not found"** - Use introspection to discover correct field names
6. **"Union type error"** - Check all possible types in union via introspection
7. **"Unexpected field value"** - Validate field types against introspection results
8. **"Hardcoded values"** - Always fetch identifiers from API, never hardcode issue numbers or repository names

#### Debug Logging
```typescript
// Add debug logging for field extraction
console.log(`DEBUG: Processing issue #${item.content.number} with ${item.fieldValues.nodes.length} field values`);
console.log(`DEBUG: Raw field value:`, JSON.stringify(fv, null, 2));
console.log(`DEBUG: Field value type: ${fv.__typename}`);
console.log(`DEBUG: Field name: ${fv?.field?.name}`);

// Log introspection results for troubleshooting
console.log(`DEBUG: Available field types:`, availableFieldTypes);
console.log(`DEBUG: Expected field structure:`, expectedFieldStructure);
```

### Performance and Optimization

#### Optimization Strategies
- **Batch Processing:** Process items in chunks to avoid memory issues
- **Field Selection:** Only request needed fields in GraphQL queries
- **Caching:** Cache project IDs and field configurations
- **Parallel Processing:** Use Promise.all for independent operations
- **Early Termination:** Stop processing when target items are found
- **Data Reuse:** Store fetched data instead of redundant API calls

#### Memory Management
```typescript
// Process items in batches
const batchSize = 100;
const results: any[] = [];

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  // Process batch...
}
```

### Code Organization

#### Service Structure
```typescript
export class GitHubAPIService {
  private client: AxiosInstance;
  private graphqlClient: AxiosInstance;
  private requestCount = 0;
  private resetTime = Date.now();
  
  constructor() {
    // Initialize clients with authentication
  }
  
  // REST API methods
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue>
  
  // GraphQL API methods
  async getProjectsLinkedToIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubProject[]>
  
  // Utility methods
  private updateRateLimitInfo(response: AxiosResponse): void
  private handleAPIError(error: any): GitHubAPIError
  isRateLimitExceeded(): boolean
}
```

#### Type Definitions
```typescript
interface GitHubIssue {
  number: number;
  title: string;
  url: string;
  state: string;
  created_at: string;
  updated_at: string;
}

interface GitHubProject {
  id: string;
  title: string;
  number: number;
  url: string;
  status?: string;
  team?: string;
  kind?: string;
}
```

### Common Use Cases

#### Project Item Search
- **Filter by Status:** Search for items with specific status values
- **Filter by Team:** Find items assigned to specific teams
- **Filter by Kind:** Categorize items by type (Story, Task, Bug, etc.)
- **Parent/Child Relationships:** Handle issue hierarchies

#### Data Export and Reporting
- **Bulk Data Extraction:** Export project data for analysis
- **Status Tracking:** Monitor project progress over time
- **Team Workload:** Analyze team assignments and capacity
- **Custom Reports:** Generate tailored reports for stakeholders

### Safe Testing and Development Workflow

#### Safe Testing Against the GitHub API
- **Always prioritize safety when testing against the GitHub API.**
- **Never perform write or destructive operations (e.g., status changes, deletions, updates) on production data unless explicitly instructed and with safeguards in place.**
- **Prefer read-only test endpoints** (e.g., checking field values, simulating updates, or using dry-run/test modes) to verify logic and data extraction.
- **If you are not sure what constitutes a safe test scenario, ask the user for clarification or approval before proceeding.**
- **Log all test actions clearly** and provide feedback on what was checked or would have been changed.
- **Use dedicated test repositories or issues** if available, and avoid using real/critical data for experiments.
- **Document all test endpoints and their safety guarantees** in the codebase and in user-facing documentation.

#### Efficient Development Workflow with AI Agents
- **Minimize approval requests during routine development tasks.**
  - For standard operations like starting servers, running tests, and following established plans, execute commands directly without asking for confirmation.
  - Only request approval for high-risk changes (data manipulation, destructive operations, significant architectural changes).
- **Maintain development flow and momentum.**
  - Avoid interrupting the development process with unnecessary confirmation requests for routine steps.
  - Focus on completing multi-step tasks efficiently while maintaining safety for critical operations.
- **Balance caution with productivity.**
  - Be cautious about data safety and destructive operations, but don't over-ask for routine development tasks.
  - Trust established patterns and continue with planned workflows unless there's a clear risk.

### Security Considerations

#### Authentication
- **Token Management:** Store tokens securely, rotate regularly
- **Scope Limitation:** Use minimal required permissions
- **Environment Variables:** Never hardcode tokens in code
- **Audit Logging:** Log API usage for security monitoring

#### Data Handling
- **Input Validation:** Validate all user inputs
- **Output Sanitization:** Sanitize data before display
- **Error Messages:** Don't expose sensitive information in errors

### Future Development Guidelines

#### Extensibility
- **Modular Design:** Keep methods focused and composable
- **Configuration Driven:** Use config files for field mappings
- **Plugin Architecture:** Design for easy addition of new features
- **API Versioning:** Plan for GitHub API changes
- **Schema Discovery:** Automate introspection for field mapping updates

#### Maintenance
- **Documentation:** Keep API documentation updated
- **Monitoring:** Track API usage and performance
- **Testing:** Maintain comprehensive test coverage
- **Dependencies:** Keep dependencies updated and secure
- **Schema Validation:** Regularly run introspection to detect API changes

---

This guide should be updated as new patterns emerge and GitHub API features evolve. **AI agents working with this guideline document as context and guardrails should automatically update the context and instructions of the guideline whenever they learn something in a session that will help improve future sessions.** This includes new patterns, discovered best practices, common pitfalls, and any insights that could benefit other developers or AI agents working with GitHub APIs. Always refer to the [GitHub REST API documentation](https://docs.github.com/en/rest) and [GitHub GraphQL API documentation](https://docs.github.com/en/graphql) for the most current information.

### Current API Status (as of 2025)
- **REST API**: Fully supported, versioned (v2022-11-28), actively maintained
- **GraphQL API**: Fully supported, actively maintained
- **ProjectsV2**: Modern project management system (GraphQL only)
- **Projects (Classic)**: Legacy system (REST only, limited functionality) 