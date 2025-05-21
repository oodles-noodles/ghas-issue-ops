// Helper functions for GHAS enablement workflow
const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

/**
 * Parses config.yaml and groups repositories by GHES instance
 * @param {string} repositoriesJson - JSON string of repositories
 * @param {boolean} enableSecretScanning - Whether to enable secret scanning
 * @param {boolean} enableCodeScanning - Whether to enable code scanning
 * @param {boolean} enableDependabotAlerts - Whether to enable dependabot alerts
 * @param {number} minRemainingLicenses - Minimum remaining licenses
 * @returns {Array} Matrix items for GitHub Actions
 */
function parseConfigAndGroupRepos(repositoriesJson, enableSecretScanning, enableCodeScanning, enableDependabotAlerts, minRemainingLicenses) {
  // Load and parse config.yaml
  const configYaml = fs.readFileSync('config.yaml', 'utf8');
  const config = yaml.load(configYaml);
  
  // Parse repositories from JSON string
  const repositories = JSON.parse(repositoriesJson);
  
  // Group repositories by hostname (extracted from the URL)
  const groupedRepos = {};
  repositories.forEach(repo => {
    try {
      // Extract hostname from repo URL
      const hostname = new URL(repo).hostname;
      if (!groupedRepos[hostname]) {
        groupedRepos[hostname] = [];
      }
      groupedRepos[hostname].push(repo);
    } catch (error) {
      console.error(`Invalid repository URL: ${repo}`, error.message);
      // Continue with other repositories
    }
  });
  
  // Build matrix JSON
  const matrixItems = [];
  
  for (const hostname in groupedRepos) {
    // Find matching GHES instance
    let matched = false;
    const reposList = groupedRepos[hostname];
    
    if (config.ghes_instances && Array.isArray(config.ghes_instances)) {
      for (const instance of config.ghes_instances) {
        try {
          // Extract hostname from API URL for matching
          const apiUrl = new URL(instance.api_url);
          const instanceHostname = apiUrl.hostname.replace(/^api\./, '');
          
          // More precise matching that prevents partial hostname matches
          // This ensures github-test.com doesn't match github.com
          if (hostname === instanceHostname || 
              hostname.endsWith(`.${instanceHostname}`)) {
            matched = true;
            matrixItems.push({
              hostname: hostname,
              instance_name: instance.name,
              api_url: instance.api_url,
              auth_var: instance.auth_var,
              repositories: reposList,
              enable_secret_scanning: enableSecretScanning,
              enable_code_scanning: enableCodeScanning,
              enable_dependabot_alerts: enableDependabotAlerts,
              min_remaining_licenses: minRemainingLicenses
            });
            console.log(`Matched hostname '${hostname}' with GHES instance '${instance.name}' (auth: ${instance.auth_var})`);
            break;
          }
        } catch (error) {
          console.error(`Error parsing API URL for instance ${instance.name}:`, error.message);
          // Continue checking other instances
        }
      }
    }
    
    // If no match found, use default values
    if (!matched) {
      console.log(`Warning: No matching GHES instance found for hostname ${hostname}, using default token`);
      matrixItems.push({
        hostname: hostname,
        instance_name: 'unknown',
        api_url: `https://${hostname}/api/v3`,
        auth_var: 'GH_ENTERPRISE_TOKEN',
        repositories: reposList,
        enable_secret_scanning: enableSecretScanning,
        enable_code_scanning: enableCodeScanning,
        enable_dependabot_alerts: enableDependabotAlerts,
        min_remaining_licenses: minRemainingLicenses
      });
    }
  }
  
  return matrixItems;
}

/**
 * Determines authentication token name based on matrix auth_var
 * @param {string} authVar - Authentication variable from matrix
 * @returns {string} Token name to use
 */
function determineTokenName(authVar) {
  if (authVar && authVar !== 'null') {
    console.log(`Using specified auth variable: ${authVar}`);
    return authVar;
  } else {
    console.log('No auth variable specified, using default GH_ENTERPRISE_TOKEN');
    return 'GH_ENTERPRISE_TOKEN';
  }
}

