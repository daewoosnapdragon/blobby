import QRCode from 'qrcode';

/** QR code as an SVG string. Margin 4 = the standard quiet zone; medium error correction. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 4, errorCorrectionLevel: 'M' });
}
