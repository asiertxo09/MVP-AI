
// verification_script.js
// Run with: node verification_script.js
// Note: Requires backend to be running. If not, this serves as documentation of the flow.

const API_BASE = 'http://localhost:5001'; // Adjust if needed

async function request(path, method, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        try {
            return { status: res.status, data: JSON.parse(text) };
        } catch {
            return { status: res.status, text };
        }
    } catch (e) {
        return { error: e.message };
    }
}

async function verify() {
    console.log("🚀 Starting Verification Flow...");

    const timestamp = Date.now();
    const parentUser = `parent_${timestamp}`;
    const childUser = `child_${timestamp}`;
    const specialistUser = `spec_${timestamp}`;
    const password = 'Password123!';

    // 1. Register Parent
    console.log(`\n1. Registering Parent (${parentUser})...`);
    let res = await request('/api/register', 'POST', { username: parentUser, password, role: 'parent' });
    if (res.status !== 201 && res.status !== 200) { console.error("❌ Failed to register parent", res); return; }
    console.log("✅ Parent Registered");

    // Login Parent
    res = await request('/api/login', 'POST', { username: parentUser, password });
    if (!res.data || !res.data.token) { console.error("❌ Failed to login parent", res); return; }
    const parentToken = res.data.token;
    console.log("✅ Parent Logged In");

    // 2. Register Child
    console.log(`\n2. Registering Child (${childUser})...`);
    res = await request('/api/register', 'POST', { username: childUser, password, role: 'child' });
    if (res.status !== 201 && res.status !== 200) { console.error("❌ Failed to register child", res); return; }
    console.log("✅ Child Registered");

    // Link Child to Parent
    console.log("   Linking Child to Parent...");
    res = await request('/api/link-account', 'POST', { childUsername: childUser, childPassword: password }, parentToken);
    if (res.status !== 200) { console.error("❌ Failed to link child", res); return; }
    console.log("✅ Child Linked");

    // 3. Play as Child (Login Child)
    console.log(`\n3. Child Gameplay Simulation...`);
    res = await request('/api/login', 'POST', { username: childUser, password });
    if (!res.data || !res.data.token) { console.error("❌ Failed to login child", res); return; }
    const childToken = res.data.token;
    const childId = res.data.user.id;
    // Note: Assuming login returns user object with id. If not, parent 'get children' will give ID.

    // Get Child ID from Parent view if needed
    res = await request('/api/children', 'GET', null, parentToken);
    const linkedChild = res.data.children.find(c => c.username === childUser);
    const targetChildId = linkedChild.id;
    console.log(`   Child ID verified: ${targetChildId}`);

    // Send Metrics (Win Phoneme Hunt)
    console.log("   Sending Game Metrics (Phoneme Hunt)...");
    res = await request('/api/metrics', 'POST', {
        activityType: 'phoneme_hunt',
        isCorrect: true,
        metadata: { score: 100, difficulty: 1.1 }
    }, childToken); // Use child token!
    if (res.status !== 200 && res.status !== 201) { console.error("❌ Failed to save metrics", res); }
    else console.log("✅ Metrics Saved");

    // 4. Verify on Parent Dashboard
    console.log(`\n4. Verifying Parent Dashboard Data...`);
    res = await request(`/api/metrics?type=current&childId=${targetChildId}`, 'GET', null, parentToken);
    if (res.data && res.data.current) {
        console.log("✅ Data retrieved successfully:", res.data.current);
    } else {
        console.error("❌ Failed to retrieve metrics", res);
    }

    // 5. Specialist Flow
    console.log(`\n5. Specialist Flow (${specialistUser})...`);
    res = await request('/api/register', 'POST', { username: specialistUser, password, role: 'specialist' });
    if (res.status !== 201 && res.status !== 200) { console.error("❌ Failed to register specialist", res); return; }

    // Login Specialist
    res = await request('/api/login', 'POST', { username: specialistUser, password });
    const specToken = res.data.token;
    console.log("✅ Specialist Logged In");

    // Link Child to Specialist
    // Note: Specialist usually links via code or username/password too in this simple system?
    // Checking portal-specialist.html -> it uses /api/link-account just like parent.
    console.log("   Linking Child to Specialist...");
    res = await request('/api/link-account', 'POST', { childUsername: childUser, childPassword: password }, specToken);
    if (res.status !== 200) { console.error("❌ Failed to link child to specialist", res); }
    else console.log("✅ Child Linked to Specialist");

    // Verify Data as Specialist
    console.log("   Verifying Data as Specialist...");
    res = await request(`/api/metrics?type=current&childId=${targetChildId}`, 'GET', null, specToken);
    if (res.data && res.data.current) {
        console.log("✅ Data visible to Specialist!");
    } else {
        console.error("❌ Specialist could not see data", res);
    }

    console.log("\n✨ Verification Complete!");
}

verify();
