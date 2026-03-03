
// Mock dependencies
const getIncomers = ({ id }, nodes, edges) => {
    return edges
        .filter(e => e.target === id)
        .map(e => nodes.find(n => n.id === e.source));
};

const getOutgoers = ({ id }, nodes, edges) => {
    return edges
        .filter(e => e.source === id)
        .map(e => nodes.find(n => n.id === e.target));
};


// The function to test (copy of proposed logic)
function getConversationHistory(node, nodes, edges) {
    const history = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const visited = new Set(); // Prevent cycles and duplicates

    function processNode(currentNode) {
        if (!currentNode || visited.has(currentNode.id)) return;
        visited.add(currentNode.id);

        const nodeHistory = {
            id: currentNode.id,
            role: currentNode.type === 'userInput' ? 'user' : 'assistant',
            parent: [],
            content: currentNode.data.text,
            files: currentNode.data.files || [],
            children: []
        };

        // Find parent nodes
        const incomers = getIncomers({ id: currentNode.id }, nodes, edges);
        // Clean undefineds just in case
        const validIncomers = incomers.filter(Boolean);
        nodeHistory.parent = validIncomers.map(incomer => incomer.id);

        if (node.id !== currentNode.id) {
            // Find child nodes
            const outgoers = getOutgoers({ id: currentNode.id }, nodes, edges);
            // Clean undefineds just in case
            const validOutgoers = outgoers.filter(Boolean);
            nodeHistory.children = validOutgoers.map(outgoer => outgoer.id);
        }

        // Push this node to history FIRST (so we get youngest first, then we reverse or sort later? 
        // Original logic did `history.unshift(nodeHistory)`, meaning youngest is LAST?
        // Wait, standard chat history expects [Oldest, ..., Youngest].
        // If we recurse upwards (parents), we visit Youngest -> Parent -> GrandParent.
        // If we unshift, we get [GrandParent, Parent, Youngest]. This is correct for OpenAI API.
        history.unshift(nodeHistory);

        // Process parent nodes recursively
        // Sort incomers to have deterministic order if needed, but usually just iterate
        validIncomers.forEach(incomer => processNode(nodeMap.get(incomer.id)));
    }

    // Start processing from the given node
    processNode(node);
    return history;
}

// --- Test Cases ---

const nodes = [
    { id: '1', type: 'userInput', data: { text: 'Node 1 (Root)' } },
    { id: '2', type: 'userInput', data: { text: 'Node 2 (Child of 1)' } },
    { id: '3', type: 'userInput', data: { text: 'Node 3 (Child of 2)' } },
    { id: '4', type: 'userInput', data: { text: 'Node 4 (Side Root)' } },
    { id: '5', type: 'userInput', data: { text: 'Node 5 (Child of 3 and 4) - Merge' } },
];

const edges = [
    { source: '1', target: '2' }, // 1 -> 2
    { source: '2', target: '3' }, // 2 -> 3
    { source: '3', target: '5' }, // 3 -> 5
    { source: '4', target: '5' }, // 4 -> 5
];

// Case A: Get history for Node 3 (Linear chain 1 -> 2 -> 3)
console.log("--- Test Case A: Linear Chain (1->2->3) ---");
const h3 = getConversationHistory(nodes[2], nodes, edges);
const ids3 = h3.map(h => h.id);
console.log("Result IDs:", ids3);
if (JSON.stringify(ids3) === JSON.stringify(['1', '2', '3'])) {
    console.log("PASS");
} else {
    console.log("FAIL");
}

// Case B: Get history for Node 5 (Merge 1->2->3->5 and 4->5)
// Expected: Should contain 1, 2, 3, 4, 5. Order between branches depends on traversal, but topological sort is ideal. 
// Basic recursion might interleave.
console.log("\n--- Test Case B: Merge (1->2->3->5 & 4->5) ---");
const h5 = getConversationHistory(nodes[4], nodes, edges);
const ids5 = h5.map(h => h.id);
console.log("Result IDs:", ids5);
// We expect identifying all ancestors.
const hasAll = ['1', '2', '3', '4', '5'].every(id => ids5.includes(id));
console.log("Has all ancestors:", hasAll);
if (hasAll) console.log("PASS (Set check)");

// Check for duplicates
const distinct = new Set(ids5).size === ids5.length;
console.log("No duplicates:", distinct);
if (distinct) console.log("PASS (Duplicate check)");

