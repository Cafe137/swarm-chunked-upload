import { makeChunkedFile } from '@fairdatasociety/bmt-js'
import axios from 'axios'
import { readFileSync, writeFileSync } from 'fs'
import { marshalPostageStamp } from './signature'

main()

async function main() {
    const path = process.argv[2]
    const batchID = 'f8f97cc4e4a5e2cf364694db0889578b7390be33c4d5c46d5fffa516902501a1' // process.argv[3]
    const privateKey = 'be52c649a4c560a1012daa572d4e81627bcce20ca14e007aef87808a7fadd3d0' // process.argv[4]
    const rawBinaryFileData = readFileSync(path)
    const chunkedFile = makeChunkedFile(rawBinaryFileData)
    const levels = chunkedFile.bmt()
    let counter = 0
    const chunks = []
    for (const level of levels) {
        for (const chunk of level) {
            chunks.push(chunk)
        }
    }
    const rootChunk = chunkedFile.rootChunk()
    console.log('Root address', Buffer.from(rootChunk.address()).toString('hex'))
    chunks.push(rootChunk)
    for (const chunk of chunks) {
        console.log('Working on chunk ', counter)
        const chunkIndex = String(counter++).padStart(5, '0')
        const chunkAddressHex = Buffer.from(chunk.address()).toString('hex')
        const chunkOutputPath = `data-${chunkIndex}-${chunkAddressHex}.bin`
        const data = Uint8Array.from([...chunk.span(), ...chunk.payload])
        writeFileSync(chunkOutputPath, data)
        const marshal = await marshalPostageStamp(
            { batchID, depth: 17 } as unknown as any,
            Date.now(),
            Buffer.from(chunk.address()),
            Buffer.from(privateKey, 'hex')
        )
        const marshalOutputPath = `data-${chunkIndex}-${chunkAddressHex}.sig.bin`
        writeFileSync(marshalOutputPath, marshal.toString('hex'), 'utf8')
        await axios('http://localhost:1633/chunks', {
            method: 'POST',
            data,
            headers: {
                'Swarm-Postage-Stamp': marshal.toString('hex')
            }
        })
    }
}
