import svelte from "rollup-plugin-svelte";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";
import sveltePreprocess from "svelte-preprocess";
import typescript from "@rollup/plugin-typescript";
// import css from "rollup-plugin-css-only";

import postcss from "rollup-plugin-postcss";
import html from "@rollup/plugin-html";
import { promises as fs } from "fs";
import path from "path";
import json from "@rollup/plugin-json";

const production = !process.env.ROLLUP_WATCH;

function serve() {
    let server;

    function toExit() {
        if (server) server.kill(0);
    }

    return {
        writeBundle() {
            if (server) return;
            server = require("child_process").spawn(
                "npm",
                ["run", "start-dev", "--", "--dev"],
                {
                    stdio: ["ignore", "inherit", "inherit"],
                    shell: true,
                }
            );

            process.on("SIGTERM", toExit);
            process.on("exit", toExit);
        },
    };
}

function copyPublic(publicDir) {
    return {
        name: "copy-public",
        async generateBundle({ dir }) {
            if (!(await fs.stat(publicDir)).isDirectory()) {
                throw Error(`Provided path should be a dir`);
            }
            const srcDir = await fs.readdir(publicDir);
            await fs.access(dir).catch((e) => fs.mkdir(dir));
            for (const file of srcDir) {
                if (file !== "index.html" && file !== "build") {
                    await fs.copyFile(
                        path.format({
                            dir: publicDir,
                            base: file,
                        }),
                        path.format({
                            dir,
                            base: file,
                        })
                    );
                }
            }
        },
    };
}

const htmlOptions = {
    template: async ({ attributes, files, meta, publicPath, title }) => {
        let htmlTmpl = await fs.readFile("public/index.html", {
            encoding: "utf-8",
        });

        if (files.css) {
            htmlTmpl = htmlTmpl.replace(
                "build/bundle.css",
                files.css[0].fileName
            );
        }
        if (files.js) {
            htmlTmpl = htmlTmpl.replace(
                "build/bundle.js",
                files.js[0].fileName
            );
        }
        return htmlTmpl;
    },
};

export default {
    input: "src/main.ts",
    output: production
        ? {
              format: "iife",
              sourcemap: false,
              entryFileNames: "[name].[hash].js",
              chunkFileNames: "[name].[hash].js",
              name: "app",
              // file: "public/build/bundle.js",
              dir: "build/",
          }
        : {
              sourcemap: true,
              format: "iife",
              name: "app",
              file: "/build/bundle.js",
          },
    plugins: [
        json(),
        production && copyPublic("public"),
        svelte({
            preprocess: sveltePreprocess({ sourceMap: !production }),
            emitCss: true,
            compilerOptions: {
                // enable run-time checks when not in production
                dev: !production,
            },
        }),
        // // we'll extract any component CSS out into
        // // a separate file - better for performance
        // // Default behaviour is to write all styles to the bundle destination where .js is replaced by .css
        // css({
        //     output: function (styles, _styleNodes, bundle) {
        //         // console.log(bundle);
        //         for (const file of Object.values(bundle)) {
        //             if (file.isEntry) {
        //                 let dest = file.fileName;
        //                 if (dest.endsWith(".js")) {
        //                     dest = dest.slice(0, -3);
        //                 }
        //                 dest = dest + ".css";
        //                 console.log(this);
        //                 writeFileSync(
        //                     path.join(path.resolve("."), outDir, dest),
        //                     styles
        //                 );
        //                 // this.emitFile({ type: 'asset', fileName: dest, source: css });
        //             }
        //         }
        //     },
        // }),
        postcss({
            extract: true,
            minimize: true,
            use: [
                [
                    "sass",
                    {
                        includePaths: ["./src/theme", "./node_modules"],
                    },
                ],
            ],
        }),
        // If you have external dependencies installed from
        // npm, you'll most likely need these plugins. In
        // some cases you'll need additional configuration -
        // consult the documentation for details:
        // https://github.com/rollup/plugins/tree/master/packages/commonjs
        resolve({
            browser: true,
            dedupe: ["svelte"],
        }),
        commonjs(),
        typescript({
            sourceMap: !production,
            inlineSources: !production,
        }),

        // In dev mode, call `npm run start` once
        // the bundle has been generated
        !production && serve(),

        // Watch the `public` directory and refresh the
        // browser on changes when not in production
        !production && livereload("public"),

        // If we're building for production (npm run build
        // instead of npm run dev), minify
        production && terser(),
        production && html(htmlOptions),
    ],
    watch: {
        clearScreen: false,
    },
};