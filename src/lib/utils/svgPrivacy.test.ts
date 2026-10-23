// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';

import { withOpaqueNames } from '$lib/utils/svgPrivacy';

const ROOT = 'mermaid-3f2a9c1e-4b7d-4e2f-9a1b-0c8d7e6f5a4b';
const P = 'svg-0b5e2a8c';

function parse(markup: string): HTMLElement {
	return new DOMParser().parseFromString(markup, 'text/html').body;
}

function attr(root: HTMLElement, selector: string, name: string): string | null {
	return root.querySelector(selector)?.getAttribute(name) ?? null;
}

describe('withOpaqueNames', () => {
	test('ids and classes without digits, which Datadog puts in selectors, become opaque', () => {
		const out = withOpaqueNames(
			[
				`<svg id="${ROOT}" class="flowchart"><style>#${ROOT} .node rect{fill:#fff}`,
				`#PrivateAcquisition{stroke:#bad}.PrivateClass>*{fill:url('#grad')}</style>`,
				`<defs><linearGradient id='grad'></linearGradient><marker id=arrowEnd></marker></defs>`,
				`<g class='cluster PrivateClass' id='PrivateAcquisition' aria-labelledby="title"></g>`,
				`<title id="title">t</title><g id="flowchart-Secret-0" class="node c1"></g>`,
				`<path marker-end="url(#arrowEnd)" fill="url( &quot;#grad&quot; )"></path>`,
				`<use href='#PrivateAcquisition'></use><use xlink:href="#grad"></use>`,
				`<rect style="fill: url('#grad')"></rect><g id="bad"></g>`,
				`<text>#PrivateAcquisition .PrivateClass url(#grad) stay as text</text></svg>`
			].join(''),
			P
		);
		const root = parse(out);
		expect(out).not.toMatch(/id="(PrivateAcquisition|grad|arrowEnd|title)"/);
		expect(out).not.toMatch(/class="[^"]*(PrivateClass|cluster|flowchart|\bnode\b)/);
		const subgraph = attr(root, 'g[aria-labelledby]', 'id') as string;
		const grad = attr(root, 'linearGradient', 'id') as string;
		const marker = attr(root, 'marker', 'id') as string;
		expect([subgraph, grad, marker].every((id) => id.startsWith(`${P}-id-`))).toBe(true);
		expect(attr(root, 'svg', 'id')).toBe(ROOT);
		expect(attr(root, 'g[aria-labelledby]', 'aria-labelledby')).toBe(attr(root, 'title', 'id'));
		expect(attr(root, 'path', 'marker-end')).toBe(`url(#${marker})`);
		expect(attr(root, 'path', 'fill')).toBe(`url("#${grad}")`);
		expect(attr(root, 'rect', 'style')).toBe(`fill: url('#${grad}')`);
		const uses = root.querySelectorAll('use');
		expect(uses[0].getAttribute('href')).toBe(`#${subgraph}`);
		expect(uses[1].getAttribute('xlink:href')).toBe(`#${grad}`);
		expect(attr(root, 'g#flowchart-Secret-0', 'class')).toMatch(new RegExp(`^${P}-c-\\d+ c1$`));
		const css = root.querySelector('style')?.textContent ?? '';
		expect(css).toContain(`#${ROOT} .`);
		expect(css).toContain(`#${subgraph}{stroke:#bad}`);
		expect(css).toContain(`{fill:url('#${grad}')}`);
		expect(css).toContain('fill:#fff');
		expect(css).not.toMatch(/PrivateAcquisition|PrivateClass|\.node\b/);
		expect(root.querySelector('g#bad')).not.toBeNull();
		expect(root.querySelector('text')?.textContent).toBe(
			'#PrivateAcquisition .PrivateClass url(#grad) stay as text'
		);
	});

	test('chained and event-started animations keep their references', () => {
		const out = withOpaqueNames(
			[
				'<svg><rect id="box"><animate id="move" begin="0s; back.end + 1s" dur="1s"></animate>',
				'<animate id="back" begin="move.end" end="box.click; indefinite" dur="1s"></animate>',
				'<set begin="move.repeat(2)" to="1"></set></rect></svg>'
			].join(''),
			P
		);
		const root = parse(out);
		const [box, move, back] = ['rect', 'animate:first-of-type', 'animate:last-of-type'].map(
			(selector) => attr(root, selector, 'id') as string
		);
		expect(attr(root, 'animate:first-of-type', 'begin')).toBe(`0s; ${back}.end + 1s`);
		expect(attr(root, 'animate:last-of-type', 'begin')).toBe(`${move}.end`);
		expect(attr(root, 'animate:last-of-type', 'end')).toBe(`${box}.click; indefinite`);
		expect(attr(root, 'set', 'begin')).toBe(`${move}.repeat(2)`);
	});

	test('two SVGs never share an opaque name', () => {
		const svg = '<svg><marker id="arrowhead" class="arrow"></marker></svg>';
		expect(withOpaqueNames(svg, 'svg-1')).not.toBe(withOpaqueNames(svg, 'svg-2'));
	});

	test('an SVG whose names all have digits is unchanged', () => {
		const svg = `<svg id="${ROOT}"><g id="flowchart-A-0" class="c1"></g></svg>`;
		expect(withOpaqueNames(svg, P)).toBe(svg);
	});
});
