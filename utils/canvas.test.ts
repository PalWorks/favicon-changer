import { describe, it, expect } from 'vitest';
import { normalizeImageDataUrl } from './canvas';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64');

// This function exists because sites like GitHub serve an SVG favicon; saving it
// lands a .png filename, and re-uploading produced data:image/png;base64,<svg>,
// which no browser can decode. See CHANGELOG 1.3.0.
describe('normalizeImageDataUrl', () => {
  it('relabels base64 SVG bytes that claim to be PNG', () => {
    const out = normalizeImageDataUrl(`data:image/png;base64,${b64(SVG)}`);
    expect(out.startsWith('data:image/svg+xml;base64,')).toBe(true);
    // The payload must be carried over untouched.
    expect(out.endsWith(b64(SVG))).toBe(true);
  });

  it('relabels percent-encoded SVG that claims to be PNG', () => {
    const out = normalizeImageDataUrl(`data:image/png,${encodeURIComponent(SVG)}`);
    expect(out.startsWith('data:image/svg+xml,')).toBe(true);
  });

  it('tolerates an XML prolog, a comment and leading whitespace', () => {
    const withProlog = `<?xml version="1.0"?>\n<!-- a note -->\n  ${SVG}`;
    expect(normalizeImageDataUrl(`data:image/png;base64,${b64(withProlog)}`))
      .toContain('data:image/svg+xml');
  });

  it('leaves a correctly labelled SVG alone', () => {
    const url = `data:image/svg+xml;base64,${b64(SVG)}`;
    expect(normalizeImageDataUrl(url)).toBe(url);
  });

  it('leaves real PNG bytes alone', () => {
    const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')}`;
    expect(normalizeImageDataUrl(png)).toBe(png);
  });

  it('leaves a non-data URL alone', () => {
    expect(normalizeImageDataUrl('https://example.com/i.png')).toBe('https://example.com/i.png');
  });

  it('returns the input unchanged when the payload is not decodable', () => {
    const bad = 'data:image/png;base64,!!!not-base64!!!';
    expect(normalizeImageDataUrl(bad)).toBe(bad);
  });

  it('does not mistake HTML or text that merely mentions svg for SVG', () => {
    const html = `data:image/png;base64,${b64('<html><body>svg</body></html>')}`;
    expect(normalizeImageDataUrl(html)).toBe(html);
  });

  it('leaves a malformed data URL alone', () => {
    expect(normalizeImageDataUrl('data:')).toBe('data:');
  });
});
