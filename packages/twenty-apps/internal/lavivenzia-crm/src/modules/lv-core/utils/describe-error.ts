// One line for a caught error, including the underlying cause when there is
// one. Node's fetch reports every network / TLS / DNS problem as the bare
// "fetch failed" and keeps the real reason in `error.cause`; without it a
// production log cannot tell a certificate problem from a refused connection.
export const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeText =
    cause instanceof Error
      ? ` — cause: ${(cause as Error & { code?: string }).code ?? ''} ${cause.message}`.trimEnd()
      : cause !== undefined
        ? ` — cause: ${String(cause)}`
        : '';

  return `${error.message}${causeText}`;
};
