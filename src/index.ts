import { Bee } from '@ethersphere/bee-js'
import { Chunk, ChunkAddress, makeChunkedFile } from '@fairdatasociety/bmt-js'
import { Promises, Strings } from 'cafe-utility'
import { MantarayNode, Reference } from 'mantaray-js'
import { TextEncoder } from 'util'

type Options = {
    filename: string
    beeUrl: string
    stamp: string
    deferred?: boolean
    parallelism?: number
    contentType?: string
    retries?: number
    onSuccessfulChunkUpload?: (chunk: Chunk, context: Context) => Promise<void>
    onFailedChunkUpload?: (chunk: Chunk, context: Context) => Promise<void>
}

type Context = Required<Options> & { bee: Bee }

type Result = {
    rootChunkAddress: ChunkAddress
    bzzReference: Reference
    context: Context
}

const noop = () => Promise.resolve()

export async function uploadChunked(bytes: Uint8Array, options: Options): Promise<Result> {
    const context = makeContext(options)
    const rootChunkAddress = await splitAndUploadChunks(bytes, context)
    const bzzReference = await createManifest(rootChunkAddress, context)
    return { rootChunkAddress, bzzReference, context }
}

async function splitAndUploadChunks(bytes: Uint8Array, context: Context): Promise<ChunkAddress> {
    const queue = Promises.makeAsyncQueue(context.parallelism)
    const chunkedFile = makeChunkedFile(bytes)
    const levels = chunkedFile.bmt()
    for (const level of levels) {
        for (const chunk of level) {
            queue.enqueue(async () => {
                await uploadChunkWithRetries(chunk, context)
                await context.onSuccessfulChunkUpload(chunk, context)
            })
        }
    }
    await queue.drain()
    return chunkedFile.address()
}

async function createManifest(address: ChunkAddress, context: Context): Promise<Reference> {
    const node = new MantarayNode()
    node.addFork(encodePath(`/${context.filename}`), address, {
        'Content-Type': context.contentType,
        Filename: context.filename
    })
    node.addFork(encodePath('/'), new Uint8Array(32) as Reference, {
        'website-index-document': `/${context.filename}`
    })
    const reference = await node.save(async data => {
        const result = await uploadDataWithRetries(data, context)
        return fromHexString(result.reference) as Reference
    })
    return reference
}

async function uploadDataWithRetries(data: Uint8Array, context: Context): Promise<{ reference: string }> {
    let lastError = null
    for (let attempts = 0; attempts < context.retries; attempts++) {
        try {
            return await context.bee.uploadData(context.stamp, data)
        } catch (error) {
            lastError = error
        }
    }
    throw lastError
}

async function uploadChunkWithRetries(chunk: Chunk, context: Context) {
    let lastError = null
    for (let attempts = 0; attempts < context.retries; attempts++) {
        try {
            return await uploadChunk(chunk, context)
        } catch (error) {
            lastError = error
            await context.onFailedChunkUpload(chunk, context)
        }
    }
    throw lastError
}

async function uploadChunk(chunk: Chunk, context: Context) {
    const expectedReference = toHexString(chunk.address())
    const actualReference = await context.bee.uploadChunk(
        context.stamp,
        Uint8Array.from([...chunk.span(), ...chunk.payload]),
        {
            deferred: context.deferred
        }
    )
    if (actualReference !== expectedReference) {
        throw Error(`Expected ${expectedReference} but got ${actualReference}`)
    }
    return actualReference
}

function makeContext(options: Options): Context {
    return {
        filename: options.filename,
        beeUrl: options.beeUrl,
        stamp: options.stamp,
        bee: new Bee(options.beeUrl),
        deferred: options.deferred ?? true,
        parallelism: options.parallelism ?? 8,
        contentType: options.contentType ?? detectMime(options.filename),
        retries: options.retries ?? 5,
        onSuccessfulChunkUpload: options.onSuccessfulChunkUpload ?? noop,
        onFailedChunkUpload: options.onFailedChunkUpload ?? noop
    }
}

function encodePath(path: string) {
    return new TextEncoder().encode(path)
}

function fromHexString(hexString: string): Uint8Array {
    const matches = hexString.match(/.{1,2}/g)
    if (!matches) {
        throw Error(`Invalid hex string: ${hexString}`)
    }
    return Uint8Array.from(matches.map(byte => parseInt(byte, 16)))
}

function toHexString(bytes: Uint8Array): string {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
}

function detectMime(filename: string): string {
    const extension = Strings.getExtension(filename)
    return (
        {
            aac: 'audio/aac',
            abw: 'application/x-abiword',
            ai: 'application/postscript',
            arc: 'application/octet-stream',
            avi: 'video/x-msvideo',
            azw: 'application/vnd.amazon.ebook',
            bin: 'application/octet-stream',
            bz: 'application/x-bzip',
            bz2: 'application/x-bzip2',
            csh: 'application/x-csh',
            css: 'text/css',
            csv: 'text/csv',
            doc: 'application/msword',
            dll: 'application/octet-stream',
            eot: 'application/vnd.ms-fontobject',
            epub: 'application/epub+zip',
            gif: 'image/gif',
            htm: 'text/html',
            html: 'text/html',
            ico: 'image/x-icon',
            ics: 'text/calendar',
            jar: 'application/java-archive',
            jpeg: 'image/jpeg',
            jpg: 'image/jpeg',
            js: 'application/javascript',
            json: 'application/json',
            mid: 'audio/midi',
            midi: 'audio/midi',
            mp2: 'audio/mpeg',
            mp3: 'audio/mpeg',
            mp4: 'video/mp4',
            mpa: 'video/mpeg',
            mpe: 'video/mpeg',
            mpeg: 'video/mpeg',
            mpkg: 'application/vnd.apple.installer+xml',
            odp: 'application/vnd.oasis.opendocument.presentation',
            ods: 'application/vnd.oasis.opendocument.spreadsheet',
            odt: 'application/vnd.oasis.opendocument.text',
            oga: 'audio/ogg',
            ogv: 'video/ogg',
            ogx: 'application/ogg',
            otf: 'font/otf',
            png: 'image/png',
            pdf: 'application/pdf',
            ppt: 'application/vnd.ms-powerpoint',
            rar: 'application/x-rar-compressed',
            rtf: 'application/rtf',
            sh: 'application/x-sh',
            svg: 'image/svg+xml',
            swf: 'application/x-shockwave-flash',
            tar: 'application/x-tar',
            tif: 'image/tiff',
            tiff: 'image/tiff',
            ts: 'application/typescript',
            ttf: 'font/ttf',
            txt: 'text/plain',
            vsd: 'application/vnd.visio',
            wav: 'audio/x-wav',
            weba: 'audio/webm',
            webm: 'video/webm',
            webp: 'image/webp',
            woff: 'font/woff',
            woff2: 'font/woff2',
            xhtml: 'application/xhtml+xml',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.ms-excel',
            xml: 'application/xml',
            xul: 'application/vnd.mozilla.xul+xml',
            zip: 'application/zip',
            '3gp': 'video/3gpp',
            '3gp2': 'video/3gpp2',
            '7z': 'application/x-7z-compressed'
        }[extension] || 'application/octet-stream'
    )
}
