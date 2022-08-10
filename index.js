import { Bee } from '@ethersphere/bee-js'
import bmt from '@fairdatasociety/bmt-js'
import { Promises, Strings } from 'cafe-utility'
import { readFile } from 'fs/promises'
import manta from 'mantaray-js'

const deferred = false
const beeUrl = process.env.BEE || 'http://localhost:1633'
const stamp = process.env.STAMP || 'f0b1935f917f5d9f29726e9f184b82309829b5bdfc9e1f177a6f84a9ea4cbd56'
const bee = new Bee(beeUrl)
const path = process.argv[2]
const filename = Strings.normalizeFilename(path)

const contentType = detectMime(filename)
const buffer = await readFile(path)
const bytes = new Uint8Array(buffer)
const address = await splitAndUploadChunks(bytes)
await createManifest(filename, address)

async function splitAndUploadChunks(bytes) {
    const queue = Promises.makeAsyncQueue(8)
    const chunkedFile = bmt.makeChunkedFile(bytes)
    const levels = chunkedFile.bmt()
    for (const level of levels) {
        for (const chunk of level) {
            queue.enqueue(async () => {
                const reference = await uploadChunkWithRetries(chunk)
                console.log('✅', `${beeUrl}/chunks/${reference}`)
            })
        }
    }
    await queue.drain()
    return chunkedFile.address()
}

async function createManifest(filename, address) {
    const node = new manta.MantarayNode()
    node.addFork(encodePath(`/${filename}`), address, {
        'Content-Type': contentType,
        Filename: filename
    })
    node.addFork(encodePath('/'), new Uint8Array(32), {
        'website-index-document': `/${filename}`
    })
    const manifest = await node.save(async data => {
        const result = await uploadDataWithRetries(data)
        return fromHexString(result.reference)
    })
    console.log('📦', `${beeUrl}/bzz/${toHexString(manifest)}/`)
}

async function uploadDataWithRetries(data) {
    let lastError = null
    for (let attempts = 0; attempts < 5; attempts++) {
        try {
            return await bee.uploadData(stamp, data)
        } catch (error) {
            lastError = error
            console.error('❌')
        }
    }
    throw lastError
}

async function uploadChunkWithRetries(chunk) {
    let lastError = null
    for (let attempts = 0; attempts < 5; attempts++) {
        try {
            return await uploadChunk(chunk)
        } catch (error) {
            lastError = error
            console.error('❌', `${beeUrl}/chunks/${toHexString(chunk.address())}`)
        }
    }
    throw lastError
}

async function uploadChunk(chunk) {
    const expectedReference = toHexString(chunk.address())
    const actualReference = await bee.uploadChunk(stamp, Uint8Array.from([...chunk.span(), ...chunk.payload]), {
        deferred
    })
    if (actualReference !== expectedReference) {
        throw Error(`Expected ${expectedReference} but got ${actualReference}`)
    }
    return actualReference
}

function encodePath(path) {
    return new TextEncoder().encode(path)
}

function fromHexString(hexString) {
    return Uint8Array.from(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
}

function toHexString(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
}

function detectMime(filename) {
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
