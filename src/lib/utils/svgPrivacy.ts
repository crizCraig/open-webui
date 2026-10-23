// SVGs shown in chats (Mermaid diagrams, SVG artifacts) are chat content, and their ids and
// classes come from it (a Mermaid subgraph's id is its name, a classDef's name is a class).
// Datadog RUM builds element selectors (for actions and performance vitals) from ids and
// classes without digits, and beforeSend can't change selectors (src/app.html). So SVGs are
// shown with every such name replaced by an opaque one with digits, which the selector
// builder skips, inside a container session replay hides (SVGPanZoom.svelte).

const HIDDEN_ATTRIBUTE = 'data-dd-privacy';
const HAS_DIGIT = /[0-9]/;
// An id spelled like a CSS hex colour (#fade) keeps its name: renaming it would rename colours.
const HEX_COLOUR = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// url(#id), url('#id') or url("#id"), in attributes and CSS.
const URL_REFERENCE = /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g;
// #id and .class selectors in a <style> sheet (a colour like #fff starts the same way).
const CSS_NAME = /([#.])(-?[_a-zA-Z][\w-]*)/g;
const HREF_ATTRIBUTES = ['href', 'xlink:href'];
const ID_LIST_ATTRIBUTES = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns'];
// SMIL timing: "move.end+1s; btn.click" names elements by id before a dot.
const TIMING_ATTRIBUTES = ['begin', 'end'];
const TIMING_REFERENCE = /(^|;)(\s*)([A-Za-z_][\w-]*)\./g;

type Renames = { ids: Map<string, string>; classes: Map<string, string> };
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
// SVGs on a page never share one). References follow: href/xlink:href="#id", url(#id) in
// any attribute, aria id lists, SMIL begin/end timing (move.end), and #id / .class /
// url(#id) in <style>. Text is left alone.
// Parsed as HTML, as {@html} renders it.
export function withOpaqueNames(markup: string, prefix: string): string {
	const root = new DOMParser().parseFromString(markup, 'text/html').body;
	const renames = collectRenames(root, prefix);
	if (renames.ids.size === 0 && renames.classes.size === 0) return markup;
	root.querySelectorAll('*').forEach((element) => renameElement(element, renames));
	return root.innerHTML;
}

function collectRenames(root: HTMLElement, prefix: string): Renames {
	const ids = new Map<string, string>();
	const classes = new Map<string, string>();
	root.querySelectorAll('[id]').forEach((element) => {
		const id = element.getAttribute('id') ?? '';
		if (id && !HAS_DIGIT.test(id) && !HEX_COLOUR.test(id) && !ids.has(id)) {
			ids.set(id, `${prefix}-id-${ids.size + 1}`);
		}
	});
	root.querySelectorAll('[class]').forEach((element) => {
		for (const name of classNames(element)) {
			if (!HAS_DIGIT.test(name) && !classes.has(name)) {
				classes.set(name, `${prefix}-c-${classes.size + 1}`);
			}
		}
	});
	return { ids, classes };
}

function renameElement(element: Element, renames: Renames): void {
	const { ids, classes } = renames;
	const id = element.getAttribute('id');
	if (id && ids.has(id)) element.setAttribute('id', ids.get(id) as string);
	if (element.hasAttribute('class')) {
		const renamed = classNames(element).map((name) => classes.get(name) ?? name);
		element.setAttribute('class', renamed.join(' '));
	}
	for (const attribute of Array.from(element.attributes)) {
		const value = renameReferences(attribute.name, attribute.value, ids);
		if (value !== attribute.value) element.setAttribute(attribute.name, value);
	}
	if (element.tagName.toLowerCase() === 'style' && element.textContent) {
		element.textContent = renameInCss(element.textContent, renames);
	}
}

function renameReferences(name: string, value: string, ids: Map<string, string>): string {
	if (HREF_ATTRIBUTES.includes(name) && value.startsWith('#')) {
		const target = value.slice(1);
		return ids.has(target) ? `#${ids.get(target)}` : value;
	}
	if (ID_LIST_ATTRIBUTES.includes(name)) {
		return value.replace(/\S+/g, (target) => ids.get(target) ?? target);
	}
	if (TIMING_ATTRIBUTES.includes(name)) {
		return value.replace(TIMING_REFERENCE, (whole, start, space, target) =>
			ids.has(target) ? `${start}${space}${ids.get(target)}.` : whole
		);
	}
	return value.replace(URL_REFERENCE, (whole, quote, target) =>
		ids.has(target) ? `url(${quote}#${ids.get(target)}${quote})` : whole
	);
}

function renameInCss(css: string, { ids, classes }: Renames): string {
	return css.replace(CSS_NAME, (whole, sigil, name) => {
		const names = sigil === '#' ? ids : classes;
		return names.has(name) ? `${sigil}${names.get(name)}` : whole;
	});
}

function classNames(element: Element): string[] {
	return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}
