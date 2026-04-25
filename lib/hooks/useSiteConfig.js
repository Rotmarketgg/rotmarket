'use client'

import { useState, useEffect } from 'react'
import {
  fetchSiteConfig,
  DEFAULT_GAMES,
  DEFAULT_RARITIES,
  DEFAULT_PAYMENT_METHODS,
} from '@/lib/constants'

const DEFAULT_CONFIG = {
  games: DEFAULT_GAMES,
  rarities: DEFAULT_RARITIES,
  payment_methods: DEFAULT_PAYMENT_METHODS,
}

/**
 * useSiteConfig() — fetches the admin-managed games/rarities/payments config.
 * Falls back to static defaults while loading or if the API fails.
 *
 * Returns { config, loading }
 *   config.games           — active games (filtered by enabled: true)
 *   config.allGames        — all games including disabled ones
 *   config.rarities        — active rarities per game
 *   config.allRarities     — all rarities per game
 *   config.payment_methods — active payment methods
 *   config.allPaymentMethods — all payment methods
 */
export function useSiteConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSiteConfig()
      .then(cfg => {
        setConfig(cfg)
        setLoading(false)
      })
      .catch(() => {
        setConfig(DEFAULT_CONFIG)
        setLoading(false)
      })
  }, [])

  const activeGames = (config.games || DEFAULT_GAMES).filter(g => g.enabled !== false)
  const activePayments = (config.payment_methods || DEFAULT_PAYMENT_METHODS).filter(p => p.enabled !== false)

  // Filter rarities: only enabled ones per game
  const activeRarities = {}
  const allRarities = config.rarities || DEFAULT_RARITIES
  for (const gameId of Object.keys(allRarities)) {
    activeRarities[gameId] = (allRarities[gameId] || []).filter(r => r.enabled !== false)
  }

  return {
    loading,
    config: {
      games: activeGames,
      allGames: config.games || DEFAULT_GAMES,
      rarities: activeRarities,
      allRarities,
      payment_methods: activePayments,
      allPaymentMethods: config.payment_methods || DEFAULT_PAYMENT_METHODS,
    },
  }
}
