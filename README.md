# GHAS2. Users create a new issue using the "GHAS Enablement Request" template
2. The issue form collects:
   - List of repositories to enable GHAS features on
   - Which GHAS features to enable (Secret Scanning, Code Scanning, Dependabot)
   - GitHub Enterprise Server URL
3. The workflow automatically:
   - Parses the issue form data
   - Checks GHAS license availability from GitHub Enterprise Cloud (ensures at least 1 license remains available)
   - Analyzes all repositories collectively to determine total unique new committers
   - Enables the selected GHAS features on ALL specified repositories if:
     - The total number of new unique committers would still leave at least the specified minimum licenses available
     - The features were selected in the request form GitHub Advanced Security Enablement

A GitHub Actions workflow to automatically enable GitHub Advanced Security (GHAS) Secret Scanning on repositories based on committer analysis and license availability.

## How It Works

1. Users create a new issue using the "GHAS Enablement Request" template
2. The issue form collects:
   - List of repositories to enable GHAS features on
   - Which GHAS features to enable (Secret Scanning, Code Scanning, Dependabot)
   - GitHub Enterprise Server URL
   - Option to skip license checking (for special cases)
3. The workflow automatically:
   - Parses the issue form data
   - Checks GHAS license availability (unless the skip option is selected)
   - If not skipped, verifies that enough licenses remain available based on the specified minimum
   - Enables the selected GHAS features on ALL specified repositories if:
     - Either license checking was skipped OR enough licenses are available
     - The features were selected in the request form
   - Secret Scanning is enabled on all repositories, even those without recent committers, to scan historical commits
   - Updates the issue with detailed results including license availability before and after enablement

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
   - List of repository URLs (one per line)
   - Select which GHAS features to enable
   - Optionally provide your Enterprise Server URL and name (will be auto-detected if omitted)
   - Optionally specify minimum remaining licenses (default: 1)
5. Submit the issue
6. The workflow will automatically run and comment on the issue with results

## Customization

You can modify the workflow files to:
- Change the GHAS features that can be enabled
- Adjust the permission checking logic
- Change the default license threshold (currently 1)
- Change the committer analysis period (currently 90 days)
- Change the behavior to only enable on repositories with recent committers (currently enables on all repositories)

## License Calculation Logic

The workflow uses the following process to determine whether to enable GHAS features:
1. Counts the total number of unique committers across all repositories (from the last 90 days)
2. Retrieves license information from GitHub Enterprise Cloud
3. Checks if enabling the selected features would leave at least the specified minimum licenses available (default: 1)
4. If sufficient licenses remain available, enables the selected features on ALL repositories from the request
5. If enabling would reduce licenses below the threshold, no repositories are enabled

## Technical Implementation

The workflow uses:
- Native JavaScript with js-yaml for YAML parsing
- Modular helper functions in the `/scripts` directory for improved maintainability
- GitHub Actions matrix jobs to parallelize enablement across different Enterprise instances
- GitHub CLI (gh) for API interactions
- GitHub Enterprise Cloud API for license information

The workflow is structured to be maintainable and adaptable to different enterprise environments by using:
- A consistent configuration approach with a central config.yaml file
- Array-based structure for GHES instances
- No external dependencies beyond js-yaml for configuration parsing
- Organized, reusable JavaScript functions

## Troubleshooting

Common issues:
- Insufficient permissions for the GH_ENTERPRISE_TOKEN
- Invalid repository format (should be org-name/repo-name)
- Enterprise API endpoint errors (verify your Enterprise Server URL)
- js-yaml installation issues (the workflow automatically installs this dependency)