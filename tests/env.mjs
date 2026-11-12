// Windows (app Claude, MSIX): o Chromium do Playwright mora numa pasta virtualizada; sem isso dá "spawn UNKNOWN".
// Precisa ser importado ANTES do playwright (o caminho é lido na importação).
import path from 'path';
import fs from 'fs';
if (process.platform === 'win32' && !process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.LOCALAPPDATA) {
  const pk = path.join(process.env.LOCALAPPDATA, 'Packages');
  try { const d = fs.readdirSync(pk).find((x) => /^Claude_/.test(x)); if (d) { const p = path.join(pk, d, 'LocalCache', 'Local', 'ms-playwright'); if (fs.existsSync(p)) process.env.PLAYWRIGHT_BROWSERS_PATH = p; } } catch (_) {}
}
