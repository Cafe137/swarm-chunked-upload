const count = 2 ** 16
const size = count * 4

export function storeState(state: number[]): Buffer {
    const buffer = Buffer.alloc(size)
    for (let i = 0; i < count; i++) {
        buffer.writeInt16LE(state[i], i * 4)
    }
    return buffer
}

export function loadState(buffer: Buffer): number[] {
    const state = []
    for (let i = 0; i < count; i++) {
        state[i] = buffer.readInt16LE(i * 4)
    }
    return state
}

export function readFileOrCreate(): Buffer {
    try {
        return require('fs').readFileSync('state.bin')
    } catch (e) {
        return Buffer.alloc(size)
    }
}
