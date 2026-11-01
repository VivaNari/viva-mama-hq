/**
 * Identify a file from its first bytes, never from the name or the Content-Type she
 * (or anything in between) claimed. Only the formats chat attachments care about.
 *
 * HEIC is recognised so it can be refused with a clear code: the app converts it to
 * JPEG before upload, and the server's image library cannot decode it.
 */
export type TSniffedType =
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "application/pdf"
    | "image/heic";

const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean =>
    buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

export function sniffMime(buf: Buffer): TSniffedType | null {
    if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (
        startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && // RIFF
        startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8) // WEBP
    ) {
        return "image/webp";
    }
    // ISO-BMFF: size(4) "ftyp" brand(4)
    if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
        const brand = buf.subarray(8, 12).toString("latin1");
        if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) {
            return "image/heic";
        }
    }
    // The PDF spec allows junk before the header; readers accept it within 1 KiB.
    const head = buf.subarray(0, Math.min(buf.length, 1024)).toString("latin1");
    if (head.includes("%PDF-")) return "application/pdf";
    return null;
}
