# GitHub Issue Report Generator

A TypeScript application for generating comprehensive issue reports from GitHub Projects using the GitHub API.

## Features

- 🔍 Fetch issues from GitHub Projects with filtering by Team and Status
- 📊 Generate detailed issue reports with proper categorization
- 🎯 Group issues by Kind (Story, Request, Postmortem, Other)
- 📝 Create TL;DR summaries with appropriate tense based on status
- 🌐 Modern web UI for easy report generation
- ⚡ Built-in rate limiting and error handling
- 🔐 Secure token-based authentication
- 📝 Comprehensive TypeScript types

## New Feature: Status Update Functionality

### Overview
The app now includes the ability to automatically update the Status field of all issues listed in a generated report. This feature follows the GitHub API development guidelines and uses GraphQL mutations to update ProjectV2 field values.

### How It Works
1. **Generate a Report**: Create a report for a specific team and status
2. **Select New Status**: Choose the desired new status from the dropdown
3. **Update All Issues**: Click "Update All Issues Status" to automatically update all issues in the report
4. **Review Results**: See detailed feedback on which issues were successfully updated

### Technical Implementation
- **GraphQL Mutations**: Uses `updateProjectV2ItemFieldValue` mutation
- **Rate Limiting**: Respects GitHub API rate limits with built-in delays
- **Error Handling**: Comprehensive error reporting for failed updates
- **Batch Processing**: Processes multiple issues efficiently
- **Schema Discovery**: Dynamically discovers field configurations

### API Endpoints
- `POST /api/update-report-status`: Updates status for all issues in a report
  - Body: `{ report: string, newStatus: string }`
  - Response: `{ success: boolean, updated: number, failed: number, totalIssues: number, errors: Array, message: string }`

## Prerequisites

- Node.js 16+ 
- npm or yarn
- GitHub Personal Access Token

### Getting a GitHub Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select the following scopes:
   - `repo` (for private repositories)
   - `public_repo` (for public repositories)
   - `read:org` (for organization projects)
4. Copy the generated token

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp env.example .env
```

3. Edit `.env` and add your GitHub token:
```env
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_API_BASE_URL=https://api.github.com
```

## Usage

### Quick Start

The easiest way to run the application is using the startup script:

```bash
./start.sh
```

This will:
- Check for required dependencies and install them if needed
- Build the frontend if necessary
- Start the server on http://localhost:3001

### Manual Setup

If you prefer to run the components separately:

1. Start the backend server:
```bash
npm run server:dev
```

2. In a new terminal, start the frontend (optional - for development):
```bash
cd ui && npm start
```

3. Open [http://localhost:3001](http://localhost:3001) in your browser

4. Select Team and Status, then click "Generate Report"

**Features:**
- 🎨 Modern, responsive design
- 📊 Real-time report preview with markdown rendering
- 📋 Copy to clipboard functionality
- 💾 Download as markdown file
- ⚡ Loading states and error handling
- 🎯 Filter by Team and Status with viable options only

## Report Features

### Issue Categorization
- **Roadmap**: Story issues organized by parent initiatives
- **Customer Work**: Request issues with customer-focused language
- **Operational Work**: Postmortem issues for platform improvements
- **Other Issues**: Uncategorized issues and miscellaneous work

### Smart Tense Handling
Reports automatically use appropriate tense based on issue status:
- **Past tense** (Validation/Done): "We completed", "delivered", "resolved"
- **Present tense** (In Progress): "We are working on", "are delivering", "are resolving"
- **Future tense** (others): "We plan to work on", "plan to deliver", "plan to resolve"

### TL;DR Summaries
Each report includes a concise summary with:
- Parent initiative progress
- Customer request counts with examples
- Operational issue counts with examples
- Other issue counts with examples

### Epic Handling
- Epic issues are excluded from all sections except as parents
- Only Epics with children in the report are shown as parent initiatives

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/roadmap-options` - Get available teams and statuses
- `POST /api/generate-report` - Generate issue report
- `POST /api/update-report-status` - Update report status

### Example API Usage

```bash
# Get available options
curl http://localhost:3001/api/roadmap-options

# Generate a report
curl -X POST http://localhost:3001/api/generate-report \
  -H "Content-Type: application/json" \
  -d '{"team":"Atlas 🗺️","status":"In Progress ⛏️"}'

# Update report status
curl -X POST http://localhost:3001/api/update-report-status \
  -H "Content-Type: application/json" \
  -d '{"report":"# Team Atlas Issue Report...","newStatus":"Done ✅"}'
```

## Project Structure

```
issue-report-app/
├── src/                   # Backend source code
│   ├── services/          # GitHub API and report generation services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── config/            # Configuration files
│   └── server.ts          # Express server setup
├── ui/                    # React frontend
│   ├── src/               # React source code
│   ├── public/            # Static assets
│   └── build/             # Production build (generated)
├── package.json           # Backend dependencies
├── tsconfig.json          # TypeScript configuration
├── .gitignore             # Git ignore rules
├── env.example            # Environment variables template
└── start.sh               # Startup script
```

## Development

The application is built with:
- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, TypeScript
- **API**: GitHub REST and GraphQL APIs
- **Styling**: CSS modules

### Development Commands

```bash
# Backend development
npm run server:dev          # Start development server
npm run build              # Build TypeScript
npm run lint               # Run ESLint

# Frontend development
cd ui
npm start                  # Start React development server
npm run build              # Build for production
npm test                   # Run tests
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes |
| `GITHUB_API_BASE_URL` | GitHub API base URL | No (defaults to https://api.github.com) |
| `PORT` | Server port | No (defaults to 3001) |

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
   - Run `npm install` to install dependencies
   - Run `cd ui && npm install` to install frontend dependencies

2. **"Port already in use" errors**
   - Kill existing processes: `pkill -f "ts-node src/server.ts"`
   - Or change the port in the environment variables

3. **GitHub API rate limiting**
   - Check your token permissions
   - The app includes built-in rate limiting handling

4. **Frontend not loading**
   - Ensure the UI is built: `cd ui && npm run build`
   - Check that the server is running on port 3001

### Debug Mode

To enable debug logging, set the `DEBUG` environment variable:

```bash
DEBUG=* npm run server:dev
```

## License

MIT License 