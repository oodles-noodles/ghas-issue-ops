// Helper functions for GHAS enablement workflow
const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

/**
 * Fetches unique committers from a repository over the last 90 days
 * @param {string} repoUrl - Repository URL
 * @param {string} token - Authentication token
 * @returns {Array} Array of committer emails
 */
function fetchRepoCommitters(repoUrl, token) {
  try {
    // Parse the URL to extract components
    const url = new URL(repoUrl);
    const hostname = url.hostname;
    
    // Extract org/repo from path
    const pathParts = url.pathname.replace(/^\//, '').split('/');
    if (pathParts.length < 2) {
      console.error(`Invalid repository URL format: ${repoUrl}`);
      return [];
    }
    
    const org = pathParts[0];
    const repo = pathParts[1];
    
    console.log(`Fetching committers for repository: ${org}/${repo} from ${hostname}`);
    
    // Calculate date 90 days ago for commit search
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sinceDate = ninetyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Use GitHub CLI to fetch commits from the last 90 days
    // Note: This will paginate to get up to 1000 commits from the last 90 days
    const cmd = `gh api -H "Accept: application/vnd.github+json" "/repos/${org}/${repo}/commits?since=${sinceDate}&per_page=100" --hostname "${hostname}" --paginate`;
    
    try {
      // Determine the correct environment variable based on hostname
      // GitHub.com uses GH_TOKEN, GHES instances use GH_ENTERPRISE_TOKEN
      const isGitHubDotCom = hostname === 'github.com';
      const tokenEnvVar = isGitHubDotCom ? 'GH_TOKEN' : 'GH_ENTERPRISE_TOKEN';
      
      const execEnv = { 
        ...process.env,
        [tokenEnvVar]: token
      };
      
      const commitsDataRaw = execSync(cmd, {
        env: execEnv,
        encoding: 'utf8'
      });
      
      // Parse commits and extract unique committer emails
      const commits = JSON.parse(commitsDataRaw);
      const committers = new Set();
      
      if (Array.isArray(commits)) {
        commits.forEach(commit => {
          if (commit.commit && commit.commit.author && commit.commit.author.email) {
            committers.add(commit.commit.author.email.toLowerCase());
          }
          if (commit.commit && commit.commit.committer && commit.commit.committer.email) {
            committers.add(commit.commit.committer.email.toLowerCase());
          }
        });
      } else {
        console.error(`Invalid response format when fetching commits for ${org}/${repo}`);
      }
      
      return Array.from(committers);
    } catch (error) {
      if (error.message.includes('404')) {
        console.error(`Repository not found or no access: ${org}/${repo}`);
      } else if (error.message.includes('403')) {
        console.error(`Permission denied when fetching commits for ${org}/${repo}`);
      } else {
        console.error(`Error fetching commits for ${org}/${repo}:`, error.message);
      }
      return [];
    }
  } catch (error) {
    console.error(`Error processing repo URL ${repoUrl}:`, error.message);
    return [];
  }
}

/**
 * Fetch all unique committers across multiple repositories over the last 90 days
 * @param {Array} repositories - Array of repository URLs
 * @param {Object} tokensByHostname - Map of hostnames to authentication tokens
 * @returns {Array} Array of unique committer emails
 */
function getAllUniqueCommitters(repositories, tokensByHostname) {
  const allCommitters = new Set();
  
  for (const repoUrl of repositories) {
    try {
      const hostname = new URL(repoUrl).hostname;
      const token = tokensByHostname[hostname];
      
      if (!token) {
        console.error(`No token found for hostname ${hostname}`);
        continue;
      }
      
      const repoCommitters = fetchRepoCommitters(repoUrl, token);
      repoCommitters.forEach(committer => allCommitters.add(committer));
      
      console.log(`Found ${repoCommitters.length} committers in ${repoUrl}`);
    } catch (error) {
      console.error(`Error processing repository ${repoUrl}:`, error.message);
    }
  }
  
  return Array.from(allCommitters);
}

/**
 * Fetches all repositories for a given organization URL
 * @param {string} orgUrl - The URL of the organization
 * @param {string} token - The token for authentication
 * @returns {Object} Object with success flag, repositories array, and error info
 */
function fetchOrganizationRepos(orgUrl, token) {
  try {
    // Parse the URL to extract components
    const url = new URL(orgUrl);
    const hostname = url.hostname;
    
    // Extract org name from path (remove leading slash)
    const orgPath = url.pathname.replace(/^\//, '');
    
    if (!orgPath) {
      console.error(`Invalid organization URL: ${orgUrl}. Could not extract organization name.`);
      return {
        success: false,
        repositories: [],
        error: 'Could not extract organization name from URL'
      };
    }

    console.log(`🔍 DEBUG: Fetching repositories for organization: ${orgPath} from ${hostname}`);
    console.log(`🔍 DEBUG: Using token: ${token ? token.substring(0, 8) + '...' : 'NO_TOKEN'}`);
    
    if (!token) {
      console.error(`❌ No authentication token provided for ${hostname}`);
      console.error(`   Cannot fetch repositories from organization: ${orgPath}`);
      return {
        success: false,
        repositories: [],
        error: 'No authentication token provided'
      };
    }
    
    // Use GitHub CLI to fetch repositories with pagination
    // The --paginate flag automatically handles pagination to get all repositories
    const cmd = `gh api -H "Accept: application/vnd.github+json" "/orgs/${orgPath}/repos?per_page=100" --hostname "${hostname}" --paginate`;
    
    console.log(`🔍 DEBUG: Executing command: ${cmd}`);
    
    // Determine the correct environment variable based on hostname
    // GitHub.com uses GH_TOKEN, GHES instances use GH_ENTERPRISE_TOKEN
    const isGitHubDotCom = hostname === 'github.com';
    const tokenEnvVar = isGitHubDotCom ? 'GH_TOKEN' : 'GH_ENTERPRISE_TOKEN';
    
    console.log(`🔍 DEBUG: Using environment variable: ${tokenEnvVar} (hostname: ${hostname})`);
    
    const execEnv = { 
      ...process.env,
      [tokenEnvVar]: token
    };
    
    const reposDataRaw = execSync(cmd, {
      env: execEnv,
      encoding: 'utf8'
    });
    
    const reposData = JSON.parse(reposDataRaw);
    if (!Array.isArray(reposData)) {
      console.error(`Invalid response when fetching repositories for ${orgPath}`);
      return {
        success: false,
        repositories: [],
        error: 'Invalid response format from API'
      };
    }
    
    // Map to full repository URLs
    const repoUrls = reposData.map(repo => {
      // Construct the full URL using the hostname and full_name (org/repo)
      return `https://${hostname}/${repo.full_name}`;
    });
    
    console.log(`✅ Found ${repoUrls.length} repositories in organization ${orgPath}`);
    
    // Log first few repositories for debugging (but not all to avoid log spam)
    if (repoUrls.length > 0) {
      const sampleRepos = repoUrls.slice(0, Math.min(5, repoUrls.length));
      console.log(`🔍 DEBUG: Sample repositories:`, sampleRepos);
      if (repoUrls.length > 5) {
        console.log(`🔍 DEBUG: ... and ${repoUrls.length - 5} more repositories`);
      }
    }
    
    return {
      success: true,
      repositories: repoUrls,
      error: null
    };
  } catch (error) {
    console.error(`❌ Error fetching repositories for organization ${orgUrl}:`, error.message);
    
    let errorMessage = error.message;
    // Provide more specific error information
    if (error.message.includes('404')) {
      console.error(`   Organization '${orgUrl}' not found or not accessible with provided token`);
      errorMessage = 'Organization not found or not accessible with provided token';
    } else if (error.message.includes('403')) {
      console.error(`   Access denied. Token may lack permissions to access organization '${orgUrl}'`);
      errorMessage = 'Access denied. Token may lack permissions to access organization';
    } else if (error.message.includes('401')) {
      console.error(`   Authentication failed. Token may be invalid or expired`);
      errorMessage = 'Authentication failed. Token may be invalid or expired';
    }
    
    return {
      success: false,
      repositories: [],
      error: errorMessage
    };
  }
}

/**
 * Checks if a URL points to an organization rather than a specific repository
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's an org URL, false otherwise
 */
function isOrganizationUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // If there's only one path segment (org name) and no additional path, it's an org URL
    return pathParts.length === 1;
  } catch (error) {
    console.error(`Invalid URL: ${url}`, error.message);
    return false;
  }
}

