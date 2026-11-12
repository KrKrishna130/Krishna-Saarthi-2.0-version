// Produce a classic local script so the desktop can load the app from file://.
export default {
  build: { rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } } },
  plugins: [{
    name: 'desktop-file-entry',
    transformIndexHtml: { order: 'post', handler: html => html.replace('<script type="module" crossorigin', '<script defer').replace('<link rel="stylesheet" crossorigin', '<link rel="stylesheet"') }
  }]
}
