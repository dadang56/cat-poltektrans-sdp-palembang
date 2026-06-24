import crypto from 'crypto'

// Simulator
function simulate(studentId, examId, clusters) {
    const seedString = `${studentId || 'anon'}-${examId}`
    let seedHash = 0
    for (let i = 0; i < seedString.length; i++) {
        const char = seedString.charCodeAt(i)
        seedHash = ((seedHash << 5) - seedHash) + char
        seedHash |= 0
    }
    const seededRandom = (max) => {
        seedHash = (seedHash * 1103515245 + 12345) & 0x7fffffff
        return seedHash % max
    }

    // Pick 1 random variant per cluster
    const selected = Object.keys(clusters).map(clusterId => {
        const variants = clusters[clusterId]
        const idx = seededRandom(variants.length)
        return { clusterId, variant: variants[idx] }
    })

    return selected
}

// Setup clusters: 5 clusters, each has 2 variants (Variant A and Variant B)
const clusters = {
    'cluster-1': ['A', 'B'],
    'cluster-2': ['A', 'B'],
    'cluster-3': ['A', 'B'],
    'cluster-4': ['A', 'B'],
    'cluster-5': ['A', 'B']
}

const examId = 'exam-123'

// 1. Simulate with "anon" (user.id is undefined)
console.log('--- SIMULATING FOR 3 STUDENTS WHEN USER IS UNDEFINED/ANON ---')
for (let i = 1; i <= 3; i++) {
    const result = simulate(undefined, examId, clusters)
    console.log(`Student ${i} (anon) got:`, result.map(r => r.variant).join(', '))
}

// 2. Simulate with unique student UUIDs
console.log('\n--- SIMULATING FOR 5 DIFFERENT STUDENTS ---')
for (let i = 1; i <= 5; i++) {
    const studentUuid = crypto.randomUUID()
    const result = simulate(studentUuid, examId, clusters)
    console.log(`Student ${i} (${studentUuid.substring(0, 8)}...) got:`, result.map(r => r.variant).join(', '))
}
