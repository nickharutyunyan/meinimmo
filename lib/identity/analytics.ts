export const ANALYTICS_CONFIG_SCRIPT = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      var pagePath = window.location.pathname;
      var pageLocation = window.location.origin + pagePath;
      gtag('config', 'G-7NZBW8CKQ3', { page_location: pageLocation, page_path: pagePath });
    `;

export function analyticsPageFields(location: { origin: string; pathname: string }) {
  return {
    page_location: `${location.origin}${location.pathname}`,
    page_path: location.pathname,
  };
}
