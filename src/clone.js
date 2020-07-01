import { uid, makeImage } from './utils';

const uuid = uid();

async function makeNodeCopy(node) {
  if (node instanceof HTMLCanvasElement) {
    return makeImage(node.toDataURL());
  }

  return node.cloneNode(false);
}

function cloneStyle(original, clone) {
  const fontAttributes = [
    'font',
    'fontFamily',
    'fontFeatureSettings',
    'fontKerning',
    'fontSize',
    'fontStretch',
    'fontStyle',
    'fontVariant',
    'fontVariantCaps',
    'fontVariantEastAsian',
    'fontVariantLigatures',
    'fontVariantNumeric',
    'fontVariationSettings',
    'fontWeight',
  ];
  const source = window.getComputedStyle(original);

  if (source.cssText) {
    clone.style.cssText = source.cssText;
    /* Fix Safari issue with transform-origin property not present in cssText */
    clone.style.transformOrigin = source.getPropertyValue('transform-origin');
    fontAttributes.forEach((attr) => {
      clone.style[attr] = source[attr];
    });
  } else {
    Array.from(source).forEach((name) => {
      clone.style.setProperty(
        name,
        source.getPropertyValue(name),
        source.getPropertyPriority(name)
      );
    });
  }

  return clone;
}

function formatCssText(style) {
  const content = style.getPropertyValue('content');
  return `${style.cssText} content: ${content};`;
}

function formatCssProperties(style) {
  function formatProperty(name) {
    return `${name}: ${style.getPropertyValue(name)}${
      style.getPropertyPriority(name) ? ' !important' : ''
    }`;
  }

  return `${Array.from(style).map(formatProperty).join('; ')};`;
}

function formatPseudoElementStyle(className, element, style) {
  const selector = `.${className}:${element}`;
  const cssText = style.cssText ? formatCssText(style) : formatCssProperties(style);
  return document.createTextNode(`${selector}{${cssText}}`);
}

function clonePseudoElements(original, clone) {
  [':before', ':after'].forEach((element) => {
    const style = window.getComputedStyle(original, element);
    const content = style.getPropertyValue('content');

    if (content !== '' && content !== 'none') {
      const className = uuid();
      clone.classList.add(className);
      const styleElement = document.createElement('style');
      styleElement.appendChild(formatPseudoElementStyle(className, element, style));
      clone.appendChild(styleElement);
    }
  });

  return clone;
}

function copyUserInput(original, clone) {
  if (original instanceof HTMLTextAreaElement) {
    clone.innerHTML = original.value;
  }
  if (original instanceof HTMLInputElement) {
    clone.setAttribute('value', original.value);
  }
  return clone;
}

function fixSvg(clone) {
  if (!(clone instanceof SVGElement)) {
    return clone;
  }

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  if (!(clone instanceof SVGRectElement)) {
    return clone;
  }

  ['width', 'height'].forEach((attribute) => {
    const value = clone.getAttribute(attribute);

    if (!value) {
      return;
    }
    clone.style.setProperty(attribute, value);
  });
  return clone;
}

function processClone(original, clone) {
  if (!(clone instanceof Element)) {
    return clone;
  }

  return fixSvg(
    copyUserInput(original, clonePseudoElements(original, cloneStyle(original, clone)))
  );
}

async function cloneChildren(original, clone, filter) {
  const children = original.childNodes;

  if (children.length === 0) {
    return clone;
  }

  function cloneChildrenInOrder(parent, c, f) {
    let done = Promise.resolve();
    c.forEach((child) => {
      done = done
        .then(() => {
          // eslint-disable-next-line no-use-before-define
          return cloneNode(child, f);
        })
        .then((childClone) => {
          if (childClone) {
            parent.appendChild(childClone);
          }
        });
    });
    return done;
  }

  return cloneChildrenInOrder(clone, Array.from(children), filter).then(() => clone);
}

export default async function cloneNode(node, filter, root) {
  if (!root && filter && !filter(node)) {
    return null;
  }

  const nodeCopy = await makeNodeCopy(node);
  const clone = await cloneChildren(node, nodeCopy, filter);
  return processClone(node, clone);
}
