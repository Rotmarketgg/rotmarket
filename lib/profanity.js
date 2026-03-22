// Profanity and content filter for RotMarket.gg

const BLOCKED_WORDS = [
  'nigger','nigga','nigg','chink','spic','kike','gook','wetback','beaner',
  'towelhead','cracker','coon','redskin','fag','faggot','dyke','tranny','retard',
  'fuck','fucker','fucking','fucked','shit','shitting','asshole','arse','arsehole',
  'bitch','bastard','cunt','cock','dick','pussy','porn','porno','nude','naked',
  'rape','rapist','molest','pedophile','pedo','kys','killurself',
  'cocaine','heroin','meth','mdma',
]

// Words that should only match as standalone words (not substrings like "cocktail", "scunthorpe")
const WORD_BOUNDARY_WORDS = new Set([
  'cock', 'dick', 'ass', 'arse', 'coon', 'fag', 'pedo', 'meth', 'nude', 'naked',
  'porn', 'porno', 'crack', 'cracker', 'bitch', 'shit', 'cunt',
])

const buildPattern = (word) => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const leet = escaped
    .replace(/a/g, '[a@4]')
    .replace(/e/g, '[e3]')
    .replace(/i/g, '[i1!]')
    .replace(/o/g, '[o0]')
    .replace(/s/g, '[s$5]')
    .replace(/t/g, '[t7]')
  // Use word boundaries for words that commonly appear as substrings
  const pattern = WORD_BOUNDARY_WORDS.has(word) ? `\\b${leet}\\b` : leet
  return new RegExp(pattern, 'gi')
}

const PATTERNS = BLOCKED_WORDS.map(w => ({ word: w, pattern: buildPattern(w) }))

export function checkProfanity(text) {
  if (!text || typeof text !== 'string') return { clean: true, matches: [] }
  const matches = []
  for (const { word, pattern } of PATTERNS) {
    if (pattern.test(text)) {
      matches.push(word)
      pattern.lastIndex = 0
    }
  }
  return { clean: matches.length === 0, matches }
}

export function isClean(text) {
  return checkProfanity(text).clean
}

export function validateContent(fields) {
  const errors = {}
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue
    const { clean } = checkProfanity(String(value))
    if (!clean) errors[field] = 'This field contains inappropriate language.'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateClean(text, fieldName = 'This field') {
  if (!text) return null
  const { clean } = checkProfanity(String(text))
  if (!clean) return `${fieldName} contains inappropriate language.`
  return null
}

export function censorText(text) {
  if (!text) return text
  let result = text
  for (const { pattern } of PATTERNS) {
    result = result.replace(pattern, (match) => '*'.repeat(match.length))
    pattern.lastIndex = 0
  }
  return result
}
