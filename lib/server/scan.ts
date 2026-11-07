import net from 'net';

/*
 * Upload scanning hook. Every uploaded file passes through scanUpload() before it is stored.
 *  1. Built-in checks (always): PDFs that carry JavaScript, auto-run actions or embedded files are refused.
 *  2. Optional ClamAV: set CLAMAV_HOST (and CLAMAV_PORT, default 3310) to a clamd server; files are sent
 *     with the INSTREAM command and refused when a virus is found. If clamd cannot be reached, the upload
 *     is refused only when CLAMAV_REQUIRED=true (otherwise it is logged and accepted).
 */

export interface ScanResult { ok: boolean; reason?: string }

function pdfRisk(bytes: Buffer): string | null {
  const s = bytes.toString('latin1');
  if (/\/(JavaScript|JS)\b/.test(s)) return 'The PDF contains JavaScript.';
  if (/\/(Launch|OpenAction\s*<<[^>]*\/S\s*\/JavaScript)\b/.test(s)) return 'The PDF tries to run an action when opened.';
  if (/\/EmbeddedFile\b/.test(s)) return 'The PDF contains embedded files.';
  return null;
}

function clamdScan(bytes: Buffer, host: string, port: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    let out = '';
    sock.setTimeout(15000, () => { sock.destroy(); reject(new Error('ClamAV timed out')); });
    sock.on('error', reject);
    sock.on('data', d => { out += d.toString(); });
    sock.on('end', () => resolve(/FOUND/.test(out) ? out.replace(/^stream:\s*/, '').replace(/\0/g, '').trim() : /OK/.test(out) ? null : `ClamAV: ${out.trim()}`));
    sock.on('connect', () => {
      sock.write('zINSTREAM\0');
      for (let i = 0; i < bytes.length; i += 64 * 1024) {
        const chunk = bytes.subarray(i, i + 64 * 1024);
        const len = Buffer.alloc(4); len.writeUInt32BE(chunk.length);
        sock.write(len); sock.write(chunk);
      }
      sock.write(Buffer.alloc(4));
    });
  });
}

export async function scanUpload(bytes: Buffer, mime: string): Promise<ScanResult> {
  if (mime === 'application/pdf') { const r = pdfRisk(bytes); if (r) return { ok: false, reason: r }; }
  const host = process.env.CLAMAV_HOST;
  if (!host) return { ok: true };
  try {
    const found = await clamdScan(bytes, host, Number(process.env.CLAMAV_PORT || 3310));
    return found ? { ok: false, reason: 'The file did not pass the virus check.' } : { ok: true };
  } catch (e) {
    console.error('[TheSchoolTeacher] Virus scan unavailable:', (e as Error).message);
    return process.env.CLAMAV_REQUIRED === 'true' ? { ok: false, reason: 'The virus check is unavailable. Please try again later.' } : { ok: true };
  }
}
