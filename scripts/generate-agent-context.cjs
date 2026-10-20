const fs = require('fs');
const { execSync } = require('child_process');
function getGit(c) { try { return execSync(c).toString().trim(); } catch(e) { return 'N/A'; } }
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const content = `# INFORME DE ESTADO PARA AGENTE DE IA (SESSION CONTEXT)
> **Generado automáticamente:** ${new Date().toISOString()}

## 1. Identificación del Proyecto
* **Nombre:** ${pkg.name}
* **Versión:** ${pkg.version}
* **Rama Git Actual:** \`${getGit('git rev-parse --abbrev-ref HEAD')}\`
* **Último Commit:** \`${getGit('git log -1 --pretty=format:"%h - %s (%cr)"')}\`

## 2. Archivos Modificados / Pendientes (\`git status\`)
\`\`\`text
${getGit('git status --short') || 'Sin cambios pendientes (Working tree clean)'}
\`\`\`

## 3. Estado de Módulos y Arquitectura
- [x] Corrección de solapes y layout 100dvh.
- [x] Filtro estricto de TLEs obsoletos.
- [x] Estética HUD (Glassmorphism + Hyper Glow neón #FF6700).
- [x] Proyección Ortográfica 2D (Globo Esférico con drag en ejes X/Y corregidos).
- [x] Modo Kiosco / F11 en Tauri v2.
`;
fs.writeFileSync('AGENT_SESSION.md', content);
console.log('✅ AGENT_SESSION.md generado.');
