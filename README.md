# GHAS Issue Ops - GitHub Advanced Security Enablement

A GitHub Actions workflow to automatically enable GitHub Advanced Security (GHAS) Secret Scanning on repositories based on committer analysis and license availability.

## How It Works

1. Users create a new issue using the "GHAS Enablement Request" template
2. The issue form collects:
   - List of repositories to enable GHAS features on
   - Which GHAS features to enable (Secret Scanning, Code Scanning, Dependabot)
   - GitHub Enterprise Server URL
3. The workflow automatically:
   - Parses the issue form data
   - Checks GHAS license availability (ensures at least 100 licenses remain available)
   - Analyzes all repositories collectively to determine total unique new committers
   - Enables Secret Scanning on ALL specified repositories if:
     - The total number of new unique committers would still leave at least 100 licenses available
     - Secret Scanning was selected as a feature in the request form
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

The workflow is configured to maintain a minimum of 100 unused GHAS licenses. This threshold can be adjusted by modifying the `MIN_REMAINING_LICENSES` environment variable in the workflow file.

## Usage

1. Navigate to the "Issues" tab of this repository
2. Click "New Issue"
3. Select "GHAS Enablement Request" template
4. Fill out the form with:
   - List of repositories (one per line)
   - Select "Secret Scanning" feature
   - Provide your Enterprise Server URL
5. Submit the issue
6. The workflow will automatically run and comment on the issue with results

## Customization

You can modify the workflow files to:
- Change the GHAS features that can be enabled
- Adjust the permission checking logic
- Modify the license threshold
- Change the committer analysis period (currently 90 days)
- Change the behavior to only enable on repositories with recent committers (currently enables on all repositories)

## License Calculation Logic

The workflow uses the following process to determine whether to enable Secret Scanning:
1. Counts the total number of unique committers across all repositories (from the last 90 days)
2. Checks if enabling Secret Scanning for these committers would leave at least 100 licenses available
3. If sufficient licenses remain available, enables Secret Scanning on ALL repositories from the request
4. If enabling would reduce licenses below the threshold, no repositories are enabled

## Troubleshooting

Common issues:
- Insufficient permissions for the GH_ENTERPRISE_TOKEN
- Invalid repository format (should be org-name/repo-name)
- Enterprise API endpoint errors (verify your Enterprise Server URL)