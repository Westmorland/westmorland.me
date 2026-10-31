import assert from 'node:assert/strict';

// Deliberately independent of application data: only these navigation links are authorised.
export const profileHrefs = ['https://uk.linkedin.com/in/danwestmorland', 'https://github.com/Westmorland', 'https://medium.com/@westmorland'];
export function checkResourceAttributes(html) {
  for (const tag of html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)) {
    for (const attribute of tag[0].matchAll(/\b(src|href)\s*=\s*["'](https?:[^"']*|\/\/[^"']*)["']/gi)) {
      assert.ok(tag[1].toLowerCase() === 'a' && attribute[1].toLowerCase() === 'href' && profileHrefs.includes(attribute[2]), 'only exact approved external navigation anchors are permitted');
    }
  }
  assert.doesNotMatch(html, /\b(?:srcset|poster)\s*=|url\(\s*["']?(?:https?:|\/\/)|@import/i, 'no additional external resource channels');
}
