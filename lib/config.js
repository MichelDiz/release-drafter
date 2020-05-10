const core = require('@actions/core')
const { validateSchema } = require('./schema')
const { DEFAULT_CONFIG } = require('./default-config')
const log = require('./log')
const { runnerIsActions } = require('./utils')
const Table = require('cli-table3')

const DEFAULT_CONFIG_NAME = 'release-drafter.yml'

module.exports.getConfig = async function getConfig({
  app,
  context,
  configName
}) {
  try {
    console.log("context.config at config js=>", context.config)
    const repoConfig = await context.config(
      configName || DEFAULT_CONFIG_NAME,
      DEFAULT_CONFIG
    )
    console.log("configName at config js=>", configName)
    console.log("repoConfig at config js=>", repoConfig)
    const config = validateSchema(app, context, repoConfig)
    console.log("config=>", repoConfig)
    return config
  } catch (error) {
    log({ app, context, error, message: 'Invalid config file' })

    if (error.isJoi) {
      log({
        app,
        context,
        message:
          'Config validation errors, please fix the following issues in release-drafter.yml:\n' +
          joiValidationErrorsAsTable(error)
      })
    }

    if (runnerIsActions()) {
      core.setFailed('Invalid config file')
    }
    return null
  }
}

function joiValidationErrorsAsTable(error) {
  const table = new Table({ head: ['Property', 'Error'] })
  error.details.forEach(({ path, message }) => {
    const prettyPath = path
      .map(pathPart =>
        Number.isInteger(pathPart) ? `[${pathPart}]` : pathPart
      )
      .join('.')
    table.push([prettyPath, message])
  })
  return table.toString()
}
