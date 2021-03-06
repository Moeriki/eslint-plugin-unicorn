'use strict';
const getDocumentationUrl = require('./utils/get-documentation-url');
const methodSelector = require('./utils/method-selector');

const message = 'Do not use leading/trailing space between `console.{{method}}` parameters.';

const methods = [
	'log',
	'debug',
	'info',
	'warn',
	'error'
];

const selector = methodSelector({
	names: methods,
	min: 1,
	object: 'console'
});

const getArgumentValue = (context, nodeArgument) => {
	let value = null;

	if (
		nodeArgument.type === 'Literal' &&
		typeof nodeArgument.value === 'string'
	) {
		value = nodeArgument.value;
	}

	if (nodeArgument.type === 'TemplateLiteral') {
		const sourceCode = context.getSourceCode();
		value = sourceCode.getText(nodeArgument);
		// Strip off backticks
		value = value.slice(1, -1);
	}

	return value;
};

const fixValue = (value, {
	fixLeading = true,
	fixTrailing = true
}) => {
	if (!value) {
		return value;
	}

	// Allow exactly one space
	if (value.length <= 1) {
		return value;
	}

	let fixed = value;

	// Find exactly one leading space
	if (fixLeading && fixed.startsWith(' ') && !fixed.startsWith('  ')) {
		fixed = fixed.slice(1);
	}

	// Find exactly one trailing space
	if (fixTrailing && fixed.endsWith(' ') && !fixed.endsWith('  ')) {
		fixed = fixed.slice(0, -1);
	}

	return fixed;
};

const getFixableArguments = (context, node) => {
	const {arguments: arguments_} = node;

	const fixables = arguments_.map((nodeArgument, i) => {
		const fixLeading = i !== 0;
		const fixTrailing = i !== arguments_.length - 1;

		const value = getArgumentValue(context, nodeArgument);
		const fixed = fixValue(value, {fixLeading, fixTrailing});

		return {
			nodeArgument,
			value,
			fixed,
			fixable: value !== fixed
		};
	});

	return fixables.filter(fixable => fixable.fixable);
};

const fixArgument = (context, fixable, fixer) => {
	const {nodeArgument, fixed} = fixable;

	// Ignore quotes and backticks
	const range = [
		nodeArgument.range[0] + 1,
		nodeArgument.range[1] - 1
	];

	return fixer.replaceTextRange(range, fixed);
};

const create = context => {
	return {
		[selector](node) {
			const method = node.callee.property.name;

			const fixables = getFixableArguments(context, node);
			for (const fixable of fixables) {
				context.report({
					node: fixable.nodeArgument,
					message,
					data: {method},
					fix: fixer => fixArgument(context, fixable, fixer)
				});
			}
		}
	};
};

module.exports = {
	create,
	meta: {
		type: 'suggestion',
		docs: {
			url: getDocumentationUrl(__filename)
		},
		fixable: 'code'
	}
};
