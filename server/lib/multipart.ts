/** A small multipart/form-data parser (Part 4 §5 Images): fields and file parts from a raw body. */
export interface MultipartFile {
  filename: string
  contentType: string
  data: Uint8Array
}

export interface Multipart {
  fields: Record<string, string>
  files: Record<string, MultipartFile>
}

export function boundaryOf(contentType: string | null): string | null {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '')
  return match ? (match[1] ?? match[2]).trim() : null
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}

const decoder = new TextDecoder()
const CRLF2 = new TextEncoder().encode('\r\n\r\n')

export function parseMultipart(body: Uint8Array, boundary: string): Multipart {
  const delimiter = new TextEncoder().encode(`--${boundary}`)
  const out: Multipart = { fields: {}, files: {} }
  let pos = indexOf(body, delimiter, 0)
  while (pos !== -1) {
    let start = pos + delimiter.length
    if (body[start] === 45 && body[start + 1] === 45) break // closing --boundary--
    if (body[start] === 13 && body[start + 1] === 10) start += 2
    const next = indexOf(body, delimiter, start)
    if (next === -1) break
    let end = next
    if (body[end - 2] === 13 && body[end - 1] === 10) end -= 2
    const part = body.subarray(start, end)
    const split = indexOf(part, CRLF2, 0)
    if (split !== -1) {
      const headers = decoder.decode(part.subarray(0, split))
      const data = part.subarray(split + 4)
      const disposition = /content-disposition:\s*form-data;([^\r\n]*)/i.exec(headers)?.[1]
      const name = disposition && /name="([^"]*)"/i.exec(disposition)?.[1]
      if (name !== undefined && name !== null && disposition) {
        const filename = /filename="([^"]*)"/i.exec(disposition)?.[1]
        if (filename !== undefined) {
          const contentType = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? 'application/octet-stream'
          out.files[name] = { filename, contentType, data: data.slice() }
        } else out.fields[name] = decoder.decode(data)
      }
    }
    pos = next
  }
  return out
}
