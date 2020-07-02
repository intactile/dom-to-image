/* eslint-disable func-names */
import Tesseract from 'tesseract.js';
import { equal as imageDiffEqual } from 'imagediff';
import domtoimage from '../src/index';
import { delay, uid, getAndEncode, parseExtension, mimeType, resolveUrl } from '../src/utils';
import { inlineAll, readUrls, inline } from '../src/inliner';
import { resolveAll as resolveAllFonts } from '../src/embedFonts';
import { inlineImage } from '../src/inlineImages';
import { setOptions } from '../src/options';

const BASE_URL = '/base/spec/resources/';

const uuid = uid();

function getResource(fileName) {
  const url = BASE_URL + fileName;
  const request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'text';

  return new Promise((resolve, reject) => {
    request.onload = () => {
      if (request.status === 200) {
        resolve(request.response.toString().trim());
      } else {
        reject(new Error(`cannot load ${url}`));
      }
    };
    request.send();
  });
}

function loadPage() {
  return getResource('page.html').then((html) => {
    const root = document.createElement('div');
    root.id = 'test-root';
    root.innerHTML = html;
    document.body.appendChild(root);
  });
}

function loadTestPage(html, css, expectedImage) {
  return loadPage()
    .then(() => {
      return getResource(html).then((htmlString) => {
        document.querySelector('#dom-node').innerHTML = htmlString;
      });
    })
    .then(() => {
      if (css) {
        return getResource(css).then((cssString) => {
          document.querySelector('#style').append(document.createTextNode(cssString));
        });
      }
      return null;
    })
    .then(() => {
      if (expectedImage) {
        return getResource(expectedImage).then((image) => {
          document.querySelector('#control-image').src = image;
        });
      }
      return null;
    });
}

function purgePage() {
  const root = document.querySelector('#test-root');
  if (root) root.remove();
}

function domNode() {
  return document.querySelector('#dom-node');
}

function controlImage() {
  return document.querySelector('#control-image');
}

function canvas() {
  return document.querySelector('#canvas');
}

function compareToControlImage(image, tolerance) {
  assert.isTrue(
    imageDiffEqual(image, controlImage(), tolerance),
    'rendered and control images should be same'
  );
}

function makeImgElement(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };

    image.src = src;
  });
}

function drawImgElement(node, dimensions = {}) {
  return async (image) => {
    const localNode = node || domNode();
    canvas().height = dimensions.height || localNode.offsetHeight.toString();
    canvas().width = dimensions.width || localNode.offsetWidth.toString();
    canvas().getContext('2d').imageSmoothingEnabled = false;
    canvas().getContext('2d').drawImage(image, 0, 0);
    return image;
  };
}

function drawDataUrl(dataUrl, dimensions) {
  return makeImgElement(dataUrl).then(drawImgElement(null, dimensions));
}

function check(dataUrl) {
  return drawDataUrl(dataUrl).then(compareToControlImage);
}

function renderToPng(node) {
  return domtoimage.toPng(node || domNode());
}

async function renderAndCheck() {
  return renderToPng().then(check);
}

function assertTextRendered(lines) {
  return () => {
    return new Promise((resolve, reject) => {
      Tesseract.recognize(canvas()).then(({ data: { text } }) => {
        lines.forEach((line) => {
          try {
            assert.include(text, line);
          } catch (e) {
            reject(e);
          }
        });
        resolve();
      });
    });
  };
}

