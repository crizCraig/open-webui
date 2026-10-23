// SVGs shown in chats (Mermaid diagrams, SVG artifacts) are chat content, and their ids and
// classes come from it (a Mermaid subgraph's id is its name, a classDef's name is a class).
// Datadog RUM builds element selectors (for actions and performance vitals) from ids and
// classes without digits, and beforeSend can't change selectors (src/app.html). So SVGs are
// shown with every such name replaced by an opaque one with digits, which the selector
// builder skips, inside a container session replay hides (SVGPanZoom.svelte).

const HIDDEN_ATTRIBUTE = 'data-dd-privacy';
const ID_ATTRIBUTE = /(\sid=")([^"]*)(")/g;
const CLASS_ATTRIBUTE = /(\sclass=")([^"]*)(")/g;
const STYLE_ELEMENT = /(<style[^>]*>)([\s\S]*?)(<\/style>)/g;
const HAS_DIGIT = /[0-9]/;
// An id spelled like a CSS hex colour (#fade) keeps its name: renaming it would rename colours.
const HEX_COLOUR = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

type MermaidRender = (id: string, text: string, container?: Element) => Promise<{ svg: string }>;

// Renders in a temporary container hidden from session replay (Mermaid otherwise puts its
// working SVG and the diagram's CSS straight under <body>).
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
		return svg;
	} finally {
		container.remove();
	}
}

// Ids and classes with no digit get opaque names, prefixed by a per-SVG unique prefix (so two
// SVGs on a page never share one). References follow: href="#id", url(#id), and #id / .class
// in the SVG's own <style>. Text content is left alone.
export function withOpaqueNames(svg: string, prefix: string): string {
	const ids = opaqueNames(svg, ID_ATTRIBUTE, `${prefix}-id-`, (value) =>
		HEX_COLOUR.test(value) ? [] : [value]
	);
	const classes = opaqueNames(svg, CLASS_ATTRIBUTE, `${prefix}-c-`, classTokens);
	if (ids.size === 0 && classes.size === 0) return svg;
	return renameInStyles(renameInAttributes(svg, ids, classes), ids, classes);
}

function opaqueNames(
	svg: string,
	attribute: RegExp,
	prefix: string,
	names: (value: string) => string[]
): Map<string, string> {
	const renames = new Map<string, string>();
	for (const match of svg.matchAll(attribute)) {
		for (const name of names(match[2])) {
			if (name && !HAS_DIGIT.test(name) && !renames.has(name)) {
				renames.set(name, `${prefix}${renames.size + 1}`);
			}
		}
	}
	return renames;
}

function classTokens(value: string): string[] {
	return value.split(/\s+/);
}

function renameInAttributes(
	svg: string,
	ids: Map<string, string>,
	classes: Map<string, string>
): string {
	const rename = (names: Map<string, string>, name: string) => names.get(name) ?? name;
	return svg
		.replace(ID_ATTRIBUTE, (_w, start, id, end) => `${start}${rename(ids, id)}${end}`)
		.replace(CLASS_ATTRIBUTE, (_w, start, value: string, end) => {
			const renamed = value.replace(/[^\s]+/g, (name) => rename(classes, name));
			return `${start}${renamed}${end}`;
		})
		.replace(/(="#)([^"]*)(")/g, (_w, start, id, end) => `${start}${rename(ids, id)}${end}`)
		.replace(/url\(#([^)]*)\)/g, (_w, id) => `url(#${rename(ids, id)})`);
}

function renameInStyles(
	svg: string,
	ids: Map<string, string>,
	classes: Map<string, string>
): string {
	return svg.replace(STYLE_ELEMENT, (_whole, open, css: string, close) => {
		const renamed = css.replace(/([#.])(-?[_a-zA-Z][\w-]*)/g, (whole, sigil, name) => {
			const names = sigil === '#' ? ids : classes;
			return names.has(name) ? `${sigil}${names.get(name)}` : whole;
		});
		return `${open}${renamed}${close}`;
	});
}
