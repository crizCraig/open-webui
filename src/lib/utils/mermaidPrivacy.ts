// Mermaid diagrams are chat content, and Mermaid names SVG elements after them (a subgraph's
// id is its name). Datadog RUM builds element selectors (for actions and performance
// vitals) from ids without digits, and beforeSend can't change selectors (src/app.html).
// So rendering happens in a container session replay hides, and every id without a digit
// is replaced by an opaque one, which the selector builder skips.

const HIDDEN_ATTRIBUTE = 'data-dd-privacy';
const OPAQUE_ID_PREFIX = 'mermaid-node-';
const ID_ATTRIBUTE = /(\sid=")([^"]*)(")/g;

type MermaidRender = (id: string, text: string, container?: Element) => Promise<{ svg: string }>;

// Renders in a temporary container hidden from session replay (Mermaid otherwise puts its
// working SVG and the diagram's CSS straight under <body>) and returns opaque-id SVG.
export async function renderMermaidPrivately(
	render: MermaidRender,
	id: string,
	code: string
): Promise<string> {
	const container = document.createElement('div');
	container.setAttribute(HIDDEN_ATTRIBUTE, 'hidden');
	document.body.appendChild(container);
	try {
		const { svg } = await render(id, code, container);
		return withOpaqueIds(svg);
	} finally {
		container.remove();
	}
}

// Ids with no digit get opaque names; references to them (href="#id", url(#id), and
// #id in the SVG's own <style>) follow. Text content is left alone.
export function withOpaqueIds(svg: string): string {
	const renames = new Map<string, string>();
	for (const match of svg.matchAll(ID_ATTRIBUTE)) {
		const id = match[2];
		if (id && !/[0-9]/.test(id) && !renames.has(id)) {
			renames.set(id, `${OPAQUE_ID_PREFIX}${renames.size + 1}`);
		}
	}
	if (renames.size === 0) return svg;
	return renameStyleReferences(renameAttributeReferences(svg, renames), renames);
}

function renameAttributeReferences(svg: string, renames: Map<string, string>): string {
	return svg
		.replace(ID_ATTRIBUTE, (whole, start, id, end) =>
			renames.has(id) ? `${start}${renames.get(id)}${end}` : whole
		)
		.replace(/(="#)([^"]*)(")/g, (whole, start, id, end) =>
			renames.has(id) ? `${start}${renames.get(id)}${end}` : whole
		)
		.replace(/url\(#([^)]*)\)/g, (whole, id) =>
			renames.has(id) ? `url(#${renames.get(id)})` : whole
		);
}

function renameStyleReferences(svg: string, renames: Map<string, string>): string {
	return svg.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (_whole, open, css, close) => {
		const renamed = css.replace(/#([\w-]+)/g, (whole: string, id: string) =>
			renames.has(id) ? `#${renames.get(id)}` : whole
		);
		return `${open}${renamed}${close}`;
	});
}
