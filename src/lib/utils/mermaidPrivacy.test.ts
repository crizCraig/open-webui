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
		expect(withOpaqueIds(svg, ROOT)).toBe(
			[
				`<svg id="${ROOT}"><style>#${ROOT} .node{fill:red}#${ROOT}-node-2{stroke:blue}</style>`,
				`<defs><marker id="${ROOT}-node-1"></marker></defs>`,
				`<g class="cluster" id="${ROOT}-node-2"><rect></rect></g>`,
				`<g id="flowchart-Secret-0"></g>`,
				`<path marker-end="url(#${ROOT}-node-1)"></path><use href="#${ROOT}-node-2"></use>`,
				`<text>#PrivateAcquisition and url(#x) stay as text</text></svg>`
			].join('')
		);
	});

	test('two diagrams never share an opaque id', () => {
		const other = 'mermaid-9a8b7c6d-1e2f-4a3b-8c9d-0e1f2a3b4c5d';
		const first = withOpaqueIds('<svg><marker id="arrowhead"></marker></svg>', ROOT);
		const second = withOpaqueIds('<svg><marker id="arrowhead"></marker></svg>', other);
		expect(first).toBe(`<svg><marker id="${ROOT}-node-1"></marker></svg>`);
		expect(second).toBe(`<svg><marker id="${other}-node-1"></marker></svg>`);
	});

	test('an SVG whose ids all have digits is unchanged', () => {
		const svg = `<svg id="${ROOT}"><g id="flowchart-A-0"></g></svg>`;
		expect(withOpaqueIds(svg, ROOT)).toBe(svg);
	});
});