/**
 * Gets the actual token value - in the simplified workflow, this function is no longer needed
 * as we're using GitHub Actions' secrets context directly
 * @deprecated Use secrets context syntax in the workflow instead: ${{ secrets[matrix.auth_var] || secrets.GH_ENTERPRISE_TOKEN }}
 * @param {string} tokenName - The name of the token
 * @param {Object} secrets - Available secrets from GitHub Actions
 * @returns {string} The actual token value
 */
function getTokenValue(tokenName, secrets) {
  // This function is kept for backward compatibility
  // In the newer implementation, we directly use the secrets context in the workflow
  console.log('This function is deprecated. Use secrets context directly in workflows.');
  return secrets?.GH_ENTERPRISE_TOKEN || '';
}

/**
 * Checks GHAS license availability or returns default values if skipping check
 * @param {Object} env - Environment variables
 * @param {boolean} skipCheck - Whether to skip the license check
 * @returns {Object} License information and availability status
 */
function checkLicenseAvailability(env, skipCheck = false) {
  // If skipping check, return default values that indicate success
  if (skipCheck) {
    console.log('Skipping license check as requested');
    return {
      totalLicenses: 1000,
      usedLicenses: 1,
      availableLicenses: 999,
      minRemainingLicenses: parseInt(env.MIN_REMAINING_LICENSES, 10) || 1,
      hasEnoughLicenses: true,
      skipLicenseCheck: true
    };
  }

  // Load and parse config.yaml
  const configYaml = fs.readFileSync('config.yaml', 'utf8');
  const config = yaml.load(configYaml);
  
  // Get GHEC configuration
  const ghecConfig = config.ghec;
  const ghecApiUrl = ghecConfig.api_url;
  const ghecName = ghecConfig.name;
  const ghecAuthVar = ghecConfig.auth_var;
  
  // Set the GHEC token for API calls
  // Use the token that was already set as GH_ENTERPRISE_TOKEN
  // The workflow will handle setting the right token value from the auth_var
  const ghecToken = env.GH_ENTERPRISE_TOKEN;
  
  // Get total and used GHAS licenses from GHEC API
  const cmd = `gh api -H "Accept: application/vnd.github+json" "/enterprises/${ghecName}/settings/billing/advanced-security" --hostname "${ghecApiUrl}"`;
  const ghasDataRaw = execSync(cmd, { 
    env: { ...env, GH_TOKEN: ghecToken },
    encoding: 'utf8'
  });
  
  const ghasData = JSON.parse(ghasDataRaw);
  const totalLicenses = ghasData.purchased_advanced_security_committers;
  const usedLicenses = ghasData.total_advanced_security_committers;
  const availableLicenses = totalLicenses - usedLicenses;
  const minRemainingLicenses = parseInt(env.MIN_REMAINING_LICENSES, 10) || 1;
  
  console.log(`Total GHAS licenses: ${totalLicenses}`);
  console.log(`Used GHAS licenses: ${usedLicenses}`);
  console.log(`Available GHAS licenses: ${availableLicenses}`);
  console.log(`Min remaining licenses required: ${minRemainingLicenses}`);
  
  return {
    totalLicenses,
    usedLicenses,
    availableLicenses,
    minRemainingLicenses,
    hasEnoughLicenses: availableLicenses > minRemainingLicenses,
    skipLicenseCheck: false
  };
}

/**
 * Creates a comment for the issue with enablement results
 * @param {Object} params - Parameters for creating the comment
 * @returns {string} Comment text
 */
