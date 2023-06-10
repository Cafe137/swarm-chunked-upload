import { PostageBatch } from '@ethersphere/bee-js'
import { Wallet } from 'ethers'

export const TEST_BATCH_ID = process.env.DUMMY_STAMP
export const TEST_PRIVATE_KEY = process.env.DUMMY_PRIVATE_KEY

export async function createSignature(
    address: Buffer,
    privateKey: Buffer,
    batchID: Buffer,
    depth: number
): Promise<Buffer> {
    if (address.length !== 32) {
        throw Error('Expected 32 byte address, got ' + address.length + ' bytes')
    }
    if (batchID.length !== 32) {
        throw Error('Expected 32 byte batchID, got ' + batchID.length + ' bytes')
    }
    const signer = new Wallet(privateKey.toString('hex'))
    const index = swarmAddressToBucketIndex(depth, address)
    const toSign = Buffer.alloc(32 + 32 + 8 + 8)
    address.copy(toSign, 0)
    batchID.copy(toSign, 32)
    toSign.writeBigUInt64LE(BigInt(index), 64)
    toSign.writeBigUInt64LE(BigInt(Date.now()), 72)
    const eip191SignatureString: string = await signer.signMessage(toSign)
    const eip191Signature = Buffer.from(eip191SignatureString.slice(2), 'hex')
    // const signature = Buffer.concat([
    //     util.setLengthLeft(ecdsaSignature.r, 32),
    //     util.setLengthLeft(ecdsaSignature.s, 32),
    //     util.toBuffer(ecdsaSignature.v)
    // ])
    if (eip191Signature.length !== 65) {
        throw Error('Expected 65 byte signature, got ' + eip191Signature.length + ' bytes')
    }
    return eip191Signature
}

export async function marshalPostageStamp(
    postageBatch: PostageBatch,
    index: number,
    timestamp: number,
    address: Buffer,
    privateKey: Buffer
): Promise<Buffer> {
    if (address.length !== 32) {
        throw Error('Expected 32 byte address, got ' + address.length + ' bytes')
    }
    if (privateKey.length !== 32) {
        throw Error('Expected 32 byte privateKey, got ' + privateKey.length + ' bytes')
    }
    const batchID = Buffer.from(postageBatch.batchID, 'hex')
    const signature = await createSignature(address, privateKey, batchID, postageBatch.depth)
    const buffer = Buffer.alloc(32 + 8 + 8 + 65)
    batchID.copy(buffer, 0)
    buffer.writeBigUInt64LE(BigInt(index), 32)
    buffer.writeBigUInt64LE(BigInt(timestamp), 40)
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
