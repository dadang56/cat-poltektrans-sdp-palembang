import crypto from 'crypto'

function traceRandom(studentId, examId) {
    const seedString = `${studentId}-${examId}`
    let seedHash = 0
    for (let i = 0; i < seedString.length; i++) {
        const char = seedString.charCodeAt(i)
        seedHash = ((seedHash << 5) - seedHash) + char
        seedHash |= 0
    }
    
    console.log(`Initial seedHash for ${studentId.substring(0, 8)}...:`, seedHash)
    
    for (let step = 1; step <= 5; step++) {
        const multiplied = seedHash * 1103515245
        const added = multiplied + 12345
        const anded = added & 0x7fffffff
        const result = anded % 2
        console.log(`Step ${step}:`)
        console.log(`  multiplied: ${multiplied} (exceeds MAX_SAFE_INTEGER? ${multiplied > Number.MAX_SAFE_INTEGER})`)
        console.log(`  added:      ${added}`)
        console.log(`  anded:      ${anded}`)
        console.log(`  result % 2: ${result}`)
        seedHash = anded
    }
}

traceRandom(crypto.randomUUID(), 'exam-123')
