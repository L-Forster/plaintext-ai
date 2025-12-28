/**
 * PlaintextAI API Tests
 * 
 * Run with: node sdk/api-client.test.mjs
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const results = [];

async function post(endpoint, body) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
    }
    return res.json();
}

async function get(endpoint) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
    }
    return res.json();
}

async function runTest(name, testFn) {
    const start = Date.now();
    try {
        await testFn();
        results.push({ name, passed: true, duration: Date.now() - start });
        console.log(`✓ ${name} (${Date.now() - start}ms)`);
    } catch (error) {
        results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
        console.log(`✗ ${name}: ${error.message}`);
    }
}

async function testSearchPapers() {
    const response = await post('/api/source-finder/search', { query: 'machine learning', limit: 5 });

    if (!response.papers) {
        throw new Error('Response missing papers array');
    }
    if (!Array.isArray(response.papers)) {
        throw new Error('papers is not an array');
    }
    // Note: Semantic Scholar may rate-limit, so empty results are acceptable
    // The test passes if the response structure is correct
    if (response.papers.length > 0) {
        const paper = response.papers[0];
        if (!paper.title) {
            throw new Error('Paper missing title');
        }
    }
}

async function testExtractClaims() {
    const testText = 'The Earth is approximately 4.5 billion years old. Water covers about 71% of the Earth\'s surface.';
    const response = await post('/api/claim-extractor/extract', { prompt: testText });

    if (!response.claims) {
        throw new Error('Response missing claims array');
    }
    if (!Array.isArray(response.claims)) {
        throw new Error('claims is not an array');
    }
}

async function testContradictionCheck() {
    const testText = 'The sky is blue during the day. Some birds can fly very fast.';
    const response = await post('/api/contradiction-check/check', { text: testText });

    if (!response.claims) {
        throw new Error('Response missing claims array');
    }
    if (response.summary === undefined) {
        throw new Error('Response missing summary');
    }
}

async function testLiteratureReview() {
    const response = await post('/api/literature-review/generate', {
        reviewTopicScope: 'artificial intelligence in healthcare',
        reviewType: 'narrative',
        reviewDepthLength: 'brief',
    });

    if (!response.review) {
        throw new Error('Response missing review text');
    }
    if (typeof response.review !== 'string') {
        throw new Error('review is not a string');
    }
}

async function testFormatReferences() {
    const testReferences = `
    Smith, J. (2020). Introduction to Machine Learning. Journal of AI Research.
    Johnson, A. & Williams, B. (2021). Deep Learning Advances. Nature.
  `;

    const response = await post('/api/reference-management/format', {
        referencesInput: testReferences,
        citationStyle: 'APA'
    });

    if (!response.formattedReferences) {
        throw new Error('Response missing formattedReferences');
    }
}

async function testGenerateWorkflow() {
    const response = await post('/api/generate-workflow-from-text', {
        userInput: 'Find papers about transformers and export to text file'
    });

    if (!response.nodes) {
        throw new Error('Response missing nodes array');
    }
    if (!response.edges) {
        throw new Error('Response missing edges array');
    }
    if (!Array.isArray(response.nodes)) {
        throw new Error('nodes is not an array');
    }
}

async function testHealthEndpoints() {
    const endpoints = [
        '/api/contradiction-check/health',
        '/api/claim-extractor/health',
        '/api/pdf/health',
    ];

    for (const endpoint of endpoints) {
        const res = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!res.ok) {
            throw new Error(`${endpoint} returned ${res.status}`);
        }
        const data = await res.json();
        if (data.status !== 'ok') {
            throw new Error(`${endpoint} status is not ok`);
        }
    }
}

async function runAllTests() {
    console.log('\n=== PlaintextAI API Tests ===\n');
    console.log(`Testing against: ${API_BASE_URL}\n`);

    await runTest('Health Endpoints', testHealthEndpoints);
    await runTest('Search Papers', testSearchPapers);
    await runTest('Extract Claims', testExtractClaims);
    await runTest('Contradiction Check', testContradictionCheck);
    await runTest('Literature Review', testLiteratureReview);
    await runTest('Format References', testFormatReferences);
    await runTest('Generate Workflow', testGenerateWorkflow);

    console.log('\n=== Test Summary ===\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Passed: ${passed}/${results.length}`);
    console.log(`Failed: ${failed}/${results.length}`);

    if (failed > 0) {
        console.log('\nFailed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
        process.exit(1);
    } else {
        console.log('\nAll tests passed! ✓');
        process.exit(0);
    }
}

// Run tests
runAllTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
