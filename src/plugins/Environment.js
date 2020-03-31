export function env(variableName) {
  return {
    value: process.env[variableName],
    cancel: () => {},
  };
}

export function json_env(variableName) {
  const raw = env(variableName);
  if (!raw) return {};
  return {
    value: JSON.parse(raw),
    cancel: () => {},
  };
}

