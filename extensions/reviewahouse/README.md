# ReviewAHouse Listing Helper — local prototype 0.1.0

Desktop Chrome only. Not yet published or reviewed by the Chrome Web Store.

## Install once

1. Open chrome://extensions and turn on Developer mode.
2. Choose Load unpacked and select this folder (the one containing manifest.json).
3. Refresh https://reviewahouse.com/am in this same Chrome profile.
4. Check for “Browser helper connected”, paste a List.am URL and click Create report.

The helper opens a temporary English listing tab, reads public property sections,
and returns text to ReviewAHouse. The site validates it and creates a shareable
report. The tab closes after reading; browser verification must be completed by
you if requested. There is no CAPTCHA solver or protection bypass.

## Permissions and privacy

- Scripting access on list.am and www.list.am; a communication script on
  reviewahouse.com and www.reviewahouse.com. No other sites, localhost or subdomains.
- No cookies, passwords, browsing-history, debugger, clipboard or storage permission.
- Only a real Create report submission triggers import; one concurrent import.
- Reads headline, asking price, sale category, property fields, location and public
  description. Does not read account details, seller cards, forms or map ads.
- Listing text is passed to ReviewAHouse in the submitting tab; existing report
  storage/sharing rules apply. Do not import confidential/personal documents here.
- No background crawling, analytics, remote code or API keys in the extension.
- Disable/remove it at chrome://extensions to revoke access. Local prototypes
  do not update automatically; reload after reviewing a new version.

Source-site terms still apply. This helper does not grant permission to reuse
List.am content commercially. Resolve that permission before broad distribution.

## Package

From the repository root, `npm run helper:package` writes
`public/downloads/reviewahouse-helper.zip`. `npm run build` and `npm run deploy`
do that first. Packaging uses Node, so the Cloudflare build image does not need
a `zip` binary. The archive contains only the five runtime files and this README,
never environment files or secrets. The zip is generated, not committed.
