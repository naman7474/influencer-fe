const TEMPLATE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplate(
  template: string,
  context: Record<string, string | number | null | undefined>
): string {
  return template.replace(TEMPLATE_PATTERN, (_match, key: string) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}
