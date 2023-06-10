import { PostageBatch } from '@ethersphere/bee-js'
import { marshalPostageStamp, swarmAddressToBucketIndex } from './signature'

test('swarmAddressToBucketIndex', async () => {
    const bucketIndex = swarmAddressToBucketIndex(
        20,
        Buffer.from('1000000000000000000000000000000000000000000000000000000000000001', 'hex')
    )
    expect(bucketIndex).toBe(65536)
})

test('marshalPostageStamp', async () => {
    const marshalled = await marshalPostageStamp(
        {
            batchID: '1000000000000000000000000000000000000000000000000000000000000001',
            depth: 20
        } as unknown as PostageBatch,
        200,
        200,
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex')
    )
    expect(marshalled).toHaveLength(113) // todo
})
