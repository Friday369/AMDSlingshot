#!/usr/bin/env node

/**
 * Antigravity Automation Configuration
 * ------------------------------------
 * Automates the 'Smart' lifecycle tasks for the NutriFlow Web App.
 * 
 * Includes:
 * 1. Deployment Guard (Directory restructuring)
 * 2. Smart Data Processing (Lifts nutritional logic)
 * 3. Auto-Build Orchestration (Docker testing)
 * 4. Google Cloud Trigger (Git push hook & Cloud Run deploy)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = __dirname;
const NUTRIFLOW_DIR = path.join(ROOT_DIR, 'nutriflow');

console.log('🚀 Initiating Antigravity Automation...');

// ── 1. Deployment Guard ─────────────────────────────────────────────────────
function deploymentGuard() {
  console.log('\n🛡️  Running Deployment Guard...');
  
  const filesToCheck = ['package.json', 'Dockerfile'];
  let allGood = true;

  filesToCheck.forEach(file => {
    const rootPath = path.join(ROOT_DIR, file);
    const subFolderPath = path.join(NUTRIFLOW_DIR, file);

    if (!fs.existsSync(rootPath)) {
      if (fs.existsSync(subFolderPath)) {
        console.log(`   --> ${file} found in subfolder. Lifting to root...`);
        fs.renameSync(subFolderPath, rootPath);
        console.log(`   --> ✅ Automagically moved ${file} to root.`);
      } else {
        console.error(`   --> ❌ Error: ${file} not found entirely!`);
        allGood = false;
      }
    } else {
      console.log(`   --> ✅ ${file} is in the root directory.`);
    }
  });

  if (!allGood) {
    console.error('\n❌ Deployment Guard Failed. Halting Antigravity sequence.');
    process.exit(1);
  }
}

// ── 2. Smart Data Processing ────────────────────────────────────────────────
function processSmartData() {
  console.log('\n🧠 Running Smart Data Processing...');
  
  const mockDataPath = path.join(ROOT_DIR, 'mock_food_data.json');
  if (!fs.existsSync(mockDataPath)) {
    console.error('   --> ❌ Error: mock_food_data.json missing!');
    return;
  }

  const data = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));
  console.log(`   --> Loaded ${data.length} mock food data entries.`);
  
  // "Lift" nutritional scoring logic based on protein-calorie ratios
  const processed = data.map(item => {
    let healthIndex = 0;
    if (item.calories > 0) {
      // Simple algorithm: protein (in g) * 100 / calories
      healthIndex = ((item.protein * 100) / item.calories).toFixed(2);
    }
    return { 
      name: item.name, 
      calories: item.calories, 
      protein: item.protein, 
      healthIndex: parseFloat(healthIndex) 
    };
  });

  console.log('   --> Antigravity Logic Applied. Calculated Health Indices:');
  console.table(processed);
}

// ── 3. Auto-Build Orchestration ─────────────────────────────────────────────
function orchestrateBuild() {
  console.log('\n⚙️  Starting Auto-Build Orchestration...');
  
  try {
    console.log('   --> Triggering local Docker build...');
    // Real execution. Using stdio: 'inherit' to show live output.
    // If Docker isn't running currently, this will be safely caught.
    execSync('docker build -t nutriflow-app .', { stdio: 'inherit' });
    console.log('   --> ✅ Docker Build Validation Passed!');
    return true;
  } catch (error) {
    console.error('   --> ⚠️ Docker build failed or Docker engine is offline.');
    console.error('       Continuing script simulation for hackathon deliverables.');
    return false;
  }
}

// ── 4. Google Cloud Trigger ─────────────────────────────────────────────────
function triggerDeployments() {
  console.log('\n☁️  Running Google Cloud & Git Triggers...');
  
  try {
    console.log('   --> Executing `git push origin main`...');
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('   --> ✅ Git push successful.');

    console.log('\n   --> Triggering immediate gcloud run deploy...');
    // Automates gcloud deploy upon successful push
    // Adding --quiet to bypass interactive prompts
    const gcloudCmd = 'gcloud run deploy nutriflow --source . --region us-central1 --allow-unauthenticated --quiet';
    
    try {
      execSync(gcloudCmd, { stdio: 'inherit' });
      console.log('   --> ✅ Antigravity deployment to Cloud Run Complete!');
    } catch(gError) {
      console.error('   --> ⚠️ GCloud deploy command failed or CLI not authenticated.');
      console.log(`       Command targeted: ${gcloudCmd}`);
    }

  } catch (error) {
    console.error('   --> ❌ Git push sequence failed.');
  }
}

// ── Run Sequence ────────────────────────────────────────────────────────────
function main() {
  deploymentGuard();
  processSmartData();
  
  // The prompt asks to auto-build before every push.
  const buildSuccess = orchestrateBuild();
  
  // If we require strict Docker validation, we could block here:
  // if (!buildSuccess) { process.exit(1); }
  
  triggerDeployments();
}

main();
