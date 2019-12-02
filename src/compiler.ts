import svelte2tsx from 'svelte2tsx';
import * as ts from 'typescript';
import getCodeFrame from './from_svelte/code_frame'
import * as path from 'path';



type ProcessFileCallback = (filename: string, content: string) => void;

function createCompilerHost(configOptions: ts.CompilerOptions, onProcessFile:ProcessFileCallback): ts.CompilerHost {

    let original = ts.createCompilerHost(configOptions);

    function getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void) {
        let sourceText;
       // if (!fileName.endsWith(".d.ts")) console.log("processing "+fileName);
        if (fileName.endsWith(".svelte.tsx") || fileName.endsWith(".svelte")) {
            let originalName = fileName.endsWith(".svelte") ? fileName : fileName.substring(0, fileName.length - ".tsx".length);
            sourceText = ts.sys.readFile(originalName);
            if (!sourceText) {
                 if (onError) { 
                     onError("Couldn't find or read source file: '"+originalName+"'")
                 }
                 return undefined;
            }
            
            let output;
            try {
                output = svelte2tsx(sourceText);
            } catch (e) {
                console.error("error converting file ", fileName);
                throw e;
            }
            let srcFile = ts.createSourceFile(fileName, output.code, languageVersion);
            (srcFile as any).__svelte_map = output.map;
            (srcFile as any).__svelte_source = sourceText;

            onProcessFile(srcFile.fileName, output.code);
            
            return srcFile;
        }
        else {
            sourceText = ts.sys.readFile(fileName);
            if (sourceText) {
                let file = ts.createSourceFile(fileName, sourceText, languageVersion)
                onProcessFile(fileName, sourceText);
                return file;
            } 
            return  undefined;
        }
    }

    function resolveModuleNames(moduleNames: string[] , containingFile: string ): ts.ResolvedModule[] {
        return moduleNames.map(moduleName => {
            let lookupResult = ts.resolveModuleName(moduleName,containingFile, configOptions, { 
                fileExists: f => f.endsWith('.svelte.tsx') ? ts.sys.fileExists(f.substring(0, f.length - ".tsx".length)) : ts.sys.fileExists(f),
                readFile: ts.sys.readFile
            });
            if (lookupResult.resolvedModule) return lookupResult.resolvedModule;
            //try with .tsx extension
            if (moduleName.indexOf(".svelte") >= 0) {
                for(let loc of (lookupResult as any).failedLookupLocations) {
                    if (!loc.endsWith(".tsx")) continue;
                    let originalFile = loc.substring(0, loc.lastIndexOf(".tsx"));
                   
                    if (original.fileExists(originalFile)) {
                        return {
                            extension: ts.Extension.Tsx,
                            resolvedFileName: loc,
                            isExternalLibraryImport: originalFile.indexOf("node_modules") >=0,
                            packageId: null
                        } as ts.ResolvedModuleFull
                    }
                }
            }
           // if (moduleName.startsWith("@")) {
          //      console.log("could not find module", moduleName, (lookupResult as any).failedLookupLocations.filter(x => x.startsWith("C:/dev/svelte/svelte/site/node_modules")))
          //  }
            return undefined;
        })
    }
   

    
    return { ...original, getSourceFile, resolveModuleNames }
}

import { SourceMapConsumer } from 'source-map'
import { Warning } from 'svelte/types/compiler/interfaces';
import { SourceMap } from 'magic-string';

function getRelativeFileName(fileName: string): string {
    return path.relative(ts.sys.getCurrentDirectory(), fileName);
}

const categoryFormatMap = {
    [ts.DiagnosticCategory.Warning]: "Warning",
    [ts.DiagnosticCategory.Error]: "Error",
    [ts.DiagnosticCategory.Message]: "Info",
};


function transformDiagnostics(diagnostics: ts.Diagnostic[]): Warning[] {

    let consumers = new Map<ts.SourceFile, SourceMapConsumer>();

    function transformDiagnostic(diagnostic: ts.Diagnostic): Warning {

        if (diagnostic.file) {
            
            let start = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
            //these are 0 based, but we want 1 based to match sourcemap and editor etc
            start.character = start.character + 1;
            start.line = start.line + 1;
            let end = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start + diagnostic.length);
            end.character = end.character + 1;
            end.line = end.line + 1;

            let sourceMap = (diagnostic.file as any).__svelte_map as SourceMap;
            let relativeFileName = getRelativeFileName(diagnostic.file.fileName);
            let sourceText = diagnostic.file.text;

            if (sourceMap) {
                let decoder = consumers.get(diagnostic.file);
                if (!decoder) {
                    decoder = new SourceMapConsumer(sourceMap as any);
                    consumers.set(diagnostic.file, decoder);
                }
                //we know there is one per file, since we built it that way
                sourceText = (diagnostic.file as any).__svelte_source;

                for (let pos of [start, end]) {
                    if (pos.line == 0) {
                        console.log("invalid pos", start, end, diagnostic.start);
                    }
                    let res = decoder.originalPositionFor({ line: pos.line, column: pos.character })
                    
                    pos.line = res.line;
                    pos.character = res.column;
                }

                if (relativeFileName.endsWith(".svelte.tsx")) {
                    relativeFileName = relativeFileName.substring(0, relativeFileName.lastIndexOf(".tsx"))
                }
            }

            let warning: Warning = {
                code: categoryFormatMap[diagnostic.category],
                message: `TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine)}`,
                start: { line: start.line, column: start.character },
                end: { line: end.line, column: end.character },
                filename: relativeFileName,
                frame: getCodeFrame(sourceText, start.line, start.character, Math.max(start.line == end.line ? end.character - start.character: 1, 1) ) 
            }

            return warning;
        }
        return {
            code: categoryFormatMap[diagnostic.category],
            message: `TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine)}`,
            start: {line: 0, column: 0},
            end: { line:0, column: 0},
            filename: '(unknown)',
            frame: ""
        }
    }

    return diagnostics.map(transformDiagnostic)
}

export function compile(compilerOptions: ts.CompilerOptions, sourceFiles?: string[], onProcessFile?: ProcessFileCallback): Warning[] {

    //compile
    const host = createCompilerHost(compilerOptions, onProcessFile || (() => {}));
    const program = ts.createProgram(sourceFiles.map(s=> s.endsWith(".svelte") ? s+".tsx" : s), compilerOptions, host);

    //collect any errors
    let diagnostics: ts.Diagnostic[];
    // First get and report any syntactic errors.
    diagnostics = [...program.getSyntacticDiagnostics()];
    // If we didn't have any syntactic errors, then also try getting the global and
    // semantic errors.
    if (diagnostics.length === 0) {
        diagnostics = [...program.getOptionsDiagnostics().concat(program.getGlobalDiagnostics())];
        if (diagnostics.length === 0) {
            diagnostics = [...program.getSemanticDiagnostics()];
        }
    }

    return transformDiagnostics(diagnostics);
}
