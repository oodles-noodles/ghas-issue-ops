# GitHub Advanced Security (GHAS) IssueOps Enablement

A comprehensive GitHub Actions solution that provides a **reusable workflow** for enabling GitHub Advanced Security (GHAS) features across repositories and organizations. Primarily designed for IssueOps-driven automation, but flexible enough to be cal5. **Forward Compatibility**: Enables new integration patterns (API calls, scheduled jobs, etc.)

### Reusable Workflow Interface

#### Inputs

| Input | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `issue_number` | ✅ | number | - | Issue number for result reporting and optional data parsing |
| `repositories` | ❌ | string | - | JSON array of repository URLs (parsed from issue if not provided) |
| `enable_secret_scanning` | ❌ | boolean | - | Enable Secret Scanning (parsed from issue if not provided) |
| `enable_code_scanning` | ❌ | boolean | - | Enable Code Scanning (parsed from issue if not provided) |
| `enable_dependabot_alerts` | ❌ | boolean | - | Enable Dependabot Alerts (parsed from issue if not provided) |
| `min_remaining_licenses` | ❌ | number | 1 | Minimum licenses to keep available |
| `skip_license_check` | ❌ | boolean | false | Skip license availability checking |
| `dry_run` | ❌ | boolean | false | Preview mode without making changes |

#### Required Secrets

| Secret | Purpose |
|--------|---------|
| `GHES_API_TOKEN_1` | Primary GitHub Enterprise Server API token |
| `GHES_API_TOKEN_2` | Secondary GHES instance token (optional) |
| `GH_ENTERPRISE_TOKEN_CLOUD` | GitHub Enterprise Cloud license management |

#### Outputs

The workflow provides comprehensive reporting through:
- **Issue Comments**: Detailed results posted to the triggering issue
- **Workflow Logs**: Technical details and debugging information
- **Job Status**: Success/failure status for monitoring and automation

### Integration Examples

#### Scheduled GHAS Enablement
```yaml
name: Weekly GHAS Enablement
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
jobs:
  enable-ghas:
    uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
    with:
      issue_number: 1
      repositories: '["https://github.com/org/new-repo"]'
      enable_secret_scanning: true
      dry_run: false
    secrets: inherit
```

#### Repository Template Integration
```yaml
# In repository templates
name: Auto-enable GHAS on new repos
on:
  create:
jobs:
  enable-ghas:
    if: github.ref == 'refs/heads/main'
    uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
    with:
      issue_number: 1
      repositories: '["${{ github.server_url }}/${{ github.repository }}"]'
      enable_secret_scanning: true
      enable_code_scanning: true
    secrets: inherit
```ed from any GitHub Actions workflow with automatic license availability checking and comprehensive dry run analysis.

## Key Features

- **Reusable workflow architecture**: Core functionality packaged as a reusable workflow that can be called from any repository
- **IssueOps-driven automation**: Primary use case enables GHAS features by simply creating an issue
- **Flexible integration**: Can be triggered from issues, other workflows, or external automation systems
- **Organization-wide enablement**: Process all repositories within an organization with a single request
- **Multiple GHAS features**: Enable Secret Scanning, Code Scanning, and/or Dependabot Alerts
- **Advanced license management**: Automatically checks license availability using 90-day committer analysis
- **Comprehensive dry run mode**: Preview all changes, license impacts, and repository validation before making changes
- **Multi-instance support**: Configure and manage multiple GitHub Enterprise Server instances
- **Robust error handling**: Validates repositories during enablement with detailed error reporting
- **Fault tolerance**: Continues processing valid repositories even when some URLs are invalid
- **Enterprise Server support**: Works seamlessly with GitHub Enterprise Server instances

## How It Works

The solution is built around a **reusable workflow architecture** that provides maximum flexibility:

### Primary Use Case: IssueOps Automation
1. **Issue Creation**: Users create a new issue using the "GHAS Enablement Request" template
2. **Automatic Parsing**: The reusable workflow automatically parses the issue form data
3. **License Analysis**: For each repository, the workflow:
   - Analyzes commit history from the last 90 days to identify committers
   - Checks GHAS license availability based on new committers
   - Provides comprehensive dry run analysis showing license impact
