export async function loadWasmNode() {
  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const wasmPath = path.join(__dirname, 'deposit.wasm');
  return await fs.readFile(wasmPath);
}

export async function fullPath(file_name) {
  const path = await import('path');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const full_path = path.join(__dirname, file_name);
  return full_path
}