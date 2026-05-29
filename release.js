import { exec } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'
import readline from 'node:readline'

const require = createRequire(import.meta.url)
const PluginInfo = require('./plugin.json')

const {
  version: currentVersion = '0.0.0',
} = PluginInfo

const SEMVER_RE = /^\d+\.\d+\.\d+$/
const VERSION_JSON_RE = /"version"\s*:\s*"[^"]+"/

function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number)
  return {
    major,
    minor,
    patch,
  }
}

function incrementVersion(version, type) {
  let {
    major,
    minor,
    patch,
  } = parseVersion(version)

  switch (type) {
    case 'major':
      major++
      minor = 0
      patch = 0
      break
    case 'minor':
      minor++
      patch = 0
      break
    case 'patch':
      patch++
      break
    default:
      break
  }

  return {
    major,
    minor,
    patch,
    version: `${major}.${minor}.${patch}`,
  }
}

function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close()
    resolve(answer)
  }))
}

const args = process.argv.slice(2)
const mode = args.find((arg) => arg.startsWith('--mode='))?.split('=')[1]



const main = async () => {
  try {

    console.log(`🌟  Current version: \x1B[36m${currentVersion}\x1B[0m\n`)

    // Calculate potential new versions for auto-update
    const newPatchVersion = incrementVersion(currentVersion, 'patch')
    const newMinorVersion = incrementVersion(currentVersion, 'minor')
    const newMajorVersion = incrementVersion(currentVersion, 'major')

    let newVersion
    if (mode) {
      switch (mode) {
        case 'manual':
          newVersion = await promptUser('✍️  Please enter the new version (in a.b.c format): ')
          break
        case 'major':
          newVersion = newMajorVersion.version
          break
        case 'minor':
          newVersion = newMinorVersion.version
          break
        case 'patch':
          newVersion = newPatchVersion.version
          break
      }
    } else {
      // Prompt the user with formatted options
      console.log('🔄  How would you like to update the version?\n')
      console.log(`  1️⃣  Auto update \x1B[33mpatch\x1B[0m version (new: ${newPatchVersion.major}.${newPatchVersion.minor}.\x1B[33m${newPatchVersion.patch}\x1B[0m) [1]`)
      console.log(`  2️⃣  Auto update \x1B[33mminor\x1B[0m version (new: ${newMinorVersion.major}.\x1B[33m${newMinorVersion.minor}.${newMinorVersion.patch}\x1B[0m) [2]`)
      console.log(`  3️⃣  Auto update \x1B[33mmajor\x1B[0m version (new: \x1B[33m${newMajorVersion.version}\x1B[0m) [3]`)
      console.log(`  4️⃣  Input version \x1B[33mmanually\x1B[0m [4]`)
      // Press 0 to skip version update
      console.log('  0️⃣  \x1B[33mQuit\x1B[0m without updating [0]\n')

      const updateChoice = await promptUser('👉  Please choose (\x1B[33m1\x1B[0m/2/3/4): ') || '1'
      switch (updateChoice.trim()) {
        case '1':
          newVersion = newPatchVersion.version
          break
        case '2':
          newVersion = newMinorVersion.version
          break
        case '3':
          newVersion = newMajorVersion.version
          break
        case '4':
          newVersion = await promptUser('✍️  Please enter the new version (in a.b.c format): ')
          break
        case '0':
          console.log('\n\x1B[90m🛑  Skipping version update.\x1B[0m')
          return
        default:
          console.log('\n\x1B[31m❌  Invalid option, no version update.\x1B[0m')
          return
      }
    }

    console.log(`🚀  Ready to release => v${newVersion}`)

    const isValid = SEMVER_RE.test(newVersion)
    if (!isValid) {
      console.log('\n\x1B[31m❌  Invalid version format.\x1B[0m')
      return
    }


    console.log('🔄  \x1B[90mUpdating plugin.json...\x1B[0m')
    const content = readFileSync('./plugin.json', 'utf8')
    const updated = content.replace(
      VERSION_JSON_RE,
      `"version": "${newVersion}"`,
    )
    writeFileSync('./plugin.json', updated, 'utf8')
    console.log('✅  plugin.json updated')

    console.log('🔄  \x1B[90mUpdating package.json...\x1B[0m')
    const packageContent = readFileSync('./package.json', 'utf8')
    const packageUpdated = packageContent.replace(
      VERSION_JSON_RE,
      `"version": "${newVersion}"`,
    )
    writeFileSync('./package.json', packageUpdated, 'utf8')
    console.log('✅  package.json updated')

    console.log('🔄  \x1B[90m Ready to commit new version and create tag...\x1B[0m')
    exec(
      `git add ./plugin.json ./package.json && git commit -m "chore: update version to ${newVersion}" && git push && git tag v${newVersion}`,
      (err, stdout) => {
        if (err) {
          console.error('\x1B[31m%s\x1B[0m', '❌  Error for adding and committing:', err)
          process.exit(1)
        }

        console.log('🔄  \x1B[90mTag Created, pushing...\x1B[0m')
        exec(`git push origin v${newVersion}`, (err) => {
          if (err) {
            console.error('\x1B[31m%s\x1B[0m', '❌  Error for pushing tag:', err)
            process.exit(1)
          }
          console.log(`\n✅  Version successfully updated to: \x1B[32m${newVersion}\x1B[0m\n`)
        })
      },
    )


  } catch (error) {
    console.error('\x1B[31m%s\x1B[0m', '❌  Error:', error)
  }
}
main()

