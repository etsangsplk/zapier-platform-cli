/*eslint no-process-exit: 0 */
require('babel-polyfill');

const _ = require('lodash');
const colors = require('colors/safe');

const {DEBUG, PLATFORM_PACKAGE} = require('./constants');
const commands = require('./commands');
const utils = require('./utils');

module.exports = (argv) => {
  process.on('exit', utils.clearSpinner);
  process.on('SIGINT', () => {
    utils.clearSpinner();
    process.exit();
  });

  if (!utils.isValidNodeVersion()) {
    console.error(colors.red(
      `Requires node version >= ${utils.readNvmVersion()}, found ${process.versions.node}. Please upgrade node.`
    ));
    process.exit(1);
  }

  if (DEBUG) {
    console.log('running in:', process.cwd());
    console.log('raw argv:', argv);
    console.log('\n--------------------------------------------------\n\n');
  }

  argv = argv.slice(2); // strip path, zapier.js

  let [args, argOpts] = utils.argParse(argv);
  global.argOpts = argOpts;

  // when `zapier invitees --help`, swap to `zapier help invitees`
  if (argOpts.help || args.length === 0) {
    args = ['help'].concat(args);
  }

  const command = args[0];
  args = args.slice(1);

  // create the context, logs thread through this
  const context = utils.createContext({command, args, argOpts});

  if (argOpts.version || argOpts.v) {
    context.line([
      `zapier-platform-cli/${require('../package.json').version}`,
      `node/${process.version}`,
    ].join('\n'));
    return;
  }

  let commandFunc = commands[command];
  if (!commandFunc) {
    context.line(`\`zapier ${command}\` is not a command! Try running \`zapier help\`?`);
    return;
  }

  if (!utils.isValidAppInstall(command)) {
    console.error(colors.red(
      `Looks like your package.json is missing ${PLATFORM_PACKAGE} or you haven't run npm install yet!`
    ));
    process.exit(1);
  }

  const spec = {
    argsSpec: commandFunc.argsSpec,
    argOptsSpec: _.extend({}, utils.globalArgOptsSpec, commandFunc.argOptsSpec)
  };
  const errors = utils.enforceArgSpec(spec, args, argOpts);
  if (errors.length) {
    utils.clearSpinner();
    context.line();
    context.line(colors.red('Errors running command `' + ['zapier'].concat(argv).join(' ') + '`:'));
    context.line();
    errors.forEach((error) => context.line(colors.red(`!!!   ${error}`)));
    context.line();
    context.line(`For more information, run \`zapier help ${command}\`.`);
    context.line();
    process.exit(1);
  }

  commandFunc.apply(commands, [context].concat(args))
    .then(() => {
      utils.clearSpinner();
    })
    .catch((err) => {
      utils.clearSpinner();
      if (DEBUG || global.argOpts.debug) {
        context.line();
        context.line(err.stack);
        context.line();
        context.line(colors.red('Error!'));
      } else {
        context.line();
        context.line();
        context.line(colors.red('Error!') + ' ' + colors.red(err.message));
        context.line(colors.grey('(Use --debug flag and run this command again to get more details.)'));
      }
      process.exit(1);
    });
};
