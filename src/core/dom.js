// Minimal hyperscript helper so games and the shell build UI without a framework.
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false)
            continue;
        if (k === "class")
            node.className = String(v);
        else if (k === "html")
            node.innerHTML = String(v);
        else if (k === "style" && typeof v === "object")
            Object.assign(node.style, v);
        else if (k.startsWith("on") && typeof v === "function") {
            node.addEventListener(k.slice(2).toLowerCase(), v);
        }
        else
            node.setAttribute(k, String(v));
    }
    for (const c of children) {
        if (c == null || c === false)
            continue;
        node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
}
export function clear(node) {
    node.replaceChildren();
}
