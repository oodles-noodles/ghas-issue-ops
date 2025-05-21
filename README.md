# GitHub Advanced Security (GHAS) IssueOps Enablement

A GitHub Actions workflow that uses IssueOps to automatically enable GitHub Advanced Security (GHAS) features across repositories and organizations based on user requests, with automatic license availability checking.

## Key Features

- **IssueOps-driven automation**: Enable GHAS features by simply creating an issue
- **Organization-wide enablement**: Process all repositories within an organization with a single request
- **Multiple GHAS features**: Enable Secret Scanning, Code Scanning, and/or Dependabot Alerts
- **License management**: Automatically checks license availability using committer analysis before enablement
- **Enterprise Server support**: Works with GitHub Enterprise Server instances
- **Multi-instance support**: Configure and manage multiple GHES instances

## How It Works

1. Users create a new issue using the "GHAS Enablement Request" template
2. The issue form collects:
   - URLs of repositories OR organizations to enable GHAS features on
   - Which GHAS features to enable (Secret Scanning, Code Scanning, Dependabot Alerts)
   - Option to skip license checking (for special cases)
   - Minimum remaining licenses threshold (optional)
3. The workflow automatically:
   - Parses the issue form data
   - For organization URLs, fetches all repositories within those organizations
   - Analyzes repository commit history from the last 90 days to identify committers
   - Checks GHAS license availability based on new committers (unless the skip option is selected)
   - Enables Advanced Security if not already enabled on the repository
   - Enables the selected GHAS features on ALL repositories if sufficient licenses are available
   - Updates the issue with detailed results per enterprise instance

## Prerequisites

This workflow requires:

1. A GitHub Enterprise Server instance with GHAS licenses
2. A Personal Access Token stored as a repository secret `GH_ENTERPRISE_TOKEN` with permissions:
   - `repo` - Full control of private repositories
   - `admin:org` - For organization settings
   - `security_events` - For code scanning and secret scanning

## Configuration

The workflow is configured to maintain a minimum of unused GHAS licenses (default: 1). This threshold can be adjusted directly in the issue form by specifying a value in the "Minimum Remaining Licenses" field.

The workflow uses GitHub Enterprise Cloud for license information by default, ensuring a centralized view of license usage across all repositories.

## Usage

1. Navigate to the "Issues" tab of this repository
2. Click "New Issue"
3. Select "GHAS Enablement Request" template
4. Fill out the form with:
   - List of repository and/or organization URLs (one per line)
     - For repositories: `https://github.example.com/org-name/repo-name`
     - For organizations: `https://github.example.com/org-name`
   - Select which GHAS features to enable
   - Optionally specify minimum remaining licenses (default: 1)
   - Optionally choose to skip license checking (for special cases)
5. Submit the issue
6. The workflow will automatically run and comment on the issue with results for each enterprise instance

## Customization

You can modify the workflow files to:
- Change the GHAS features that can be enabled
- Adjust the permission checking logic
- Change the default license threshold (currently 1)
- Add additional filters for repositories within organizations
- Customize the issue comment format
- Add additional error handling or notification mechanisms

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

The workflow uses:
- **IssueOps pattern**: Driving automation through GitHub Issues for a user-friendly interface
- **Native JavaScript** with js-yaml for YAML parsing and configuration
- **Modular helper functions** in the `/scripts` directory for improved maintainability
- **GitHub Actions matrix jobs** to parallelize enablement across different Enterprise instances
- **GitHub CLI (gh)** for API interactions with both GitHub.com and GitHub Enterprise Server
- **GitHub Enterprise Cloud API** for license information

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

## Advanced Features

- **Organization-wide enablement**: Specify an organization URL to process all repositories it contains
- **Enterprise-specific filtering**: Organization URLs are filtered per enterprise instance to ensure correct processing
- **Advanced Security verification**: The workflow checks and enables Advanced Security if not already enabled
- **Committer-based license analysis**: Analyzes repository commit history to accurately estimate license requirements
- **License checking bypass**: Option to skip license checking for special situations
- **Robust comment posting**: Fallback mechanisms ensure comments are posted even with permission issues