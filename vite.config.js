import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const isTrue = (v) => String(v || '').toLowerCase() === 'true'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Mock e bypass do Turnstile são só de dev/teste: um build de produção com essas flags ligadas é abortado
  // (nunca imprime valores de variáveis).
  if (command === 'build' && mode === 'production') {
    const v = loadEnv(mode, process.cwd(), 'VITE_')
    const bad = ['VITE_USE_MOCK', 'VITE_USE_MOCKS', 'VITE_TURNSTILE_DEV_BYPASS'].filter((k) => isTrue(v[k]) || isTrue(process.env[k]))
    if (bad.length) {
      throw new Error(`Build de produção bloqueado: ${bad.join(', ')} só pode(m) ser usada(s) em dev/teste. Remova da configuração de build.`)
    }
  }
  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2020',
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js', 'scripts/**/*.test.js'],
    },
  }
})
