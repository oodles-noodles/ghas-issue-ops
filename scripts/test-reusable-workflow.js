// Test script to validate reusable workflow implementation
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Testing GitHub Actions Reusable Workflow Implementation');
console.log('====================================================');

// Paths to workflow files
const callerWorkflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ghas-enablement.yml');
const reusableWorkflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ghas-enablement-action.yml');

// Read workflow files
console.log('Reading workflow files...');
const callerWorkflow = fs.readFileSync(callerWorkflowPath, 'utf8');
const reusableWorkflow = fs.readFileSync(reusableWorkflowPath, 'utf8');

// Validate caller workflow
console.log('\nValidating caller workflow...');
validateCallerWorkflow(callerWorkflow);

// Validate reusable workflow
console.log('\nValidating reusable workflow...');
validateReusableWorkflow(reusableWorkflow);

// Check if caller workflow properly calls the reusable workflow
console.log('\nValidating workflow call...');
validateWorkflowCall(callerWorkflow);

// Validate issue_number parameter is correctly passed and used
console.log('\nValidating issue_number parameter...');
validateIssueNumberHandling(callerWorkflow, reusableWorkflow);

console.log('\nValidation complete!');

function validateCallerWorkflow(workflow) {
  // Check if the workflow has a trigger on issues being opened
  if (!workflow.includes('on:') || !workflow.includes('issues:') || !workflow.includes('types: [opened]')) {
    console.error('❌ Caller workflow is missing trigger on issue opening!');
  } else {
    console.log('✅ Caller workflow correctly triggers on issue opening.');
  }

  // Check if it has a job that calls the reusable workflow
  if (!workflow.includes('uses: ./.github/workflows/ghas-enablement-action.yml')) {
    console.error('❌ Caller workflow does not call the reusable workflow!');
  } else {
    console.log('✅ Caller workflow correctly calls the reusable workflow.');
  }
}

function validateReusableWorkflow(workflow) {
  // Check if the workflow has a workflow_call trigger
  if (!workflow.includes('workflow_call:')) {
    console.error('❌ Reusable workflow is missing workflow_call trigger!');
  } else {
    console.log('✅ Reusable workflow correctly defines workflow_call trigger.');
  }

  // Check if it accepts inputs
  if (!workflow.includes('inputs:')) {
    console.error('❌ Reusable workflow does not define inputs!');
  } else {
    console.log('✅ Reusable workflow correctly defines inputs.');
  }

  // Check for required inputs
  const requiredInputs = ['repositories', 'issue_number'];
  let missingInputs = [];
  
  for (const input of requiredInputs) {
    if (!workflow.includes(`${input}:`)) {
      missingInputs.push(input);
    }
  }
  
  if (missingInputs.length > 0) {
    console.error(`❌ Reusable workflow is missing required inputs: ${missingInputs.join(', ')}`);
  } else {
    console.log('✅ Reusable workflow defines all required inputs.');
  }
}

function validateWorkflowCall(workflow) {
  // Check if the workflow passes required parameters
  const requiredParams = ['repositories', 'issue_number'];
  let missingParams = [];
  
  for (const param of requiredParams) {
    if (!workflow.includes(`${param}:`)) {
      missingParams.push(param);
    }
  }
  
  if (missingParams.length > 0) {
    console.error(`❌ Caller workflow is not passing required parameters: ${missingParams.join(', ')}`);
  } else {
    console.log('✅ Caller workflow passes all required parameters.');
  }

  // Check if secrets are passed correctly
  if (!workflow.includes('secrets:') || !workflow.includes('GHES_API_TOKEN_1:')) {
    console.error('❌ Caller workflow is not passing required secrets correctly!');
  } else {
    console.log('✅ Caller workflow passes secrets correctly.');
  }
}

function validateIssueNumberHandling(caller, reusable) {
  // Check if issue_number is passed from the caller
  if (!caller.includes('issue_number: ${{ github.event.issue.number }}')) {
    console.error('❌ Caller workflow does not pass issue_number from the trigger event!');
  } else {
    console.log('✅ Caller workflow correctly passes issue_number from the trigger event.');
  }

  // Check if the reusable workflow uses issue_number
  if (!reusable.includes('${{ inputs.issue_number }}')) {
    console.error('❌ Reusable workflow does not use the passed issue_number input!');
  } else {
    console.log('✅ Reusable workflow correctly uses the passed issue_number input.');
  }
}
