//* try tp get errors
import * as path from "path";
import { compile, parseConfigFile } from './compiler';
import { Warning } from 'svelte/types/compiler/interfaces';
import chalk from 'chalk'
import * as ts from 'typescript'
import { existsSync, readdirSync } from "fs";
export { compile, parseConfigFile };


function reportDiagnostic(d: Warning) {
    let c = d.code.toLowerCase();
    let codeOutput = "info"
    if (c == "error") codeOutput = chalk`{red error}`
    if (c == "warning") codeOutput = chalk`{yellow error}`

    let output = chalk`{cyan ${d.filename}}{yellow :${d.start.line}:${d.start.column}} - ${codeOutput} ${d.message}\n\n`

    output += `${d.frame}\n\n`
    process.stdout.write(output);
}



//cli?
if (require.main === module) {
    let args = process.argv.slice(2);
    let srcPath = args.length && args[0] || "."
    srcPath = path.resolve(process.cwd(), srcPath);

    if (!existsSync(srcPath)) {
        console.error(`Couldn't find the provided path: ${srcPath}`);
        process.exit(1);
    }

    console.log(`Type checking source at: ${srcPath}`);

    //resolve config
    let compilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
    };

    const tsconfigPath = '' // ts.findConfigFile(srcPath, ts.sys.fileExists, 'tsconfig.json') ||
        //ts.findConfigFile(srcPath, ts.sys.fileExists, 'jsconfig.json') ||
        //'';

    const configJson = tsconfigPath && ts.readConfigFile(tsconfigPath, ts.sys.readFile).config;
    let files: string[] = [];
    if (configJson) {
        const parsedConfig = ts.parseJsonConfigFileContent(
            configJson,
            ts.sys,
            path.dirname(tsconfigPath),
            compilerOptions,
            tsconfigPath,
            undefined,
            [
                { extension: 'html', isMixedContent: true },
                { extension: 'svelte', isMixedContent: false, scriptKind: ts.ScriptKind.TSX },
            ],
        );
        files = parsedConfig.fileNames;
        compilerOptions = { ...compilerOptions, ...parsedConfig.options };
    } else {
        //we do all svelte files in the current directory
        files = readdirSync(srcPath).filter(f => f.endsWith(".svelte")).map(f => ts.sys.resolvePath(`${srcPath}/${f}`))
    }

    //we force some options
    let forcedOptions: ts.CompilerOptions = { 
        noEmit: true,
        declaration: false,
        jsx: ts.JsxEmit.Preserve,
        jsxFactory: "h",
        skipLibCheck: true
    }

    compilerOptions = { ...compilerOptions, ...forcedOptions }

    //we force our custom jsx definitions from svelte2tsx
    const svelte2TsxPath = path.dirname(require.resolve('svelte2tsx'))
    const svelteTsxFiles = ['./svelte-shims.d.ts', './svelte-jsx.d.ts'].map(f => ts.sys.resolvePath(path.resolve(svelte2TsxPath, f)));


    let diags = compile(compilerOptions, files.concat(svelteTsxFiles));
    diags.forEach(reportDiagnostic)
}