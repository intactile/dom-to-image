import * as inliner from './inliner';

function filterWebFontRules(cssRules) {
  return cssRules
    .filter((rule) => rule.type === CSSRule.FONT_FACE_RULE)
    .filter((rule) => inliner.shouldProcess(rule.style.getPropertyValue('src')));
}

function newWebFont(webFontRule) {
  const { href: baseUrl } = webFontRule.parentStyleSheet || {};
  return inliner.inlineAll(webFontRule.cssText, baseUrl);
}

function getCssRules(styleSheets) {
  const cssRules = [];
  styleSheets.forEach((sheet) => {
    try {
      Array.from(sheet.cssRules).forEach(cssRules.push.bind(cssRules));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Error while reading CSS rules from ${sheet.href}`, e.toString());
    }
  });
  return cssRules;
}

export async function resolveAll() {
  const webfontRules = filterWebFontRules(getCssRules(Array.from(document.styleSheets)));
  const inlineWebfontRules = await Promise.all(webfontRules.map(newWebFont));
  return inlineWebfontRules.join('\n');
}

export default async function embedFonts(node) {
  const cssText = await resolveAll();
  const styleNode = document.createElement('style');
  node.appendChild(styleNode);
  styleNode.appendChild(document.createTextNode(cssText));
  return node;
}