/**
 * Parses config.yaml and groups repositories by GHES instance
 * @param {string} repositoriesJson - JSON string of repositories
 * @param {boolean} enableSecretScanning - Whether to enable secret scanning
 * @param {boolean} enableCodeScanning - Whether to enable code scanning
 * @param {boolean} enableDependabotAlerts - Whether to enable dependabot alerts
 * @param {number} minRemainingLicenses - Minimum remaining licenses
 * @returns {Object} Object containing:
 *   - matrixItems: Array of matrix items for GitHub Actions
 *   - invalidRepositories: Array of invalid repository URLs that were skipped
 *   - validRepositories: Array of valid repository URLs that will be processed
 *   - totalRepositories: Total number of input repositories
 */
function parseConfigAndGroupRepos(repositoriesJson, enableSecretScanning, enableCodeScanning, enableDependabotAlerts, minRemainingLicenses) {
  // Load and parse config.yaml
  const configYaml = fs.readFileSync('config.yaml', 'utf8');
  const config = yaml.load(configYaml);
  
  // Parse repositories from JSON string
  const inputRepos = JSON.parse(repositoriesJson);
  
  // Expand organization URLs to include all repositories
  const repositories = [];
  const orgUrls = [];
  const invalidRepositories = [];
  
  // First pass: identify and separate org URLs from repo URLs
  inputRepos.forEach(url => {
    if (isOrganizationUrl(url)) {
      orgUrls.push(url);
    } else {
      repositories.push(url);
    }
  });
  
  console.log(`Found ${repositories.length} repository URLs and ${orgUrls.length} organization URLs`);
  
  // Second pass: expand org URLs to repo URLs
  // Note: This is done in a separate loop because we need to find the right token for each org
  if (orgUrls.length > 0) {
    // Find tokens for each hostname
    const tokensByHostname = {};
    
    console.log(`🔍 DEBUG: Processing ${orgUrls.length} organization URLs`);
    console.log(`🔍 DEBUG: Available environment variables: ${Object.keys(process.env).filter(k => k.includes('TOKEN')).join(', ')}`);
    console.log(`🔍 DEBUG: Specifically checking for: GHES_API_TOKEN_1=${process.env.GHES_API_TOKEN_1 ? 'SET' : 'NOT_SET'}, GHES_API_TOKEN_2=${process.env.GHES_API_TOKEN_2 ? 'SET' : 'NOT_SET'}, GH_ENTERPRISE_TOKEN_CLOUD=${process.env.GH_ENTERPRISE_TOKEN_CLOUD ? 'SET' : 'NOT_SET'}`);
    
    // Process GHES instances
    if (config.ghes_instances && Array.isArray(config.ghes_instances)) {
      console.log(`🔍 DEBUG: Processing ${config.ghes_instances.length} GHES instances`);
      for (const instance of config.ghes_instances) {
        try {
          const apiUrl = new URL(instance.api_url);
          const hostname = apiUrl.hostname.replace(/^api\./, '');
          const tokenValue = process.env[instance.auth_var];
          tokensByHostname[hostname] = tokenValue;
          
          console.log(`🔍 DEBUG: Instance '${instance.name}' mapping:`);
          console.log(`   API URL: ${instance.api_url}`);
          console.log(`   Hostname: ${hostname}`);
          console.log(`   Auth var: ${instance.auth_var}`);
          console.log(`   Token exists: ${tokenValue ? 'YES' : 'NO'}`);
          console.log(`   Token preview: ${tokenValue ? tokenValue.substring(0, 8) + '...' : 'undefined'}`);
        } catch (error) {
          console.error(`Error processing instance config:`, error.message);
        }
      }
    }
    
    console.log(`🔍 DEBUG: Final tokensByHostname mapping:`);
    Object.entries(tokensByHostname).forEach(([hostname, token]) => {
      console.log(`   ${hostname} -> ${token ? 'HAS_TOKEN' : 'NO_TOKEN'}`);
    });
    
    // Process each org URL
    orgUrls.forEach(orgUrl => {
      try {
        const hostname = new URL(orgUrl).hostname;
        const token = tokensByHostname[hostname];
        
        console.log(`🔍 DEBUG: Processing org URL: ${orgUrl}`);
        console.log(`   Extracted hostname: ${hostname}`);
        console.log(`   Looking for token in tokensByHostname...`);
        console.log(`   Token found: ${token ? 'YES' : 'NO'}`);
        
        if (!token) {
          // Find which auth_var should be used for this hostname
          const matchingInstance = config.ghes_instances.find(instance => {
            try {
              const apiUrl = new URL(instance.api_url);
              return apiUrl.hostname.replace(/^api\./, '') === hostname;
            } catch {
              return false;
            }
          });
          
          console.error(`❌ No token found for hostname ${hostname}`);
          console.error(`   Expected environment variable: ${matchingInstance?.auth_var || 'UNKNOWN'}`);
          console.error(`   Environment variable value: ${process.env[matchingInstance?.auth_var] ? 'SET (but not in tokensByHostname)' : 'NOT SET'}`);
          console.error(`   Available hostnames in tokensByHostname: ${Object.keys(tokensByHostname).join(', ')}`);
          console.error(`   This will prevent organization URL expansion for: ${orgUrl}`);
          console.error(`   Please ensure the token is configured in your workflow secrets and environment variables.`);
          
          // Add to invalid repositories list
          invalidRepositories.push({
            url: orgUrl,
            error: 'No authentication token available for this hostname'
          });
          return;
        }
        
        // Fetch all repositories for this organization
        const orgResult = fetchOrganizationRepos(orgUrl, token);
        if (orgResult.success) {
          console.log(`Adding ${orgResult.repositories.length} repositories from organization URL: ${orgUrl}`);
          repositories.push(...orgResult.repositories);
        } else {
          console.error(`Failed to fetch repositories from organization: ${orgUrl}`);
          // Add to invalid repositories list
          invalidRepositories.push({
            url: orgUrl,
            error: orgResult.error
          });
        }
      } catch (error) {
        console.error(`Error processing org URL ${orgUrl}:`, error.message);
      }
    });
  }
  
  // Group repositories by hostname
  const groupedRepos = {};
  const validRepositories = [];
  
  repositories.forEach(repo => {
    try {
      // Extract hostname from repo URL
      const hostname = new URL(repo).hostname;
      if (!groupedRepos[hostname]) {
        groupedRepos[hostname] = [];
      }
      groupedRepos[hostname].push(repo);
      validRepositories.push(repo);
    } catch (error) {
      console.error(`Invalid repository URL: ${repo}`, error.message);
      invalidRepositories.push({
        url: repo,
        error: error.message
      });
      // Continue with other repositories
    }
  });
  
  if (invalidRepositories.length > 0) {
    console.log(`Found ${invalidRepositories.length} invalid repository URLs that will be skipped:`);
    invalidRepositories.forEach(item => console.log(`  - ${item.url}: ${item.error}`));
  }
  
  console.log(`Processing ${validRepositories.length} valid repositories across ${Object.keys(groupedRepos).length} hostnames`);
  
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
  
  return {
    matrixItems,
    invalidRepositories,
    validRepositories,
    totalRepositories: repositories.length
  };
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
 * @param {Array} repositories - List of repositories to enable GHAS for (optional)
 * @param {Object} features - Feature selection flags (optional)
 * @param {boolean} features.enableSecretScanning - Whether secret scanning is selected
 * @param {boolean} features.enableCodeScanning - Whether code scanning is selected
 * @param {boolean} features.enableDependabotAlerts - Whether dependabot alerts is selected
 * @returns {Object} License information and availability status including:
 *   - totalLicenses: Total number of GHAS licenses (0 or undefined indicates unlimited)
 *   - usedLicenses: Number of licenses currently in use
 *   - availableLicenses: Number of licenses available after considering new committers (Number.MAX_SAFE_INTEGER for unlimited)
 *   - minRemainingLicenses: Minimum number of licenses that must remain unused
 *   - hasEnoughLicenses: Boolean indicating if there are enough licenses (always true for unlimited)
 *   - skipLicenseCheck: Boolean indicating if license check was skipped
 *   - currentGhasCommitters: Array of emails for committers already using GHAS licenses
 *   - newCommitters: Number of committers that would need new licenses
 *   - newCommittersList: Array of committer emails that would need new licenses
 *   - estimatedLicensesNeeded: Number of new licenses that would be needed
 */
function checkLicenseAvailability(env, skipCheck = false, repositories = [], features = {}) {
  // If skipping check, return default values that indicate success
  if (skipCheck) {
    console.log('Skipping license check as requested');
    return {
      totalLicenses: 1000,
      usedLicenses: 1,
      availableLicenses: 999,
      minRemainingLicenses: parseInt(env.MIN_REMAINING_LICENSES, 10) || 1,
      hasEnoughLicenses: true,
      skipLicenseCheck: true,
      currentGhasCommitters: [],
      newCommitters: 0,
      newCommittersList: [],
      estimatedLicensesNeeded: 0
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
  // Use the token from the auth_var specified in the configuration
  const ghecToken = env[ghecAuthVar];
  const ghecHostname = new URL(ghecApiUrl).hostname.replace(/^api\./, '');
  
  // Get total and used GHAS licenses from GHEC API
  // Determine the correct environment variable based on hostname
  // GitHub.com uses GH_TOKEN, GHES instances use GH_ENTERPRISE_TOKEN
  const isGitHubDotCom = ghecHostname === 'github.com';
  const tokenEnvVar = isGitHubDotCom ? 'GH_TOKEN' : ghecAuthVar;
  
  let ghasData;
  let licenseCmd = `gh api -H "Accept: application/vnd.github+json" "/enterprises/${ghecName}/settings/billing/advanced-security" --hostname "${ghecHostname}" --paginate`;
  
  // Refresh GitHub CLI authentication with enterprise billing scope
  try {
    console.log('Refreshing GitHub CLI authentication with enterprise billing scope...');
    const authRefreshCmd = `gh auth refresh -h ${ghecHostname} -s manage_billing:enterprise`;
    execSync(authRefreshCmd, { 
      env: { ...env, [tokenEnvVar]: ghecToken },
      encoding: 'utf8'
    });
    console.log('Successfully refreshed GitHub CLI authentication');
  } catch (authError) {
    console.warn('Warning: Failed to refresh GitHub CLI authentication scope:', authError.message);
    console.warn('Proceeding with license API call - it may fail if token lacks proper scope');
  }
  
  try {
    // First attempt: Try without advanced_security_product parameter
    console.log('Attempting to fetch license data without advanced_security_product parameter...');
    const ghasDataRaw = execSync(licenseCmd, { 
      env: { ...env, [tokenEnvVar]: ghecToken },
      encoding: 'utf8'
    });
    ghasData = JSON.parse(ghasDataRaw);
    console.log('Successfully retrieved license data');
  } catch (error) {
    console.log('Initial license API call failed, checking for 422 error...');
    
    // Check if this is a 422 error indicating we need the advanced_security_product parameter
    if (error.message && error.message.includes('422')) {
      console.log('Detected 422 error - retrying with advanced_security_product parameter');
      
      // Determine the appropriate advanced_security_product based on selected features
      let advancedSecurityProduct = null;
      
      if (features.enableSecretScanning && features.enableCodeScanning) {
        // Both secret scanning and code scanning selected - use code_security (includes both)
        advancedSecurityProduct = 'code_security';
        console.log('Both Secret Scanning and Code Scanning selected - using code_security product');
      } else if (features.enableSecretScanning) {
        // Only secret scanning selected - use secret_protection
        advancedSecurityProduct = 'secret_protection';
        console.log('Only Secret Scanning selected - using secret_protection product');
      } else if (features.enableCodeScanning) {
        // Only code scanning selected - use code_security
        advancedSecurityProduct = 'code_security';
        console.log('Only Code Scanning selected - using code_security product');
      } else {
        // No specific GHAS features selected, default to code_security
        advancedSecurityProduct = 'code_security';
        console.log('No specific GHAS features selected - defaulting to code_security product');
      }
      
      // Retry the API call with the advanced_security_product parameter
      licenseCmd = `gh api -H "Accept: application/vnd.github+json" "/enterprises/${ghecName}/settings/billing/advanced-security?advanced_security_product=${advancedSecurityProduct}" --hostname "${ghecHostname}" --paginate`;
      
      try {
        console.log(`Retrying license API call with advanced_security_product=${advancedSecurityProduct}...`);
        const ghasDataRaw = execSync(licenseCmd, { 
          env: { ...env, [tokenEnvVar]: ghecToken },
          encoding: 'utf8'
        });
        ghasData = JSON.parse(ghasDataRaw);
        console.log('Successfully retrieved license data with advanced_security_product parameter');
      } catch (retryError) {
        console.error('Failed to retrieve license data even with advanced_security_product parameter:', retryError.message);
        throw retryError;
      }
    } else {
      // Not a 422 error, re-throw the original error
      console.error('License API call failed with non-422 error:', error.message);
      throw error;
    }
  }
  const totalLicenses = ghasData.purchased_advanced_security_committers;
  const usedLicenses = ghasData.total_advanced_security_committers;
  
  // Check if this is an unlimited license scenario (0 or undefined total licenses indicates unlimited)
  const isUnlimitedLicenses = totalLicenses === 0 || totalLicenses === undefined;
  if (isUnlimitedLicenses) {
    const reason = totalLicenses === 0 ? 'Total licenses is 0' : 'Total licenses is undefined';
    console.log(`${reason} - treating as unlimited licenses available`);
  }
  
  // Extract all unique committer emails from repositories that already have GHAS enabled
  const currentGhasCommitters = new Set();
  if (ghasData.repositories && Array.isArray(ghasData.repositories)) {
    console.log(`Found ${ghasData.repositories.length} repositories with GHAS enabled`);
    
    for (const repo of ghasData.repositories) {
      if (repo.advanced_security_committers_breakdown && Array.isArray(repo.advanced_security_committers_breakdown)) {
        for (const committer of repo.advanced_security_committers_breakdown) {
          if (committer.last_pushed_email) {
            currentGhasCommitters.add(committer.last_pushed_email.toLowerCase());
          }
        }
      }
    }
    console.log(`Found ${currentGhasCommitters.size} unique committers currently using GHAS licenses`);
  }
  
  // Create a base license availability assessment
  const availableLicenses = isUnlimitedLicenses ? Number.MAX_SAFE_INTEGER : totalLicenses - usedLicenses;
  const minRemainingLicenses = parseInt(env.MIN_REMAINING_LICENSES, 10) || 1;
  
  console.log(`Total GHAS licenses: ${isUnlimitedLicenses ? 'Unlimited' : totalLicenses}`);
  console.log(`Currently used GHAS licenses: ${usedLicenses}`);
  console.log(`Base available licenses: ${isUnlimitedLicenses ? 'Unlimited' : availableLicenses}`);
  console.log(`Min remaining licenses required: ${minRemainingLicenses}`);
  
  // If no repositories are provided for analysis, use the base license check
  if (!repositories || repositories.length === 0) {
    console.log('No repositories provided for license analysis, using base license check');
    return {
      totalLicenses,
      usedLicenses,
      availableLicenses,
      minRemainingLicenses,
      hasEnoughLicenses: isUnlimitedLicenses || availableLicenses > minRemainingLicenses,
      skipLicenseCheck: false,
      currentGhasCommitters: Array.from(currentGhasCommitters),
      newCommitters: 0,
      estimatedLicensesNeeded: 0
    };
  }
  
  // Prepare token mapping for each hostname
  const tokensByHostname = {};
  
  // Add GHEC token
  tokensByHostname[ghecHostname] = ghecToken;
  
  // Add tokens for all GHES instances
  if (config.ghes_instances && Array.isArray(config.ghes_instances)) {
    for (const instance of config.ghes_instances) {
      try {
        const apiUrl = new URL(instance.api_url);
        const hostname = apiUrl.hostname.replace(/^api\./, '');
        tokensByHostname[hostname] = env[instance.auth_var];
      } catch (error) {
        console.error(`Error processing instance config:`, error.message);
      }
    }
  }
  
  // Get all committers from the repositories to be enabled
  console.log(`Analyzing committers for ${repositories.length} repositories...`);
  const repoCommitters = getAllUniqueCommitters(repositories, tokensByHostname);
  console.log(`Found ${repoCommitters.length} unique committers in the repositories to enable`);
  
  // Calculate new committers (those in repos to enable but not already using GHAS licenses)
  const newCommittersList = repoCommitters.filter(committer => !currentGhasCommitters.has(committer.toLowerCase()));
  const newCommittersCount = newCommittersList.length;
  console.log(`Identified ${newCommittersCount} new committers that would need licenses`);
  
  // Final license check including committer analysis
  const estimatedLicensesNeeded = newCommittersCount;
  const estimatedAvailableLicenses = isUnlimitedLicenses ? Number.MAX_SAFE_INTEGER : availableLicenses - estimatedLicensesNeeded;
  
  console.log(`Estimated licenses needed: ${estimatedLicensesNeeded}`);
  console.log(`Estimated available licenses after enablement: ${isUnlimitedLicenses ? 'Unlimited' : estimatedAvailableLicenses}`);
  console.log(`Min remaining licenses required: ${minRemainingLicenses}`);
  
  const hasEnoughLicenses = isUnlimitedLicenses || estimatedAvailableLicenses >= minRemainingLicenses;
  
  return {
    totalLicenses,
    usedLicenses,
    availableLicenses: estimatedAvailableLicenses,
    minRemainingLicenses,
    hasEnoughLicenses,
    skipLicenseCheck: false,
    currentGhasCommitters: Array.from(currentGhasCommitters),
    newCommitters: newCommittersCount,
    newCommittersList,
    estimatedLicensesNeeded
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
    skipLicenseCheck,
    organizationUrls,
    newCommitters,
    estimatedLicensesNeeded,
    dryRun,
    invalidRepositories // New parameter for invalid repositories
  } = params;
  
  let comment = `## GHAS ${dryRun ? 'Dry Run Analysis' : 'Enablement Results'} for ${hostname}\n\n`;
  
  if (dryRun) {
    comment += `> **⚠️ DRY RUN MODE ⚠️**\n>\n> No changes have been made to your repositories.\n> This analysis shows what would happen if you run the enablement for real.\n\n`;
  }
  
  if (skipLicenseCheck) {
    comment += `**License Check: SKIPPED**\n\n`;
    comment += `License check was skipped as requested in the issue form.\n\n`;
  } else {
    comment += `**License Summary:**\n`;
    comment += `- Total GHAS licenses: ${totalLicenses}\n`;
    comment += `- Used GHAS licenses: ${usedLicenses}\n`;
    
    // Add committer analysis if available
    if (newCommitters !== undefined && estimatedLicensesNeeded !== undefined) {
      comment += `- New committers requiring licenses: ${newCommitters}\n`;
      comment += `- Estimated licenses needed: ${estimatedLicensesNeeded}\n`;
      
      // If we have the detailed list of new committers and there aren't too many, show them
      if (params.newCommittersList && Array.isArray(params.newCommittersList)) {
        // Only show emails if the list is reasonably small (max 10)
        if (params.newCommittersList.length > 0 && params.newCommittersList.length <= 10) {
          comment += `\n**New committer emails:**\n`;
          params.newCommittersList.forEach(email => {
            comment += `- ${email}\n`;
          });
          comment += `\n`;
        } else if (params.newCommittersList.length > 10) {
          comment += `- ${params.newCommittersList.length} unique committers identified (too many to list)\n`;
        }
      }
    }
    
    comment += `- Available GHAS licenses after enablement: ${availableLicenses}\n`;
    comment += `- Minimum required remaining licenses: ${minRemainingLicenses}\n\n`;
    
    if (!hasEnoughLicenses) {
      comment += `⚠️ Not enough GHAS licenses available. Need to maintain at least ${minRemainingLicenses} unused licenses.\n`;
      return comment;
    }
  }
  
  if (!enableSecretScanning && !enableCodeScanning && !enableDependabotAlerts) {
    comment += '⚠️ No GHAS features were selected for enablement.\n';
  } else {
    comment += `### Features ${dryRun ? 'Selected' : 'Enabled'}\n`;
    if (enableSecretScanning) comment += `- ${dryRun ? '➡️' : '✅'} Secret Scanning\n`;
    if (enableCodeScanning) comment += `- ${dryRun ? '➡️' : '✅'} Code Scanning (default setup)\n`;
    if (enableDependabotAlerts) comment += `- ${dryRun ? '➡️' : '✅'} Dependabot Alerts\n`;
    
    // If organization URLs were provided, mention them
    if (organizationUrls && organizationUrls.length > 0) {
      comment += `\n### Organization(s)\n`;
      organizationUrls.forEach(orgUrl => {
        comment += `- ${orgUrl}\n`;
      });
    }
    
    // Display invalid organizations and repositories separately if any
    if (invalidRepositories && invalidRepositories.length > 0) {
      // Separate invalid organizations from invalid repositories
      const invalidOrganizations = [];
      const invalidRepos = [];
      
      invalidRepositories.forEach(item => {
        if (isOrganizationUrl(item.url)) {
          invalidOrganizations.push(item);
        } else {
          invalidRepos.push(item);
        }
      });
      
      // Display invalid organizations if any
      if (invalidOrganizations.length > 0) {
        comment += `\n### ⚠️ Invalid Organizations (Skipped)\n`;
        invalidOrganizations.forEach(item => {
          comment += `- **${item.url}**\n  - Error: ${item.error}\n`;
        });
        comment += `\n`;
      }
      
      // Display invalid repositories if any
      if (invalidRepos.length > 0) {
        comment += `\n### ⚠️ Invalid Repositories (Skipped)\n`;
        invalidRepos.forEach(item => {
          comment += `- **${item.url}**\n  - Error: ${item.error}\n`;
        });
        comment += `\n`;
      }
    }
    
    comment += `\n### ${invalidRepositories && invalidRepositories.length > 0 ? 'Valid ' : ''}Repositories${dryRun ? ' (No Changes Applied)' : ' Enabled'}\n`;
    repositories.forEach(repo => {
      comment += `- ${repo}\n`;
    });
  }
  
  if (dryRun) {
    comment += `\n\n---\n`;
    comment += `### ✅ Next steps\n`;
    comment += `This was a dry run analysis. If you're satisfied with the analysis and want to proceed:\n\n`;
    comment += `1. Create a new issue using the same GHAS Enablement Request template\n`;
    comment += `2. Use the same settings you provided for this dry run\n`;
    comment += `3. Set **"Dry Run Mode"** to **"No"**\n`;
    comment += `4. Submit the issue to trigger actual GHAS enablement\n\n`;
    comment += `The workflow will then enable the selected GHAS features on your repositories.\n`;
  }
  
  return comment;
}

/**
 * This function has been removed as validation is now handled directly during
 * the enablement process for more efficient error handling.
 * 
 * @deprecated This function is no longer used as repository validation is now performed
 * during the actual enablement process to reduce redundant API calls.
 */
async function validateRepositoryUrl(repoUrl, hostname, token) {
  console.warn('validateRepositoryUrl is deprecated. Repository validation is now done during enablement.');
  return { valid: true }; // Default to valid as this will be checked during enablement
}

/**
 * Parses issue body to extract repositories, feature selections, and other settings
 * @param {string} body - The issue body text
 * @returns {Object} Parsed data including repositories and feature flags
 */
function parseIssueBody(body) {
  // Parse the repository and/or organization URLs from the form submission
  // Match both "Repository URLs" (old format) and "Repository or Organization URLs" (new format)
  const repoListMatch = body.match(/### Repository( or Organization)? URLs([\s\S]*?)(?:###|$)/);
  const repoListRaw = repoListMatch ? repoListMatch[2].trim() : '';
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
  
  // Parse dry run option (dropdown field)
  const dryRunMatch = body.match(/### Dry Run Mode\s*([^\n]+)/);
  const dryRunRaw = dryRunMatch ? dryRunMatch[1].trim() : 'No';
  const dryRun = dryRunRaw === 'Yes';
  
  console.log(`Repositories: ${repositories.length}`);
  console.log(`Secret Scanning: ${enableSecretScanning}`);
  console.log(`Code Scanning: ${enableCodeScanning}`);
  console.log(`Dependabot Alerts: ${enableDependabotAlerts}`);
  console.log(`Min Remaining Licenses: ${validMinLicenses}`);
  console.log(`Skip License Check: ${skipLicenseCheck}`);
  
  if (dryRun) {
    console.log('======================================');
    console.log('✅ DRY RUN MODE IS ACTIVE');
    console.log('✅ NO CHANGES WILL BE MADE TO REPOSITORIES');
    console.log('✅ THIS IS ONLY A SIMULATION OF WHAT WOULD HAPPEN');
    console.log('======================================');
  } else {
    console.log(`Dry Run: ${dryRun} (features WILL be enabled)`);
  }
  
  return {
    repositories,
    features: {
      enableSecretScanning,
      enableCodeScanning,
      enableDependabotAlerts
    },
    minRemainingLicenses: validMinLicenses,
    skipLicenseCheck,
    dryRun
  };
}

/**
 * Parses the issue body and sets job outputs for use in GitHub Actions
 * @param {Object} issue - The issue object from GitHub context
 * @param {Object} core - The GitHub Actions core object for setting outputs
 * @returns {Object} Parsed data including repositories and feature flags
 */
function parseIssueAndSetOutputs(issue, core) {
  const parsedData = parseIssueBody(issue.body);
  
  // Set outputs for use in later steps
  core.setOutput('repositories', JSON.stringify(parsedData.repositories));
  core.setOutput('enable_secret_scanning', parsedData.features.enableSecretScanning);
  core.setOutput('enable_code_scanning', parsedData.features.enableCodeScanning);
  core.setOutput('enable_dependabot_alerts', parsedData.features.enableDependabotAlerts);
  core.setOutput('min_remaining_licenses', parsedData.minRemainingLicenses);
  core.setOutput('skip_license_check', parsedData.skipLicenseCheck);
  core.setOutput('dry_run', parsedData.dryRun);
  
  return parsedData;
}

module.exports = {
  parseIssueBody,
  parseIssueAndSetOutputs,
  parseConfigAndGroupRepos,
  determineTokenName,
  getTokenValue,
  checkLicenseAvailability,
  validateRepositoryUrl, // Kept for backward compatibility but deprecated
  createResultsComment,
  fetchOrganizationRepos,
  isOrganizationUrl,
  fetchRepoCommitters,
  getAllUniqueCommitters
};
