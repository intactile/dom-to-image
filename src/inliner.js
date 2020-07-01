import { isDataUrl, resolveUrl, getAndEncode, escape, dataAsUrl, mimeType } from './utils';

const URL_REGEX = /url\(['"]?([^'"]+?)['"]?\)/g;

export function shouldProcess(string) {
  return string.search(URL_REGEX) !== -1;
}

function urlAsRegex(url) {
  return new RegExp(`(url\\(['"]?)(${escape(url)})(['"]?\\))`, 'g');
}

export function readUrls(string) {
  const result = [];
  let match = URL_REGEX.exec(string);
  while (match !== null) {
    result.push(match[1]);
    match = URL_REGEX.exec(string);
  }
  return result.filter((url) => !isDataUrl(url));
}

export function inline(baseUrl, get = getAndEncode) {
  return async (url) => {
    const resolvedUrl = baseUrl ? resolveUrl(url, baseUrl) : url;
    const data = await get(resolvedUrl);
    return dataAsUrl(mimeType(url))(data);
  };
}

export async function inlineAll(string, baseUrl, get) {
  if (shouldProcess(string)) {
    const urls = readUrls(string);
    const inlineUrls = await Promise.all(urls.map(inline(baseUrl, get)));
    urls.forEach((url, index) => {
      string = string.replace(urlAsRegex(url), `$1${inlineUrls[index]}$3`);
    });
  }
  return string;
}
