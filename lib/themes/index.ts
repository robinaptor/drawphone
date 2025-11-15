export interface Theme {
     id: string
     name: string
     emoji: string
     colors: {
       primary: string
       secondary: string
       accent: string
       background: string
       gradientFrom: string
       gradientVia: string
       gradientTo: string
       text: string
       cardBg: string
       buttonPrimary: string
       buttonSecondary: string
     }
     effects?: {
       snow?: boolean
       confetti?: boolean
       leaves?: boolean
       hearts?: boolean
     }
   }
   
   export const themes: Theme[] = [
     {
       id: 'default',
       name: 'Classic',
       emoji: '🎨',
       colors: {
         primary: '#A855F7',
         secondary: '#EC4899',
         accent: '#F59E0B',
         background: '#FFFFFF',
         gradientFrom: '#A855F7',
         gradientVia: '#EC4899',
         gradientTo: '#F97316',
         text: '#1F2937',
         cardBg: '#FFFFFF',
         buttonPrimary: 'from-purple-500 to-pink-500',
         buttonSecondary: 'from-green-500 to-blue-500'
       }
     },
     {
       id: 'dark',
       name: 'Dark Mode',
       emoji: '🌙',
       colors: {
         primary: '#8B5CF6',
         secondary: '#6366F1',
         accent: '#06B6D4',
         background: '#1F2937',
         gradientFrom: '#1F2937',
         gradientVia: '#374151',
         gradientTo: '#4B5563',
         text: '#F9FAFB',
         cardBg: '#374151',
         buttonPrimary: 'from-indigo-600 to-purple-600',
         buttonSecondary: 'from-cyan-600 to-blue-600'
       }
     },
     {
       id: 'christmas',
       name: 'Christmas',
       emoji: '🎄',
       colors: {
         primary: '#DC2626',
         secondary: '#16A34A',
         accent: '#EAB308',
         background: '#FFFFFF',
         gradientFrom: '#DC2626',
         gradientVia: '#16A34A',
         gradientTo: '#FFFFFF',
         text: '#1F2937',
         cardBg: '#FEF2F2',
         buttonPrimary: 'from-red-600 to-green-600',
         buttonSecondary: 'from-green-600 to-emerald-600'
       },
       effects: {
         snow: true
       }
     },
     {
       id: 'halloween',
       name: 'Halloween',
       emoji: '🎃',
       colors: {
         primary: '#F97316',
         secondary: '#7C3AED',
         accent: '#000000',
         background: '#1C1917',
         gradientFrom: '#F97316',
         gradientVia: '#7C3AED',
         gradientTo: '#000000',
         text: '#F97316',
         cardBg: '#292524',
         buttonPrimary: 'from-orange-600 to-purple-600',
         buttonSecondary: 'from-purple-600 to-black'
       }
     },
     {
       id: 'valentine',
       name: 'Valentine',
       emoji: '💝',
       colors: {
         primary: '#EC4899',
         secondary: '#F43F5E',
         accent: '#FBBF24',
         background: '#FFF1F2',
         gradientFrom: '#FDF2F8',
         gradientVia: '#FCE7F3',
         gradientTo: '#FEE2E2',
         text: '#881337',
         cardBg: '#FFFFFF',
         buttonPrimary: 'from-pink-500 to-rose-500',
         buttonSecondary: 'from-rose-500 to-pink-600'
       },
       effects: {
         hearts: true
       }
     },
     {
       id: 'summer',
       name: 'Summer',
       emoji: '🏖️',
       colors: {
         primary: '#06B6D4',
         secondary: '#FBBF24',
         accent: '#F97316',
         background: '#FFFBEB',
         gradientFrom: '#06B6D4',
         gradientVia: '#14B8A6',
         gradientTo: '#FBBF24',
         text: '#0C4A6E',
         cardBg: '#FFFFFF',
         buttonPrimary: 'from-cyan-500 to-teal-500',
         buttonSecondary: 'from-yellow-500 to-orange-500'
       }
     },
     {
       id: 'autumn',
       name: 'Autumn',
       emoji: '🍂',
       colors: {
         primary: '#D97706',
         secondary: '#DC2626',
         accent: '#CA8A04',
         background: '#FFFBEB',
         gradientFrom: '#DC2626',
         gradientVia: '#D97706',
         gradientTo: '#CA8A04',
         text: '#78350F',
         cardBg: '#FEF3C7',
         buttonPrimary: 'from-orange-600 to-red-600',
         buttonSecondary: 'from-amber-600 to-orange-600'
       },
       effects: {
         leaves: true
       }
     },
     {
       id: 'matrix',
       name: 'Matrix',
       emoji: '💚',
       colors: {
         primary: '#22C55E',
         secondary: '#16A34A',
         accent: '#4ADE80',
         background: '#000000',
         gradientFrom: '#000000',
         gradientVia: '#052e16',
         gradientTo: '#14532d',
         text: '#22C55E',
         cardBg: '#052e16',
         buttonPrimary: 'from-green-600 to-green-700',
         buttonSecondary: 'from-emerald-600 to-green-600'
       }
     },
     {
       id: 'ocean',
       name: 'Ocean',
       emoji: '🌊',
       colors: {
         primary: '#0EA5E9',
         secondary: '#06B6D4',
         accent: '#6366F1',
         background: '#F0F9FF',
         gradientFrom: '#0EA5E9',
         gradientVia: '#06B6D4',
         gradientTo: '#3B82F6',
         text: '#0C4A6E',
         cardBg: '#FFFFFF',
         buttonPrimary: 'from-sky-500 to-cyan-500',
         buttonSecondary: 'from-blue-500 to-indigo-500'
       }
     },
     {
       id: 'sunset',
       name: 'Sunset',
       emoji: '🌅',
       colors: {
         primary: '#F59E0B',
         secondary: '#EC4899',
         accent: '#8B5CF6',
         background: '#FFF7ED',
         gradientFrom: '#F59E0B',
         gradientVia: '#EC4899',
         gradientTo: '#8B5CF6',
         text: '#78350F',
         cardBg: '#FFFFFF',
         buttonPrimary: 'from-amber-500 to-pink-500',
         buttonSecondary: 'from-pink-500 to-purple-500'
       }
     }
   ]
   
   export const getTheme = (id: string): Theme => {
     return themes.find(t => t.id === id) || themes[0]
   }