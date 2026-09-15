// La Vivenzia mark, served by this front-end (CM-005). The upstream default
// pointed at Twenty's placeholder image on GitHub Pages.
// Absolute, because consumers pass it through getImageAbsoluteURI, which
// treats a bare path as a file-storage key under /files/.
export const DEFAULT_WORKSPACE_LOGO = `${typeof window === 'undefined' ? '' : window.location.origin}/images/lv/logo-mark.png`;
