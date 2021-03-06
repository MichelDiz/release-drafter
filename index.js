const { getConfig } = require('./lib/config')
const { isTriggerableBranch } = require('./lib/triggerable-branch')
const {
  findReleases,
  generateReleaseInfo,
  createRelease,
  updateRelease
} = require('./lib/releases')
const { findCommitsWithAssociatedPullRequests } = require('./lib/commits')
const { sortPullRequests } = require('./lib/sort-pull-requests')
const log = require('./lib/log')
const core = require('@actions/core')


var fs = require('fs');
let path = './.github';

fs.readdir(path, function(err, items) {
    for (var i=0; i<items.length; i++) {
        var file = path + '/' + items[i];
        console.log("Start: " + file);
 
        fs.stat(file, function(err, stats) {
            console.log(file);
            console.log(stats["size"]);
        });
    }
});

fs.readFile('./.github/release-tmpl.yml', {encoding: 'utf-8'}, function(err,data){
    if (!err) {
        console.log('received data: ' + data);
    } else {
        console.log(err);
    }
});

fs.readFile('./.github/release-model.yml', {encoding: 'utf-8'}, function(err,data){
  if (!err) {
      console.log('received data: ' + data);
  } else {
      console.log(err);
  }
});

module.exports = app => {
  app.on('push', async context => {
    console.log("context default_branch at index =>", context.payload.repository.default_branch)

    // const newContext = {
    //   ...context,
    //   payload: { ...context.payload, repository: { default_branch: 'release/v20.4.0' } },
    //   config: context.config
    // }

    const config = await getConfig({
      app,
      context,
      configName: core.getInput('config-name')
    })
    console.log("config index =>", config)
    if (config === null) return

    // GitHub Actions merge payloads slightly differ, in that their ref points
    // to the PR branch instead of refs/heads/master
    const ref = process.env['GITHUB_REF'] || context.payload.ref
    console.log("ref=>", ref)
    const branch = ref.replace(/^refs\/heads\//, '')

    const flatten = arr => {
      return Array.prototype.concat(...arr)
    }
    const validBranches = flatten([config.branches])
    console.log("validBranches=>", validBranches)
    // if (!isTriggerableBranch({ branch, app, context, config })) {
    //   return
    // }

    const { draftRelease, lastRelease } = await findReleases({ app, context })
    const {
      commits,
      pullRequests: mergedPullRequests
    } = await findCommitsWithAssociatedPullRequests({
      app,
      context,
      branch,
      lastRelease
    })

    const sortedMergedPullRequests = sortPullRequests(
      mergedPullRequests,
      config['sort-by'],
      config['sort-direction']
    )

    const releaseInfo = generateReleaseInfo({
      commits,
      config,
      lastRelease,
      mergedPullRequests: sortedMergedPullRequests,
      version: core.getInput('version') || undefined,
      tag: core.getInput('tag') || undefined,
      name: core.getInput('name') || undefined
    })

    const shouldDraft = core.getInput('publish').toLowerCase() !== 'true'

    let createOrUpdateReleaseResponse
    if (!draftRelease) {
      log({ app, context, message: 'Creating new release' })
      createOrUpdateReleaseResponse = await createRelease({
        context,
        releaseInfo,
        shouldDraft,
        config
      })
    } else {
      log({ app, context, message: 'Updating existing release' })
      createOrUpdateReleaseResponse = await updateRelease({
        context,
        draftRelease,
        releaseInfo,
        shouldDraft,
        config
      })
    }

    setActionOutput(createOrUpdateReleaseResponse)
  })
}

function setActionOutput(releaseResponse) {
  const {
    data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl }
  } = releaseResponse
  if (releaseId && Number.isInteger(releaseId))
    core.setOutput('id', releaseId.toString())
  if (htmlUrl) core.setOutput('html_url', htmlUrl)
  if (uploadUrl) core.setOutput('upload_url', uploadUrl)
}
