/**
 * PromptService — per-source prompt management with variable injection.
 *
 * Each SourceConfig has a `config` JSON field that stores per-source prompt
 * configuration.  If no per-source prompt is set, the global default prompt
 * from AutomationSetting (`default_prompt`) is used as a fallback.
 */
import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SourcePromptConfig {
  systemPrompt: string
  extractionPrompt?: string
  generationPrompt?: string
  seoPrompt?: string
  version: number
  updatedAt: string
}

export const DEFAULT_SYSTEM_PROMPT = `তুমি একজন পেশাদার বাংলা কন্টেন্ট রাইটার এবং SEO বিশেষজ্ঞ।

নিচের উৎস কন্টেন্টের উপর ভিত্তি করে একটি পূর্ণাঙ্গ ব্লগ পোস্ট তৈরি করো।

কন্টেন্টটি পড়ে:
1. একটি আকর্ষণীয় শিরোনাম তৈরি করো
2. একটি SEO-অপ্টিমাইজড ব্লগ পোস্ট লিখো (বাংলায়, অন্তত ৫০০ শব্দ)
3. একটি সংক্ষিপ্ত সারসংক্ষেপ (excerpt) তৈরি করো (২-৩ বাক্য)
4. একটি SEO মেটা বর্ণনা তৈরি করো (১৫০-১৬০ অক্ষর)
5. ৫-৮টি প্রাসঙ্গিক ট্যাগ তৈরি করো

গুরুত্বপূর্ণ:
- ভাষা প্রাঞ্জল ও সহজবোধ্য হতে হবে
- শিক্ষার্থীদের জন্য উপযোগী করে লিখতে হবে
- তথ্যগুলো নির্ভুল ও মূল কন্টেন্টের সাথে সঙ্গতিপূর্ণ হতে হবে

ব্লগ পোস্ট কন্টেন্ট মার্কডাউন ফরম্যাটে লিখতে হবে। নিচের মার্কডাউন এলিমেন্টগুলো ব্যবহার করতে পারো:
- # heading 1 / ## heading 2 / ### heading 3 (শিরোনামের জন্য)
- **bold** এবং *italic* (টেক্সট ফরম্যাটিং)
- - বা * দিয়ে আনঅর্ডারড লিস্ট
- 1. 2. দিয়ে অর্ডারড লিস্ট
- > দিয়ে ব্লককোট
- \`\`\`language দিয়ে কোড ব্লক
- | কলাম১ | কলাম২ | দিয়ে টেবিল
- --- দিয়ে বিভাজক রেখা
- ![alt](url) দিয়ে ছবি
- [text](url) দিয়ে লিংক
- $...$ দিয়ে ইনলাইন ম্যাথ

শুধুমাত্র নিচের JSON ফরম্যাটে উত্তর দাও (কোনো অতিরিক্ত টেক্সট নয়):
{
  "title": "বাংলা শিরোনাম",
  "content": "সম্পূর্ণ ব্লগ পোস্ট (মার্কডাউন ফরম্যাটে, কোনো HTML নয়)",
  "excerpt": "সংক্ষিপ্ত সারসংক্ষেপ (২-৩ বাক্য)",
  "metaDescription": "SEO মেটা বর্ণনা (১৫০-১৬০ অক্ষর)",
  "tags": ["ট্যাগ১", "ট্যাগ২", "ট্যাগ৩"]
}`

/* ------------------------------------------------------------------ */
/*  Prompt variable helpers                                            */
/* ------------------------------------------------------------------ */

export interface PromptVariables {
  organization: string
  title: string
  content: string
  url: string
  publish_date: string
  deadline: string
  source_name: string
  today: string
  language: string
}

export function buildPromptVariables(opts?: Partial<PromptVariables>): PromptVariables {
  const today = new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    organization: opts?.organization || 'N/A',
    title: opts?.title || 'N/A',
    content: opts?.content || '',
    url: opts?.url || 'N/A',
    publish_date: opts?.publish_date || today,
    deadline: opts?.deadline || 'N/A',
    source_name: opts?.source_name || 'N/A',
    today,
    language: opts?.language || 'bn',
  }
}

