#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Slack AI Application
 * 
 * This script runs all tests and generates a comprehensive report
 * covering functionality, performance, and code coverage.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Comprehensive Test Suite for Slack AI Application');
console.log('=' .repeat(70));

// Test categories and their descriptions
const testCategories = [
  {
    name: 'Unit Tests',
    description: 'Testing individual components and functions',
    patterns: [
      'tests/server/**/*.test.ts',
      'tests/client/**/*.test.tsx',
      'tests/shared/**/*.test.ts'
    ]
  },
  {
    name: 'Integration Tests',
    description: 'Testing API endpoints and workflows',
    patterns: ['tests/integration/**/*.test.ts']
  },
  {
    name: 'Performance Tests',
    description: 'Testing application performance and scalability',
    patterns: ['tests/performance/**/*.test.ts']
  }
];

// Test report structure
const testReport = {
  timestamp: new Date().toISOString(),
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    coverage: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    }
  },
  categories: [],
  recommendations: []
};

// Run tests for each category
async function runTestCategory(category) {
  console.log(`\n📋 Running ${category.name}`);
  console.log(`Description: ${category.description}`);
  console.log('-'.repeat(50));

  const categoryResult = {
    name: category.name,
    status: 'passed',
    tests: 0,
    passed: 0,
    failed: 0,
    duration: 0,
    errors: []
  };

  try {
    const startTime = Date.now();
    
    // Run Jest with specific patterns
    const testPattern = category.patterns.join(' ');
    const command = `npx jest ${testPattern} --verbose --json`;
    
    console.log(`Running: ${command}`);
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const endTime = Date.now();
    categoryResult.duration = endTime - startTime;
    
    // Parse Jest JSON output
    try {
      const result = JSON.parse(output);
      categoryResult.tests = result.numTotalTests;
      categoryResult.passed = result.numPassedTests;
      categoryResult.failed = result.numFailedTests;
      
      testReport.summary.totalTests += result.numTotalTests;
      testReport.summary.passedTests += result.numPassedTests;
      testReport.summary.failedTests += result.numFailedTests;
      
      console.log(`✅ ${categoryResult.passed} passed, ❌ ${categoryResult.failed} failed`);
      
    } catch (parseError) {
      console.log('⚠️  Could not parse Jest output, but tests completed');
      categoryResult.status = 'completed';
    }
    
  } catch (error) {
    categoryResult.status = 'failed';
    categoryResult.errors.push(error.message);
    console.log(`❌ ${category.name} failed: ${error.message}`);
  }

  testReport.categories.push(categoryResult);
  return categoryResult;
}

// Generate test coverage report
async function generateCoverageReport() {
  console.log('\n📊 Generating Coverage Report');
  console.log('-'.repeat(50));

  try {
    const coverageCommand = 'npx jest --coverage --coverageReporters=json-summary';
    execSync(coverageCommand, { stdio: 'inherit' });
    
    // Read coverage summary
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
      const total = coverageData.total;
      
      testReport.summary.coverage = {
        statements: total.statements.pct,
        branches: total.branches.pct,
        functions: total.functions.pct,
        lines: total.lines.pct
      };
      
      console.log(`✅ Coverage: ${total.lines.pct}% lines, ${total.functions.pct}% functions`);
    }
    
  } catch (error) {
    console.log('⚠️  Could not generate coverage report');
  }
}

