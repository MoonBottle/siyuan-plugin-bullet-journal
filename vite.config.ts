/* eslint-disable node/prefer-global/process */
import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import fg from "fast-glob"
import minimist from "minimist"
import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'
import livereload from "rollup-plugin-livereload"
import {
  defineConfig,
  loadEnv,
} from "vite"
import removeConsole from "vite-plugin-remove-console"
import { viteStaticCopy } from "vite-plugin-static-copy"
import zipPack from "vite-plugin-zip-pack"

const pluginInfo = require("./plugin.json")

const PI_REGISTER_BUILTINS_ID = 'pi-ai/dist/providers/register-builtins.js'
const PI_ENV_API_KEYS_ID = 'pi-ai/dist/env-api-keys.js'

const FONT_FACE_RE = /@font-face\{[^}]+\}/g

function removeGanttFontFace() {
  return {
    name: 'remove-gantt-font-face',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (id.includes('dhtmlx-gantt') && id.endsWith('.css')) {
        // 只删除非图标字体的 @font-face（如 Inter），保留 dhx-gantt-icons
        return {
          code: code.replace(FONT_FACE_RE, (match) => match.includes('dhx-gantt-icons') ? match : ''),
          map: null,
        }
      }
    },
  }
}

function piProviderOptimizer() {
  return {
    name: 'pi-provider-optimizer',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes(PI_REGISTER_BUILTINS_ID)) {
        return {
          code: `import { registerApiProvider, clearApiProviders } from "../api-registry.js";
import { streamOpenAICompletions, streamSimpleOpenAICompletions } from "./openai-completions.js";
export { streamOpenAICompletions, streamSimpleOpenAICompletions };
export function registerBuiltInApiProviders() {
  registerApiProvider({
    api: "openai-completions",
    stream: streamOpenAICompletions,
    streamSimple: streamSimpleOpenAICompletions,
  });
}
export function resetApiProviders() {
  clearApiProviders();
  registerBuiltInApiProviders();
}
registerBuiltInApiProviders();
`,
          map: null,
        }
      }

      if (id.includes(PI_ENV_API_KEYS_ID)) {
        return {
          code: `export function findEnvKeys() { return undefined; }
export function getEnvApiKey() { return undefined; }
`,
          map: null,
        }
      }

      return null
    },
  }
}

function scopeBytemdCss() {
  const TARGET_FILES = [
    'bytemd/dist/index.css',
    'github-markdown-css/github-markdown-light.css',
    'highlight.js/styles/github.css',
  ]
  const PREFIX = '.ta-skill-edit-dialog'

  return {
    name: 'scope-bytemd-css',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!id.endsWith('.css'))
        return null
      if (!TARGET_FILES.some((f) => id.includes(f)))
        return null

      const result = postcss()
        .use(prefixSelector({ prefix: PREFIX }))
        .process(code, { from: undefined })
        .css

      return {
        code: result,
        map: null,
      }
    },
  }
}