function createResultsComment(params) {
  const {
    enableSecretScanning,
    enableCodeScanning,
    enableDependabotAlerts,
    repositories,
    hasEnoughLicenses,
    availableLicenses,
    totalLicenses,
    usedLicenses,
    minRemainingLicenses,
    hostname,
    instanceName,
    skipLicenseCheck
  } = params;
  
  let comment = `## GHAS Enablement Results for ${hostname}\n\n`;
  
  if (skipLicenseCheck) {
    comment += `**License Check: SKIPPED**\n\n`;
    comment += `License check was skipped as requested in the issue form.\n\n`;
  } else {
    comment += `**License Summary:**\n`;
    comment += `- Total GHAS licenses: ${totalLicenses}\n`;
    comment += `- Used GHAS licenses: ${usedLicenses}\n`;
    comment += `- Available GHAS licenses: ${availableLicenses}\n`;
    comment += `- Minimum required remaining licenses: ${minRemainingLicenses}\n\n`;
    
    if (!hasEnoughLicenses) {
      comment += `⚠️ Not enough GHAS licenses available. Need to maintain at least ${minRemainingLicenses} unused licenses.\n`;
      return comment;
    }
  }
  
  if (!enableSecretScanning && !enableCodeScanning && !enableDependabotAlerts) {
    comment += '⚠️ No GHAS features were selected for enablement.\n';
  } else {
    comment += `### Features Enabled\n`;
    if (enableSecretScanning) comment += `- ✅ Secret Scanning\n`;
    if (enableCodeScanning) comment += `- ✅ Code Scanning (default setup)\n`;
    if (enableDependabotAlerts) comment += `- ✅ Dependabot Alerts\n`;
    
    comment += `\n### Repositories\n`;
    repositories.forEach(repo => {
      comment += `- ${repo}\n`;
    });
  }
  
  return comment;
}

/**
 * Parses issue body to extract repositories, feature selections, and other settings
 * @param {string} body - The issue body text
 * @returns {Object} Parsed data including repositories and feature flags
 */
function parseIssueBody(body) {
  // Parse the repository URLs from the form submission
  const repoListMatch = body.match(/### Repository URLs([\s\S]*?)(?:###|$)/);
  const repoListRaw = repoListMatch ? repoListMatch[1].trim() : '';
  const repositories = repoListRaw.split('\n').map(repo => repo.trim()).filter(Boolean);
  
  // Parse the selected GHAS features
  const featuresMatch = body.match(/### GHAS Features to Enable\s*([^\n]+)/);
  const featuresRaw = featuresMatch ? featuresMatch[1].trim() : '';
  const enableSecretScanning = featuresRaw.includes('Secret Scanning');
  const enableCodeScanning = featuresRaw.includes('Code Scanning');
  const enableDependabotAlerts = featuresRaw.includes('Dependabot Alerts');
  
  // Parse minimum remaining licenses (optional)
  const minLicensesMatch = body.match(/### Minimum Remaining Licenses \(optional\)\s*([^\n]+)/);
  const minLicensesRaw = minLicensesMatch ? minLicensesMatch[1].trim() : '';
  // Set a default value of 1 if not provided or not a valid number
  const minRemainingLicenses = minLicensesRaw ? parseInt(minLicensesRaw, 10) : 1;
  const validMinLicenses = !isNaN(minRemainingLicenses) && minRemainingLicenses > 0 ? minRemainingLicenses : 1;
  
  // Parse skip license check option (dropdown field)
  const skipLicenseCheckMatch = body.match(/### Skip License Check\s*([^\n]+)/);
  const skipLicenseCheckRaw = skipLicenseCheckMatch ? skipLicenseCheckMatch[1].trim() : 'No';
  const skipLicenseCheck = skipLicenseCheckRaw === 'Yes';
  
  console.log(`Repositories: ${repositories.length}`);
  console.log(`Secret Scanning: ${enableSecretScanning}`);
  console.log(`Code Scanning: ${enableCodeScanning}`);
  console.log(`Dependabot Alerts: ${enableDependabotAlerts}`);
  console.log(`Min Remaining Licenses: ${validMinLicenses}`);
  console.log(`Skip License Check: ${skipLicenseCheck}`);
  
  return {
    repositories,
    features: {
      enableSecretScanning,
      enableCodeScanning,
      enableDependabotAlerts
    },
    minRemainingLicenses: validMinLicenses,
    skipLicenseCheck
  };
}

module.exports = {
  parseIssueBody,
  parseConfigAndGroupRepos,
  determineTokenName,
  getTokenValue,
  checkLicenseAvailability,
  createResultsComment
};
