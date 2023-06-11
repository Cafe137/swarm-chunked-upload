import { PostageBatch } from '@ethersphere/bee-js'
import { Wallet, keccak256, solidityPacked } from 'ethers'

const PREFIX_STRING = Buffer.from('\x19Ethereum Signed Message:\n32')

export const TEST_BATCH_ID = process.env.DUMMY_STAMP
export const TEST_PRIVATE_KEY = process.env.DUMMY_PRIVATE_KEY

export async function createSignature(
    address: Buffer,
    privateKey: Buffer,
    batchID: Buffer,
    depth: number
): Promise<Buffer> {
    if (!Buffer.isBuffer(address)) {
        throw Error('Expected address to be a Buffer')
    }
    if (!Buffer.isBuffer(privateKey)) {
        throw Error('Expected privateKey to be a Buffer')
    }
    if (!Buffer.isBuffer(batchID)) {
        throw Error('Expected batchID to be a Buffer')
    }
    if (address.length !== 32) {
        throw Error('Expected 32 byte address, got ' + address.length + ' bytes')
    }
    if (batchID.length !== 32) {
        throw Error('Expected 32 byte batchID, got ' + batchID.length + ' bytes')
    }
    if (privateKey.length !== 32) {
        throw Error('Expected 32 byte privateKey, got ' + privateKey.length + ' bytes')
    }

    const signer = new Wallet(privateKey.toString('hex'))
    const index = swarmAddressToBucketIndex(depth, address)
    const indexBuffer = Buffer.alloc(8)
    indexBuffer.writeBigUInt64LE(BigInt(index))
    const timestampBuffer = Buffer.alloc(8)
    timestampBuffer.writeBigUInt64LE(BigInt(Date.now()))
    const packed = solidityPacked(
        ['bytes32', 'bytes32', 'bytes8', 'bytes8'],
        [address, batchID, indexBuffer, timestampBuffer]
    )
    console.log({ packed })
    const signedHexString = await signer.signMessage(keccak256(packed))
    console.log({ signedHexString })
    const signed = Buffer.from(signedHexString.slice(2), 'hex')
    if (signed.length !== 65) {
        throw Error('Expected 65 byte signature, got ' + signed.length + ' bytes')
    }
    return signed
}

export async function marshalPostageStamp(
    postageBatch: PostageBatch,
    timestamp: number,
    address: Buffer,
    privateKey: Buffer
): Promise<Buffer> {
    if (!Buffer.isBuffer(address)) {
        throw Error('Expected address to be a Buffer')
    }
    if (!Buffer.isBuffer(privateKey)) {
        throw Error('Expected privateKey to be a Buffer')
    }
    if (address.length !== 32) {
        throw Error('Expected 32 byte address, got ' + address.length + ' bytes')
    }
    if (privateKey.length !== 32) {
        throw Error('Expected 32 byte privateKey, got ' + privateKey.length + ' bytes')
    }
    const batchID = Buffer.from(postageBatch.batchID, 'hex')
    const bucket = swarmAddressToBucketIndex(16, address)
    const index = bucketAndIndexToBuffer(bucket, 0)
    console.log({ index })
    const signature = await createSignature(address, privateKey, batchID, postageBatch.depth)
    const buffer = Buffer.alloc(32 + 8 + 8 + 65)
    batchID.copy(buffer, 0)
    index.copy(buffer, 32)
    buffer.writeBigUInt64BE(BigInt(timestamp), 40)
    signature.copy(buffer, 48)
    return buffer
}

export function swarmAddressToBucketIndex(depth: number, address: Buffer): number {
    if (address.length !== 32) {
        throw Error('Expected 32 byte address, got ' + address.length + ' bytes')
    }
    if (depth < 16 || depth > 100) {
        throw Error('Expected depth between 16 and 100, got ' + depth)
    }
    const i = address.readUInt32BE(0)
    return i >>> (32 - depth)
}

function bucketAndIndexToBuffer(bucket: number, index: number): Buffer {
    console.log({ bucket, index })
    const buffer = Buffer.alloc(8)
    buffer.writeUInt32BE(bucket)
    buffer.writeUInt32BE(index, 4)
    return buffer
}
