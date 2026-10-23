import { describe, expect, test } from 'vitest';

import { withOpaqueNames } from '$lib/utils/svgPrivacy';

const ROOT = 'mermaid-3f2a9c1e-4b7d-4e2f-9a1b-0c8d7e6f5a4b';
const P = 'svg-0b5e2a8c';

describe('withOpaqueNames', () => {
	test('ids and classes without digits, which Datadog puts in selectors, become opaque', () => {
		const svg = [
			`<svg id="${ROOT}" class="flowchart"><style>#${ROOT} .node rect{fill:#fff;opacity:0.5}`,
			`#PrivateAcquisition{stroke:#bad}.PrivateClass>*{fill:red}</style>`,
			`<defs><marker id="arrowEnd"></marker></defs>`,
			`<g class="cluster PrivateClass" id="PrivateAcquisition"><rect></rect></g>`,
			`<g id="flowchart-Secret-0" class="node default"></g><g id="bad"></g>`,
			`<path marker-end="url(#arrowEnd)"></path><use href="#PrivateAcquisition"></use>`,
			`<text>#PrivateAcquisition .PrivateClass stay as text</text></svg>`
		].join('');
		expect(withOpaqueNames(svg, P)).toBe(
			[
				`<svg id="${ROOT}" class="${P}-c-1"><style>#${ROOT} .${P}-c-4 rect{fill:#fff;opacity:0.5}`,
				`#${P}-id-2{stroke:#bad}.${P}-c-3>*{fill:red}</style>`,
				`<defs><marker id="${P}-id-1"></marker></defs>`,
				`<g class="${P}-c-2 ${P}-c-3" id="${P}-id-2"><rect></rect></g>`,
				`<g id="flowchart-Secret-0" class="${P}-c-4 ${P}-c-5"></g><g id="bad"></g>`,
				`<path marker-end="url(#${P}-id-1)"></path><use href="#${P}-id-2"></use>`,
				`<text>#PrivateAcquisition .PrivateClass stay as text</text></svg>`
			].join('')
		);
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
