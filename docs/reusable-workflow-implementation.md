# GHAS Enablement Reusable Workflow Implementation Guide

This document provides technical details on the implementation of the reusable workflow architecture for the GHAS enablement through IssueOps.

## Workflow Architecture

The implementation uses a caller/reusable workflow architecture, split into two files:

1. **Caller Workflow** (`ghas-enablement.yml`):
   - Triggered when an issue with the 'ghas-enablement' label is opened
   - Parses the issue body to extract required parameters
   - Calls the reusable workflow with the extracted parameters
   - Simple and focused only on initial processing and calling the reusable workflow

2. **Reusable Workflow** (`ghas-enablement-action.yml`):
   - Defines the `workflow_call` trigger with required inputs and secrets
   - Contains all core implementation logic for GHAS enablement
   - Groups repositories by GHES instance
   - Performs license checks and enables GHAS features
   - Posts results back to the triggering issue
   - Can be called from other workflows or repositories

## Parameter Passing

The following parameters are passed from the caller to the reusable workflow:

| Parameter | Type | Description |
|-----------|------|-------------|
| repositories | string | JSON string of repositories to enable GHAS for |
| enable_secret_scanning | boolean | Whether to enable secret scanning |
| enable_code_scanning | boolean | Whether to enable code scanning |
| enable_dependabot_alerts | boolean | Whether to enable dependabot alerts |
| min_remaining_licenses | number | Minimum remaining licenses to maintain |
| skip_license_check | boolean | Whether to skip license checking |
| dry_run | boolean | Whether to run in dry run mode |
| issue_number | number | The issue number that triggered the workflow |

## Secret Passing

The following secrets are passed from the caller to the reusable workflow:

| Secret | Description |
|--------|-------------|
| GHES_API_TOKEN_1 | Token for first GitHub Enterprise Server instance |
| GHES_API_TOKEN_2 | Token for second GitHub Enterprise Server instance (optional) |
| GH_ENTERPRISE_TOKEN_CLOUD | Token for GitHub Enterprise Cloud |
| GITHUB_TOKEN | Default GitHub token |

## Key Components

1. **Issue Parsing**: 
   - Extracts repositories, feature flags, and options from issue body
   - Added support for dry run mode

2. **Repository Grouping**:
   - Groups repositories by GHES instance based on config.yaml
   - Creates a matrix for parallel processing

3. **License Checking**:
   - Analyzes repository commit history from the last 90 days
   - Identifies committers who would need new licenses
   - Compares against existing GHAS committers
   - Added email extraction from GHAS API response

4. **GHAS Enablement**:
   - Enables Advanced Security if not already enabled
   - Enables requested GHAS features (Secret Scanning, Code Scanning, Dependabot Alerts)
   - Configures default setup for Code Scanning when selected

5. **Result Reporting**:
   - Posts detailed results back to the original issue
   - Includes license usage analysis and committer information
   - Enhanced with clear dry run mode indicators when applicable

## Implementation Benefits

1. **Reusability**: The core enablement logic can be called from other workflows or repositories
2. **Maintenance**: Easier to update the core logic without changing the triggering mechanism
3. **Testing**: Separation allows for more targeted testing of each component
4. **Flexibility**: Additional callers can be added without duplicating the core logic
5. **Organization**: Clean separation of concerns between trigger and implementation
6. **Clarity**: Clear division of responsibilities between files:
   - Caller workflow handles only issue parsing and delegating to reusable workflow
   - Reusable workflow contains all business logic and implementation details
7. **Consistency**: Reduced duplication ensures consistent behavior across different invocations

## Testing the Implementation

Run the validation script to verify the implementation:

```bash
node scripts/test-reusable-workflow.js
```

This script checks:
- Correct definition of workflow triggers
- Proper parameter passing
- Correct handling of the issue number
- Proper secret passing

## Repository URL Validation

The workflow includes efficient repository URL validation integrated directly into the enablement process:

1. **Format checking**: Ensures repository URLs are well-formed and contain both organization and repository names
2. **Inline validation**: Validates repositories during the actual enablement process, eliminating redundant API calls
3. **Detailed error reporting**: Captures specific error types (404, 403, 422) with customized error messages
4. **Fault tolerance**: Continues processing valid repositories even when some URLs are invalid
5. **Performance optimization**: Eliminates separate validation steps by capturing errors during actual enablement

This approach ensures that the workflow continues to function efficiently even when some repository URLs are problematic, reducing API calls while providing detailed error information.

## Future Improvements

1. **Versioned Releases**: Consider tagging versions of the reusable workflow
2. **Automated Testing**: Add CI/CD for testing the reusable workflow
3. **Input Validation**: Add more robust validation for inputs
4. **Metrics**: Add telemetry to track usage and performance of the workflow
