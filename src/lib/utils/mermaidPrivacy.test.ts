import { describe, expect, test } from 'vitest';

import { withOpaqueIds } from '$lib/utils/mermaidPrivacy';

const ROOT = 'mermaid-3f2a9c1e-4b7d-4e2f-9a1b-0c8d7e6f5a4b';

describe('withOpaqueIds', () => {
	test('ids without digits, which Datadog puts in selectors, become opaque', () => {
		const svg = [
			`<svg id="${ROOT}"><style>#${ROOT} .node{fill:red}#PrivateAcquisition{stroke:blue}</style>`,
			`<defs><marker id="arrowEnd"></marker></defs>`,
			`<g class="cluster" id="PrivateAcquisition"><rect></rect></g>`,
			`<g id="flowchart-Secret-0"></g>`,
			`<path marker-end="url(#arrowEnd)"></path><use href="#PrivateAcquisition"></use>`,
			`<text>#PrivateAcquisition and url(#x) stay as text</text></svg>`
		].join('');
		expect(withOpaqueIds(svg)).toBe(
			[
				`<svg id="${ROOT}"><style>#${ROOT} .node{fill:red}#mermaid-node-2{stroke:blue}</style>`,
				`<defs><marker id="mermaid-node-1"></marker></defs>`,
				`<g class="cluster" id="mermaid-node-2"><rect></rect></g>`,
				`<g id="flowchart-Secret-0"></g>`,
				`<path marker-end="url(#mermaid-node-1)"></path><use href="#mermaid-node-2"></use>`,
				`<text>#PrivateAcquisition and url(#x) stay as text</text></svg>`
			].join('')
		);
	});

	test('an SVG whose ids all have digits is unchanged', () => {
		const svg = `<svg id="${ROOT}"><g id="flowchart-A-0"></g></svg>`;
		expect(withOpaqueIds(svg)).toBe(svg);
	});
});