// Generate recommendations based on test results
function generateRecommendations() {
  console.log('\n💡 Generating Recommendations');
  console.log('-'.repeat(50));

  const recommendations = [];

  // Check overall test pass rate
  const passRate = testReport.summary.totalTests > 0 
    ? (testReport.summary.passedTests / testReport.summary.totalTests) * 100
    : 0;

  if (passRate < 90) {
    recommendations.push({
      type: 'critical',
      message: `Test pass rate is ${passRate.toFixed(1)}%. Aim for >90% to ensure reliability.`,
      action: 'Review and fix failing tests before deployment'
    });
  }

  // Check code coverage
  const lineCoverage = testReport.summary.coverage.lines;
  if (lineCoverage < 80) {
    recommendations.push({
      type: 'important',
      message: `Code coverage is ${lineCoverage}%. Aim for >80% to ensure thorough testing.`,
      action: 'Add more unit tests to cover untested code paths'
    });
  }

  // Check for failed test categories
  const failedCategories = testReport.categories.filter(cat => cat.status === 'failed');
  if (failedCategories.length > 0) {
    recommendations.push({
      type: 'critical',
      message: `${failedCategories.length} test categories failed completely.`,
      action: 'Fix test setup and infrastructure issues'
    });
  }

  // Performance recommendations
  const performanceCategory = testReport.categories.find(cat => cat.name === 'Performance Tests');
  if (performanceCategory && performanceCategory.duration > 30000) {
    recommendations.push({
      type: 'optimization',
      message: 'Performance tests are taking too long to run.',
      action: 'Consider optimizing test setup or splitting into smaller test suites'
    });
  }

  // Security recommendations
  recommendations.push({
    type: 'security',
    message: 'Add security-focused tests for authentication and authorization.',
    action: 'Implement tests for SQL injection, XSS, and CSRF protection'
  });

  // AI-specific recommendations
  recommendations.push({
    type: 'ai',
    message: 'Add comprehensive tests for AI error handling and edge cases.',
    action: 'Test AI service failures, rate limiting, and invalid responses'
  });

  testReport.recommendations = recommendations;

  recommendations.forEach(rec => {
    const icon = rec.type === 'critical' ? '🚨' : 
                rec.type === 'important' ? '⚠️' : 
                rec.type === 'security' ? '🔒' : 
                rec.type === 'ai' ? '🤖' : '💡';
    console.log(`${icon} ${rec.message}`);
    console.log(`   Action: ${rec.action}`);
  });
}

// Generate final report
function generateFinalReport() {
  console.log('\n📋 Test Suite Summary');
  console.log('='.repeat(70));

  const { summary, categories } = testReport;
  
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`✅ Passed: ${summary.passedTests}`);
  console.log(`❌ Failed: ${summary.failedTests}`);
  console.log(`⏭️  Skipped: ${summary.skippedTests}`);
  
  const passRate = summary.totalTests > 0 
    ? ((summary.passedTests / summary.totalTests) * 100).toFixed(1)
    : '0';
  console.log(`📊 Pass Rate: ${passRate}%`);
  
  console.log('\n📊 Code Coverage:');
  console.log(`Lines: ${summary.coverage.lines}%`);
  console.log(`Functions: ${summary.coverage.functions}%`);
  console.log(`Branches: ${summary.coverage.branches}%`);
  console.log(`Statements: ${summary.coverage.statements}%`);

  console.log('\n📋 Category Results:');
  categories.forEach(cat => {
    const statusIcon = cat.status === 'passed' ? '✅' : 
                      cat.status === 'failed' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${cat.name}: ${cat.passed}/${cat.tests} tests (${cat.duration}ms)`);
  });

  // Save report to file
  const reportPath = path.join(process.cwd(), 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  // Determine overall status
  const overallSuccess = summary.failedTests === 0 && 
                        !categories.some(cat => cat.status === 'failed');
  
  console.log('\n' + '='.repeat(70));
  if (overallSuccess) {
    console.log('🎉 ALL TESTS PASSED! Application is ready for deployment.');
  } else {
    console.log('❌ SOME TESTS FAILED. Please review and fix before deployment.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    // Run tests for each category
    for (const category of testCategories) {
      await runTestCategory(category);
    }

    // Generate coverage report
    await generateCoverageReport();

    // Generate recommendations
    generateRecommendations();

    // Generate final report
    generateFinalReport();

  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run the test suite
main().catch(console.error);
