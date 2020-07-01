import cloneNode from './clone';
import { makeImage, delay, escapeXhtml, getNodeWidth, getNodeHeight, canvasToBlob } from './utils';
import { setOptions } from './options';
import embedFonts from './embedFonts';
import inlineImages from './inlineImages';

function makeSvgDataUri(node, width, height) {
  return async (clone) => {
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    const xhtml = new XMLSerializer().serializeToString(clone);

    return `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="${
      width || getNodeWidth(node)
    }" height="${height || getNodeHeight(node)}">
      <foreignObject x="0" y="0" width="100%" height="100%">${escapeXhtml(xhtml)}</foreignObject>
    </svg>`;
  };
}

/**
 * @param {Node} node - The DOM Node object to render
 * @param {Object} options - Rendering options
 * @param {Function} options.filter - Should return true if passed node should be included in the output
 *          (excluding node means excluding it's children as well). Not called on the root node.
 * @param {String} options.bgcolor - color for the background, any valid CSS color value.
 * @param {Number} options.width - width to be applied to node before rendering.
 * @param {Number} options.height - height to be applied to node before rendering.
 * @param {Object} options.style - an object whose properties to be copied to node's style before rendering.
 * @param {Number} options.quality - a Number between 0 and 1 indicating image quality (applicable to JPEG only), defaults to 1.0.
 * @param {String} options.imagePlaceholder - dataURL to use as a placeholder for failed images, default behaviour is to fail fast on images we can't fetch
 * @param {Boolean} options.cacheBust - set to true to cache bust by appending the time to the request url
 * @return {Promise} - A promise that is fulfilled with a SVG image data URL
 * */
function toSvg(node, options = {}) {
  setOptions(options);

  // eslint-disable-next-line complexity
  async function applyOptions(clone) {
    if (options.bgcolor) {
      clone.style.backgroundColor = options.bgcolor;
    }

    if (options.width) {
      clone.style.width = `${options.width}px`;
    }
    if (options.height) {
      clone.style.height = `${options.height}px`;
    }

    if (options.style) {
      Object.entries(options.style).forEach(([property, value]) => {
        clone.style[property] = value;
      });
    }

    return clone;
  }

  return cloneNode(node, options.filter, true)
    .then(embedFonts)
    .then(inlineImages)
    .then(applyOptions)
    .then(makeSvgDataUri(node, options.width, options.height));
}

function draw(domNode, options) {
  return toSvg(domNode, options)
    .then(makeImage)
    .then(delay(100))
    .then((image) => {
      const canvas = document.createElement('canvas');
      canvas.width = options.width || getNodeWidth(domNode);
      canvas.height = options.height || getNodeHeight(domNode);

      if (options.bgcolor) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = options.bgcolor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas;
    });
}

async function toPixelData(node, options = {}) {
  const canvas = await draw(node, options);
  return canvas.getContext('2d').getImageData(0, 0, getNodeWidth(node), getNodeHeight(node)).data;
}

async function toPng(node, options = {}) {
  const canvas = await draw(node, options);
  return canvas.toDataURL();
}

async function toJpeg(node, options = {}) {
  const canvas = await draw(node, options);
  return canvas.toDataURL('image/jpeg', options.quality || 1.0);
}

async function toBlob(node, options = {}) {
  const canvas = await draw(node, options);
  return canvasToBlob(canvas);
}

async function toCanvas(node, options = {}) {
  return draw(node, options);
}

export default {
  toSvg,
  toPixelData,
  toPng,
  toJpeg,
  toBlob,
  toCanvas,
};
