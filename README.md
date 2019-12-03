# svelte-type-checker

When run as a script and provided a file glob, will type check all svelte/js/ts files in that glob (and all their dependencies).
Performs its magic using [svelte2tsx](https://github.com/halfnelson/svelte2tsx) and Typescript.


![svelte-type-checker](https://raw.githubusercontent.com/halfnelson/svelte-type-checker/master/svelte-type-checker.gif)

__NOTE__ It has typescript as a `peerDependency` so you will need to have it installed for the code to function.

__NOTE__ Your Svelte components do not need to be typescript for this to run since typescript is a superset of javascript.

## Install

```sh
$ npm install --save-dev svelte-type-checker
```

## Usage

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