4. **GHAS Enablement**: If sufficient licenses are available:
   - Enables Advanced Security on repositories
   - Enables the selected GHAS features (Secret Scanning, Code Scanning, Dependabot Alerts)
5. **Results Reporting**: Updates the issue with detailed results per enterprise instance

### Alternative Use Cases
The reusable workflow can also be called directly from:
- Other GitHub Actions workflows
- External automation systems
- Scheduled workflows
- Manual workflow dispatch triggers

## Reusable Workflow Architecture

The implementation is designed as a modern reusable workflow with two components:

### 1. Caller Workflow (`ghas-enablement.yml`)
- **Purpose**: Entry point triggered by issue creation
- **Responsibility**: Passes issue number to reusable workflow
- **Size**: Ultra-lightweight (only 17 lines)
- **Location**: This repository (example implementation)

```yaml
name: GHAS Enablement Workflow
on:
  issues:
    types: [opened]
jobs:
  call-ghas-enablement:
    if: contains(github.event.issue.labels.*.name, 'ghas-enablement')
    uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
    with:
      issue_number: ${{ github.event.issue.number }}
    secrets: inherit
```

### 2. Reusable Workflow (`ghas-enablement-action.yml`)
- **Purpose**: Contains all core GHAS enablement logic
- **Flexibility**: Can be called from any repository or workflow
- **Features**: Issue parsing, license checking, GHAS enablement, result reporting
- **Input Modes**: Supports both issue-based and direct parameter modes

### Deployment Options

#### Option A: Deploy Both Files (Recommended for New Implementations)
Deploy both workflows to your repository for a complete IssueOps solution.

#### Option B: Use as External Reusable Workflow
Call the reusable workflow from any repository without deploying the full solution:

```yaml
# In your workflow file
uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
with:
  issue_number: ${{ github.event.issue.number }}  # For issue-based calls
  # OR provide direct parameters for API-based calls
secrets: inherit
```

### Usage Modes

The reusable workflow supports two primary usage patterns:

#### Mode 1: Issue-Based (Recommended for IssueOps)
Automatically parses issue form data - only requires the issue number:

```yaml
uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
with:
  issue_number: ${{ github.event.issue.number }}
secrets: inherit
```

**Benefits:**
- Simple caller workflow (minimal configuration)
- Automatic parsing of issue form data
- Built-in result reporting to the issue
- User-friendly interface via GitHub Issues

#### Mode 2: Direct API/Parameter Mode
Provide all parameters directly, bypassing issue parsing:

```yaml
uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
with:
  issue_number: 123  # Still required for result reporting
  repositories: '["https://github.com/org/repo1", "https://github.com/org/repo2"]'
  enable_secret_scanning: true
  enable_code_scanning: true
  enable_dependabot_alerts: false
  min_remaining_licenses: 5
  skip_license_check: false
  dry_run: true
secrets: inherit
```

**Benefits:**
- Direct integration with automation systems
- No dependency on issue form templates
- Programmatic control over all parameters
- Can be called from external systems via GitHub API

#### Hybrid Mode
Combine both approaches - provide some parameters directly while letting others be parsed from the issue:

```yaml
uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
with:
  issue_number: ${{ github.event.issue.number }}
  dry_run: true  # Override issue setting
  min_remaining_licenses: 10  # Override issue setting
secrets: inherit
```

## Prerequisites

This workflow requires:

1. **GitHub Enterprise Server instance** with GHAS licenses
2. **Personal Access Tokens** stored as repository secrets:
   - `GHES_API_TOKEN_1` - For primary GHES instance
   - `GHES_API_TOKEN_2` - For secondary GHES instance (optional)
   - `GH_ENTERPRISE_TOKEN_CLOUD` - For GitHub Enterprise Cloud license management
3. **Token permissions**:
   - `repo` - Full control of private repositories
   - `admin:org` - For organization settings
   - `security_events` - For code scanning and secret scanning

## Configuration

The workflow is configured via `config.yaml` which defines:
- GitHub Enterprise Server instances and their API endpoints
- Authentication variables for each instance
- GitHub Enterprise Cloud configuration for license management

The default configuration maintains a minimum of 1 unused GHAS license, which can be adjusted in the issue form.

## Usage

### For End Users (IssueOps)

