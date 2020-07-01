import * as inliner from './inliner';
import { mimeType, dataAsUrl, isDataUrl, getAndEncode } from './utils';

export async function inlineImage(element) {
  if (isDataUrl(element.src)) {
    return element;
  }

  const data = await getAndEncode(element.src);
  const dataUrl = dataAsUrl(mimeType(element.src))(data);

  return new Promise((resolve) => {
    element.onload = resolve;
    element.onerror = resolve;
    element.src = dataUrl;
  });
}

async function inlineBackground(node) {
  const background = node.style.getPropertyValue('background');

  if (!background) {
    return node;
  }

  const inlined = await inliner.inlineAll(background);
  node.style.setProperty('background', inlined, node.style.getPropertyPriority('background'));
  return node;
}

async function inlineAll(node) {
  if (!(node instanceof Element)) {
    return node;
  }

  const inlineNode = await inlineBackground(node);

  if (inlineNode instanceof HTMLImageElement) {
    return inlineImage(inlineNode);
  }

  return Promise.all(Array.from(inlineNode.childNodes).map((child) => inlineAll(child)));
}

export default async function inlineImages(node) {
  await inlineAll(node);
  return node;
}
