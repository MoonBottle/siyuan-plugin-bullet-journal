import type { RegisteredSkill } from '@/skills'
import { defineStore } from 'pinia'
import {
  computed,
  ref,
} from 'vue'
import {
  getFile,
  putFile,
  readDir,
  removeFile,
} from '@/api'
import {
  SkillLoader,
  SkillRegistry,
} from '@/skills'

const PLUGIN_NAME = 'siyuan-plugin-bullet-journal'
const SKILLS_DIR = `/data/storage/petal/${PLUGIN_NAME}/skills`
const SKILL_STATES_KEY = 'aiSkills'

const registry = new SkillRegistry()
const registryVersion = ref(0)

export const useSkillStore = defineStore('skill', () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const skills = computed(() => {
    void registryVersion.value
    return registry.getAllSkills()
  })
  const enabledSkills = computed(() => {
    void registryVersion.value
    return registry.getEnabledSkills()
  })

  function isSkillNameExists(name: string): boolean {
    return registry.resolveSkill(name) !== undefined
  }

  function getSkillByName(name: string): RegisteredSkill | undefined {
    return registry.resolveSkill(name)
  }

  async function loadSkills(plugin: any) {
    isLoading.value = true
    error.value = null

    try {
      const readFileFn = async (path: string): Promise<string> => {
        const content = await getFile(path)
        if (content == null || content === '') {
          throw new Error(`File not found: ${path}`)
        }
        return typeof content === 'string' ? content : String(content)
      }

      const readdirFn = async (path: string): Promise<string[]> => {
        try {
          const entries = await readDir(path)
          if (!Array.isArray(entries)) return []
          return entries.filter((e: any) => e.isDir).map((e: any) => e.name)
        } catch {
          return []
        }
      }

      const loader = new SkillLoader(registry, readFileFn, readdirFn)

      await loader.loadFromDirectory(SKILLS_DIR)

      await restoreSkillStates(plugin)

      registryVersion.value++
    } catch (err) {
      console.error('[SkillStore] Failed to load skills:', err)
      error.value = (err as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function restoreSkillStates(plugin: any) {
    if (!plugin) return

    try {
      const data = await plugin.loadData?.(SKILL_STATES_KEY)
      if (data?.skills && Array.isArray(data.skills)) {
        for (const state of data.skills) {
          const skill = registry.resolveSkill(state.name)
          if (skill && state.enabled !== undefined) {
            skill.enabled = state.enabled
          }
        }
      }
    } catch (err) {
      console.error('[SkillStore] Failed to restore skill states:', err)
    }
  }

  function toggleSkillEnabled(name: string, enabled: boolean) {
    registry.toggleEnabled(name, enabled)
    registryVersion.value++
    saveToStorage()
  }

  function removeSkill(name: string) {
    const skill = registry.resolveSkill(name)
    if (skill && skill.source === 'user' && skill.filePath) {
      removeFile(skill.filePath).catch((err) => {
        console.error('[SkillStore] Failed to remove skill file:', err)
      })
    }
    registry.unregister(name)
    registryVersion.value++
    saveToStorage()
  }

  async function addSkill(skillData: {
    name: string
    description: string
    content: string
    version?: string
    author?: string
    tags?: string[]
    type?: 'prompt' | 'tool' | 'workflow'
    autoEnable?: boolean
  }) {
    const {
      name,
      description,
      content,
      version = '1.0.0',
      author = 'User',
      tags = [],
      type = 'prompt',
      autoEnable = true,
    } = skillData

    const skillDir = `${SKILLS_DIR}/${name}`
    const skillFilePath = `${skillDir}/SKILL.md`

    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      `version: ${version}`,
      `author: ${author}`,
      `tags: [${tags.join(', ')}]`,
      `type: ${type}`,
      '---',
      '',
    ].join('\n')

    const fullContent = frontmatter + content

    try {
      await putFile(skillFilePath, false, new Blob([fullContent], { type: 'text/markdown' }))
    } catch (err) {
      console.error('[SkillStore] Failed to write skill file:', err)
      throw err
    }

    const registered: RegisteredSkill = {
      name,
      description,
      version,
      author,
      tags,
      type,
      content,
      enabled: autoEnable,
      source: 'user',
      filePath: skillFilePath,
    }

    registry.register(registered)
    registryVersion.value++
    saveToStorage()
  }

  function saveToStorage() {
    const exportData = {
      skills: registry.getAllSkills().map((s) => ({
        name: s.name,
        enabled: s.enabled,
        source: s.source,
      })),
    }

    const event = new CustomEvent('skill-store-changed', {
      detail: exportData,
    })
    window.dispatchEvent(event)
  }

  async function loadFromPlugin(plugin: any) {
    await loadSkills(plugin)
  }

  async function saveToPlugin(plugin: any) {
    if (!plugin) return

    try {
      await plugin.saveData?.(SKILL_STATES_KEY, {
        skills: registry.getAllSkills().map((s) => ({
          name: s.name,
          enabled: s.enabled,
          source: s.source,
        })),
      })
    } catch (err) {
      console.error('[SkillStore] Failed to save:', err)
      error.value = (err as Error).message
    }
  }

  function getExportData() {
    return {
      skills: registry.getAllSkills().map((s) => ({
        name: s.name,
        enabled: s.enabled,
        source: s.source,
      })),
    }
  }

  return {
    skills,
    isLoading,
    error,
    enabledSkills,
    isSkillNameExists,
    getSkillByName,
    loadSkills,
    addSkill,
    removeSkill,
    toggleSkillEnabled,
    getExportData,
    loadFromPlugin,
    saveToPlugin,
  }
})