1. Navigate to the "Issues" tab of the repository where this workflow is deployed
2. Click "New Issue"
3. Select "GHAS Enablement Request" template
4. Fill out the form with:
   - List of repository and/or organization URLs (one per line)
     - For repositories: `https://github.example.com/org-name/repo-name`
     - For organizations: `https://github.example.com/org-name`
   - Select which GHAS features to enable
   - Optionally specify minimum remaining licenses (default: 1)
   - Optionally choose to skip license checking (for special cases)
   - Optionally use dry run mode to preview changes without applying them
5. Submit the issue
6. The workflow will automatically run and comment on the issue with results for each enterprise instance

### For Developers (Reusable Workflow Integration)

#### Quick Start: Use as External Reusable Workflow
To integrate GHAS enablement into your existing workflows without deploying this entire solution:

```yaml
# .github/workflows/your-workflow.yml
name: Your Custom GHAS Workflow
on:
  workflow_dispatch:
    inputs:
      repositories:
        description: 'Repositories to enable GHAS for'
        required: true
        type: string

jobs:
  enable-ghas:
    runs-on: ubuntu-latest
    steps:
      - name: Enable GHAS
        uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
        with:
          issue_number: 1  # Dummy issue number for reporting
          repositories: ${{ github.event.inputs.repositories }}
          enable_secret_scanning: true
          enable_code_scanning: true
          dry_run: false
        secrets: inherit
```

#### Full Deployment: Complete IssueOps Solution
1. Fork or copy this repository to your organization
2. Update `config.yaml` with your Enterprise Server details
3. Configure the required secrets in your repository settings
4. Customize the issue template if needed
5. Deploy and use via Issues as described above

### Using Dry Run Mode

Dry run mode allows you to preview what would happen if you enable GHAS features without actually making any changes:

1. Select "Yes" for the "Dry Run Mode" option when creating your issue
2. The workflow will analyze repositories, check licenses, and list what actions would be taken
3. A detailed report will be generated showing:
   - License availability analysis
   - New committers requiring licenses
   - Repositories that would be enabled
   - Features that would be applied
4. To proceed with actual enablement, create a new issue with the same settings but with "Dry Run Mode" set to "No"

## Customization

### Workflow Customization

#### For the Caller Workflow (`ghas-enablement.yml`)
You can modify the trigger conditions:
```yaml
# Change trigger from issues to other events
on:
  workflow_dispatch:  # Manual trigger
  schedule:           # Scheduled trigger
    - cron: '0 9 * * 1'
  push:              # Code push trigger
    paths: ['ghas-config.yaml']
```

#### For the Reusable Workflow (`ghas-enablement-action.yml`)
Common customizations include:
- **GHAS Features**: Modify which features can be enabled
- **License Logic**: Adjust the permission checking and threshold logic
- **Repository Filtering**: Add additional filters for organization repositories
- **Error Handling**: Customize error messages and notification mechanisms
- **Result Formatting**: Modify how results are presented in issue comments

#### Configuration File (`config.yaml`)
Customize enterprise instances and settings:
```yaml
# Add additional GHES instances
enterprises:
  - name: "production"
    api_url: "https://github.company.com/api/v3"
    token_var: "GHES_API_TOKEN_PROD"
  - name: "staging"
    api_url: "https://github-staging.company.com/api/v3"
    token_var: "GHES_API_TOKEN_STAGING"
```

### Integration Patterns

#### Custom Wrapper Workflows
Create your own wrapper that adds business logic:
```yaml
name: Custom GHAS Enablement
on:
  workflow_dispatch:
jobs:
  validate-request:
    runs-on: ubuntu-latest
    steps:
      # Custom validation logic
      - name: Validate repositories
        run: echo "Custom validation here"
  
  enable-ghas:
    needs: validate-request
    uses: your-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
    with:
      issue_number: 1
      repositories: ${{ github.event.inputs.repositories }}
    secrets: inherit
```

#### Multi-Organization Deployment
Deploy across multiple organizations:
```yaml
# Organization A
uses: central-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main

# Organization B  
uses: central-org/ghas-issue-ops/.github/workflows/ghas-enablement-action.yml@main
```

## License Management and Checking

