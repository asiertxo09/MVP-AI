// Verification Script for Neuro-Engine Logic
const { GameEngine } = await import('./GameEngine.js');

// Mock DOM and Browser APIs
global.document = {
    createElement: () => ({ style: {}, appendChild: () => { }, remove: () => { } }),
    body: { appendChild: () => { } },
    getElementById: () => ({ style: {} })
};
global.window = {
    telemetry: { logEvent: (type, data) => console.log(`[Telemetry] ${type}`, data) },
    addEventListener: () => { },
    location: { pathname: '/app/test' }
};
global.localStorage = {
    getItem: () => null,
    setItem: () => { }
};
global.sessionStorage = {
    getItem: () => null
};
global.alert = console.log;

// Mock API Client
const mockApiClient = {
    apiFetch: async () => ({ ok: true, data: { profile: { modality: { auditory_index: 0.2 } } } }),
    post: async () => { }
};

// Hack to mock dynamic import in GameEngine
const originalImport = global.import;
// Since we are in ES modules, we can't easily mock dynamic imports inside the source module without a loader.
// However, for pure logic testing of calculateNeuroEngine, we only need the class methods.
// Let's instantiate and test the logic methods directly, avoiding init() which calls API.

async function runTests() {
    console.log("Starting Neuro-Engine Verification...");
    const engine = new GameEngine();
    // Mock saveMetric to avoid API calls during logic testing
    engine.saveMetric = async () => { };

    // Test 1: Rolling Window & Metrics
    console.log("\nTest 1: Accuracy Calculation (Zone A)");
    // Simulate 10 correct answers (100% Accuracy)
    for (let i = 0; i < 10; i++) {
        engine.reportResult(true, 'test', { reactionTimeMs: 500 }); // Constant RT
    }

    let adaptation = engine.calculateNeuroEngine();
    console.log("Metrics:", engine.calculateNeuroMetrics());
    console.log("Adaptation:", adaptation);

    if (adaptation.zone === 'A' && adaptation.action === 'increase_load') {
        console.log("✅ PASS: Correctly identified Zone A (Boredom/Mastery)");
    } else {
        console.error("❌ FAIL: Expected Zone A");
    }

    // Test 2: Consistency Check (Attention)
    console.log("\nTest 2: Consistency Check");
    engine.history = []; // Reset
    // Simulate erratic RTs
    for (let i = 0; i < 10; i++) {
        const rt = i % 2 === 0 ? 200 : 2500; // High variance
        engine.history.push({ isCorrect: true, rt, timestamp: Date.now() });
    }

    adaptation = engine.calculateNeuroEngine();
    console.log("Consistency (SD):", engine.calculateNeuroMetrics().consistency);
    if (adaptation.scaffolding.includes('attention_check')) {
        console.log("✅ PASS: Triggered Attention Check");
    } else {
        console.error("❌ FAIL: Did not trigger Attention Check");
    }

    // Test 3: Zone C (Frustration)
    console.log("\nTest 3: Zone C (Frustration)");
    engine.history = [];
    // Simulate 6 failures (40% Accuracy)
    for (let i = 0; i < 10; i++) {
        const isCorrect = i < 4;
        engine.reportResult(isCorrect, 'test', { reactionTimeMs: 800 });
    }

    adaptation = engine.calculateNeuroEngine();
    if (adaptation.zone === 'C' && adaptation.action === 'increase_scaffolding') {
        console.log("✅ PASS: Correctly identified Zone C (Anxiety)");
    } else {
        console.error("❌ FAIL: Expected Zone C");
    }

    // Test 4: Modality Adaptation
    console.log("\nTest 4: Modality Adaptation");
    // Manually inject modality profile since we didn't call init()
    engine.modalityProfile = { auditory_index: 0.3 };
    engine.updateModalityState();

    if (engine.currentModalityState.enhanceVisuals === true) {
        console.log("✅ PASS: Applied Visual Enhancement for Auditory Deficit");
    } else {
        console.error("❌ FAIL: Failed to apply modality adaptation");
    }
}

runTests().catch(console.error);