/**
 * Replace all {{variable}} placeholders in a prompt string.
 */
export function injectVariables(template: string, vars: PromptVariables): string {
  return template
    .replace(/\{\{organization\}\}/g, vars.organization)
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{content\}\}/g, vars.content)
    .replace(/\{\{url\}\}/g, vars.url)
    .replace(/\{\{publish_date\}\}/g, vars.publish_date)
    .replace(/\{\{deadline\}\}/g, vars.deadline)
    .replace(/\{\{source_name\}\}/g, vars.source_name)
    .replace(/\{\{today\}\}/g, vars.today)
    .replace(/\{\{language\}\}/g, vars.language)
}

/* ------------------------------------------------------------------ */
/*  Read per-source prompt config                                      */
/* ------------------------------------------------------------------ */

export async function getSourcePromptConfig(sourceId: string): Promise<SourcePromptConfig | null> {
  const source = await db.sourceConfig.findUnique({
    where: { id: sourceId },
    select: { config: true, name: true, updatedAt: true },
  })
  if (!source) return null
  if (!source.config) return null

  try {
    const parsed = JSON.parse(source.config)
    if (parsed && parsed.systemPrompt) {
      return {
        systemPrompt: parsed.systemPrompt,
        extractionPrompt: parsed.extractionPrompt || undefined,
        generationPrompt: parsed.generationPrompt || undefined,
        seoPrompt: parsed.seoPrompt || undefined,
        version: parsed.version || 1,
        updatedAt: parsed.updatedAt || source.updatedAt?.toISOString() || new Date().toISOString(),
      }
    }
  } catch {
    // config is not valid JSON - ignore
  }
  return null
}

/**
 * Get the effective system prompt for a source.
 * Priority: per-source prompt → global default_prompt → hardcoded DEFAULT_SYSTEM_PROMPT
 */
export async function getEffectiveSystemPrompt(
  sourceId?: string,
  manualPrompt?: string,
): Promise<{ systemPrompt: string; source: string }> {
  // 1. Try per-source prompt
  if (sourceId) {
    const sourcePrompt = await getSourcePromptConfig(sourceId)
    if (sourcePrompt?.systemPrompt) {
      return {
        systemPrompt: manualPrompt
          ? `${sourcePrompt.systemPrompt}\n\nঅতিরিক্ত নির্দেশনা: ${manualPrompt}`
          : sourcePrompt.systemPrompt,
        source: `${sourceId} (per-source)`,
      }
    }
  }

  // 2. Fall back to global default_prompt setting
  const globalSetting = await db.automationSetting.findUnique({ where: { key: 'default_prompt' } })
  if (globalSetting?.value) {
    return {
      systemPrompt: manualPrompt
        ? `${globalSetting.value}\n\nঅতিরিক্ত নির্দেশনা: ${manualPrompt}`
        : globalSetting.value,
      source: 'global (default_prompt)',
    }
  }

  // 3. Fall back to hardcoded default
  return {
    systemPrompt: manualPrompt
      ? `${DEFAULT_SYSTEM_PROMPT}\n\nঅতিরिक্ত নির্দেশনা: ${manualPrompt}`
      : DEFAULT_SYSTEM_PROMPT,
    source: 'hardcoded default',
  }
}

/**
 * Get the list of supported variables for the UI editor hint.
 */
export function getSupportedVariables(): Array<{ key: string; description: string }> {
  return [
    { key: '{{organization}}', description: 'সংস্থার নাম' },
    { key: '{{title}}', description: 'কন্টেন্টের শিরোনাম' },
    { key: '{{content}}', description: 'কন্টেন্টের মূল অংশ' },
    { key: '{{url}}', description: 'সোর্স URL' },
    { key: '{{publish_date}}', description: 'প্রকাশের তারিখ' },
    { key: '{{deadline}}', description: 'আবেদনের শেষ তারিখ' },
    { key: '{{source_name}}', description: 'সোর্সের নাম' },
    { key: '{{today}}', description: 'আজকের তারিখ' },
    { key: '{{language}}', description: 'ভাষা' },
  ]
}
