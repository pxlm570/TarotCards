import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(url && anonKey)
export const inviteGateRequired = import.meta.env.VITE_REQUIRE_INVITE === 'true'
export const defaultAIEnabled = import.meta.env.VITE_DEFAULT_AI_ENABLED === 'true'
// 自定义 AI 入口开关（2026-09-25 用户拍板：所有用户统一用项目提供的 LLM，暂时
// 不开放自定义配置）。未设变量时视为允许——保持本地开发/静态版原行为；部署
// 环境显式设 VITE_ALLOW_CUSTOM_AI=false 隐藏入口。代码保留，将来放开只需改变量。
export const customAIAllowed = import.meta.env.VITE_ALLOW_CUSTOM_AI !== 'false'
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { auth: { autoRefreshToken: true, persistSession: true } })
  : null