describe('domtoimage', () => {
  afterEach(purgePage);

  it('should load', () => {
    assert.ok(domtoimage);
  });

  describe('regression', () => {
    it('should render to svg', (done) => {
      loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image')
        .then(() => domtoimage.toSvg(domNode()))
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should render to png', (done) => {
      loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image')
        .then(() => domtoimage.toPng(domNode()))
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should handle border', (done) => {
      loadTestPage('border/dom-node.html', 'border/style.css', 'border/control-image')
        .then(renderAndCheck)
        .then(done)
        .catch(done);
    });

    it('should render to jpeg', (done) => {
      loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image-jpeg')
        .then(() => {
          return domtoimage.toJpeg(domNode());
        })
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should use quality parameter when rendering to jpeg', (done) => {
      loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image-jpeg-low')
        .then(() => {
          return domtoimage.toJpeg(domNode(), { quality: 0.5 });
        })
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should render to blob', (done) => {
      loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image')
        .then(() => {
          return domtoimage.toBlob(domNode());
        })
        .then(global.URL.createObjectURL)
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should render bigger node', (done) => {
      loadTestPage('bigger/dom-node.html', 'bigger/style.css', 'bigger/control-image')
        .then(() => {
          const parent = document.querySelector('#dom-node');
          const child = document.querySelector('.dom-child-node');
          for (let i = 0; i < 10; i++) {
            parent.append(child.cloneNode(true));
          }
          return parent;
        })
        .then(renderAndCheck)
        .then(done)
        .catch(done);
    });

    it('should handle "#" in colors and attributes', (done) => {
      loadTestPage('hash/dom-node.html', 'hash/style.css', 'small/control-image')
        .then(renderAndCheck)
        .then(done)
        .catch(done);
    });

    it('should render nested svg with broken namespace', (done) => {
      loadTestPage('svg-ns/dom-node.html', 'svg-ns/style.css', 'svg-ns/control-image')
        .then(renderAndCheck)
        .then(done)
        .catch(done);
    });

    it('should render svg <rect> with width and heigth', (done) => {
      loadTestPage('svg-rect/dom-node.html', 'svg-rect/style.css', 'svg-rect/control-image')
        .then(renderAndCheck)
        .then(done)
        .catch(done);
    });

    it('should render whole node when its scrolled', (done) => {
      let domNodeLocal;
      loadTestPage('scroll/dom-node.html', 'scroll/style.css', 'scroll/control-image')
        .then(() => {
          domNodeLocal = document.querySelector('#scrolled');
        })
        .then(() => {
          return renderToPng(domNodeLocal);
        })
        .then(makeImgElement)
        .then(drawImgElement(domNodeLocal))
        .then(compareToControlImage)
        .then(done)
        .catch(done);
    });

    it('should render text nodes', function (done) {
      this.timeout(30000);
      loadTestPage('text/dom-node.html', 'text/style.css')
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['SOME TEXT', 'SOME MORE TEXT']))
        .then(done)
        .catch(done);
    });

    it('should preserve content of ::before and ::after pseudo elements', function (done) {
      this.timeout(10000);
      loadTestPage('pseudo/dom-node.html', 'pseudo/style.css')
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['JUSTBEFORE', 'BOTHBEFORE']))
        .then(assertTextRendered(['JUSTAFTER', 'BOTHAFTER']))
        .then(done)
        .catch(done);
    });

    it('should use node filter', (done) => {
      function filter(node) {
        if (node.classList) return !node.classList.contains('omit');
        return true;
      }

      loadTestPage('filter/dom-node.html', 'filter/style.css', 'filter/control-image')
        .then(() => {
          return domtoimage.toPng(domNode(), {
            filter,
          });
        })
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should not apply node filter to root node', (done) => {
      function filter(node) {
        if (node.classList) return node.classList.contains('include');
        return false;
      }

      loadTestPage('filter/dom-node.html', 'filter/style.css', 'filter/control-image')
        .then(() => {
          return domtoimage.toPng(domNode(), {
            filter,
          });
        })
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should render with external stylesheet', (done) => {
      loadTestPage('sheet/dom-node.html', 'sheet/style.css', 'sheet/control-image')
        .then(delay(1000))
        .then(renderAndCheck)
        .then(done)
        .catch(done);
    });

    it('should render web fonts', function (done) {
      this.timeout(10000);
      loadTestPage('fonts/dom-node.html', 'fonts/style.css')
        .then(delay(1000))
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['O']))
        .then(done)
        .catch(done);
    });

    it('should render images', (done) => {
      loadTestPage('images/dom-node.html', 'images/style.css')
        .then(delay(500))
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['PNG', 'JPG']))
        .then(done)
        .catch(done);
    });

    it('should render background images', (done) => {
      loadTestPage('css-bg/dom-node.html', 'css-bg/style.css')
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['JPG']))
        .then(done)
        .catch(done);
    });

    it('should render user input from <textarea>', (done) => {
      loadTestPage('textarea/dom-node.html', 'textarea/style.css')
        .then(() => {
          document.getElementById('input').value = 'USER\nINPUT';
        })
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['USER\nINPUT']))
        .then(done)
        .catch(done);
    });

    it('should render user input from <input>', (done) => {
      loadTestPage('input/dom-node.html', 'input/style.css')
        .then(() => {
          document.getElementById('input').value = 'USER INPUT';
        })
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['USER INPUT']))
        .then(done)
        .catch(done);
    });

    it('should render content from <canvas>', (done) => {
      loadTestPage('canvas/dom-node.html', 'canvas/style.css')
        .then(() => {
          const canvasLocal = document.getElementById('content');
          const ctx = canvasLocal.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasLocal.width, canvasLocal.height);
          ctx.fillStyle = '#000000';
          ctx.font = '100px monospace';
          ctx.fillText('0', canvasLocal.width / 2, canvasLocal.height / 2);
        })
        .then(renderToPng)
        .then(drawDataUrl)
        .then(assertTextRendered(['0']))
        .then(done)
        .catch(done);
    });

    it('should render bgcolor', (done) => {
      loadTestPage('bgcolor/dom-node.html', 'bgcolor/style.css', 'bgcolor/control-image')
        .then(() =>
          domtoimage.toPng(domNode(), {
            bgcolor: '#ff0000',
          })
        )
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should render bgcolor in SVG', (done) => {
      loadTestPage('bgcolor/dom-node.html', 'bgcolor/style.css', 'bgcolor/control-image')
        .then(() =>
          domtoimage.toSvg(domNode(), {
            bgcolor: '#ff0000',
          })
        )
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should not crash when loading external stylesheet causes error', (done) => {
      loadTestPage('ext-css/dom-node.html', 'ext-css/style.css')
        .then(delay(1000))
        .then(renderToPng)
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('should convert an element to an array of pixels', (done) => {
      loadTestPage('pixeldata/dom-node.html', 'pixeldata/style.css')
        .then(delay(1000))
        .then(() => domtoimage.toPixelData(domNode()))
        // eslint-disable-next-line complexity
        .then((pixels) => {
          for (let y = 0; y < domNode().scrollHeight; ++y) {
            for (let x = 0; x < domNode().scrollWidth; ++x) {
              const rgba = [0, 0, 0, 0];

              if (y < 10) {
                rgba[0] = 255;
              } else if (y < 20) {
                rgba[1] = 255;
              } else {
                rgba[2] = 255;
              }

              if (x < 10) {
                rgba[3] = 255;
              } else if (x < 20) {
                rgba[3] = 0.4 * 255;
              } else {
                rgba[3] = 0.2 * 255;
              }

              const offset = 4 * y * domNode().scrollHeight + 4 * x;

              assert.deepEqual(Array.from(pixels.slice(offset, offset + 4)), rgba);
            }
          }
        })
        .then(done)
        .catch(done);
    });

    it('should apply width and height options to node copy being rendered', (done) => {
      loadTestPage('dimensions/dom-node.html', 'dimensions/style.css', 'dimensions/control-image')
        .then(() => {
          return domtoimage.toPng(domNode(), {
            width: 200,
            height: 200,
          });
        })
        .then((dataUrl) => drawDataUrl(dataUrl, { width: 200, height: 200 }))
        .then(compareToControlImage)
        .then(done)
        .catch(done);
    });

    it('should apply style text to node copy being rendered', (done) => {
      loadTestPage('style/dom-node.html', 'style/style.css', 'style/control-image')
        .then(() => {
          return domtoimage.toPng(domNode(), {
            style: { 'background-color': 'red', transform: 'scale(0.5)' },
          });
        })
        .then(check)
        .then(done)
        .catch(done);
    });

    it('should combine dimensions and style', (done) => {
      loadTestPage('scale/dom-node.html', 'scale/style.css', 'scale/control-image')
        .then(() => {
          return domtoimage.toPng(domNode(), {
            width: 200,
            height: 200,
            style: {
              transform: 'scale(2)',
              'transform-origin': 'top left',
            },
          });
        })
        .then((dataUrl) => drawDataUrl(dataUrl, { width: 200, height: 200 }))
        .then(compareToControlImage)
        .then(done)
        .catch(done);
    });
  });

  describe('inliner', () => {
    const NO_BASE_URL = null;

    it('should parse urls', () => {
      assert.deepEqual(readUrls('url("http://acme.com/file")'), ['http://acme.com/file']);
      // eslint-disable-next-line quotes
      assert.deepEqual(readUrls("url(foo.com), url('bar.org')"), ['foo.com', 'bar.org']);
    });

    it('should ignore data urls', () => {
      assert.deepEqual(readUrls('url(foo.com), url(data:AAA)'), ['foo.com']);
    });

    it('should inline url', (done) => {
      inline(NO_BASE_URL, () => Promise.resolve('AAA'))('http://acme.com/image.png')
        .then((result) => assert.equal(result, 'data:image/png;base64,AAA'))
        .then(done)
        .catch(done);
    });

    it('should resolve urls if base url given', (done) => {
      inline('http://acme.com/', (url) => {
        return Promise.resolve(
          {
            'http://acme.com/images/image.png': 'AAA',
          }[url]
        );
      })('images/image.png')
        .then((result) => assert.equal(result, 'data:image/png;base64,AAA'))
        .then(done)
        .catch(done);
    });

    it('should inline all urls', (done) => {
      inlineAll('url(http://acme.com/image.png), url("foo.com/font.ttf")', NO_BASE_URL, (url) => {
        return Promise.resolve(
          {
            'http://acme.com/image.png': 'AAA',
            'foo.com/font.ttf': 'BBB',
          }[url]
        );
      })
        .then((result) => {
          assert.equal(
            result,
            'url(data:image/png;base64,AAA), url("data:application/font-truetype;base64,BBB")'
          );
        })
        .then(done)
        .catch(done);
    });
  });

  describe('util', () => {
    it('should get and encode resource', (done) => {
      getResource('util/fontawesome.base64')
        .then((testResource) => {
          return getAndEncode(`${BASE_URL}util/fontawesome.woff2`).then((resource) => {
            assert.equal(resource, testResource);
          });
        })
        .then(done)
        .catch(done);
    });

    it('should return empty result if cannot get resource', (done) => {
      getAndEncode(`${BASE_URL}util/not-found`)
        .then((resource) => {
          assert.equal(resource, '');
        })
        .then(done)
        .catch(done);
    });

    it('should return placeholder result if cannot get resource and placeholder is provided', (done) => {
      const placeholder =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAMSURBVBhXY7h79y4ABTICmGnXPbMAAAAASUVORK5CYII=';
      setOptions({ imagePlaceholder: placeholder });
      getAndEncode(`${BASE_URL}util/not-found`)
        .then((resource) => {
          const placeholderData = placeholder.split(/,/)[1];
          assert.equal(resource, placeholderData);
          setOptions();
        })
        .then(done)
        .catch(done);
    });

    it('should parse extension', () => {
      assert.equal(parseExtension('http://acme.com/font.woff'), 'woff');
      assert.equal(parseExtension('../FONT.TTF'), 'TTF');
      assert.equal(parseExtension('../font'), '');
      assert.equal(parseExtension('font'), '');
    });

    it('should guess mime type from url', () => {
      assert.equal(mimeType('http://acme.com/font.woff'), 'application/font-woff');
      assert.equal(mimeType('IMAGE.PNG'), 'image/png');
      assert.equal(mimeType('http://acme.com/image'), '');
    });

    it('should resolve url', () => {
      assert.equal(resolveUrl('font.woff', 'http://acme.com'), 'http://acme.com/font.woff');
      assert.equal(
        resolveUrl('/font.woff', 'http://acme.com/fonts/woff'),
        'http://acme.com/font.woff'
      );

      assert.equal(
        resolveUrl('../font.woff', 'http://acme.com/fonts/woff/'),
        'http://acme.com/fonts/font.woff'
      );
      assert.equal(
        resolveUrl('../font.woff', 'http://acme.com/fonts/woff'),
        'http://acme.com/font.woff'
      );
    });

    it('should generate uids', () => {
      assert(uuid().length >= 4);
      assert.notEqual(uid(), uid());
    });
  });

  describe('web fonts', () => {
    it('should read non-local font faces', (done) => {
      loadTestPage('fonts/web-fonts/empty.html', 'fonts/web-fonts/rules.css')
        .then(resolveAllFonts)
        .then((webFonts) => {
          assert.equal(webFonts.split('\n').length, 3);
        })
        .then(done)
        .catch(done);
    });
  });

  describe('images', () => {
    it('should not inline images with data url', (done) => {
      const originalSrc = 'data:image/jpeg;base64,AAA';

      const img = new Image();
      img.src = originalSrc;

      inlineImage(img)
        .then((inlinedImage) => assert.equal(inlinedImage.src, originalSrc))
        .then(done)
        .catch(done);
    });
  });
});
