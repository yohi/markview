/**
 * Treat even strict-mode Mermaid output as untrusted markup. Sanitize it once
 * at the renderer boundary, keep the resulting SVG node, and never serialize
 * it back to HTML for insertion. ForeignObject is needed for Mermaid's HTML
 * labels; DOMPurify still validates the nested elements and their namespaces.
 */
export async function sanitizeMermaidSvg(markup: string): Promise<SVGSVGElement> {
  const { default: DOMPurify } = await import('dompurify');
  if (!DOMPurify.isSupported) throw new Error('SVG sanitization is not supported in this browser.');
  const fragment = DOMPurify.sanitize(markup, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ['foreignObject'],
    // Keep the default MathML integration point and explicitly enable SVG
    // HTML labels; namespace and element/attribute checks remain enabled.
    HTML_INTEGRATION_POINTS: { 'annotation-xml': true, foreignobject: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input',
      'button', 'textarea', 'select', 'link', 'meta', 'base', 'template'],
    FORBID_ATTR: ['srcdoc'],
  });
  const root = fragment.firstElementChild;
  if (fragment.childElementCount !== 1 || !root ||
      root.namespaceURI !== 'http://www.w3.org/2000/svg' || root.localName !== 'svg') {
    throw new Error('Invalid Mermaid SVG');
  }
  return root as SVGSVGElement;
}
