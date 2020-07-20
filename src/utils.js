import { getOptions } from './options';

export function escapeXhtml(string) {
  return string.replace(/#/g, '%23').replace(/\n/g, '%0A');
}

export function isDataUrl(url) {
  return url.search(/^(data:)/) !== -1;
}

export function resolveUrl(url, baseUrl) {
  const doc = document.implementation.createHTMLDocument();
  const base = doc.createElement('base');
  doc.head.appendChild(base);
  const a = doc.createElement('a');
  doc.body.appendChild(a);
  base.href = baseUrl;
  a.href = url;
  return a.href;
}

export function makeImage(uri) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = uri;
  });
}

export function delay(ms) {
  return (arg) => new Promise((resolve) => setTimeout(() => resolve(arg), ms));
}

function px(node, styleProperty) {
  const value = window.getComputedStyle(node).getPropertyValue(styleProperty);
  return parseFloat(value.replace('px', ''));
}

export function getNodeWidth(node) {
  const leftBorder = px(node, 'border-left-width');
  const rightBorder = px(node, 'border-right-width');
  return node.scrollWidth + leftBorder + rightBorder;
}

export function getNodeHeight(node) {
  const topBorder = px(node, 'border-top-width');
  const bottomBorder = px(node, 'border-bottom-width');
  return node.scrollHeight + topBorder + bottomBorder;
}

function toBlob(canvas) {
  return new Promise((resolve) => {
    const binaryString = window.atob(canvas.toDataURL().split(',')[1]);
    const length = binaryString.length;
    const binaryArray = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      binaryArray[i] = binaryString.charCodeAt(i);
    }

    resolve(new Blob([binaryArray], { type: 'image/png' }));
  });
}

export function canvasToBlob(canvas) {
  if (canvas.toBlob) {
    return new Promise((resolve) => canvas.toBlob(resolve));
  }
  return toBlob(canvas);
}

export function getAndEncode(url) {
  const TIMEOUT = 30000;
  const { cacheBust, imagePlaceholder } = getOptions();

  if (cacheBust) {
    // Cache bypass so we dont have CORS issues with cached images
    // Source: https://developer.mozilla.org/en/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
    url += (/\?/.test(url) ? '&' : '?') + new Date().getTime();
  }

  return new Promise((resolve) => {
    const request = new XMLHttpRequest();

    let placeholder;
    if (imagePlaceholder) {
      const split = imagePlaceholder.split(/,/);
      if (split && split[1]) {
        placeholder = split[1];
      }
    }

    const fail = (message) => {
      // eslint-disable-next-line no-console
      console.error(message);
      resolve('');
    };

    const timeout = () => {
      if (placeholder) {
        resolve(placeholder);
      } else {
        fail(`timeout of ${TIMEOUT}ms occured while fetching resource: ${url}`);
      }
    };

    const done = () => {
      if (request.readyState !== 4) return;

      if (request.status !== 200) {
        if (placeholder) {
          resolve(placeholder);
        } else {
          fail(`cannot fetch resource: ${url}, status: ${request.status}`);
        }
        return;
      }

      const encoder = new FileReader();
      encoder.onloadend = () => {
        const content = encoder.result.split(/,/)[1];
        resolve(content);
      };
      encoder.readAsDataURL(request.response);
    };

    request.onreadystatechange = done;
    request.ontimeout = timeout;
    request.responseType = 'blob';
    request.timeout = TIMEOUT;
    request.open('GET', url, true);
    request.send();
  });
}

function mimes() {
  /*
   * Only WOFF and EOT mime types for fonts are 'real'
   * see http://www.iana.org/assignments/media-types/media-types.xhtml
   */
  const WOFF = 'application/font-woff';
  const JPEG = 'image/jpeg';

  return {
    woff: WOFF,
    woff2: WOFF,
    ttf: 'application/font-truetype',
    eot: 'application/vnd.ms-fontobject',
    png: 'image/png',
    jpg: JPEG,
    jpeg: JPEG,
    gif: 'image/gif',
    tiff: 'image/tiff',
    svg: 'image/svg+xml',
  };
}

export function parseExtension(url) {
  const match = /\.([^./]*?)(\?|$)/g.exec(url);
  if (match) {
    return match[1];
  }
  return '';
}

export function mimeType(url) {
  const extension = parseExtension(url).toLowerCase();
  return mimes()[extension] || '';
}

export function dataAsUrl(type) {
  return (content) => `data:${type};base64,${content}`;
}

export function escape(string) {
  return string.replace(/([.*+?^${}()|[\]/\\])/g, '\\$1');
}

export function uid() {
  let index = 0;

  return () => {
    function fourRandomChars() {
      /* see http://stackoverflow.com/a/6248722/2519373 */
      // eslint-disable-next-line no-bitwise, no-restricted-properties
      return `0000${((Math.random() * Math.pow(36, 4)) << 0).toString(36)}`.slice(-4);
    }

    return `u${fourRandomChars()}${index++}`;
  };
}