The workflow uses the following process to manage GHAS licenses:
1. Retrieves license information from GitHub Enterprise Cloud
2. Analyzes repository committers from the last 90 days
3. Compares repository committers against existing GHAS committers to identify new license requirements
4. Checks if enabling the selected features would leave at least the specified minimum licenses available (default: 1) after accounting for new committers
5. If sufficient licenses remain available, enables the selected features on ALL repositories
6. If enabling would reduce licenses below the threshold, no repositories are enabled
7. Option to skip license checking entirely for special cases (e.g., when licenses are managed separately)

## Technical Implementation

### Core Architecture

The solution is built around a **reusable workflow pattern** that provides:

- **Separation of Concerns**: Trigger logic separated from core functionality
- **Reusability**: Core workflow can be called from any repository
- **Flexibility**: Supports both issue-based and direct parameter modes
- **Maintainability**: Single source of truth for GHAS enablement logic

### Technology Stack

- **GitHub Actions Reusable Workflows**: Primary architecture pattern
- **Native JavaScript** with js-yaml for YAML parsing and configuration
- **Modular helper functions** in the `/scripts` directory for improved maintainability
- **GitHub Actions matrix jobs** to parallelize enablement across different Enterprise instances
- **GitHub CLI (gh)** for API interactions with both GitHub.com and GitHub Enterprise Server
- **GitHub Enterprise Cloud API** for license information

### Workflow Architecture Details

The implementation consists of two workflow files optimized for different use cases:

#### 1. Caller Workflow (`ghas-enablement.yml`)
- **Trigger**: Issues with the 'ghas-enablement' label
- **Function**: Ultra-lightweight entry point (17 lines total)
- **Responsibility**: Pass issue number to reusable workflow
- **Benefits**: Minimal maintenance overhead, easy to customize triggers

#### 2. Reusable Workflow (`ghas-enablement-action.yml`)
- **Type**: `workflow_call` reusable workflow
- **Function**: Contains all core implementation logic
- **Input Flexibility**: 
  - **Issue Mode**: Automatically parses issue form data when only `issue_number` provided
  - **Direct Mode**: Accepts all parameters directly for API/automation integration
  - **Hybrid Mode**: Combines issue parsing with parameter overrides
- **Capabilities**:
  - Groups repositories by GHES instance
  - Performs license checks and enables GHAS features
  - Posts results back to the triggering issue
  - Handles error scenarios gracefully

#### Key Design Benefits

1. **Modularity**: Core logic separated from trigger mechanism
2. **Reusability**: Other repositories can consume the workflow without duplication
3. **Testability**: Reusable workflow can be tested independently
4. **Scalability**: Can be called from multiple repositories simultaneously
5. **Backward Compatibility**: Supports existing issue-based workflows
6. **Forward Compatibility**: Enables new integration patterns (API calls, scheduled jobs, etc.)

The workflow is structured to be maintainable and adaptable:
- **Centralized configuration** with `config.yaml` for managing multiple GHES instances
- **Organization URL expansion** to process all repositories within an organization
- **Advanced Security verification** to ensure it's enabled before enabling specific features
- **Robust error handling** with fallback mechanisms for comment posting
- **Hostname-specific filtering** to ensure organization URLs are only processed by the correct enterprise instance

## Troubleshooting

Common issues:
- **Insufficient permissions**: Ensure the tokens have appropriate permissions (repo, admin:org, security_events)
- **URL format issues**: Repository URLs should be fully qualified URLs (e.g., https://github.example.com/org/repo)
- **Organization URL format**: Organization URLs should point to the organization root (e.g., https://github.example.com/org)
- **API endpoint errors**: Verify your Enterprise Server URL in config.yaml
- **Comment posting issues**: The workflow has fallback mechanisms but check workflow permissions
- **License check failures**: Verify the GitHub Enterprise Cloud configuration in config.yaml
- **Invalid repository URLs**: The workflow automatically detects invalid repository URLs during enablement and provides specific error messages (404 Not Found, 403 Access Denied, etc.) in the results comment

## Advanced Features

- **Organization-wide enablement**: Specify an organization URL to process all repositories it contains
- **Enterprise-specific filtering**: Organization URLs are filtered per enterprise instance to ensure correct processing
- **Advanced Security verification**: The workflow checks and enables Advanced Security if not already enabled
- **Committer-based license analysis**: Analyzes repository commit history to accurately estimate license requirements
- **License checking bypass**: Option to skip license checking for special situations
- **Robust comment posting**: Fallback mechanisms ensure comments are posted even with permission issues