// For ESLint's TypeScript service, which doesn't read .vue files (vue-tsc does).
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
