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
   - For each repository:
     - Identifies committers from the past 90 days on the default branch
     - Compares with existing GHAS committers
     - Enables Secret Scanning if new committers are found and license availability permits
   - Updates the issue with results

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

## Troubleshooting

Common issues:
- Insufficient permissions for the GH_ENTERPRISE_TOKEN
- Invalid repository format (should be org-name/repo-name)
- Enterprise API endpoint errors (verify your Enterprise Server URL)