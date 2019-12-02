let converter = require('../../index.js')
let fs = require('fs')
let assert = require('assert')
let path = require('path')
let ts = require('typescript')

describe('svelte2tsx', () => {

	let configFileOptions = {}
	before(() => {
			let configFilePath = path.resolve(__dirname, "./tsconfig.json")
			let configContents = ts.sys.readFile(configFilePath);
			const { config, error } = ts.parseConfigFileTextToJson(configFilePath, configContents);
			if (error) throw error;
			const configCommandline = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configFilePath));
			configFileOptions = configCommandline
	})

	fs.readdirSync(`${__dirname}/samples`).forEach(dir => {
		if (dir[0] === '.') return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo$/.test(dir);

		if (solo && process.env.CI) {
			throw new Error(
				`Forgot to remove '.solo' from test parser/samples/${dir}`
			);
		}

		(solo ? it.only : it)(dir, () => {
			let inputFiles = fs.readdirSync(`${__dirname}/samples/${dir}`)
								.filter(f => f.endsWith(".svelte") || f.endsWith(".ts") || f.endsWith(".js"))
								.map(f => `${__dirname}/samples/${dir}/${f}`)

			let diags = converter.compile(configFileOptions.options, configFileOptions.fileNames.concat(inputFiles))
			let expectedFile = `${__dirname}/samples/${dir}/expected.txt`

			let makeRelative = f => path.relative(`${__dirname}/samples/${dir}`, f);

			let checkDiags = diags.map(d => `${makeRelative(d.filename)}:${d.start.line}:${d.start.column} ${d.message}`).join("\n").replace(/\r\n/g,"\n");

			if (!fs.existsSync(expectedFile)) {
				fs.writeFileSync(expectedFile, checkDiags)
			}

			const expectedOutput = fs.readFileSync(expectedFile, 'utf-8').replace(/\r\n/g, "\n");
			
       		assert.equal(checkDiags, expectedOutput)
		});
	});
});