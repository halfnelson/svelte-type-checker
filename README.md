# svelte-type-checker

When run as a script and provided a file glob, will type check all svelte/js/ts files in that glob (and all their dependencies).
Performs its magic using [svelte2tsx](https://github.com/halfnelson/svelte2tsx) and Typescript.

```
Usage: npx svelte-type-checker [options] [rootFilesGlob]

Runs the type checker over the files and their dependencies. [the glob defaults to ./**/*.svelte]

Options:
  -V, --version          output the version number
  -d --config-dir <dir>  tsconfig/jsconfig directory (default: "C:\\dev\\svelte\\svelte-type-checker")
  -e --emit-tsx          emit compiled .tsx file for debugging (default: false)
  -h, --help             output usage information

```

This is very new so feel free to lodge issues or pull requests.