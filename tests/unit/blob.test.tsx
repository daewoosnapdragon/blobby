import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Blob, BLOB_HEX, type BlobColor } from '@/components/blob/Blob';

const part = (c: HTMLElement, name: string) => c.querySelector(`[data-part="${name}"]`);

describe('Blob', () => {
  it('renders an idle face: two eye ellipses inside a blink group', () => {
    const { container } = render(<Blob color="sunny" mood="idle" size={100} />);
    const blink = part(container, 'blink');
    expect(blink).not.toBeNull();
    expect(blink!.querySelectorAll('ellipse')).toHaveLength(2);
  });

  it('renders happy arcs, oops sweat drop and sleepy lines', () => {
    const happy = render(<Blob color="sunny" mood="happy" size={100} />).container;
    expect(part(happy, 'arc-eyes')!.getAttribute('d')).toMatch(/q/);
    expect(part(happy, 'smile')).not.toBeNull();
    expect(part(happy, 'blink')).toBeNull();

    const oops = render(<Blob color="sunny" mood="oops" size={100} />).container;
    expect(part(oops, 'sweat-drop')!.tagName.toLowerCase()).toBe('path');
    expect(part(oops, 'blink')).toBeNull();

    const sleepy = render(<Blob color="sunny" mood="sleepy" size={100} />).container;
    const lines = part(sleepy, 'sleepy-eyes')!;
    expect(lines.tagName.toLowerCase()).toBe('path');
    expect(lines.getAttribute('d')).toMatch(/M/);
    expect(part(sleepy, 'blink')).toBeNull();
  });

  it('fills body with BLOB_HEX[color]', () => {
    const colors = Object.keys(BLOB_HEX) as BlobColor[];
    expect(colors).toHaveLength(6);
    for (const c of colors) {
      const { container } = render(<Blob color={c} mood="idle" size={80} />);
      expect(part(container, 'body')!.getAttribute('fill')).toBe(BLOB_HEX[c]);
    }
    expect(BLOB_HEX.sunny).toBe('#FFD95A');
    expect(BLOB_HEX.grape).toBe('#D9CCF5');
  });

  it('applies reaction and re-triggers with a fresh element when key changes', () => {
    const { container, rerender } = render(
      <Blob key="a" color="mint" mood="idle" size={100} reaction="hop" />,
    );
    const first = container.firstElementChild!;
    expect(first.getAttribute('data-reaction')).toBe('hop');
    rerender(<Blob key="b" color="mint" mood="idle" size={100} reaction="hop" />);
    const second = container.firstElementChild!;
    expect(second).not.toBe(first);
    expect(second.getAttribute('data-reaction')).toBe('hop');
    rerender(<Blob key="b" color="mint" mood="idle" size={100} reaction={null} />);
    expect(container.firstElementChild!.hasAttribute('data-reaction')).toBe(false);
  });

  it('renders the spin reaction', () => {
    const { container } = render(<Blob color="sunny" mood="happy" size={100} reaction="spin" />);
    expect(container.firstElementChild!.getAttribute('data-reaction')).toBe('spin');
  });

  it('is aria-hidden and exposes mood', () => {
    const { container } = render(<Blob color="pink" mood="happy" size={100} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('data-mood')).toBe('happy');
  });

  it('draws hats', () => {
    const s = render(<Blob color="pink" mood="idle" size={100} hat="santa" />).container;
    expect(part(s, 'hat-santa')).not.toBeNull();
    const k = render(<Blob color="pink" mood="idle" size={100} hat="seollal" />).container;
    expect(part(k, 'hat-seollal')).not.toBeNull();
  });
});