export default defineConfig(({
  mode,
}) => {

  console.log('mode=>', mode)
  const env = loadEnv(mode, process.cwd())
  const {
    VITE_SIYUAN_WORKSPACE_PATH,
  } = env
  console.log('env=>', env)


  const siyuanWorkspacePath = VITE_SIYUAN_WORKSPACE_PATH
  let devDistDir = './dev'
  if (!siyuanWorkspacePath) {
    console.log("\nSiyuan workspace path is not set.")
  } else {
    console.log(`\nSiyuan workspace path is set:\n${siyuanWorkspacePath}`)
    devDistDir = `${siyuanWorkspacePath}/data/plugins/${pluginInfo.name}`
  }
  console.log(`\nPlugin will build to:\n${devDistDir}`)

  const args = minimist(process.argv.slice(2))
  const isWatch = args.watch || args.w || false
  const distDir = siyuanWorkspacePath ? devDistDir : "./dist"

  console.log()
  console.log("isWatch=>", isWatch)
  console.log("distDir=>", distDir)

  return {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        ...(!isWatch ? { vconsole: resolve(__dirname, "src/mobile/utils/vconsole.stub.ts") } : {}),
      },
    },

    // 依赖预构建优化
    optimizeDeps: {
      include: [
        "vue",
        "pinia",
        "dayjs",
        "chart.js",
        "@fullcalendar/core",
        "@fullcalendar/daygrid",
        "@fullcalendar/timegrid",
        "@fullcalendar/list",
        "@fullcalendar/interaction",
        "dhtmlx-gantt",
      ],
      exclude: ["siyuan"],
    },

    plugins: [
      removeGanttFontFace(),
      piProviderOptimizer(),
      scopeBytemdCss(),
      vue(),
      viteStaticCopy({
        targets: [
          {
            src: "./README*.md",
            dest: "./",
          },
          {
            src: "./icon.png",
            dest: "./",
          },
          {
            src: "./preview.png",
            dest: "./",
          },
          {
            src: "./plugin.json",
            dest: "./",
          },
          // 插件设置生成的 MCP 配置指向插件根目录下的 mcp-server.js，
          // 因此只要输出到工作空间插件目录，就必须同步复制最新的 MCP 构建产物。
          ...(siyuanWorkspacePath
            ? [
                {
                  src: "./dist/mcp-server.js",
                  dest: "./",
                },
                {
                  src: "./dist/kernel.js",
                  dest: "./",
                },
              ]
            : []),
          {
            src: "./src/i18n/**",
            dest: "./i18n/",
          },

        ],
      }),
      // 只在生产构建且非监听模式时移除 console.log
      ...(mode === 'production' && !isWatch ? [removeConsole()] : []),
    ],

    // https://github.com/vitejs/vite/issues/1930
    // https://vitejs.dev/guide/env-and-mode.html#env-files
    // https://github.com/vitejs/vite/discussions/3058#discussioncomment-2115319
    // 在这里自定义变量
    define: {
      "process.env.DEV_MODE": `"${isWatch}"`,
      "process.env.NODE_ENV": JSON.stringify(isWatch ? 'development' : 'production'),
      "__VUE_OPTIONS_API__": true,
      "__VUE_PROD_DEVTOOLS__": isWatch,
    },

    build: {
      // 输出路径
      outDir: distDir,
      emptyOutDir: !isWatch && process.env.EMPTY_OUT_DIR !== 'false',

      // 构建后是否生成 source map 文件
      sourcemap: isWatch,

      // 设置为 false 可以禁用最小化混淆
      // 或是用来指定是应用哪种混淆器
      // boolean | 'terser' | 'esbuild'
      // 不压缩，用于调试
      minify: !isWatch,

      // CSS 代码分割
      cssCodeSplit: true,

      // 模块预加载配置
      modulePreload: {
        polyfill: true,
      },

      // 资源内联阈值
      assetsInlineLimit: 4096,

      // 报告 gzip 压缩后大小
      reportCompressedSize: true,

      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: resolve(__dirname, "src/index.ts"),
        // the proper extensions will be added
        fileName: "index",
        formats: ["cjs"],
      },
      rollupOptions: {
        plugins: [
          ...(isWatch
            ? [
                livereload(devDistDir),
                {
                  // 监听静态资源文件
                  name: "watch-external",
                  async buildStart() {
                    const files = await fg([
                      "src/i18n/*.json",
                      "./README*.md",
                      "./plugin.json",
                      "dist/mcp-server.js",
                      "dist/kernel.js",
                    ])
                    for (const file of files) {
                      this.addWatchFile(file)
                    }
                  },
                },
              ]
            : [
                zipPack({
                  inDir: "./dist",
                  outDir: "./",
                  outFileName: "package.zip",
                }),
              ]),
        ],

        // make sure to externalize deps that shouldn't be bundled
        // into your library
        external: ["siyuan", "process"],

        output: {
          entryFileNames: "[name].js",
          codeSplitting: false,
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === "style.css") {
              return "index.css"
            }
            return assetInfo.name || "assets/[name]-[hash][extname]"
          },
        },
      },
    },
  }
})
