import 'source-map-support/register'
import { Warning } from 'svelte/types/compiler/interfaces';
import chalk from 'chalk'
import * as ts from 'typescript'
import * as path from 'path'
import { Command } from 'commander'
import { compile } from './compiler'
import glob from 'tiny-glob/sync'
import pkg from './../package.json';

export { compile } from  './compiler'


function reportDiagnostic(d: Warning) {
    let c = d.code.toLowerCase();
    let codeOutput = "info"
    if (c == "error") codeOutput = chalk`{red error}`
    if (c == "warning") codeOutput = chalk`{yellow error}`

    let output = chalk`{cyan ${d.filename}}{yellow :${d.start.line}:${d.start.column}} - ${codeOutput} ${d.message}\n\n`

    output += `${d.frame}\n\n`
    process.stdout.write(output);
}

function typeCheck(rootFilesGlob, tsconfigPath = null, emit = false) {
  

    //resolve config
    let compilerOptions: ts.CompilerOptions = {
        allowNonTsExtensions: true,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowJs: true,
    };

    
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

    } 
    
    //add our glob files
    let globFiles = glob(rootFilesGlob);
    files = files.concat(globFiles.map(f => ts.sys.resolvePath(`${process.cwd()}/${f}`)))
    

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

    let diags = compile(compilerOptions, files.concat(svelteTsxFiles), emit);
    diags.forEach(reportDiagnostic)
}

export function cli() {
    const program = new Command()
    program.version(pkg.version);

    program
        .description('Runs the type checker over the files and their dependencies. [the glob defaults to *.svelte]')
        .arguments('[rootFilesGlob]')
        .option('-d --config-dir <dir>', 'tsconfig/jsconfig directory', process.cwd())
        .option('-e --emit-tsx', 'emit compiled .tsx file for debugging', false)
        .action((rootFilesGlob, opts) => {
            let glob = rootFilesGlob || '*.svelte'
            console.log(chalk`\n{underline svelte-type-checker ${pkg.version}}\n\n{gray files:}\t\t${glob}`)

            if (opts.dir && !ts.sys.directoryExists(opts.dir)) {
                console.error(`Couldn't find the provided tsconfig directory: ${opts.dir}`);
                process.exit(1);
            }

            const tsConfigPath = !opts.dir ? null : ts.findConfigFile(opts.dir, ts.sys.fileExists, 'tsconfig.json') || ts.findConfigFile(opts.dir, ts.sys.fileExists, 'jsconfig.json') || null;

            console.log(chalk`{gray tsconfig:}\t${tsConfigPath || 'none'}\n\n`)

            typeCheck(glob, tsConfigPath, opts.emit)
        })

    program.parse(process.argv);
}



