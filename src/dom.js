/**
 * Small, XSS-safe DOM helpers. Nothing here uses innerHTML with dynamic data:
 * every string becomes a text node.
 * @module dom
 */

/**
 * Anything `h()` and `append()` accept as a child: nodes, text, numbers, nested
 * arrays, and falsy values (skipped) so that `cond && node` works inline.
 * @typedef {Node | string | number | null | undefined | false | 0 | Child[]} Child
 */

/**
 * Looks up an element by id and fails loudly if the page markup changed.
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 * @returns {T}
 */
export function byId(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing #${id} in the page`);
  }
  return /** @type {T} */ (el);
}

/**
 * Typed lookups for the form controls the views use.
 * @param {string} id
 */
export const inputById = (id) => /** @type {HTMLInputElement} */ (byId(id));
/** @param {string} id */
export const selectById = (id) => /** @type {HTMLSelectElement} */ (byId(id));
/** @param {string} id */
export const buttonById = (id) => /** @type {HTMLButtonElement} */ (byId(id));
/** @param {string} id */
export const dialogById = (id) => /** @type {HTMLDialogElement} */ (byId(id));

/**
 * Readable message from anything thrown.
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Creates an element. The return type follows the tag, so `h('input')` is an
 * HTMLInputElement and needs no cast.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string|number|boolean|undefined>} [attrs]
 * @param {...Child} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    setAttribute(el, k, v);
  }
  append(el, children);
  return el;
}

/**
 * Sets one attribute safely: skips empty values and refuses inline event handlers.
 * @param {HTMLElement} el
 * @param {string} key
 * @param {string|number|boolean|null|undefined} value
 */
function setAttribute(el, key, value) {
  if (value === undefined || value === false || value === null) {
    return;
  }
  if (key.startsWith('on')) {
    throw new Error('Use addEventListener instead of inline handlers');
  }
  if (key === 'class') {
    el.className = String(value);
    return;
  }
  el.setAttribute(key, value === true ? '' : String(value));
}

/**
 * Appends children safely.
 * @template {Element | DocumentFragment} P
 * @param {P} parent
 * @param {Child[]} children
 * @returns {P}
 */
export function append(parent, children) {
  const flat = /** @type {unknown[]} */ (children).flat(Infinity);
  for (const c of flat) {
    if (c === null || c === undefined || c === false || Array.isArray(c)) {
      continue;
    }
    parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

/**
 * Replaces the children of an element.
 * @param {Element} el
 * @param {...Child} children
 */
export function mount(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}
