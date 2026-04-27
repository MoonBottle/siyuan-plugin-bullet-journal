/* eslint-disable node/prefer-global/process */
import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import fg from "fast-glob"
import minimist from "minimist"
import livereload from "rollup-plugin-livereload"
import {
  defineConfig,
  loadEnv,
} from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import zipPack from "vite-plugin-zip-pack"
import removeConsole from "vite-plugin-remove-console"

const pluginInfo = require("./plugin.json")

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
            ? [{ src: "./dist/mcp-server.js", dest: "./" }]
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
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: isWatch,
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
          // chunk 文件命名优化
          chunkFileNames: "assets/[name]-[hash].js",
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
