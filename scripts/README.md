# GHAS Enablement Helper Scripts

This directory contains JavaScript helper functions used by the GHAS Enablement Workflow.

## Overview

The `ghas-helpers.js` file provides modular functions that handle different aspects of the GHAS enablement process:

- **parseIssueBody**: Parses the issue body to extract repositories, feature selections, and license requirements.
- **parseIssueAndSetOutputs**: Combines issue parsing and output setting in a single function for cleaner workflow files.
- **parseConfigAndGroupRepos**: Parses the config.yaml file and groups repositories by their hostname, matching them with the appropriate GHES instance configuration.
- **determineTokenName**: Determines which authentication token name to use based on the matrix context.
- **getTokenValue**: Dynamically retrieves the appropriate token value from available secrets based on the token name.
- **checkLicenseAvailability**: Checks if there are enough GHAS licenses available for enablement by querying the GitHub Enterprise Cloud API.
- **createResultsComment**: Creates a formatted comment with the results of the GHAS enablement process.

## Benefits of this Approach

1. **Maintainability**: Code is organized into logical functions instead of long inline scripts
2. **Testability**: Functions can be unit tested independently
3. **Reusability**: Functions can be reused across different workflows
4. **Readability**: Workflow file is cleaner and easier to understand
5. **Dynamic Token Management**: Tokens are managed dynamically rather than using static if/else statements

## Dynamic Token Management

The token handling has been enhanced to use a more modular and flexible approach:

1. The `determineTokenName` function extracts the correct token name from the configuration
2. The `getTokenValue` function dynamically looks up the appropriate token value from available secrets
3. This allows adding new token types without modifying if/else conditions in the workflow

This approach makes the workflow more maintainable and extensible when adding new GHES instances or token types.

## Usage

These functions are used by the GitHub Actions workflow in `.github/workflows/ghas-enablement.yml`. The workflow calls these functions using the `actions/github-script` action, which allows executing JavaScript code as part of the workflow.
