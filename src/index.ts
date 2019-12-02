import { Warning } from 'svelte/types/compiler/interfaces';
import chalk from 'chalk'
import * as ts from 'typescript'
import * as path from 'path'
import { Command } from 'commander'
import { compile } from './compiler'
import glob from 'glob'
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
        esModuleInterop: true,
        allowJs: true
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
    let resolvedGlobFiles = glob.sync(rootFilesGlob, { absolute: true });

    console.log(chalk`{gray Pattern:}\t${rootFilesGlob} ({yellow ${resolvedGlobFiles.length} files})`);
    if (!tsconfigPath) {
        console.log(chalk`{gray TsConfig:}\tnone\n`)
    } else {
        console.log(chalk`{gray TsConfig:}\t${tsconfigPath} ({yellow ${files.length} files})\n`)
    }
   


    files = files.concat(resolvedGlobFiles);
    

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

    process.stdout.write("Processing...");

    let processedCount = 0;

    const onProcessFile = (fileName: string, content: string) => {
        if (emit && fileName.endsWith(".svelte.tsx")) {
            ts.sys.writeFile(fileName, content);
        }
        if (processedCount % 5 == 0) process.stdout.write(".");
        processedCount++;
    }

    let diags = compile(compilerOptions, files.concat(svelteTsxFiles), onProcessFile);

    console.log('\n');
    diags.forEach(reportDiagnostic)

    console.log(chalk`Processed {yellow ${processedCount}} files:`)

    let warnings = diags.reduce((sum, d) => sum += (d.code == "Warning" ? 1 : 0), 0);
    let errors = diags.reduce((sum, d) => sum += (d.code == "Error" ? 1 : 0), 0);

    if (warnings || errors) {
        let errorPhrase = errors ? chalk`{red ${errors} errors}` : ``
        let warnPhrase = warnings ? chalk`{yellow ${warnings} warnings}`: ``
        console.log(chalk`  Found ${errorPhrase} ${(errors && warnings) ? 'and ': ''}${warnPhrase}\n`);
        
    } else {
        console.log(chalk`  Found {green 0 errors or warnings}\n`);
        process.exit(0) 
    }

    process.exit(warnings || errors ? 1 : 0); //inform the caller something is wrong
}

export function cli() {
    const program = new Command()
    program.version(pkg.version);

    program
        .description('Runs the type checker over the files and their dependencies. [the glob defaults to ./**/*.svelte]')
        .arguments('[rootFilesGlob]')
        .option('-d --config-dir <dir>', 'tsconfig/jsconfig directory', process.cwd())
        .option('-e --emit-tsx', 'emit compiled .tsx file for debugging', false)
        .action((rootFilesGlob, opts) => {
            let glob = rootFilesGlob || './**/*.svelte'
            console.log(chalk`\n{underline svelte-type-checker ${pkg.version}}\n`)

            if (opts.dir && !ts.sys.directoryExists(opts.dir)) {
                console.error(`Couldn't find the provided tsconfig directory: ${opts.dir}`);
                process.exit(1);
            }

            const tsConfigPath = !opts.dir ? null : ts.findConfigFile(opts.dir, ts.sys.fileExists, 'tsconfig.json') || ts.findConfigFile(opts.dir, ts.sys.fileExists, 'jsconfig.json') || null;

            typeCheck(glob, tsConfigPath, opts.emit)
        })

    program.parse(process.argv);
}



