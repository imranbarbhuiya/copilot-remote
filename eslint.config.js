import common from 'eslint-config-mahir/common';
import edge from 'eslint-config-mahir/edge';
import module from 'eslint-config-mahir/module';
import node from 'eslint-config-mahir/node';
import typescript from 'eslint-config-mahir/typescript';

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
export default [
	...common,
	...node,
	...typescript,
	...module,
	...edge,
	{
		ignores: ['.github', '.yarn', 'node_modules', 'dist'],
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.js'],
				},
			},
		},
	},
	{
		rules: {
			'id-length': 'off',
		},
	},
];
