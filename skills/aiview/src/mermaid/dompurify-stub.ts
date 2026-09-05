// Stands in for dompurify in the mermaid-check bundle. Nothing is rendered by the
// checker, so nothing needs sanitising, and the real DOMPurify refuses to initialise
// without a genuine document.
const DOMPurify = {
  isSupported: true,
  addHook(): void {},
  removeHook(): void {},
  removeAllHooks(): void {},
  sanitize: (s: string): string => s,
  setConfig(): void {},
  clearConfig(): void {},
};
export default DOMPurify;
